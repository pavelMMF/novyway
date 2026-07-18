export type ParticipantQualification = {
  categoryId: string
  level: number
  eligible: boolean
  evidenceHash: string | null
  manualWeight: string
  membershipVersion: string
  changeId: string
  confirmedAt: string
}

export type ParticipantStats = {
  votes: number
  documents: number
  exams: number
  proposals: number
  qualifications: number
  highestLevel: number
}

export type ParticipantActivityDay = {
  date: string
  total: number
  votes: number
  documents: number
  exams: number
  proposals: number
}

export type Participant = {
  id: string
  aptosAddress: string
  displayName: string | null
  role: string
  registeredAt: string
  participationScore: number
  stats: ParticipantStats
  qualifications: ParticipantQualification[]
  activity?: ParticipantActivityDay[]
}

export type ParticipantSort = 'name' | 'registered' | 'role' | 'votes' | 'documents' | 'exams' | 'qualifications' | 'score'

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null
  return body?.error ?? `HTTP ${response.status}`
}

export async function fetchParticipants(options: {
  search?: string
  role?: string
  sort?: ParticipantSort
  direction?: 'asc' | 'desc'
  page?: number
  pageSize?: number
} = {}, signal?: AbortSignal) {
  const query = new URLSearchParams()
  if (options.search) query.set('search', options.search)
  if (options.role) query.set('role', options.role)
  if (options.sort) query.set('sort', options.sort)
  if (options.direction) query.set('direction', options.direction)
  if (options.page) query.set('page', String(options.page))
  if (options.pageSize) query.set('pageSize', String(options.pageSize))
  const response = await fetch(`/api/v1/participants?${query}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{ participants: Participant[]; total: number; page: number; pageSize: number }>
}

export async function fetchParticipant(identifier: string, signal?: AbortSignal) {
  const response = await fetch(`/api/v1/participants/${encodeURIComponent(identifier)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error(await readError(response))
  const body = await response.json() as { participant: Participant }
  return body.participant
}

async function postAccountEvent(path: string, body: unknown, csrfToken: string) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export function recordDocumentOpened(documentId: string, csrfToken: string) {
  return postAccountEvent('/api/v1/me/activity', { kind: 'document_opened', subjectId: documentId }, csrfToken)
}

export function recordExamPassed(examId: string, scoreBps: number, csrfToken: string) {
  return postAccountEvent('/api/v1/me/activity', { kind: 'exam_passed', subjectId: examId, scoreBps }, csrfToken)
}

export function syncMyQualifications(csrfToken: string) {
  return postAccountEvent('/api/v1/me/qualifications/sync', {}, csrfToken) as Promise<{ qualifications: ParticipantQualification[] }>
}
