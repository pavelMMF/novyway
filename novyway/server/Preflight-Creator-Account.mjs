import { closeStorage, pool } from './lib/storage.mjs'

const protectedEmail = 'pavel.mishelutov@gmail.com'
const creatorAddress = '0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411'

try {
  const [duplicates, account, links, creatorOwners] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM (
      SELECT user_id FROM user_wallets WHERE is_primary
      GROUP BY user_id HAVING COUNT(*) > 1
    ) duplicates`),
    pool.query(`SELECT COUNT(*)::int AS count,
        BOOL_AND(email_verified AND status = 'active')::boolean AS ready,
        BOOL_OR(wallet_kind = 'managed' OR encrypted_private_key IS NOT NULL)::boolean AS managed
      FROM users WHERE LOWER(email) = LOWER($1)`, [protectedEmail]),
    pool.query(`SELECT
        COUNT(DISTINCT i.id) FILTER (WHERE i.provider = 'google')::int AS google_identities,
        COUNT(DISTINCT w.aptos_address) FILTER (
          WHERE w.provider = 'google' AND w.kind = 'keyless'
        )::int AS google_wallets
      FROM users u
      LEFT JOIN auth_identities i ON i.user_id = u.id
      LEFT JOIN user_wallets w ON w.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)`, [protectedEmail]),
    pool.query(`SELECT COUNT(DISTINCT u.id)::int AS count FROM users u
      WHERE LOWER(u.aptos_address) = LOWER($1)
        OR EXISTS (SELECT 1 FROM user_wallets w
          WHERE w.user_id = u.id AND LOWER(w.aptos_address) = LOWER($1))`, [creatorAddress]),
  ])
  const result = {
    duplicatePrimaryUsers: duplicates.rows[0].count,
    protectedAccount: account.rows[0],
    googleLinks: links.rows[0],
    creatorAddressOwners: creatorOwners.rows[0].count,
  }
  console.log(JSON.stringify(result, null, 2))
  if (result.duplicatePrimaryUsers !== 0
    || result.protectedAccount.count !== 1
    || !result.protectedAccount.ready
    || result.protectedAccount.managed
    || result.googleLinks.google_identities < 1
    || result.googleLinks.google_wallets < 1
    || result.creatorAddressOwners > 1) process.exitCode = 1
} finally {
  await closeStorage()
}
