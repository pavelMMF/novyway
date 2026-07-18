import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import {
  bootstrapCreatorAccount,
  closeStorage,
  createSession,
  hashSecret,
  initializeStorage,
  pool,
} from './lib/storage.mjs'

const suffix = randomBytes(8).toString('hex')
const address = () => `0x${randomBytes(32).toString('hex')}`
const email = `creator-bootstrap-${suffix}@example.invalid`
const keylessAddress = address()
const creatorAddress = address()
const userId = randomUUID()
const unverifiedUserId = randomUUID()
const unverifiedEmail = `creator-unverified-${suffix}@example.invalid`
const cleanupUserIds = [userId, unverifiedUserId]

async function seedGoogleUser({ id, accountEmail, aptosAddress, emailVerified }) {
  await pool.query(`INSERT INTO users
    (id, aptos_address, email, email_verified, provider, role, status, wallet_kind, created_at, last_login_at)
    VALUES ($1, $2, $3, $4, 'google', 'voter', 'active', 'keyless', NOW(), NOW())`,
  [id, aptosAddress, accountEmail, emailVerified])
  await pool.query(`INSERT INTO user_wallets
    (id, user_id, aptos_address, kind, provider, is_primary, created_at)
    VALUES ($1, $2, $3, 'keyless', 'google', true, NOW())`, [randomUUID(), id, aptosAddress])
  await pool.query(`INSERT INTO auth_identities
    (id, user_id, provider, subject, email, created_at, last_used_at)
    VALUES ($1, $2, 'google', $3, $4, NOW(), NOW())`, [randomUUID(), id, aptosAddress, accountEmail])
  await pool.query(`INSERT INTO auth_identities
    (id, user_id, provider, subject, email, created_at, last_used_at)
    VALUES ($1, $2, 'email', $3, $3, NOW(), NOW())`, [randomUUID(), id, accountEmail])
}

async function expectBootstrapError(input, expectedMessage) {
  await assert.rejects(() => bootstrapCreatorAccount(input), (error) => {
    assert.equal(error.message, expectedMessage)
    return true
  })
}

try {
  await initializeStorage()
  await seedGoogleUser({ id: userId, accountEmail: email, aptosAddress: keylessAddress, emailVerified: true })
  await seedGoogleUser({ id: unverifiedUserId, accountEmail: unverifiedEmail, aptosAddress: address(), emailVerified: false })

  const sessionToken = `creator-session-${suffix}`
  await createSession({
    userId,
    token: sessionToken,
    csrfToken: `creator-csrf-${suffix}`,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    authMethod: 'aptos_signature',
    authAddress: keylessAddress,
  })

  const result = await bootstrapCreatorAccount({ email, passwordHash: 'test-password-hash-a', creatorAddress })
  assert.equal(result.userId, userId)
  assert.equal(result.creatorAddress, creatorAddress)
  assert.equal(result.googleLinked, true)
  assert.equal(result.migratedExistingAccount, true)

  const [user, wallets, identities, sessions, audit] = await Promise.all([
    pool.query(`SELECT aptos_address, email, email_verified, provider, role, status,
        password_hash, wallet_kind, encrypted_private_key
      FROM users WHERE id = $1`, [userId]),
    pool.query(`SELECT aptos_address, kind, provider, is_primary
      FROM user_wallets WHERE user_id = $1 ORDER BY is_primary DESC, provider`, [userId]),
    pool.query(`SELECT provider, subject FROM auth_identities WHERE user_id = $1 ORDER BY provider`, [userId]),
    pool.query('SELECT 1 FROM sessions WHERE token_hash = $1', [hashSecret(sessionToken)]),
    pool.query(`SELECT 1 FROM ops_events
      WHERE kind = 'auth' AND details_json->>'userId' = $1`, [userId]),
  ])
  assert.equal(user.rowCount, 1)
  assert.deepEqual(user.rows[0], {
    aptos_address: creatorAddress,
    email,
    email_verified: true,
    provider: 'google',
    role: 'super_admin',
    status: 'active',
    password_hash: 'test-password-hash-a',
    wallet_kind: 'external',
    encrypted_private_key: null,
  })
  assert.equal(wallets.rows.filter((wallet) => wallet.is_primary).length, 1)
  assert.equal(wallets.rows.find((wallet) => wallet.is_primary)?.aptos_address, creatorAddress)
  assert.equal(wallets.rows.find((wallet) => wallet.provider === 'google')?.aptos_address, keylessAddress)
  assert.equal(identities.rows.some((identity) => identity.provider === 'google' && identity.subject === keylessAddress), true)
  assert.equal(identities.rows.some((identity) => identity.provider === 'email' && identity.subject === email), true)
  assert.equal(sessions.rowCount, 0)
  assert.ok(audit.rowCount >= 1)

  const retry = await bootstrapCreatorAccount({ email, passwordHash: 'test-password-hash-b', creatorAddress })
  assert.equal(retry.userId, userId)
  const retryState = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId])
  assert.equal(retryState.rows[0].password_hash, 'test-password-hash-b')

  await expectBootstrapError({
    email: `missing-${suffix}@example.invalid`,
    passwordHash: 'test-password-hash',
    creatorAddress: address(),
  }, 'verified_google_account_required')
  await expectBootstrapError({
    email: unverifiedEmail,
    passwordHash: 'test-password-hash',
    creatorAddress: address(),
  }, 'verified_active_account_required')

  console.log(JSON.stringify({
    ok: true,
    preservedGoogleIdentity: true,
    revokedOldSessions: true,
    creatorWalletIsPrimary: true,
    bootstrapIsIdempotent: true,
    rejectedMissingOrUnverifiedAccounts: true,
  }, null, 2))
} finally {
  for (const id of cleanupUserIds) {
    await pool.query(`DELETE FROM ops_events WHERE details_json->>'userId' = $1`, [id]).catch(() => {})
  }
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [cleanupUserIds]).catch(() => {})
  await closeStorage()
}
