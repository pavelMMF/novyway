import { verifyPublishedModules } from './lib/aptos-service.mjs'
import { closeStorage, initializeStorage, pool } from './lib/storage.mjs'

try {
  await initializeStorage()
  const [columns, checks, users, migrations] = await Promise.all([
    pool.query(`SELECT table_name, column_name FROM information_schema.columns
      WHERE (table_name = 'auth_challenges' AND column_name = 'link_session_hash')
         OR (table_name = 'vote_intents' AND column_name = 'intent_kind')
         OR (table_name = 'email_verifications' AND column_name = 'parent_verification_id')
         OR (table_name = 'sessions' AND column_name = 'auth_method')
         OR (table_name = 'sessions' AND column_name = 'auth_address')
      ORDER BY 1, 2`),
    pool.query(`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conname IN ('email_verifications_purpose_check', 'vote_intents_intent_kind_check')
      ORDER BY 1`),
    pool.query('SELECT COUNT(*)::int AS count FROM users'),
    pool.query('SELECT version, applied_at FROM schema_migrations ORDER BY version'),
  ])
  const parity = await verifyPublishedModules({ force: true })
  console.log(JSON.stringify({
    database: { columns: columns.rows, checks: checks.rows, users: users.rows[0].count, migrations: migrations.rows },
    aptos: {
      publishedBytecodeAllowlisted: parity.verified,
      hashes: parity.hashes,
      reproducibleSource: parity.sourceDigest.matches === true,
      sourceDigest: parity.sourceDigest,
    },
  }, null, 2))
  if (columns.rowCount !== 5 || checks.rowCount !== 2 || migrations.rowCount < 1
    || !parity.verified || parity.sourceDigest.matches !== true) process.exitCode = 1
} finally {
  await closeStorage()
}
