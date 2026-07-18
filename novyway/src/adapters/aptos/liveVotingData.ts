import type { AuditEvent, AuditEventType, ElectionStatus } from '../../domain/types'
import type { AptosReadGateway, AptosVotingCounters } from '../types'
import { configuredAptosRpc, configuredVotingModule, createAptosReadGateway } from './aptosReadGateway'

type FourStrings = [string, string, string, string]

export interface LiveCategory {
  id: string
  name: string
  metadataUri: string
  active: boolean
  policyVersion: string
  createdAtSecs: string
  updatedAtSecs: string
  quotas: FourStrings
  floors: FourStrings
  maxIndividualWeight: string
  counts: FourStrings
  manualCounts: FourStrings
  manualSums: FourStrings
}

export interface LiveElectionSnapshot {
  quotas: FourStrings
  floors: FourStrings
  maxIndividualWeight: string
  counts: FourStrings
  manualCounts: FourStrings
  manualSums: FourStrings
  targets: FourStrings
  derivedWeights: FourStrings
  remainders: FourStrings
  eligibleTotal: string
}

export interface LiveElection {
  id: string
  createdBy: string
  categoryId: string
  metadataHash: string
  metadataUri: string
  membershipVersion: string
  policyVersion: string
  passBps: number
  quorumBps: number
  quorumWeight: string
  allowRevote: boolean
  startsAtSecs: string
  endsAtSecs: string
  rawStatus: number
  eligibleTotal: string
  quorumMet: boolean
  passed: boolean
  finalizedAtSecs: string
  yesUnits: string
  noUnits: string
  abstainUnits: string
  uniqueVoters: string
  finalized: boolean
  status: ElectionStatus
  snapshot: LiveElectionSnapshot
}

export interface LiveVotingState {
  ledgerVersion: string
  chainId: number
  ledgerTimestampUsecs: string
  counters: AptosVotingCounters
  versions: { council: string; policy: string; membership: string }
  administrators: string[]
  adminThreshold: string
  categories: LiveCategory[]
  elections: LiveElection[]
}

export interface LiveAuditEvent extends AuditEvent {
  ledgerVersion: string
  functionName: string
}

function textFromBytes(value: unknown) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]*$/i.test(value)) throw new Error('Aptos returned invalid text bytes')
  if (value === '0x') return ''
  const pairs = value.slice(2).match(/.{1,2}/g) ?? []
  return new TextDecoder().decode(Uint8Array.from(pairs, (pair) => Number.parseInt(pair, 16)))
}

function stringValue(value: unknown, label: string) {
  if (typeof value !== 'string') throw new Error(`Aptos returned invalid ${label}`)
  return value
}

function booleanValue(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`Aptos returned invalid ${label}`)
  return value
}

function numberValue(value: unknown, label: string) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  throw new Error(`Aptos returned invalid ${label}`)
}

function vector4(value: unknown, label: string): FourStrings {
  if (!Array.isArray(value) || value.length !== 4 || value.some((item) => typeof item !== 'string')) throw new Error(`Aptos returned invalid ${label}`)
  return value as FourStrings
}

function electionStatus(rawStatus: number, startsAtSecs: string, endsAtSecs: string, finalized: boolean, quorumMet: boolean, passed: boolean): ElectionStatus {
  if (finalized || rawStatus === 1) return !quorumMet ? 'quorum_failed' : passed ? 'passed' : 'rejected'
  const now = Date.now() / 1000
  if (now < Number(startsAtSecs)) return 'upcoming'
  if (now <= Number(endsAtSecs)) return 'active'
  return 'awaiting_finalization'
}

async function loadCategory(gateway: AptosReadGateway, id: number): Promise<LiveCategory> {
  const [category, policy] = await Promise.all([gateway.category(String(id)), gateway.categoryPolicy(String(id))])
  if (category.length !== 6 || policy.length !== 6) throw new Error(`Aptos returned an invalid category ${id}`)
  return {
    id: String(id),
    name: textFromBytes(category[0]),
    metadataUri: textFromBytes(category[1]),
    active: booleanValue(category[2], 'category state'),
    policyVersion: stringValue(category[3], 'policy version'),
    createdAtSecs: stringValue(category[4], 'category creation time'),
    updatedAtSecs: stringValue(category[5], 'category update time'),
    quotas: vector4(policy[0], 'category quotas'),
    floors: vector4(policy[1], 'category floors'),
    maxIndividualWeight: stringValue(policy[2], 'weight cap'),
    counts: vector4(policy[3], 'category counts'),
    manualCounts: vector4(policy[4], 'manual counts'),
    manualSums: vector4(policy[5], 'manual sums'),
  }
}

async function loadElection(gateway: AptosReadGateway, id: number): Promise<LiveElection> {
  const [raw, snapshotRaw, tallies, result] = await Promise.all([
    gateway.election(String(id)), gateway.electionSnapshot(String(id)), gateway.electionTallies(String(id)), gateway.electionResult(String(id)),
  ])
  if (raw.length !== 17 || snapshotRaw.length !== 10 || tallies.length !== 4 || result.length !== 3) throw new Error(`Aptos returned an invalid election ${id}`)
  const startsAtSecs = stringValue(raw[10], 'election start')
  const endsAtSecs = stringValue(raw[11], 'election end')
  const finalized = booleanValue(result[0], 'finalization state')
  const quorumMet = booleanValue(result[1], 'quorum state')
  const passed = booleanValue(result[2], 'election result')
  const snapshot: LiveElectionSnapshot = {
    quotas: vector4(snapshotRaw[0], 'snapshot quotas'),
    floors: vector4(snapshotRaw[1], 'snapshot floors'),
    maxIndividualWeight: stringValue(snapshotRaw[2], 'snapshot cap'),
    counts: vector4(snapshotRaw[3], 'snapshot counts'),
    manualCounts: vector4(snapshotRaw[4], 'snapshot manual counts'),
    manualSums: vector4(snapshotRaw[5], 'snapshot manual sums'),
    targets: vector4(snapshotRaw[6], 'snapshot targets'),
    derivedWeights: vector4(snapshotRaw[7], 'snapshot weights'),
    remainders: vector4(snapshotRaw[8], 'snapshot remainders'),
    eligibleTotal: stringValue(snapshotRaw[9], 'eligible total'),
  }
  const rawStatus = numberValue(raw[12], 'election status')
  return {
    id: String(id), createdBy: stringValue(raw[0], 'creator'), categoryId: stringValue(raw[1], 'category id'),
    metadataHash: stringValue(raw[2], 'metadata hash'), metadataUri: textFromBytes(raw[3]),
    membershipVersion: stringValue(raw[4], 'membership version'), policyVersion: stringValue(raw[5], 'policy version'),
    passBps: Number(stringValue(raw[6], 'pass threshold')), quorumBps: Number(stringValue(raw[7], 'quorum threshold')),
    quorumWeight: stringValue(raw[8], 'quorum weight'), allowRevote: booleanValue(raw[9], 'revote policy'),
    startsAtSecs, endsAtSecs, rawStatus, eligibleTotal: stringValue(raw[13], 'eligible total'),
    quorumMet, passed, finalizedAtSecs: stringValue(raw[16], 'finalization time'),
    yesUnits: stringValue(tallies[0], 'yes tally'), noUnits: stringValue(tallies[1], 'no tally'),
    abstainUnits: stringValue(tallies[2], 'abstain tally'), uniqueVoters: stringValue(tallies[3], 'voter count'),
    finalized, status: electionStatus(rawStatus, startsAtSecs, endsAtSecs, finalized, quorumMet, passed), snapshot,
  }
}

let votingCache: Promise<LiveVotingState> | undefined

async function currentLedgerInfo() {
  const response = await fetch(configuredAptosRpc())
  if (!response.ok) throw new Error(`Aptos ledger ${response.status}`)
  const ledger: unknown = await response.json()
  if (!ledger || typeof ledger !== 'object') throw new Error('Aptos returned invalid ledger information')
  const value = ledger as { ledger_version?: unknown; chain_id?: unknown; ledger_timestamp?: unknown }
  if (typeof value.ledger_version !== 'string' || typeof value.chain_id !== 'number' || typeof value.ledger_timestamp !== 'string') throw new Error('Aptos returned invalid ledger information')
  return { ledgerVersion: value.ledger_version, chainId: value.chain_id, ledgerTimestampUsecs: value.ledger_timestamp }
}

async function mapLimited<T>(length: number, limit: number, worker: (index: number) => Promise<T>) {
  const output = new Array<T>(length)
  let next = 0
  async function run() {
    while (next < length) {
      const index = next
      next += 1
      output[index] = await worker(index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, length) }, run))
  return output
}

export function loadLiveVotingState(refresh = false) {
  if (!votingCache || refresh) {
    votingCache = (async () => {
      const { ledgerVersion, chainId, ledgerTimestampUsecs } = await currentLedgerInfo()
      const gateway = createAptosReadGateway(ledgerVersion)
      const [counters, versions, administrators, adminThreshold] = await Promise.all([gateway.counters(), gateway.versions(), gateway.admins(), gateway.adminThreshold()])
      const categoryCount = Number(counters.categories)
      const electionCount = Number(counters.elections)
      if (!Number.isSafeInteger(categoryCount) || categoryCount < 0 || categoryCount > 100) throw new Error('Aptos category count is outside the supported range')
      if (!Number.isSafeInteger(electionCount) || electionCount < 0 || electionCount > 500) throw new Error('Aptos election count is outside the supported range')
      return {
        ledgerVersion,
        chainId,
        ledgerTimestampUsecs,
        counters,
        versions: { council: versions[0], policy: versions[1], membership: versions[2] },
        administrators,
        adminThreshold,
        categories: await mapLimited(categoryCount, 6, (id) => loadCategory(gateway, id)),
        elections: await mapLimited(electionCount, 6, (id) => loadElection(gateway, id)),
      }
    })()
  }
  return votingCache
}

const knownTransactions = [
  '0xbb7dfa48447d7997c01a5f7b40aba94ecf4a23edc6757431a895f6e693ebd35b',
  '0x37afe5c89d9e8406336a03a2d2bbc217219ab5e78bdeca909f528abbf7483838',
  '0x541965188c24e0c7bcc95699e08686e636dbf7322ee4fe20dfec6c3bbc273efc',
  '0x3794757338d171aa6bc63c9713bfcdf311f0ed03b57b13e0d5024fd20e6933d7',
  '0x10a0c64623b726f66d9164ac00b49c5db13c6095778f61f2765504e86bc11e95',
  '0x9700e8001070032372e4d302d395e73e8b0ee037d7fbb5ce4cc6fdbb3a8556a8',
  '0xe84824da078b9742c03a17ff20551c7d08a688baa294746ebd24f63e0468cdca',
  '0x764adf429ff35456879859a18a4966200b998a0c9e1dbeeb54ea65ec2fffc33d',
  '0x28a25dcd2259690a0efe7cbb22bd43270ca27dbb81ca2cb62db29bffbc7a1003',
  '0xf1fdca618f4a838ce9e3e2febcf30f7000c28e1f9f078fe259ea902860e0223c',
  '0x4fbe05bf2a0b882e45b7b1c396cdf7ef5f7ecb533372ae5cac4f40428242e446',
  '0xc5c207324a1df3b4848bda0c72ba9f781cac7b9f598b6b07544d7736eedff66c',
  '0xcd9d3df1d55d853e2762344138feb60e4a6f9f54a46c8acd27ad30c6afe70b69',
  '0x85cb21f1132c7e432d859e14584ce160a7b7210261961017a3b21b18eee58838',
  '0xfc139d51acb7433a02b4328fdce14fd65146569dfa8d9418a0ddb71de4f2fcab',
  '0x0abf7d54c2decb6ac2ff428bcdd4a7130a9609c259f1f6ed28e053cd3b3fbd05',
  '0x60b80aadb8b54ae309bf5474411e877b4e7ca5b5d97b6be05ab0234a61c8425b',
  '0x9cc0680c273e8ddc4fba87c7b73027f2e1dbd76544d1230b5d006cb3dc1e1d62',
  '0x8a8c1237e157818c17217178e75a5d90b86f7ac5a6c7fa4d772fe8dbdcdbadd6',
  '0x4600bfbeca78a01e81a9541e801694212062893361662ecc387199ca6fe231d1',
  '0xa67a387678072fbeb1032cf0569665ec0fb6822e2033123034466d16d3c1f38d',
  '0xdf1f33c0d2f5667c0ef451f3cec98df998c3419ee568dfbd717f3768e0486771',
  '0x75db6dfc959079dbd90e0bbe262aeb9c984f0a6997bc624ea2f94615f53236fe',
] as const

async function recordedTransactionHashes() {
  try {
    const response = await fetch('/api/v1/chain-transactions', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (!response.ok) return []
    const body: unknown = await response.json()
    if (!body || typeof body !== 'object' || !Array.isArray((body as { transactionHashes?: unknown }).transactionHashes)) return []
    return (body as { transactionHashes: unknown[] }).transactionHashes
      .filter((value): value is string => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value))
      .map((value) => value.toLowerCase())
  } catch {
    return []
  }
}

interface AptosTransaction {
  type?: string
  hash: string
  version: string
  sender: string
  timestamp: string
  success: boolean
  vm_status?: string
  payload?: { function?: string }
  events?: Array<{ type: string; data: Record<string, unknown> }>
}

function eventType(name: string, data: Record<string, unknown>): AuditEventType {
  if (name === 'VoteCast') return Number(data.revision ?? 1) > 1 ? 'revote' : 'vote'
  if (name.includes('ElectionCreated')) return 'election_created'
  if (name.includes('ElectionFinalized')) return 'finalized'
  if (name.includes('Qualification')) return 'qualification'
  if (name.includes('Policy')) return 'policy'
  if (name.includes('Category')) return 'category'
  if (name.includes('Document')) return 'document'
  return 'admin'
}

function humanEvent(name: string, data: Record<string, unknown>) {
  const election = data.election_id !== undefined ? ` #${String(data.election_id)}` : ''
  const category = data.category_id !== undefined ? ` #${String(data.category_id)}` : ''
  const revision = data.revision !== undefined ? `, ревизия ${String(data.revision)}` : ''
  const revisionEn = data.revision !== undefined ? `, revision ${String(data.revision)}` : ''
  const labels: Record<string, { ru: string; en: string }> = {
    GovernanceInitialized: { ru: 'Управление системой инициализировано', en: 'System governance initialized' },
    AdminChanged: { ru: 'Состав администраторов изменён', en: 'Administrator set changed' },
    CategoryChanged: { ru: `Категория${category} изменена`, en: `Category${category} changed` },
    PolicyChangeProposed: { ru: `Предложено изменение правил категории${category}`, en: `Category${category} policy change proposed` },
    PolicyChangeApproved: { ru: `Изменение правил категории${category} одобрено`, en: `Category${category} policy change approved` },
    PolicyChanged: { ru: `Правила категории${category} обновлены`, en: `Category${category} policy updated` },
    QualificationChangeProposed: { ru: `Предложено изменение квалификации в категории${category}`, en: `Qualification change proposed in category${category}` },
    QualificationProposed: { ru: `Предложено изменение квалификации в категории${category}`, en: `Qualification change proposed in category${category}` },
    QualificationApproved: { ru: `Изменение квалификации в категории${category} одобрено`, en: `Qualification change approved in category${category}` },
    QualificationChanged: { ru: `Квалификация в категории${category} изменена`, en: `Qualification changed in category${category}` },
    ElectionCreated: { ru: `Голосование${election} создано со снимком весов`, en: `Election${election} created with a weight snapshot` },
    VoteCast: { ru: `Голос подан в голосовании${election}${revision}`, en: `Ballot cast in election${election}${revisionEn}` },
    ElectionFinalized: { ru: `Голосование${election} завершено: ${data.passed ? 'решение принято' : 'решение не принято'}`, en: `Election${election} finalized: ${data.passed ? 'passed' : 'not passed'}` },
    DocumentAnchored: { ru: 'Отпечаток документа опубликован в сети', en: 'Document fingerprint anchored on-chain' },
    TransactionRecorded: { ru: 'Транзакция пакета подтверждена сетью', en: 'Package transaction confirmed by the network' },
  }
  return labels[name] ?? { ru: `Зафиксировано событие «${name}»`, en: `Recorded ${name} event` }
}

async function fetchTransaction(hash: string): Promise<LiveAuditEvent[]> {
  const response = await fetch(`${configuredAptosRpc()}/transactions/by_hash/${hash}`)
  if (!response.ok) throw new Error(`Aptos transaction ${response.status}`)
  const tx = await response.json() as AptosTransaction
  if (tx.hash.toLowerCase() !== hash.toLowerCase()) throw new Error('Aptos returned a different transaction hash')
  if (tx.type && tx.type !== 'user_transaction') throw new Error('Aptos returned a non-user transaction')
  if (!tx.success) throw new Error(`Aptos transaction failed: ${tx.vm_status ?? 'unknown status'}`)
  const moduleAddress = configuredVotingModule().toLowerCase()
  const events = (tx.events ?? []).filter((event) => event.type.toLowerCase().startsWith(moduleAddress))
  const relevant = events.length ? events : [{ type: `${moduleAddress}::system::TransactionRecorded`, data: {} }]
  return relevant.map((event, index) => {
    const name = event.type.split('::').at(-1) ?? 'TransactionRecorded'
    const type = eventType(name, event.data)
    const electionId = event.data.election_id === undefined ? undefined : `chain-${String(event.data.election_id)}`
    return {
      id: `${tx.hash}:${index}`, type, at: new Date(Number(tx.timestamp) / 1000).toISOString(), actor: tx.sender,
      electionId, txHash: tx.hash as `0x${string}`, human: humanEvent(name, event.data), ledgerVersion: tx.version,
      functionName: tx.payload?.function?.split('::').at(-1) ?? 'transaction',
    }
  })
}

let auditCache: Promise<LiveAuditEvent[]> | undefined

export function loadLiveAudit(refresh = false) {
  if (!auditCache || refresh) {
    auditCache = (async () => {
      const recorded = await recordedTransactionHashes()
      const hashes = [...new Set<string>([...knownTransactions, ...recorded])]
      const results = await Promise.allSettled(hashes.map(fetchTransaction))
      return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []).sort((a, b) => b.at.localeCompare(a.at))
    })()
  }
  return auditCache
}
