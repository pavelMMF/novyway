import assert from 'node:assert/strict'
import {
  AccountAddress,
  ChainId,
  Deserializer,
  EntryFunction,
  RawTransaction,
  SimpleTransaction,
  TransactionPayloadEntryFunction,
  U64,
  U8,
} from '@aptos-labs/ts-sdk'
import { validateSponsoredVoteTransaction } from './lib/sponsored-intent.mjs'

const senderAddress = '0xfb597e73cedf190d4449fd789f6d52f3f31980f9c8e2f97ffbb0ecc8fb578efd'
const feePayerAddress = '0x64e87ca6314d304b93a484bfcd0ecdbc112679811ec4250761907263ed61e9b8'
const moduleAddress = '0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411'
const now = Date.now()
const expiresAtSeconds = Math.floor(now / 1000) + 300

function transaction({ moduleName, functionName, args, chainId = 2, gas = 10_000n, feePayer = feePayerAddress }) {
  const payload = new TransactionPayloadEntryFunction(EntryFunction.build(
    `${moduleAddress}::${moduleName}`,
    functionName,
    [],
    args,
  ))
  const raw = new RawTransaction(
    AccountAddress.from(senderAddress),
    0n,
    payload,
    gas,
    100n,
    BigInt(expiresAtSeconds),
    new ChainId(chainId),
  )
  const built = new SimpleTransaction(raw, AccountAddress.from(feePayer))
  return SimpleTransaction.deserialize(new Deserializer(built.bcsToBytes()))
}

const weightedIntent = {
  intent_kind: 'weighted_vote',
  sender_address: senderAddress,
  election_id: '101',
  yes_bps: 6000,
  no_bps: 3000,
  abstain_bps: 1000,
  expires_at: new Date((expiresAtSeconds + 1) * 1000).toISOString(),
}
const weightedTransaction = transaction({
  moduleName: 'weighted_voting',
  functionName: 'cast_vote',
  args: [new U64(101), new U64(6000), new U64(3000), new U64(1000)],
})
assert.equal(validateSponsoredVoteTransaction({
  transaction: weightedTransaction, intent: weightedIntent, senderAddress, feePayerAddress, moduleAddress, now,
}), true)

assert.throws(() => validateSponsoredVoteTransaction({
  transaction: weightedTransaction,
  intent: { ...weightedIntent, yes_bps: 7000 },
  senderAddress,
  feePayerAddress,
  moduleAddress,
  now,
}), /intent_transaction_mismatch/)

assert.throws(() => validateSponsoredVoteTransaction({
  transaction: transaction({
    moduleName: 'weighted_voting', functionName: 'cast_vote',
    args: [new U64(101), new U64(6000), new U64(3000), new U64(1000)], gas: 20_000n,
  }),
  intent: weightedIntent,
  senderAddress,
  feePayerAddress,
  moduleAddress,
  now,
}), /gas_policy_mismatch/)

const adminIntent = {
  intent_kind: 'admin_equal_vote',
  sender_address: senderAddress,
  election_id: '44',
  yes_bps: 0,
  no_bps: 10_000,
  abstain_bps: 0,
  expires_at: weightedIntent.expires_at,
}
assert.equal(validateSponsoredVoteTransaction({
  transaction: transaction({
    moduleName: 'admin_election', functionName: 'cast_equal_vote', args: [new U64(44), new U8(2)],
  }),
  intent: adminIntent,
  senderAddress,
  feePayerAddress,
  moduleAddress,
  now,
}), true)

assert.throws(() => validateSponsoredVoteTransaction({
  transaction: transaction({
    moduleName: 'admin_election', functionName: 'cast_equal_vote', args: [new U64(44), new U8(2)], chainId: 1,
  }),
  intent: adminIntent,
  senderAddress,
  feePayerAddress,
  moduleAddress,
  now,
}), /network_mismatch/)

console.log(JSON.stringify({
  canonicalWeightedVote: true,
  canonicalAdminVote: true,
  typedArgumentTamperRejected: true,
  gasPolicyValidated: true,
  networkValidated: true,
}, null, 2))
