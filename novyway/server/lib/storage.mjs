import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import pg from 'pg'
import { backupRoot, databaseConfigPath, postgresBin, secretsRoot } from './runtime-paths.mjs'

export { backupRoot, secretsRoot }

function loadDatabaseConfig() {
  if (!existsSync(databaseConfigPath)) {
    throw new Error(`PostgreSQL is not configured. Run server\\Setup-PostgreSQL.ps1 first: ${databaseConfigPath}`)
  }
  return JSON.parse(readFileSync(databaseConfigPath, 'utf8').replace(/^\uFEFF/, ''))
}

const config = loadDatabaseConfig()
export const databasePath = `postgresql://${config.user}@${config.host}:${config.port}/${config.database}`
export const pool = new pg.Pool({
  host: config.host,
  port: config.port,
  database: config.database,
  user: config.user,
  password: config.password,
  ssl: config.ssl ? { rejectUnauthorized: true } : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'sovet-online',
})

const now = () => new Date().toISOString()

export function hashSecret(value) {
  return createHash('sha256').update(value).digest('hex')
}

export async function initializeStorage() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sovet_online_schema'))")
    await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      aptos_address text NOT NULL UNIQUE,
      display_name text,
      email text,
      telegram text,
      email_verified boolean NOT NULL DEFAULT false,
      provider text NOT NULL CHECK (provider IN ('google', 'apple', 'wallet')),
      role text NOT NULL DEFAULT 'voter',
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL,
      last_login_at timestamptz NOT NULL
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_kind text NOT NULL DEFAULT 'external';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_private_key text;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_provider_check;
    ALTER TABLE users ADD CONSTRAINT users_provider_check CHECK (provider IN ('email', 'google', 'apple', 'wallet'));
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_wallet_kind_check;
    ALTER TABLE users ADD CONSTRAINT users_wallet_kind_check CHECK (wallet_kind IN ('managed', 'keyless', 'external'));

    CREATE TABLE IF NOT EXISTS auth_identities (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider text NOT NULL CHECK (provider IN ('email', 'google', 'apple', 'wallet')),
      subject text NOT NULL,
      email text,
      created_at timestamptz NOT NULL,
      last_used_at timestamptz NOT NULL,
      UNIQUE(provider, subject)
    );

    CREATE TABLE IF NOT EXISTS user_wallets (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      aptos_address text NOT NULL UNIQUE,
      kind text NOT NULL CHECK (kind IN ('managed', 'keyless', 'external')),
      provider text NOT NULL CHECK (provider IN ('email', 'google', 'apple', 'wallet')),
      is_primary boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose text NOT NULL CHECK (purpose IN ('register', 'change_email_new', 'change_email_old', 'password_reset')),
      target_email text NOT NULL,
      code_hash text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      parent_verification_id uuid REFERENCES email_verifications(id) ON DELETE SET NULL
    );
    ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS parent_verification_id uuid REFERENCES email_verifications(id) ON DELETE SET NULL;
    ALTER TABLE email_verifications DROP CONSTRAINT IF EXISTS email_verifications_purpose_check;
    ALTER TABLE email_verifications ADD CONSTRAINT email_verifications_purpose_check
      CHECK (purpose IN ('register', 'change_email_new', 'change_email_old', 'password_reset'));
    CREATE INDEX IF NOT EXISTS email_verifications_lookup_idx
      ON email_verifications (user_id, purpose, target_email, created_at DESC)
      WHERE consumed_at IS NULL;

    CREATE TABLE IF NOT EXISTS pending_registrations (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      display_name text NOT NULL,
      password_hash text NOT NULL,
      aptos_address text NOT NULL,
      encrypted_private_key text NOT NULL,
      code_hash text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      expires_at timestamptz NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pending_registrations_email_unique
      ON pending_registrations(LOWER(email));
    CREATE INDEX IF NOT EXISTS pending_registrations_expiry_idx
      ON pending_registrations(expires_at);

    CREATE TABLE IF NOT EXISTS auth_challenges (
      id uuid PRIMARY KEY,
      nonce text NOT NULL UNIQUE,
      expected_json jsonb NOT NULL,
      provider_hint text,
      created_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz
    );
    ALTER TABLE auth_challenges ADD COLUMN IF NOT EXISTS link_user_id uuid REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE auth_challenges ADD COLUMN IF NOT EXISTS link_session_hash text;
    ALTER TABLE auth_challenges ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'sign_in';
    ALTER TABLE auth_challenges DROP CONSTRAINT IF EXISTS auth_challenges_purpose_check;
    ALTER TABLE auth_challenges ADD CONSTRAINT auth_challenges_purpose_check
      CHECK (purpose IN ('sign_in', 'link', 'activate'));

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_hash text NOT NULL,
      created_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL
    );
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'legacy';
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_address text;

    CREATE TABLE IF NOT EXISTS vote_intents (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      idempotency_key uuid NOT NULL,
      sender_address text NOT NULL,
      election_id bigint NOT NULL,
      yes_bps integer NOT NULL CHECK (yes_bps BETWEEN 0 AND 10000),
      no_bps integer NOT NULL CHECK (no_bps BETWEEN 0 AND 10000),
      abstain_bps integer NOT NULL CHECK (abstain_bps BETWEEN 0 AND 10000),
      raw_transaction_b64 text NOT NULL,
      status text NOT NULL,
      tx_hash text,
      error_code text,
      created_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      submitted_at timestamptz,
      confirmed_at timestamptz,
      UNIQUE(user_id, idempotency_key),
      CHECK (yes_bps + no_bps + abstain_bps = 10000)
    );
    ALTER TABLE vote_intents ADD COLUMN IF NOT EXISTS intent_kind text NOT NULL DEFAULT 'weighted_vote';
    ALTER TABLE vote_intents DROP CONSTRAINT IF EXISTS vote_intents_intent_kind_check;
    ALTER TABLE vote_intents ADD CONSTRAINT vote_intents_intent_kind_check
      CHECK (intent_kind IN ('weighted_vote', 'admin_equal_vote'));

    CREATE TABLE IF NOT EXISTS settings (
      key text PRIMARY KEY,
      value_json jsonb NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ops_events (
      id uuid PRIMARY KEY,
      kind text NOT NULL,
      severity text NOT NULL,
      message text NOT NULL,
      details_json jsonb,
      created_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uptime_samples (
      sampled_at timestamptz PRIMARY KEY,
      public_ok boolean NOT NULL,
      aptos_ok boolean NOT NULL,
      latency_ms integer,
      users_total integer NOT NULL,
      sessions_active integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backups (
      id uuid PRIMARY KEY,
      path text NOT NULL,
      bytes bigint NOT NULL,
      sha256 text NOT NULL,
      created_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logic_game_rounds (
      token_hash text PRIMARY KEY,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      challenge_id text NOT NULL,
      lang text NOT NULL CHECK (lang IN ('ru', 'en')),
      created_at timestamptz NOT NULL DEFAULT NOW(),
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS logic_game_attempts (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id text NOT NULL,
      selected_index smallint NOT NULL CHECK (selected_index BETWEEN 0 AND 7),
      is_correct boolean NOT NULL,
      points_awarded smallint NOT NULL CHECK (points_awarded IN (0, 10, 20, 30)),
      answered_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, challenge_id)
    );

    CREATE TABLE IF NOT EXISTS logic_game_profiles (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
      answered_count integer NOT NULL DEFAULT 0 CHECK (answered_count >= 0),
      correct_count integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
      current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
      best_streak integer NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS challenges_expiry_idx ON auth_challenges(expires_at);
    CREATE INDEX IF NOT EXISTS vote_intents_user_idx ON vote_intents(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS ops_events_created_idx ON ops_events(created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email)) WHERE email IS NOT NULL;
    CREATE INDEX IF NOT EXISTS auth_identities_user_idx ON auth_identities(user_id);
    CREATE INDEX IF NOT EXISTS user_wallets_user_idx ON user_wallets(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS user_wallets_one_primary_per_user_idx
      ON user_wallets(user_id) WHERE is_primary;
    CREATE INDEX IF NOT EXISTS email_verifications_lookup_idx ON email_verifications(user_id, purpose, created_at DESC);
    CREATE INDEX IF NOT EXISTS logic_game_rounds_expiry_idx ON logic_game_rounds(expires_at);
    CREATE INDEX IF NOT EXISTS logic_game_attempts_user_idx ON logic_game_attempts(user_id, answered_at DESC);
  `)
    await client.query(`INSERT INTO user_wallets (id, user_id, aptos_address, kind, provider, is_primary, created_at)
    SELECT gen_random_uuid(), id, aptos_address,
      CASE WHEN wallet_kind IN ('managed', 'keyless', 'external') THEN wallet_kind ELSE 'external' END,
      provider, true, created_at FROM users
    ON CONFLICT (aptos_address) DO NOTHING`)
    await client.query(`INSERT INTO schema_migrations (version, applied_at)
      VALUES (20260717, NOW()), (2026071701, NOW()) ON CONFLICT (version) DO NOTHING`)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function closeStorage() {
  await pool.end()
}

export async function putChallenge({ nonce, expected, providerHint, purpose = 'sign_in', linkUserId = null, linkSessionHash = null }) {
  const id = randomUUID()
  await pool.query(`INSERT INTO auth_challenges
    (id, nonce, expected_json, provider_hint, purpose, link_user_id, link_session_hash, created_at, expires_at)
    VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)`,
  [id, nonce, JSON.stringify(expected), providerHint ?? null, purpose, linkUserId, linkSessionHash, now(), expected.expirationTime])
  return id
}

export async function consumeChallenge(nonce) {
  const { rows } = await pool.query(`UPDATE auth_challenges
    SET consumed_at = NOW()
    WHERE nonce = $1 AND consumed_at IS NULL AND expires_at > NOW()
    RETURNING *`, [nonce])
  const row = rows[0]
  return row ? { ...row, expected: row.expected_json } : null
}

export async function upsertUser({ aptosAddress, provider }) {
  const address = aptosAddress.toLowerCase()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query(`SELECT u.* FROM users u
      LEFT JOIN user_wallets w ON w.user_id = u.id
      WHERE LOWER(u.aptos_address) = $1 OR LOWER(w.aptos_address) = $1 LIMIT 1`, [address])
    let user = existing.rows[0]
    if (!user) {
      const id = randomUUID()
      const walletKind = provider === 'wallet' ? 'external' : 'keyless'
      const inserted = await client.query(`INSERT INTO users
        (id, aptos_address, provider, wallet_kind, created_at, last_login_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`, [id, address, provider, walletKind])
      user = inserted.rows[0]
      await client.query(`INSERT INTO user_wallets
        (id, user_id, aptos_address, kind, provider, is_primary, created_at)
        VALUES ($1, $2, $3, $4, $5, true, NOW())`, [randomUUID(), id, address, walletKind, provider])
    } else {
      if (user.status !== 'active') throw Object.assign(new Error('account_not_active'), { status: 403 })
      const updated = await client.query('UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *', [user.id])
      user = updated.rows[0]
    }
    const identity = await client.query(`INSERT INTO auth_identities
      (id, user_id, provider, subject, created_at, last_used_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (provider, subject) DO UPDATE SET last_used_at = NOW()
      WHERE auth_identities.user_id = EXCLUDED.user_id
      RETURNING user_id`, [randomUUID(), user.id, provider, address])
    if (!identity.rows[0] || identity.rows[0].user_id !== user.id) {
      throw Object.assign(new Error('identity_already_linked'), { status: 409 })
    }
    await client.query('COMMIT')
    return user
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getUserByAptosAddress(aptosAddress) {
  const address = aptosAddress.toLowerCase()
  const { rows } = await pool.query(`SELECT u.* FROM users u
    WHERE LOWER(u.aptos_address) = $1
      OR EXISTS (SELECT 1 FROM user_wallets w WHERE w.user_id = u.id AND LOWER(w.aptos_address) = $1)
    LIMIT 1`, [address])
  return rows[0] ?? null
}

export async function linkAptosIdentity({ userId, aptosAddress, provider, makePrimary = false }) {
  const address = aptosAddress.toLowerCase()
  const walletKind = provider === 'wallet' ? 'external' : 'keyless'
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const occupied = await client.query('SELECT user_id FROM user_wallets WHERE LOWER(aptos_address) = $1', [address])
    if (occupied.rows[0] && occupied.rows[0].user_id !== userId) throw Object.assign(new Error('wallet_already_linked'), { status: 409 })
    if (makePrimary) await client.query('UPDATE user_wallets SET is_primary = false WHERE user_id = $1', [userId])
    const linkedWallet = await client.query(`INSERT INTO user_wallets (id, user_id, aptos_address, kind, provider, is_primary, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (aptos_address) DO UPDATE SET is_primary = EXCLUDED.is_primary
      WHERE user_wallets.user_id = EXCLUDED.user_id
      RETURNING user_id`,
    [randomUUID(), userId, address, walletKind, provider, makePrimary])
    if (!linkedWallet.rows[0] || linkedWallet.rows[0].user_id !== userId) {
      throw Object.assign(new Error('wallet_already_linked'), { status: 409 })
    }
    const linkedIdentity = await client.query(`INSERT INTO auth_identities (id, user_id, provider, subject, created_at, last_used_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (provider, subject) DO UPDATE SET last_used_at = NOW()
      WHERE auth_identities.user_id = EXCLUDED.user_id
      RETURNING user_id`, [randomUUID(), userId, provider, address])
    if (!linkedIdentity.rows[0] || linkedIdentity.rows[0].user_id !== userId) {
      throw Object.assign(new Error('identity_already_linked'), { status: 409 })
    }
    if (makePrimary) await client.query(`UPDATE users SET aptos_address = $1, wallet_kind = $2 WHERE id = $3`, [address, walletKind, userId])
    const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [userId])
    await client.query('COMMIT')
    return rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function activateAptosIdentity({ userId, aptosAddress, provider }) {
  const address = aptosAddress.toLowerCase()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(`SELECT u.* FROM users u
      WHERE u.id = $1 AND u.status = 'active'
        AND EXISTS (SELECT 1 FROM user_wallets w
          WHERE w.user_id = u.id AND LOWER(w.aptos_address) = $2)
        AND EXISTS (SELECT 1 FROM auth_identities i
          WHERE i.user_id = u.id AND i.provider = $3 AND LOWER(i.subject) = $2)
      FOR UPDATE`, [userId, address, provider])
    const user = rows[0]
    if (!user) throw Object.assign(new Error('linked_sign_in_method_required'), { status: 403 })
    await client.query(`UPDATE auth_identities SET last_used_at = NOW()
      WHERE user_id = $1 AND provider = $2 AND LOWER(subject) = $3`, [userId, provider, address])
    await client.query('COMMIT')
    return user
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateProfile(userId, { displayName, telegram }) {
  const { rows } = await pool.query(`UPDATE users SET display_name = $1, telegram = $2
    WHERE id = $3 RETURNING *`, [displayName ?? null, telegram ?? null, userId])
  return rows[0]
}

export async function putPendingRegistration({ id, email, displayName, passwordHash, aptosAddress, encryptedPrivateKey, codeHash, expiresAt }) {
  const normalizedEmail = email.trim().toLowerCase()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [normalizedEmail])
    if (existing.rows[0]) throw Object.assign(new Error('email_already_registered'), { status: 409 })
    await client.query('DELETE FROM pending_registrations WHERE LOWER(email) = $1', [normalizedEmail])
    await client.query(`INSERT INTO pending_registrations
      (id, email, display_name, password_hash, aptos_address, encrypted_private_key, code_hash, attempts, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, NOW(), $8)`,
    [id, normalizedEmail, displayName, passwordHash, aptosAddress.toLowerCase(), encryptedPrivateKey, codeHash, expiresAt])
    await client.query('COMMIT')
    return { id, email: normalizedEmail }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getPendingRegistration(email) {
  const { rows } = await pool.query(`SELECT * FROM pending_registrations
    WHERE LOWER(email) = LOWER($1) AND expires_at > NOW() LIMIT 1`, [email])
  return rows[0] ?? null
}

export async function deletePendingRegistration(id) {
  await pool.query('DELETE FROM pending_registrations WHERE id = $1', [id])
}

export async function consumePendingRegistration({ id, email, codeHash }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pendingResult = await client.query(`SELECT * FROM pending_registrations
      WHERE id = $1 AND LOWER(email) = LOWER($2) AND expires_at > NOW()
      FOR UPDATE`, [id, email])
    const pending = pendingResult.rows[0]
    if (!pending || pending.attempts >= 5) {
      await client.query('ROLLBACK')
      return null
    }
    if (pending.code_hash !== codeHash) {
      await client.query('UPDATE pending_registrations SET attempts = attempts + 1 WHERE id = $1', [id])
      await client.query('COMMIT')
      return null
    }
    const { rows } = await client.query(`INSERT INTO users
      (id, aptos_address, display_name, email, email_verified, provider, role, status, password_hash,
       wallet_kind, encrypted_private_key, created_at, last_login_at)
      VALUES ($1, $2, $3, LOWER($4), true, 'email', 'voter', 'active', $5, 'managed', $6, NOW(), NOW())
      RETURNING *`, [pending.id, pending.aptos_address, pending.display_name, pending.email, pending.password_hash, pending.encrypted_private_key])
    await client.query(`INSERT INTO user_wallets
      (id, user_id, aptos_address, kind, provider, is_primary, created_at)
      VALUES ($1, $2, $3, 'managed', 'email', true, NOW())`, [randomUUID(), pending.id, pending.aptos_address])
    await client.query(`INSERT INTO auth_identities
      (id, user_id, provider, subject, email, created_at, last_used_at)
      VALUES ($1, $2, 'email', LOWER($3), LOWER($3), NOW(), NOW())`, [randomUUID(), pending.id, pending.email])
    await client.query('DELETE FROM pending_registrations WHERE id = $1', [pending.id])
    await client.query('COMMIT')
    return rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email])
  return rows[0] ?? null
}

export async function getPasswordUserByEmail(email) {
  const { rows } = await pool.query(`SELECT users.* FROM users
    WHERE LOWER(users.email) = LOWER($1)
      AND users.password_hash IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM auth_identities identity
        WHERE identity.user_id = users.id
          AND identity.provider = 'email'
          AND LOWER(identity.subject) = LOWER($1)
      )
    LIMIT 1`, [email])
  return rows[0] ?? null
}

export async function markPasswordLogin(userId) {
  const { rows } = await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1 AND status = 'active' RETURNING *", [userId])
  return rows[0] ?? null
}

export async function resetPasswordAndSessions({ userId, passwordHash }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(`UPDATE users
      SET password_hash = $1, last_login_at = NOW()
      WHERE id = $2 AND status = 'active' AND email_verified = true
        AND password_hash IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth_identities identity
          WHERE identity.user_id = users.id AND identity.provider = 'email')
      RETURNING *`, [passwordHash, userId])
    if (!rows[0]) {
      await client.query('ROLLBACK')
      return null
    }
    await client.query('DELETE FROM sessions WHERE user_id = $1', [userId])
    await client.query('COMMIT')
    return rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function putEmailVerification({ userId, purpose, targetEmail, codeHash, expiresAt, parentVerificationId = null }) {
  await pool.query(`UPDATE email_verifications SET consumed_at = NOW()
    WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`, [userId, purpose])
  const id = randomUUID()
  await pool.query(`INSERT INTO email_verifications
    (id, user_id, purpose, target_email, code_hash, attempts, created_at, expires_at, parent_verification_id)
    VALUES ($1, $2, $3, LOWER($4), $5, 0, NOW(), $6, $7)`,
  [id, userId, purpose, targetEmail, codeHash, expiresAt, parentVerificationId])
  return id
}

export async function consumeEmailVerification({ userId, purpose, targetEmail, codeHash }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(`SELECT * FROM email_verifications
      WHERE user_id = $1 AND purpose = $2 AND target_email = LOWER($3)
        AND consumed_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [userId, purpose, targetEmail])
    const row = rows[0]
    if (!row || row.attempts >= 5) {
      await client.query('ROLLBACK')
      return null
    }
    if (row.code_hash !== codeHash) {
      await client.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [row.id])
      await client.query('COMMIT')
      return null
    }
    await client.query('UPDATE email_verifications SET consumed_at = NOW() WHERE id = $1', [row.id])
    await client.query('COMMIT')
    return row
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function activateRegisteredUser(userId) {
  const { rows } = await pool.query(`UPDATE users SET email_verified = true, status = 'active', last_login_at = NOW()
    WHERE id = $1 AND status = 'pending' RETURNING *`, [userId])
  return rows[0] ?? null
}

export async function completeEmailChange({ userId, email, codeHash, requiresParent, updateSuperAdminEmail }) {
  const normalized = email.trim().toLowerCase()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const verificationResult = await client.query(`SELECT * FROM email_verifications
      WHERE user_id = $1 AND purpose = 'change_email_new' AND target_email = $2
        AND consumed_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [userId, normalized])
    const verification = verificationResult.rows[0]
    if (!verification || verification.attempts >= 5) {
      await client.query('ROLLBACK')
      return null
    }
    if (verification.code_hash !== codeHash) {
      await client.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [verification.id])
      await client.query('COMMIT')
      return null
    }
    if (requiresParent) {
      const parent = await client.query(`SELECT id FROM email_verifications
        WHERE id = $1 AND user_id = $2 AND purpose = 'change_email_old'
          AND target_email = $3 AND consumed_at IS NOT NULL`,
      [verification.parent_verification_id, userId, normalized])
      if (!parent.rows[0]) {
        await client.query('ROLLBACK')
        throw Object.assign(new Error('old_email_verification_required'), { status: 400 })
      }
    }

    const emailOwner = await client.query(`SELECT id FROM users
      WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1 FOR UPDATE`, [normalized, userId])
    if (emailOwner.rows[0]) {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('email_already_registered'), { status: 409 })
    }
    const identityOwner = await client.query(`SELECT user_id FROM auth_identities
      WHERE provider = 'email' AND LOWER(subject) = $1 FOR UPDATE`, [normalized])
    if (identityOwner.rows[0] && identityOwner.rows[0].user_id !== userId) {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('email_already_registered'), { status: 409 })
    }

    await client.query('UPDATE email_verifications SET consumed_at = NOW() WHERE id = $1', [verification.id])
    await client.query("DELETE FROM auth_identities WHERE user_id = $1 AND provider = 'email'", [userId])
    await client.query(`INSERT INTO auth_identities
      (id, user_id, provider, subject, email, created_at, last_used_at)
      VALUES ($1, $2, 'email', $3, $3, NOW(), NOW())`, [randomUUID(), userId, normalized])
    const updated = await client.query(`UPDATE users SET email = $1, email_verified = true
      WHERE id = $2 AND status = 'active' RETURNING *`, [normalized, userId])
    if (!updated.rows[0]) throw Object.assign(new Error('account_not_found'), { status: 404 })
    if (updateSuperAdminEmail) {
      await client.query(`INSERT INTO settings (key, value_json, updated_at)
        VALUES ('superAdminEmail', $1::jsonb, NOW())
        ON CONFLICT(key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(normalized)])
    }
    await client.query('DELETE FROM sessions WHERE user_id = $1', [userId])
    await client.query('COMMIT')
    return updated.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listAccountConnections(userId) {
  const [identities, wallets] = await Promise.all([
    pool.query('SELECT provider, subject, email, created_at, last_used_at FROM auth_identities WHERE user_id = $1 ORDER BY created_at', [userId]),
    pool.query('SELECT aptos_address, kind, provider, is_primary, created_at FROM user_wallets WHERE user_id = $1 ORDER BY is_primary DESC, created_at', [userId]),
  ])
  return { identities: identities.rows, wallets: wallets.rows }
}

export async function creatorAccountStatus({ email, creatorAddress }) {
  const normalizedEmail = email.trim().toLowerCase()
  const address = creatorAddress.toLowerCase()
  const { rows } = await pool.query(`SELECT u.id, u.aptos_address, u.email, u.email_verified,
      u.status, u.password_hash IS NOT NULL AS has_password,
      EXISTS (SELECT 1 FROM auth_identities i WHERE i.user_id = u.id AND i.provider = 'google') AS google_linked,
      (SELECT COUNT(*)::int FROM user_wallets w WHERE w.user_id = u.id) AS linked_wallets
    FROM users u
    WHERE LOWER(u.email) = $1 OR LOWER(u.aptos_address) = $2
    ORDER BY (LOWER(u.aptos_address) = $2) DESC, u.created_at
    LIMIT 1`, [normalizedEmail, address])
  const row = rows[0]
  if (!row) return { configured: false, email: normalizedEmail, creatorAddress: address }
  return {
    configured: row.status === 'active' && row.email_verified && row.has_password
      && row.aptos_address.toLowerCase() === address && row.email?.toLowerCase() === normalizedEmail,
    userId: row.id,
    email: row.email,
    emailVerified: row.email_verified,
    creatorAddress: address,
    primaryAddress: row.aptos_address,
    hasPassword: row.has_password,
    googleLinked: row.google_linked,
    linkedWallets: row.linked_wallets,
  }
}

export async function bootstrapCreatorAccount({ email, passwordHash, creatorAddress }) {
  const normalizedEmail = email.trim().toLowerCase()
  const address = creatorAddress.toLowerCase()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sovet_online_creator_bootstrap'))")
    const emailResult = await client.query('SELECT * FROM users WHERE LOWER(email) = $1 FOR UPDATE', [normalizedEmail])
    if (emailResult.rows.length !== 1) {
      throw Object.assign(new Error('verified_google_account_required'), { status: 409 })
    }
    const emailUser = emailResult.rows[0]
    if (emailUser.status !== 'active' || !emailUser.email_verified) {
      throw Object.assign(new Error('verified_active_account_required'), { status: 409 })
    }
    if (emailUser.wallet_kind === 'managed' || emailUser.encrypted_private_key) {
      throw Object.assign(new Error('managed_account_requires_manual_merge'), { status: 409 })
    }

    const creatorResult = await client.query(`SELECT u.* FROM users u
      WHERE LOWER(u.aptos_address) = $1
        OR EXISTS (SELECT 1 FROM user_wallets w WHERE w.user_id = u.id AND LOWER(w.aptos_address) = $1)
      FOR UPDATE`, [address])
    if (creatorResult.rows.length > 1) {
      throw Object.assign(new Error('creator_wallet_ownership_conflict'), { status: 409 })
    }
    const creatorUser = creatorResult.rows[0] ?? null
    if (creatorUser && emailUser.id !== creatorUser.id) {
      throw Object.assign(new Error('creator_account_conflict'), { status: 409 })
    }

    const connections = await client.query(`SELECT w.aptos_address, w.kind, w.provider, w.is_primary,
        EXISTS (SELECT 1 FROM auth_identities i
          WHERE i.user_id = w.user_id AND i.provider = 'google'
            AND LOWER(i.subject) = LOWER(w.aptos_address)) AS google_identity
      FROM user_wallets w WHERE w.user_id = $1 FOR UPDATE`, [emailUser.id])
    const primaryWallets = connections.rows.filter((wallet) => wallet.is_primary)
    if (primaryWallets.length !== 1) {
      throw Object.assign(new Error('creator_account_primary_wallet_invalid'), { status: 409 })
    }
    const googleWallet = connections.rows.find((wallet) => wallet.provider === 'google'
      && wallet.kind === 'keyless' && wallet.google_identity)
    if (!googleWallet) {
      throw Object.assign(new Error('verified_google_identity_required'), { status: 409 })
    }

    const updated = await client.query(`UPDATE users SET
        aptos_address = $1,
        role = 'super_admin',
        password_hash = $2,
        wallet_kind = 'external',
        encrypted_private_key = NULL,
        last_login_at = NOW()
      WHERE id = $3 AND status = 'active' AND email_verified = true
      RETURNING *`, [address, passwordHash, emailUser.id])
    const user = updated.rows[0]
    if (!user) throw Object.assign(new Error('creator_account_update_failed'), { status: 409 })

    await client.query('UPDATE user_wallets SET is_primary = false WHERE user_id = $1', [user.id])
    const wallet = await client.query(`INSERT INTO user_wallets
      (id, user_id, aptos_address, kind, provider, is_primary, created_at)
      VALUES ($1, $2, $3, 'external', 'wallet', true, NOW())
      ON CONFLICT (aptos_address) DO UPDATE SET kind = 'external', provider = 'wallet', is_primary = true
      WHERE user_wallets.user_id = EXCLUDED.user_id
      RETURNING user_id`, [randomUUID(), user.id, address])
    if (!wallet.rows[0] || wallet.rows[0].user_id !== user.id) {
      throw Object.assign(new Error('creator_wallet_already_linked'), { status: 409 })
    }

    const identityOwner = await client.query(`SELECT user_id FROM auth_identities
      WHERE provider = 'email' AND LOWER(subject) = $1 FOR UPDATE`, [normalizedEmail])
    if (identityOwner.rows[0] && identityOwner.rows[0].user_id !== user.id) {
      throw Object.assign(new Error('creator_email_identity_conflict'), { status: 409 })
    }
    await client.query(`INSERT INTO auth_identities
      (id, user_id, provider, subject, email, created_at, last_used_at)
      VALUES ($1, $2, 'email', $3, $3, NOW(), NOW())
      ON CONFLICT (provider, subject) DO UPDATE SET email = EXCLUDED.email, last_used_at = NOW()
      WHERE auth_identities.user_id = EXCLUDED.user_id`, [randomUUID(), user.id, normalizedEmail])

    await client.query('DELETE FROM sessions WHERE user_id = $1', [user.id])
    await client.query('UPDATE email_verifications SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL', [user.id])
    await client.query('UPDATE auth_challenges SET consumed_at = NOW() WHERE link_user_id = $1 AND consumed_at IS NULL', [user.id])
    await client.query(`INSERT INTO ops_events
      (id, kind, severity, message, details_json, created_at)
      VALUES ($1, 'auth', 'ok', 'Creator account bootstrapped from local operator', $2::jsonb, NOW())`, [
      randomUUID(),
      JSON.stringify({ userId: user.id, creatorAddress: address, googleLinked: true, migratedExistingAccount: true }),
    ])
    await client.query('COMMIT')
    return {
      userId: user.id,
      email: user.email,
      creatorAddress: user.aptos_address,
      googleLinked: true,
      migratedExistingAccount: true,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function createSession({ userId, token, csrfToken, expiresAt, authMethod, authAddress = null }) {
  const timestamp = now()
  await pool.query(`INSERT INTO sessions
    (token_hash, user_id, csrf_hash, created_at, expires_at, last_seen_at, auth_method, auth_address)
    VALUES ($1, $2, $3, $4, $5, $4, $6, $7)`, [hashSecret(token), userId, hashSecret(csrfToken), timestamp, expiresAt, authMethod, authAddress?.toLowerCase() ?? null])
}

export async function getSession(token) {
  if (!token) return null
  const tokenHash = hashSecret(token)
  const { rows } = await pool.query(`UPDATE sessions s SET last_seen_at = NOW()
    FROM users u WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.id = s.user_id AND u.status = 'active'
    RETURNING s.*, u.id, u.aptos_address, u.display_name, u.email, u.telegram, u.email_verified,
      u.provider, u.role, u.status, u.wallet_kind, u.created_at, u.last_login_at`, [tokenHash])
  return rows[0] ?? null
}

export async function deleteSession(token) {
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashSecret(token)])
}

export async function deleteSessionByHash(tokenHash) {
  if (tokenHash) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
}

export async function deleteUserSessions(userId) {
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId])
}

export async function getUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id])
  return rows[0] ?? null
}

export async function getManagedWallet(userId) {
  const { rows } = await pool.query(`SELECT aptos_address, encrypted_private_key FROM users
    WHERE id = $1 AND status = 'active' AND wallet_kind = 'managed'`, [userId])
  return rows[0] ?? null
}

export async function listGovernanceUsers() {
  const { rows } = await pool.query(`SELECT id, aptos_address, display_name, provider, role, status, created_at, last_login_at
    FROM users WHERE status = 'active' ORDER BY COALESCE(display_name, aptos_address), created_at`)
  return rows
}

export async function getSettings() {
  const { rows } = await pool.query('SELECT key, value_json FROM settings')
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value_json]))
  return {
    registrationOpen: true,
    sponsorshipEnabled: false,
    maintenanceMode: false,
    maxSponsoredVotesPerHour: 20,
    maxSponsoredVotesGlobalPerHour: 250,
    superAdminEmail: 'pavel.mishelutov@gmail.com',
    siteTitle: 'Новый Путь',
    ...values,
  }
}

export async function setSettings(values) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const [key, value] of Object.entries(values)) {
      await client.query(`INSERT INTO settings (key, value_json, updated_at)
        VALUES ($1, $2::jsonb, NOW()) ON CONFLICT(key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = EXCLUDED.updated_at`,
      [key, JSON.stringify(value)])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return getSettings()
}

export async function logEvent(kind, severity, message, details = null) {
  await pool.query(`INSERT INTO ops_events
    (id, kind, severity, message, details_json, created_at) VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
  [randomUUID(), kind, severity, message, details ? JSON.stringify(details) : null])
}

export async function dashboardDatabaseStats() {
  const { rows: counts } = await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM users) AS users_total,
    (SELECT COUNT(*)::int FROM sessions WHERE expires_at > NOW()) AS active_sessions,
    (SELECT COUNT(*)::int FROM vote_intents WHERE created_at > NOW() - INTERVAL '1 day') AS votes_24h,
    (SELECT COUNT(*)::int FROM vote_intents WHERE status IN ('prepared', 'submitted')) AS pending_votes,
    pg_database_size(current_database())::text AS db_bytes`)
  const [{ rows: recentEvents }, { rows: uptime }] = await Promise.all([
    pool.query('SELECT * FROM ops_events ORDER BY created_at DESC LIMIT 12'),
    pool.query('SELECT * FROM uptime_samples ORDER BY sampled_at DESC LIMIT 60'),
  ])
  const row = counts[0]
  return {
    usersTotal: row.users_total,
    activeSessions: row.active_sessions,
    votes24h: row.votes_24h,
    pendingVotes: row.pending_votes,
    dbBytes: Number(row.db_bytes),
    recentEvents,
    uptime: uptime.reverse(),
  }
}

const analyticsRanges = {
  '1h': { window: "INTERVAL '1 hour'", bucket: "INTERVAL '1 minute'" },
  '24h': { window: "INTERVAL '24 hours'", bucket: "INTERVAL '15 minutes'" },
  '7d': { window: "INTERVAL '7 days'", bucket: "INTERVAL '1 hour'" },
}

export async function dashboardAnalytics(requestedRange = '24h') {
  const range = Object.hasOwn(analyticsRanges, requestedRange) ? requestedRange : '24h'
  const config = analyticsRanges[range]
  const origin = "TIMESTAMPTZ '2001-01-01 00:00:00+00'"
  const bucket = `date_bin(${config.bucket}, created_at, ${origin})`
  const sampleBucket = `date_bin(${config.bucket}, sampled_at, ${origin})`

  const [{ rows: samples }, { rows: votes }, { rows: users }, { rows: summaryRows }] = await Promise.all([
    pool.query(`SELECT ${sampleBucket} AS bucket,
        AVG(CASE WHEN public_ok THEN 100.0 ELSE 0 END)::float8 AS public_uptime_pct,
        AVG(CASE WHEN aptos_ok THEN 100.0 ELSE 0 END)::float8 AS aptos_uptime_pct,
        COALESCE(AVG(latency_ms), 0)::float8 AS latency_ms,
        MAX(users_total)::int AS users_total,
        AVG(sessions_active)::float8 AS active_sessions
      FROM uptime_samples
      WHERE sampled_at >= NOW() - ${config.window}
      GROUP BY 1 ORDER BY 1`),
    pool.query(`SELECT ${bucket} AS bucket,
        COUNT(*)::int AS votes,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_votes
      FROM vote_intents
      WHERE created_at >= NOW() - ${config.window}
      GROUP BY 1 ORDER BY 1`),
    pool.query(`SELECT ${bucket} AS bucket, COUNT(*)::int AS new_users
      FROM users
      WHERE created_at >= NOW() - ${config.window}
      GROUP BY 1 ORDER BY 1`),
    pool.query(`SELECT
        COALESCE(AVG(CASE WHEN public_ok THEN 100.0 ELSE 0 END), 0)::float8 AS uptime_percent,
        COALESCE(AVG(CASE WHEN aptos_ok THEN 100.0 ELSE 0 END), 0)::float8 AS aptos_percent,
        COALESCE(AVG(latency_ms), 0)::float8 AS average_latency_ms,
        COALESCE(MAX(sessions_active), 0)::int AS peak_sessions,
        (SELECT COUNT(*)::int FROM vote_intents WHERE created_at >= NOW() - ${config.window}) AS votes,
        (SELECT COUNT(*)::int FROM vote_intents WHERE created_at >= NOW() - ${config.window} AND status = 'confirmed') AS confirmed_votes,
        (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - ${config.window}) AS new_users
      FROM uptime_samples
      WHERE sampled_at >= NOW() - ${config.window}`),
  ])

  const points = new Map()
  const pointFor = (value) => {
    const at = new Date(value).toISOString()
    if (!points.has(at)) points.set(at, {
      at,
      publicUptimePct: 0,
      aptosUptimePct: 0,
      latencyMs: 0,
      usersTotal: 0,
      activeSessions: 0,
      votes: 0,
      confirmedVotes: 0,
      newUsers: 0,
    })
    return points.get(at)
  }

  for (const row of samples) Object.assign(pointFor(row.bucket), {
    publicUptimePct: Number(row.public_uptime_pct),
    aptosUptimePct: Number(row.aptos_uptime_pct),
    latencyMs: Number(row.latency_ms),
    usersTotal: Number(row.users_total),
    activeSessions: Number(row.active_sessions),
  })
  for (const row of votes) Object.assign(pointFor(row.bucket), {
    votes: Number(row.votes),
    confirmedVotes: Number(row.confirmed_votes),
  })
  for (const row of users) pointFor(row.bucket).newUsers = Number(row.new_users)

  const summary = summaryRows[0]
  return {
    range,
    summary: {
      uptimePercent: Number(summary.uptime_percent),
      aptosPercent: Number(summary.aptos_percent),
      averageLatencyMs: Number(summary.average_latency_ms),
      peakSessions: Number(summary.peak_sessions),
      votes: Number(summary.votes),
      confirmedVotes: Number(summary.confirmed_votes),
      newUsers: Number(summary.new_users),
    },
    series: [...points.values()].sort((left, right) => left.at.localeCompare(right.at)),
  }
}

export async function recordUptime({ publicOk, aptosOk, latencyMs }) {
  const { rows } = await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM users) AS users_total,
    (SELECT COUNT(*)::int FROM sessions WHERE expires_at > NOW()) AS active_sessions`)
  const stats = rows[0]
  await pool.query(`INSERT INTO uptime_samples
    (sampled_at, public_ok, aptos_ok, latency_ms, users_total, sessions_active)
    VALUES (NOW(), $1, $2, $3, $4, $5)`,
  [publicOk, aptosOk, latencyMs ?? null, stats.users_total, stats.active_sessions])
  await Promise.all([
    pool.query("DELETE FROM uptime_samples WHERE sampled_at < NOW() - INTERVAL '7 days'"),
    pool.query('DELETE FROM sessions WHERE expires_at <= NOW()'),
    pool.query("DELETE FROM auth_challenges WHERE expires_at <= NOW() - INTERVAL '1 day'"),
    pool.query("DELETE FROM logic_game_rounds WHERE expires_at <= NOW() - INTERVAL '1 day'"),
    pool.query("DELETE FROM pending_registrations WHERE expires_at <= NOW()"),
  ])
}

export async function listLogicGameAnsweredIds(userId) {
  if (!userId) return []
  const { rows } = await pool.query('SELECT challenge_id FROM logic_game_attempts WHERE user_id = $1', [userId])
  return rows.map((row) => row.challenge_id)
}

export async function getLogicGameProfile(userId) {
  if (!userId) return { score: 0, answeredCount: 0, correctCount: 0, currentStreak: 0, bestStreak: 0 }
  const { rows } = await pool.query(`SELECT score, answered_count, correct_count, current_streak, best_streak
    FROM logic_game_profiles WHERE user_id = $1`, [userId])
  const row = rows[0]
  return row ? {
    score: row.score,
    answeredCount: row.answered_count,
    correctCount: row.correct_count,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
  } : { score: 0, answeredCount: 0, correctCount: 0, currentStreak: 0, bestStreak: 0 }
}

export async function createLogicGameRound({ token, userId = null, challengeId, lang, expiresAt }) {
  await pool.query(`INSERT INTO logic_game_rounds
    (token_hash, user_id, challenge_id, lang, created_at, expires_at)
    VALUES ($1, $2, $3, $4, NOW(), $5)`, [hashSecret(token), userId, challengeId, lang, expiresAt])
}

export async function consumeLogicGameRound(token) {
  const { rows } = await pool.query(`UPDATE logic_game_rounds SET consumed_at = NOW()
    WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
    RETURNING *`, [hashSecret(token)])
  return rows[0] ?? null
}

export async function recordLogicGameAnswer({ userId, challengeId, selectedIndex, correct, points }) {
  if (!userId) return { recorded: false, profile: await getLogicGameProfile(null) }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`INSERT INTO logic_game_profiles
      (user_id, score, answered_count, correct_count, current_streak, best_streak, updated_at)
      VALUES ($1, 0, 0, 0, 0, 0, NOW()) ON CONFLICT (user_id) DO NOTHING`, [userId])
    const inserted = await client.query(`INSERT INTO logic_game_attempts
      (user_id, challenge_id, selected_index, is_correct, points_awarded, answered_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, challenge_id) DO NOTHING
      RETURNING challenge_id`, [userId, challengeId, selectedIndex, correct, points])
    let profile
    if (inserted.rows[0]) {
      const { rows } = await client.query(`UPDATE logic_game_profiles SET
          score = score + $2,
          answered_count = answered_count + 1,
          correct_count = correct_count + CASE WHEN $3 THEN 1 ELSE 0 END,
          current_streak = CASE WHEN $3 THEN current_streak + 1 ELSE 0 END,
          best_streak = GREATEST(best_streak, CASE WHEN $3 THEN current_streak + 1 ELSE 0 END),
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING score, answered_count, correct_count, current_streak, best_streak`, [userId, points, correct])
      profile = rows[0]
    } else {
      const { rows } = await client.query(`SELECT score, answered_count, correct_count, current_streak, best_streak
        FROM logic_game_profiles WHERE user_id = $1`, [userId])
      profile = rows[0]
    }
    await client.query('COMMIT')
    return {
      recorded: Boolean(inserted.rows[0]),
      profile: {
        score: profile.score,
        answeredCount: profile.answered_count,
        correctCount: profile.correct_count,
        currentStreak: profile.current_streak,
        bestStreak: profile.best_streak,
      },
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function runProcess(executable, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, ...env } })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_dump failed (${code}): ${stderr.slice(-500)}`)))
  })
}

function hashFile(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')))
  })
}

export async function createDatabaseBackup() {
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const destination = join(backupRoot, `sovet-online-postgresql-${stamp}.dump`)
  await runProcess(join(postgresBin, 'pg_dump.exe'), [
    '--host', config.host, '--port', String(config.port), '--username', config.user,
    '--dbname', config.database, '--format=custom', '--no-password', '--file', destination,
  ], { PGPASSWORD: config.password })
  const bytes = statSync(destination).size
  const sha256 = await hashFile(destination)
  const id = randomUUID()
  await pool.query('INSERT INTO backups (id, path, bytes, sha256, created_at) VALUES ($1, $2, $3, $4, NOW())',
    [id, destination, bytes, sha256])
  await logEvent('backup', 'ok', 'Создана резервная копия PostgreSQL', { bytes, sha256 })
  return { id, path: destination, bytes, sha256, createdAt: now() }
}

export async function latestBackup() {
  const { rows } = await pool.query('SELECT * FROM backups ORDER BY created_at DESC LIMIT 1')
  return rows[0] ?? null
}

export async function createOrGetVoteIntent(input) {
  const id = randomUUID()
  const inserted = await pool.query(`INSERT INTO vote_intents
    (id, user_id, idempotency_key, sender_address, election_id, yes_bps, no_bps, abstain_bps,
     raw_transaction_b64, intent_kind, status, created_at, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'prepared', NOW(), $11)
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING *`, [id, input.userId, input.idempotencyKey, input.senderAddress, input.electionId,
      input.yesBps, input.noBps, input.abstainBps, input.rawTransactionB64, input.intentKind, input.expiresAt])
  if (inserted.rows[0]) return inserted.rows[0]

  const existing = await pool.query(`SELECT * FROM vote_intents
    WHERE user_id = $1 AND idempotency_key = $2`, [input.userId, input.idempotencyKey])
  const row = existing.rows[0]
  const payloadMatches = row
    && row.sender_address.toLowerCase() === input.senderAddress.toLowerCase()
    && String(row.election_id) === String(input.electionId)
    && row.yes_bps === input.yesBps
    && row.no_bps === input.noBps
    && row.abstain_bps === input.abstainBps
    && row.intent_kind === input.intentKind
  if (!payloadMatches) {
    throw Object.assign(new Error('idempotency_payload_mismatch'), { status: 409 })
  }
  return row
}

export async function getVoteIntent(id) {
  const { rows } = await pool.query('SELECT * FROM vote_intents WHERE id = $1', [id])
  return rows[0] ?? null
}

export async function countRecentSponsoredVotes(userId = null) {
  const { rows } = userId
    ? await pool.query(`SELECT COUNT(*)::int AS count FROM vote_intents
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`, [userId])
    : await pool.query(`SELECT COUNT(*)::int AS count FROM vote_intents
        WHERE created_at > NOW() - INTERVAL '1 hour'`)
  return rows[0].count
}

export async function claimVoteIntent({ id, userId, globalHourlyLimit = 250 }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [86420071])
    const { rows: usage } = await client.query(`SELECT COUNT(*)::int AS count FROM vote_intents
      WHERE status <> 'prepared' AND created_at > NOW() - INTERVAL '1 hour'`)
    if (usage[0].count >= globalHourlyLimit) {
      throw Object.assign(new Error('sponsorship_global_rate_limited'), { status: 429 })
    }
    const { rows } = await client.query(`UPDATE vote_intents
      SET status = 'submitting'
      WHERE id = $1 AND user_id = $2 AND status = 'prepared' AND expires_at > NOW()
      RETURNING *`, [id, userId])
    await client.query('COMMIT')
    return rows[0] ?? null
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function markVoteSubmitted(id, txHash) {
  await pool.query(`UPDATE vote_intents SET status = 'submitted', tx_hash = $1, submitted_at = NOW()
    WHERE id = $2 AND status = 'submitting'`, [txHash, id])
}

export async function markVoteSubmissionFailed(id, errorCode = 'submission_failed') {
  await pool.query(`UPDATE vote_intents SET status = 'failed', error_code = $1, confirmed_at = NOW()
    WHERE id = $2 AND status = 'submitting'`, [errorCode, id])
}

export async function markVoteFinal(id, success, errorCode = null) {
  await pool.query('UPDATE vote_intents SET status = $1, error_code = $2, confirmed_at = NOW() WHERE id = $3',
    [success ? 'confirmed' : 'failed', errorCode, id])
}
