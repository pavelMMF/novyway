import { TransactionPayloadEntryFunction, U64, U8 } from '@aptos-labs/ts-sdk'

const TESTNET_CHAIN_ID = 2
const MAX_GAS_AMOUNT = 10_000n
const GAS_UNIT_PRICE = 100n

function reject(code) {
  const error = new Error(code)
  error.code = code
  throw error
}

function normalizedAddress(value) {
  return String(value ?? '').toLowerCase()
}

function entryArgumentBytes(argument) {
  const value = argument?.value?.value
  return value instanceof Uint8Array ? Buffer.from(value) : null
}

function matchesArgument(argument, expected) {
  const actual = entryArgumentBytes(argument)
  return actual !== null && actual.equals(Buffer.from(expected.bcsToBytes()))
}

function expectedCall(intent) {
  if (intent.intent_kind === 'weighted_vote') {
    return {
      moduleName: 'weighted_voting',
      functionName: 'cast_vote',
      arguments: [
        new U64(intent.election_id),
        new U64(intent.yes_bps),
        new U64(intent.no_bps),
        new U64(intent.abstain_bps),
      ],
    }
  }
  if (intent.intent_kind === 'admin_equal_vote') {
    const allocations = [Number(intent.yes_bps), Number(intent.no_bps), Number(intent.abstain_bps)]
    const choiceIndex = allocations.findIndex((value) => value === 10_000)
    if (choiceIndex < 0 || allocations.filter((value) => value === 10_000).length !== 1
      || allocations.some((value, index) => index !== choiceIndex && value !== 0)) {
      reject('invalid_admin_vote_intent')
    }
    return {
      moduleName: 'admin_election',
      functionName: 'cast_equal_vote',
      arguments: [new U64(intent.election_id), new U8(choiceIndex + 1)],
    }
  }
  reject('unsupported_vote_intent')
}

export function validateSponsoredVoteTransaction({ transaction, intent, senderAddress, feePayerAddress, moduleAddress, now = Date.now() }) {
  const raw = transaction?.rawTransaction
  if (!raw || normalizedAddress(raw.sender?.toString()) !== normalizedAddress(senderAddress)
    || normalizedAddress(intent.sender_address) !== normalizedAddress(senderAddress)) reject('sender_mismatch')
  if (normalizedAddress(transaction.feePayerAddress?.toString()) !== normalizedAddress(feePayerAddress)) reject('fee_payer_mismatch')
  if (raw.chain_id?.chainId !== TESTNET_CHAIN_ID) reject('network_mismatch')
  if (raw.max_gas_amount !== MAX_GAS_AMOUNT || raw.gas_unit_price !== GAS_UNIT_PRICE) reject('gas_policy_mismatch')

  const rawExpiry = Number(raw.expiration_timestamp_secs)
  const intentExpiry = Math.floor(Date.parse(intent.expires_at) / 1000)
  if (!Number.isSafeInteger(rawExpiry) || !Number.isSafeInteger(intentExpiry)
    || rawExpiry <= Math.floor(now / 1000) || rawExpiry > intentExpiry) reject('intent_expiration_mismatch')

  const expected = expectedCall(intent)
  if (!(raw.payload instanceof TransactionPayloadEntryFunction)) reject('intent_transaction_mismatch')
  const call = raw.payload.entryFunction
  if (normalizedAddress(call.module_name.address.toString()) !== normalizedAddress(moduleAddress)
    || call.module_name.name.identifier !== expected.moduleName
    || call.function_name.identifier !== expected.functionName
    || call.type_args.length !== 0
    || call.args.length !== expected.arguments.length
    || !call.args.every((argument, index) => matchesArgument(argument, expected.arguments[index]))) {
    reject('intent_transaction_mismatch')
  }
  return true
}
