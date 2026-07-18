// ==========================================================
// Новый Путь — доменные типы (по PRODUCT_DESIGN_HANDOFF §8, SITE_CONNECTIONS)
// Числа на границах API — строки (chain u64); в demo-режиме
// используем number для простоты, но интерфейсы совместимы.
// ==========================================================

export type QualificationLevel = 0 | 1 | 2 | 3
export type Bps = number // 10000 = 100%
export type HexHash = `0x${string}`

export const WEIGHT_SCALE = 1_000_000

export interface CategoryPolicy {
  categoryId: string
  policyVersion: number
  quotaBps: [Bps, Bps, Bps, Bps] // сумма 10000
  floorWeights: [number, number, number, number] // f0=1
  maxIndividualWeight: number
  active: boolean
  metadataHash: HexHash
}

export interface Category {
  id: string
  slug: string
  name: { ru: string; en: string }
  color: string // цветовой код категории (граф, чипы)
  policy: CategoryPolicy
  registryVersion: number
}

export interface Person {
  address: string
  name?: { ru: string; en: string } // зарегистрированная личность (off-chain реестр)
  role?: 'admin' | 'voter' | 'observer'
  registeredAt?: string
}

export interface QualificationRevision {
  voter: string
  categoryId: string
  level: QualificationLevel
  evidenceHash: HexHash
  confirmedAt: string
  revision: number
  reason: { ru: string; en: string }
}

export interface SnapshotGroup {
  count: number // Nk — допущенные аккаунты уровня
  quotaBps: Bps
  targetUnits: number // Tk
  perAccountWeight: number // wk
  floorWeight: number // fk
}

export interface ElectionSnapshot {
  id: number
  electionId: string
  categoryId: string
  policyVersion: number
  registryVersion: number
  registrationCutoff: string
  groups: [SnapshotGroup, SnapshotGroup, SnapshotGroup, SnapshotGroup]
  scaleS: number
  eligibleWeight: number
  manifestHash: HexHash
}

export interface Clause {
  id: string
  num: string // «п. 4.2»
  title: { ru: string; en: string }
  text: { ru: string; en: string }
  amendment?: Amendment
}

export interface Amendment {
  id: string
  documentId: string
  clauseId: string
  proposedText: { ru: string; en: string }
  rationale: { ru: string; en: string }
  amendmentHash: HexHash
  electionId: string
  kind: 'change' | 'add'
}

export interface DocumentModel {
  id: string
  categoryId: string
  group: string // группа документов (цветовой код в графе)
  primaryTopicId?: string
  secondaryTopicIds?: string[]
  createdAt?: string
  kind?: 'charter' | 'policy' | 'regulation' | 'standard' | 'program'
  title: { ru: string; en: string }
  version: string
  documentHash: HexHash
  clauses: Clause[]
}

export interface DocumentTopic {
  id: string
  name: { ru: string; en: string }
  color: string
}

export interface GraphRelation {
  id: string
  fromDocumentId: string
  toDocumentId: string
  label: { ru: string; en: string }
}

export interface GraphSpace {
  id: string
  name: { ru: string; en: string }
  documentIds: string[]
}

export type ElectionStatus = 'active' | 'upcoming' | 'awaiting_finalization' | 'passed' | 'rejected' | 'quorum_failed'

export interface Election {
  id: string
  categoryId: string
  documentId: string
  amendmentId: string
  title: { ru: string; en: string }
  startsAt: string
  endsAt: string
  quorumBps: Bps
  passBps: Bps
  snapshotId: number
  status: ElectionStatus
  allowRevote: boolean
}

export interface VoteRevision {
  revision: number
  at: string
  yesBps: Bps
  noBps: Bps
  abstainBps: Bps
  txHash: HexHash
}

export interface Vote {
  electionId: string
  voter: string
  weight: number
  current: VoteRevision
  history: VoteRevision[]
}

export interface Receipt {
  id: string
  electionId: string
  voter: string
  txHash: HexHash
  at: string
  snapshotId: number
}

export type AuditEventType =
  | 'vote' | 'revote' | 'receipt' | 'qualification' | 'policy'
  | 'snapshot' | 'election_created' | 'finalized' | 'admin' | 'category' | 'document'

export interface AuditEvent {
  id: string
  type: AuditEventType
  at: string
  actor: string
  categoryId?: string
  electionId?: string
  snapshotId?: number
  txHash: HexHash
  human: { ru: string; en: string }
}

export interface ExamQuestion {
  q: { ru: string; en: string }
  options: { ru: string; en: string }[]
  correct: number
}

export interface ExamChoice {
  id: string
  label: { ru: string; en: string }
}

interface ExamItemBase {
  id: string
  prompt: { ru: string; en: string }
  explanation?: { ru: string; en: string }
  points?: number
}

export interface ExamScenarioItem extends ExamItemBase {
  kind: 'scenario'
  scored: false
}

export interface ExamSingleChoiceItem extends ExamItemBase {
  kind: 'single_choice'
  scored: true
  options: ExamChoice[]
  correct: string
}

export interface ExamMultipleChoiceItem extends ExamItemBase {
  kind: 'multiple_choice'
  scored: true
  options: ExamChoice[]
  correct: string[]
}

export interface ExamNumericItem extends ExamItemBase {
  kind: 'numeric'
  scored: true
  answer: number
  tolerance: number
  unit?: { ru: string; en: string }
}

export type ExamItem = ExamScenarioItem | ExamSingleChoiceItem | ExamMultipleChoiceItem | ExamNumericItem

export type ExamAnswer =
  | { kind: 'single_choice'; choiceId: string }
  | { kind: 'multiple_choice'; choiceIds: string[] }
  | { kind: 'numeric'; value: number }

export interface Exam {
  id: string
  categoryId: string
  targetLevel: QualificationLevel
  title: { ru: string; en: string }
  minutes: number
  passShare: number // доля правильных для сдачи
  version: number
  items: ExamItem[]
  sources: { label: { ru: string; en: string }; url: string }[]
}

export type ExamAttemptStatus = 'passed_pending_admin' | 'failed' | 'confirmed'

export interface ExamAttempt {
  id: string
  examId: string
  voter: string
  at: string
  scoreShare: number
  status: ExamAttemptStatus
  evidenceHash: HexHash
}

export interface Tally {
  yes: number
  no: number
  abstain: number
  turnoutWeight: number
}
