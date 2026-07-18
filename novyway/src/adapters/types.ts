// ==========================================================
// Границы интеграции (SITE_CONNECTIONS.md).
// UI не импортирует Aptos SDK напрямую — только эти интерфейсы.
// Demo-runtime реализует их локально; AptosRuntime — поверх SDK.
// ==========================================================

import type { Bps } from '../domain/types'

export type ChainU64 = string
export type HexHash = `0x${string}`

export interface AptosVotingCounters {
  categories: ChainU64
  adminChanges: ChainU64
  categoryChanges: ChainU64
  policyProposals: ChainU64
  policyChanges: ChainU64
  qualificationProposals: ChainU64
  qualificationChanges: ChainU64
  elections: ChainU64
}

export interface TxReceipt {
  hash: HexHash
  status: 'submitted' | 'success' | 'failed'
  network: 'demo' | 'testnet' | 'mainnet'
  explorerUrl: string
}

export interface ConnectedAccount {
  address: string
  publicKey?: string
}

export interface AptosReadGateway {
  isConfigured(): boolean
  adminThreshold(): Promise<string>
  versions(): Promise<[string, string, string]>
  category(id: ChainU64): Promise<unknown[]>
  categoryPolicy(id: ChainU64): Promise<unknown[]>
  qualification(account: string, categoryId: ChainU64): Promise<unknown[]>
  election(id: ChainU64): Promise<unknown[]>
  electionSnapshot(id: ChainU64): Promise<unknown[]>
  electionTallies(id: ChainU64): Promise<unknown[]>
  electionResult(id: ChainU64): Promise<unknown[]>
  voteOf(id: ChainU64, account: string): Promise<unknown[]>
  // расширения по плану интеграции:
  admins(): Promise<string[]>
  counters(): Promise<AptosVotingCounters>
  voteRevision(electionId: ChainU64, historyId: ChainU64): Promise<unknown[]>
}

export interface DocumentAnchorRecord {
  anchorId: ChainU64
  documentKey: HexHash
  revision: ChainU64
  contentHash: HexHash
  parentContentHash: HexHash | '0x'
  metadataHash: HexHash
  recoveryBundleHash: HexHash | '0x'
  contentBytes: ChainU64
  mimeType: string
  metadataUri: string
  version: string
  anchoredBy: string
  anchoredAtSecs: ChainU64
}

export interface DocumentAnchorGateway {
  isConfigured(): boolean
  anchorCount(): Promise<ChainU64>
  anchor(anchorId: ChainU64): Promise<DocumentAnchorRecord>
}

export interface CreateElectionInput {
  categoryId: ChainU64
  metadataHash: HexHash
  metadataUri: string
  startsAtSecs: ChainU64
  endsAtSecs: ChainU64
  passBps: Bps
  quorumBps: Bps
  allowRevote: boolean
}

export interface CastVoteInput {
  electionId: ChainU64
  yesBps: Bps
  noBps: Bps
  abstainBps: Bps
  clientRequestId: string // идемпотентность relayer-запросов
}

export interface ProposeQualificationInput {
  account: string
  categoryId: ChainU64
  level: 0 | 1 | 2 | 3
  eligible: boolean
  evidenceHash: HexHash
  manualWeight: ChainU64 // "0" = автоматический расчёт
  reasonUri: string
  lifetimeSecs: ChainU64
}

export interface VotingWriteGateway {
  connect(): Promise<ConnectedAccount>
  disconnect(): Promise<void>
  createElection(input: CreateElectionInput): Promise<TxReceipt>
  castVote(input: CastVoteInput): Promise<TxReceipt>
  finalizeElection(electionId: ChainU64): Promise<TxReceipt>
  proposeQualification(input: ProposeQualificationInput): Promise<TxReceipt>
  approveQualification(proposalId: ChainU64): Promise<TxReceipt>
}

export interface AppError {
  code:
    | 'WALLET_NOT_CONNECTED' | 'USER_REJECTED_SIGNATURE' | 'INSUFFICIENT_GAS'
    | 'RELAYER_RATE_LIMITED' | 'CHAIN_VALIDATION_FAILED' | 'INDEXER_STALE'
    | 'DOCUMENT_HASH_MISMATCH' | string
  title: string
  detail: string
  retryable: boolean
  txHash?: string
}

export type RuntimeMode = 'demo' | 'aptos-testnet' | 'aptos-mainnet'

export function currentRuntimeMode(): RuntimeMode {
  const m = import.meta.env?.VITE_RUNTIME_MODE
  return m === 'aptos-testnet' || m === 'aptos-mainnet' ? m : 'demo'
}
