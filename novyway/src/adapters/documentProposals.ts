import { useCallback, useEffect, useState } from 'react'
import type { LiveElection } from './aptos/liveVotingData'
import type { DocumentModel } from '../domain/types'

export type LocalizedText = { ru: string; en: string }

export type DocumentProposalPayload = {
  schema: 'novyway.document-amendment.v1' | 'novyway.document-amendment.v2'
  id: string
  createdAt: string
  createdBy: string
  document: {
    id: string
    title: LocalizedText
    baseVersion: string
    baseDocumentHash: string
  }
  clause: {
    id: string
    number: string
    title: LocalizedText
    currentText: LocalizedText
  }
  amendment: {
    kind: 'replace' | 'insert' | 'delete'
    proposedText: LocalizedText
    rationale: LocalizedText
  }
  voting: {
    categoryId: string
    startsAtSecs: string
    endsAtSecs: string
    durationDays?: number
    passBps: number
    quorumBps: number
    allowRevote: boolean
  }
  launch?: {
    rule: 'registered_accounts'
    snapshotAt: string
    eligibleAccounts: number
    quorumBps: number
    requiredSupporters: number
    supportDeadlineAt: string
    supportersSha256: string | null
    sealedAt: string | null
  }
}

export type ProposalSupport = {
  snapshotAt: string
  eligibleAccounts: number
  quorumBps: number
  requiredSupporters: number
  supporterCount: number
  deadlineAt: string
  sealedAt: string | null
  supportersSha256: string | null
  currentUserSupported: boolean
}

export type DocumentProposal = {
  id: string
  documentId: string
  clauseId: string
  categoryId: string
  canonicalText: string
  payload: DocumentProposalPayload
  metadataHash: string
  metadataUri: string
  status: 'draft' | 'supporting' | 'ready' | 'published' | 'expired'
  chainId: number
  moduleAddress: string
  deploymentGeneration: string
  electionId: string | null
  creationTxHash: string | null
  finalizationTxHash: string | null
  createdAt: string
  publishedAt: string | null
  creator: { displayName: string | null; aptosAddress: string | null }
  support: ProposalSupport | null
}

export type ProposalVerification = 'verified' | 'mismatch' | 'unbound'

export type CreateDocumentProposalInput = {
  idempotencyKey: string
  documentId: string
  documentTitleRu: string
  documentTitleEn: string
  baseVersion: string
  baseDocumentHash: string
  clauseId: string
  clauseNumber: string
  clauseTitleRu: string
  clauseTitleEn: string
  currentTextRu: string
  currentTextEn: string
  kind: 'replace' | 'insert' | 'delete'
  proposedTextRu: string
  proposedTextEn: string
  rationaleRu: string
  rationaleEn: string
  categoryId: string
  durationDays: number
  passBps: number
  quorumBps: number
  allowRevote: boolean
}

export type PreparedProposal = {
  proposal: DocumentProposal
  transaction: {
    function: `${string}::${string}::${string}`
    functionArguments: unknown[]
  }
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'))
  if (typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical_json_non_finite_number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
    return `{${entries.join(',')}}`
  }
  throw new TypeError('canonical_json_unsupported_value')
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function verifyDocumentProposal(proposal: DocumentProposal, election?: LiveElection): Promise<ProposalVerification> {
  const canonical = canonicalJson(proposal.payload)
  if (canonical !== proposal.canonicalText) return 'mismatch'
  if ((await sha256Hex(canonical)) !== proposal.metadataHash.toLowerCase()) return 'mismatch'
  if (!proposal.metadataUri.endsWith(`/sha256/${proposal.metadataHash}`)) return 'mismatch'
  if (!proposal.electionId || !proposal.creationTxHash) return 'unbound'
  if (!election) return 'unbound'
  return election.id === proposal.electionId
    && election.categoryId === proposal.categoryId
    && election.metadataHash.toLowerCase() === proposal.metadataHash.toLowerCase()
    && election.metadataUri === proposal.metadataUri
    ? 'verified'
    : 'mismatch'
}

export function proposalMatchesDocumentBase(proposal: DocumentProposal, document: DocumentModel) {
  const payload = proposal.payload
  const clause = document.clauses.find((item) => item.id === payload.clause.id)
  if (!clause) return false
  return proposal.documentId === document.id
    && proposal.clauseId === clause.id
    && payload.document.id === document.id
    && payload.document.baseVersion === document.version
    && payload.document.baseDocumentHash.toLowerCase() === document.documentHash.toLowerCase()
    && payload.document.title.ru === document.title.ru
    && payload.document.title.en === document.title.en
    && payload.clause.number === clause.num
    && payload.clause.title.ru === clause.title.ru
    && payload.clause.title.en === clause.title.en
    && payload.clause.currentText.ru === clause.text.ru
    && payload.clause.currentText.en === clause.text.en
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null
  return body?.error ?? `HTTP ${response.status}`
}

async function postProposal(path: string, body: unknown, csrfToken: string) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response
}

export async function createDocumentProposal(input: CreateDocumentProposalInput, csrfToken: string) {
  const response = await postProposal('/api/v1/document-proposals', input, csrfToken)
  return response.json() as Promise<{ proposal: DocumentProposal }>
}

export async function supportDocumentProposal(id: string, csrfToken: string) {
  const response = await postProposal(`/api/v1/document-proposals/${encodeURIComponent(id)}/support`, {}, csrfToken)
  return response.json() as Promise<{ proposal: DocumentProposal }>
}

export async function prepareDocumentProposalElection(id: string, csrfToken: string) {
  const response = await postProposal(`/api/v1/governance/document-proposals/${encodeURIComponent(id)}/prepare-election`, {}, csrfToken)
  return response.json() as Promise<PreparedProposal>
}

export async function publishDocumentProposal(id: string, txHash: string, csrfToken: string) {
  const response = await postProposal(`/api/v1/governance/document-proposals/${encodeURIComponent(id)}/publish`, { txHash }, csrfToken)
  return response.json() as Promise<{ proposal: DocumentProposal }>
}

export async function finalizeDocumentProposal(id: string, txHash: string, csrfToken: string) {
  const response = await postProposal(`/api/v1/governance/document-proposals/${encodeURIComponent(id)}/finalize`, { txHash }, csrfToken)
  return response.json() as Promise<{ proposal: DocumentProposal }>
}

export function useDocumentProposals(options: {
  documentId?: string
  electionId?: string
  includeDrafts?: boolean
  enabled?: boolean
} = {}) {
  const { documentId, electionId, includeDrafts = false, enabled = true } = options
  const [proposals, setProposals] = useState<DocumentProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const path = includeDrafts
      ? '/api/v1/governance/document-proposals'
      : '/api/v1/document-proposals'
    const query = new URLSearchParams()
    if (documentId) query.set('documentId', documentId)
    if (electionId) query.set('electionId', electionId)
    setLoading(true)
    if (!enabled) {
      setProposals([])
      setLoading(false)
      setError(null)
      return
    }
    setError(null)
    fetch(`${path}?${query}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response))
        return response.json() as Promise<{ proposals: DocumentProposal[] }>
      })
      .then((body) => setProposals(body.proposals))
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'proposal_load_failed')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [documentId, electionId, includeDrafts, enabled, revision])

  return { proposals, loading, error, refresh }
}
