import { generateNonce } from '@aptos-labs/siwa'

export const SIWA_TESTNET_CHAIN_ID = 'aptos:testnet'

export function createTestnetSignInChallenge({ domain, origin, lang, now = new Date(), nonce = generateNonce() }) {
  const issuedAt = new Date(now)
  if (!Number.isFinite(issuedAt.getTime())) throw new TypeError('invalid_challenge_time')

  return {
    domain,
    statement: lang === 'ru' ? 'Вход в Новый Путь' : 'Sign in to Novyway',
    uri: origin,
    version: '1',
    chainId: SIWA_TESTNET_CHAIN_ID,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: new Date(issuedAt.getTime() + 5 * 60_000).toISOString(),
  }
}
