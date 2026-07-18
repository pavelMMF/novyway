import assert from 'node:assert/strict'
import { createTestnetSignInChallenge, SIWA_TESTNET_CHAIN_ID } from './lib/siwa-challenge.mjs'

const now = new Date('2026-07-17T12:00:00.000Z')
const challenge = createTestnetSignInChallenge({
  domain: 'novyway.com',
  origin: 'https://novyway.com',
  lang: 'ru',
  now,
  nonce: 'fixed-regression-nonce',
})

assert.equal(SIWA_TESTNET_CHAIN_ID, 'aptos:testnet')
assert.equal(challenge.chainId, 'aptos:testnet')
assert.notEqual(challenge.chainId, '2')
assert.equal(challenge.domain, 'novyway.com')
assert.equal(challenge.uri, 'https://novyway.com')
assert.equal(challenge.statement, 'Вход в Новый Путь')
assert.equal(challenge.issuedAt, now.toISOString())
assert.equal(challenge.expirationTime, '2026-07-17T12:05:00.000Z')

console.log(JSON.stringify({
  canonicalTestnetChainId: true,
  numericLedgerIdRejected: true,
  fiveMinuteLifetime: true,
}))
