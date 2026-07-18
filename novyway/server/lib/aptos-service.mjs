import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import {
  AccountAuthenticator,
  Aptos,
  AptosConfig,
  Deserializer,
  Ed25519Account,
  Ed25519PrivateKey,
  Network,
  SimpleTransaction,
} from '@aptos-labs/ts-sdk'
import { secretsRoot } from './runtime-paths.mjs'
import { protectSecretFile } from './credentials.mjs'

const moduleAddress = process.env.APTOS_MODULE_ADDRESS
  ?? '0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411'
const relayerPath = join(secretsRoot, 'testnet-relayer.key')
export const publishedPackageEvidence = Object.freeze({
  name: 'AptosVotingCore',
  sourceDigest: '120BF272B9879B1FCF8FA97B6124EFD2A55E028D306A881AEE1ABCC8356E5516',
  moduleHashes: Object.freeze({
    weighted_voting: 'ca8277cbbffdde01a0c8d3282fa4ed7458bdcd129503e64ab098b39a7c2d4049',
    admin_election: 'c07c4c1389caa1fb056ed04977858cf2be4dc67a8fd148f43f7f701ace4d3641',
    document_anchor: 'e350de3ccde2ed52170ed682d4e898cb6d5bec6ebb4fe9d3bb971a81491411ef',
  }),
})
const publishedModuleHashes = publishedPackageEvidence.moduleHashes
const deploymentGeneration = process.env.APTOS_DEPLOYMENT_GENERATION
  ?? `testnet-g1-${publishedPackageEvidence.sourceDigest.slice(0, 16).toLowerCase()}`

export const aptosClient = new Aptos(new AptosConfig({ network: Network.TESTNET }))

function loadOrCreateRelayer() {
  const readRelayer = () => new Ed25519Account({ privateKey: new Ed25519PrivateKey(readFileSync(relayerPath, 'utf8').trim()) })
  if (existsSync(relayerPath)) return readRelayer()
  const account = Ed25519Account.generate()
  try {
    writeFileSync(relayerPath, account.privateKey.toString(), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    protectSecretFile(relayerPath)
    return account
  } catch (error) {
    if (error?.code === 'EEXIST') return readRelayer()
    throw error
  }
}

const relayer = loadOrCreateRelayer()

export const aptosRuntime = {
  network: 'testnet',
  moduleAddress,
  relayerAddress: relayer.accountAddress.toString(),
  deploymentGeneration,
  sourceParityVerified: false,
  reproducibleSourceVerified: false,
  moduleHashes: {},
  sourceDigest: {},
}

let parityCache = { checkedAt: 0, verified: false, hashes: {}, sourceDigest: {} }

export async function verifyPublishedModules({ force = false } = {}) {
  if (!force && Date.now() - parityCache.checkedAt < 5 * 60_000) return parityCache
  try {
    const [entries, packageRegistry] = await Promise.all([
      Promise.all(Object.entries(publishedModuleHashes).map(async ([name, expected]) => {
        const module = await aptosClient.getAccountModule({ accountAddress: moduleAddress, moduleName: name })
        const bytecode = Buffer.from(module.bytecode.replace(/^0x/, ''), 'hex')
        const actual = createHash('sha256').update(bytecode).digest('hex')
        return [name, { expected, actual, bytes: bytecode.length, matches: actual === expected }]
      })),
      aptosClient.getAccountResource({
        accountAddress: moduleAddress,
        resourceType: '0x1::code::PackageRegistry',
      }),
    ])
    const hashes = Object.fromEntries(entries)
    const publishedPackage = packageRegistry.packages?.find((entry) => entry.name === publishedPackageEvidence.name)
    const actualDigest = String(publishedPackage?.source_digest ?? '').toUpperCase()
    const sourceDigest = {
      expected: publishedPackageEvidence.sourceDigest,
      actual: actualDigest,
      matches: actualDigest === publishedPackageEvidence.sourceDigest,
      upgradeNumber: publishedPackage?.upgrade_number ?? null,
    }
    const verified = sourceDigest.matches && Object.values(hashes).every((entry) => entry.matches)
    parityCache = { checkedAt: Date.now(), verified, hashes, sourceDigest }
  } catch (error) {
    parityCache = {
      checkedAt: Date.now(),
      verified: false,
      hashes: { error: error instanceof Error ? error.message : 'module_verification_failed' },
      sourceDigest: { error: error instanceof Error ? error.message : 'package_verification_failed', matches: false },
    }
  }
  aptosRuntime.sourceParityVerified = parityCache.verified
  aptosRuntime.reproducibleSourceVerified = parityCache.sourceDigest.matches === true
  aptosRuntime.moduleHashes = parityCache.hashes
  aptosRuntime.sourceDigest = parityCache.sourceDigest
  return parityCache
}

export async function governanceCreator() {
  const result = await aptosClient.view({
    payload: { function: `${moduleAddress}::weighted_voting::creator`, functionArguments: [] },
  })
  if (typeof result[0] !== 'string') throw new Error('invalid_governance_creator')
  return result[0].toLowerCase()
}

export async function governanceAccess(accountAddress) {
  const address = accountAddress.toLowerCase()
  const [creator, adminResult] = await Promise.all([
    governanceCreator(),
    aptosClient.view({ payload: { function: `${moduleAddress}::weighted_voting::is_admin`, functionArguments: [address] } }),
  ])
  return { creator, isCreator: address === creator, isAdmin: Boolean(adminResult[0]) }
}

function byteVectorHex(value) {
  if (typeof value === 'string') {
    if (/^0x[0-9a-f]*$/i.test(value)) return value.toLowerCase()
    return `0x${Buffer.from(value, 'utf8').toString('hex')}`
  }
  if (Array.isArray(value)) return `0x${Buffer.from(value.map(Number)).toString('hex')}`
  return null
}

export async function qualificationSnapshot(accountAddress) {
  const address = accountAddress.toLowerCase()
  const counters = await aptosClient.view({
    payload: { function: `${moduleAddress}::weighted_voting::counters`, functionArguments: [] },
  })
  const categoryCount = Number(counters[0])
  if (!Number.isSafeInteger(categoryCount) || categoryCount < 0 || categoryCount > 512) {
    throw new Error('invalid_category_count')
  }
  const snapshots = await Promise.all(Array.from({ length: categoryCount }, async (_, categoryId) => {
    const result = await aptosClient.view({
      payload: {
        function: `${moduleAddress}::weighted_voting::current_qualification`,
        functionArguments: [address, String(categoryId)],
      },
    })
    const changedAtSecs = Number(result[7])
    return {
      found: Boolean(result[0]),
      categoryId: String(categoryId),
      level: Number(result[1]),
      eligible: Boolean(result[2]),
      evidenceHash: byteVectorHex(result[3]),
      manualWeight: String(result[4]),
      membershipVersion: String(result[5]),
      changeId: String(result[6]),
      confirmedAt: Number.isFinite(changedAtSecs) && changedAtSecs > 0
        ? new Date(changedAtSecs * 1000).toISOString()
        : new Date(0).toISOString(),
    }
  }))
  return snapshots.filter((snapshot) => snapshot.found)
}

export function createManagedAccount() {
  const account = Ed25519Account.generate()
  return { aptosAddress: account.accountAddress.toString(), privateKey: account.privateKey.toString() }
}

export async function aptosStatus() {
  const started = performance.now()
  try {
    const [ledger, balance, parity] = await Promise.all([
      aptosClient.getLedgerInfo(),
      aptosClient.getAccountAPTAmount({ accountAddress: relayer.accountAddress }).catch(() => 0),
      verifyPublishedModules(),
    ])
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - started),
      ledgerVersion: ledger.ledger_version,
      chainId: ledger.chain_id,
      relayerAddress: aptosRuntime.relayerAddress,
      relayerBalanceOctas: String(balance),
      relayerBalanceApt: Number(balance) / 100_000_000,
      sourceParityVerified: parity.verified,
      reproducibleSourceVerified: parity.sourceDigest.matches === true,
      moduleHashes: parity.hashes,
      sourceDigest: parity.sourceDigest,
    }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      relayerAddress: aptosRuntime.relayerAddress,
      error: error instanceof Error ? error.message : 'aptos_unavailable',
      sourceParityVerified: false,
      reproducibleSourceVerified: false,
      moduleHashes: parityCache.hashes,
      sourceDigest: parityCache.sourceDigest,
    }
  }
}

export async function buildSponsoredVote({ senderAddress, electionId, yesBps, noBps, abstainBps }) {
  const transaction = await aptosClient.transaction.build.simple({
    sender: senderAddress,
    withFeePayer: true,
    data: {
      function: `${moduleAddress}::weighted_voting::cast_vote`,
      functionArguments: [electionId, yesBps, noBps, abstainBps],
    },
    options: {
      maxGasAmount: 10_000,
      gasUnitPrice: 100,
      expireTimestamp: Math.floor(Date.now() / 1000) + 300,
    },
  })
  transaction.feePayerAddress = relayer.accountAddress
  return {
    rawTransactionB64: Buffer.from(transaction.bcsToBytes()).toString('base64'),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    preview: {
      network: 'testnet',
      senderAddress,
      feePayerAddress: relayer.accountAddress.toString(),
      function: `${moduleAddress}::weighted_voting::cast_vote`,
      arguments: { electionId, yesBps, noBps, abstainBps },
    },
  }
}

export async function buildSponsoredEqualAdminVote({ senderAddress, adminElectionId, choice }) {
  const transaction = await aptosClient.transaction.build.simple({
    sender: senderAddress,
    withFeePayer: true,
    data: {
      function: `${moduleAddress}::admin_election::cast_equal_vote`,
      functionArguments: [adminElectionId, choice],
    },
    options: {
      maxGasAmount: 10_000,
      gasUnitPrice: 100,
      expireTimestamp: Math.floor(Date.now() / 1000) + 300,
    },
  })
  transaction.feePayerAddress = relayer.accountAddress
  return {
    rawTransactionB64: Buffer.from(transaction.bcsToBytes()).toString('base64'),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    preview: {
      network: 'testnet', senderAddress, feePayerAddress: relayer.accountAddress.toString(),
      function: `${moduleAddress}::admin_election::cast_equal_vote`,
      arguments: { adminElectionId, choice },
    },
  }
}

export function deserializeTransaction(rawTransactionB64) {
  const bytes = Buffer.from(rawTransactionB64, 'base64')
  return SimpleTransaction.deserialize(new Deserializer(bytes))
}

export function deserializeAuthenticator(senderAuthenticatorB64) {
  const bytes = Buffer.from(senderAuthenticatorB64, 'base64')
  return AccountAuthenticator.deserialize(new Deserializer(bytes))
}

export async function submitSponsoredVote({ transaction, senderAuthenticator }) {
  const feePayerAuthenticator = aptosClient.transaction.signAsFeePayer({ signer: relayer, transaction })
  return aptosClient.transaction.submit.simple({
    transaction,
    senderAuthenticator,
    feePayerAuthenticator,
  })
}

export async function submitManagedSponsoredVote({ transaction, privateKey }) {
  const signer = new Ed25519Account({ privateKey: new Ed25519PrivateKey(privateKey) })
  if (transaction.rawTransaction.sender.toString().toLowerCase() !== signer.accountAddress.toString().toLowerCase()) {
    throw Object.assign(new Error('managed_wallet_sender_mismatch'), { status: 403 })
  }
  const senderAuthenticator = aptosClient.transaction.sign({ signer, transaction })
  return submitSponsoredVote({ transaction, senderAuthenticator })
}

export async function waitForVote(txHash) {
  return aptosClient.waitForTransaction({ transactionHash: txHash, options: { timeoutSecs: 30, checkSuccess: false } })
}

function normalizeAptosAddress(value) {
  const hex = String(value ?? '').toLowerCase().replace(/^0x/, '')
  if (!/^[0-9a-f]{1,64}$/.test(hex)) throw new Error('invalid_aptos_address')
  return `0x${hex.padStart(64, '0')}`
}

function textFromMoveBytes(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]*$/i.test(value)) throw new Error('invalid_move_text_bytes')
  return Buffer.from(value.slice(2), 'hex').toString('utf8')
}

export async function verifyElectionCreation({
  txHash,
  expectedAdmin,
  expectedCategoryId,
  expectedMetadataHash,
  expectedMetadataUri,
  expectedEndsAtSecs,
  expectedPassBps,
  expectedQuorumBps,
  expectedAllowRevote,
}) {
  if (!/^0x[0-9a-f]{64}$/i.test(txHash)) throw Object.assign(new Error('invalid_transaction_hash'), { status: 400 })
  const transaction = await aptosClient.waitForTransaction({
    transactionHash: txHash,
    options: { timeoutSecs: 30, checkSuccess: false },
  })
  if (transaction.type !== 'user_transaction' || transaction.success !== true) {
    throw Object.assign(new Error('election_transaction_failed'), { status: 409 })
  }
  if (normalizeAptosAddress(transaction.sender) !== normalizeAptosAddress(expectedAdmin)) {
    throw Object.assign(new Error('election_sender_mismatch'), { status: 403 })
  }
  const expectedFunction = `${moduleAddress}::weighted_voting::create_election`.toLowerCase()
  if (String(transaction.payload?.function ?? '').toLowerCase() !== expectedFunction) {
    throw Object.assign(new Error('election_function_mismatch'), { status: 409 })
  }

  const access = await governanceAccess(expectedAdmin)
  if (!access.isAdmin) throw Object.assign(new Error('governance_admin_required'), { status: 403 })

  const expectedEventType = `${moduleAddress}::weighted_voting::ElectionCreated`.toLowerCase()
  const events = (transaction.events ?? []).filter((event) => String(event.type).toLowerCase() === expectedEventType)
  if (events.length !== 1) throw Object.assign(new Error('election_created_event_mismatch'), { status: 409 })
  const event = events[0].data ?? {}
  if (normalizeAptosAddress(event.creator) !== normalizeAptosAddress(expectedAdmin)
    || String(event.category_id) !== String(expectedCategoryId)) {
    throw Object.assign(new Error('election_created_event_data_mismatch'), { status: 409 })
  }
  const electionId = String(event.election_id)
  if (!/^\d+$/.test(electionId)) throw Object.assign(new Error('invalid_election_id'), { status: 409 })

  const election = await aptosClient.view({
    payload: {
      function: `${moduleAddress}::weighted_voting::election`,
      functionArguments: [electionId],
    },
  })
  const immutableStateMatches = normalizeAptosAddress(election[0]) === normalizeAptosAddress(expectedAdmin)
    && String(election[1]) === String(expectedCategoryId)
    && String(election[2]).toLowerCase() === expectedMetadataHash.toLowerCase()
    && textFromMoveBytes(election[3]) === expectedMetadataUri
    && Number(election[6]) === Number(expectedPassBps)
    && Number(election[7]) === Number(expectedQuorumBps)
    && Boolean(election[9]) === Boolean(expectedAllowRevote)
    && String(election[11]) === String(expectedEndsAtSecs)
  if (!immutableStateMatches) throw Object.assign(new Error('election_state_mismatch'), { status: 409 })

  return {
    electionId,
    sender: normalizeAptosAddress(transaction.sender),
    txHash: String(transaction.hash).toLowerCase(),
    ledgerVersion: String(transaction.version),
    chainId: 2,
    moduleAddress: normalizeAptosAddress(moduleAddress),
    deploymentGeneration,
  }
}

export async function verifyElectionFinalization({ txHash, expectedSender, expectedElectionId }) {
  if (!/^0x[0-9a-f]{64}$/i.test(txHash)) throw Object.assign(new Error('invalid_transaction_hash'), { status: 400 })
  const transaction = await aptosClient.waitForTransaction({
    transactionHash: txHash,
    options: { timeoutSecs: 30, checkSuccess: false },
  })
  if (transaction.type !== 'user_transaction' || transaction.success !== true) {
    throw Object.assign(new Error('finalization_transaction_failed'), { status: 409 })
  }
  if (normalizeAptosAddress(transaction.sender) !== normalizeAptosAddress(expectedSender)) {
    throw Object.assign(new Error('finalization_sender_mismatch'), { status: 403 })
  }
  const expectedFunction = `${moduleAddress}::weighted_voting::finalize`.toLowerCase()
  if (String(transaction.payload?.function ?? '').toLowerCase() !== expectedFunction) {
    throw Object.assign(new Error('finalization_function_mismatch'), { status: 409 })
  }

  const expectedEventType = `${moduleAddress}::weighted_voting::ElectionFinalized`.toLowerCase()
  const events = (transaction.events ?? []).filter((event) => String(event.type).toLowerCase() === expectedEventType)
  if (events.length !== 1) throw Object.assign(new Error('election_finalized_event_mismatch'), { status: 409 })
  const event = events[0].data ?? {}
  if (String(event.election_id) !== String(expectedElectionId)) {
    throw Object.assign(new Error('election_finalized_event_data_mismatch'), { status: 409 })
  }

  const [result, tallies] = await Promise.all([
    aptosClient.view({
      payload: {
        function: `${moduleAddress}::weighted_voting::election_result`,
        functionArguments: [String(expectedElectionId)],
      },
    }),
    aptosClient.view({
      payload: {
        function: `${moduleAddress}::weighted_voting::election_tallies`,
        functionArguments: [String(expectedElectionId)],
      },
    }),
  ])
  if (result[0] !== true
    || Boolean(event.quorum_met) !== Boolean(result[1])
    || Boolean(event.passed) !== Boolean(result[2])
    || String(event.yes_units) !== String(tallies[0])
    || String(event.no_units) !== String(tallies[1])
    || String(event.abstain_units) !== String(tallies[2])) {
    throw Object.assign(new Error('election_finalization_state_mismatch'), { status: 409 })
  }

  return {
    electionId: String(expectedElectionId),
    sender: normalizeAptosAddress(transaction.sender),
    txHash: String(transaction.hash).toLowerCase(),
    ledgerVersion: String(transaction.version),
    quorumMet: Boolean(result[1]),
    passed: Boolean(result[2]),
  }
}
