/* eslint-disable react-refresh/only-export-components */
// ==========================================================
// Demo store: локальное состояние, имитирующее контракт.
// Слои: settings (устройство) + demo chain state (домен).
// ==========================================================

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import type {
  Amendment, AuditEvent, Category, DocumentModel, Election, ElectionSnapshot,
  DocumentTopic, ExamAttempt, GraphRelation, GraphSpace, QualificationRevision, Receipt, Tally, Vote,
} from '../domain/types'
import { round2 } from '../domain/weights'
import {
  ME, amendments as amendmentSeeds, attempts as seedAttempts, auditEvents as seedAudit,
  categories as seedCategories, documents as seedDocuments, elections as seedElections,
  exams, groupColors, groupNames, myPastVotes, persons, qualifications as seedQuals,
  receipts as seedReceipts, snapshots as seedSnapshots, tallies as seedTallies, votes as seedVotes,
} from './data'
import { sound } from '../sound/engine'
import { music } from '../sound/music'
import { LangCtx, type Lang } from '../i18n'

// ---------- документы с прикреплёнными поправками ----------

const initialAmendments: Amendment[] = amendmentSeeds.map((s) => ({ ...s }))

export function buildDocuments(amendments: Amendment[] = initialAmendments): DocumentModel[] {
  return seedDocuments.map((d) => ({
    ...d,
    clauses: d.clauses.map((c) => {
      const amendment = amendments.find((a) => a.documentId === d.id && a.clauseId === c.id)
      return { ...c, amendment }
    }),
  }))
}

/** Документы с актуальными поправками из состояния */
export function useDocuments(): DocumentModel[] {
  const { state } = useStore()
  return useMemo(() => buildDocuments(state.amendments).map((document, index) => ({
    ...document,
    primaryTopicId: state.documentMeta[document.id]?.primaryTopicId ?? document.categoryId,
    secondaryTopicIds: state.documentMeta[document.id]?.secondaryTopicIds ?? [],
    createdAt: state.documentMeta[document.id]?.createdAt ?? `2026-0${(index % 5) + 1}-1${index}`,
    kind: state.documentMeta[document.id]?.kind ?? document.group as DocumentModel['kind'],
  })), [state.amendments, state.documentMeta])
}

// ---------- настройки ----------

export interface Settings {
  soundOn: boolean
  volume: number
  musicOn: boolean
  musicVolume: number
  reducedMotion: boolean
  identityMode: boolean // показывать личности вместо адресов
  lang: Lang
  theme: 'light' | 'dark' | 'system'
  dataLanguage: 'auto' | Lang
  documentsView: 'list' | 'graph' | 'combined'
  profile: { name: string; email: string; telegram: string }
  /** Локальный прогресс участника: какие документы открывал (для гражданского скора). */
  readDocs: string[]
  /** Демо-имитация OAuth: провайдер, через который «выполнен вход». */
  auth: { provider: 'google' | 'apple' | 'telegram' | 'wallet'; label: string; connectedAt: string } | null
}

const defaultSettings: Settings = {
  soundOn: true, volume: 0.5, musicOn: false, musicVolume: 0.65, reducedMotion: false, identityMode: true, lang: 'ru',
  theme: 'system', dataLanguage: 'auto', documentsView: 'combined',
  profile: { name: '', email: '', telegram: '' },
  readDocs: [],
  auth: null,
}

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch { return fallback }
}
function saveLS(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* приватный режим */ }
}

const SettingsCtx = createContext<{ s: Settings; update: (p: Partial<Settings>) => void }>({
  s: defaultSettings, update: () => {},
})

export function useSettings() { return useContext(SettingsCtx) }

// ---------- demo chain state ----------

export interface Toast { id: number; text: string; kind: 'ok' | 'warn' | 'crit' }

export interface DemoState {
  categories: Category[]
  elections: Election[]
  snapshots: ElectionSnapshot[]
  amendments: Amendment[]
  qualifications: QualificationRevision[]
  votes: Vote[]
  receipts: Receipt[]
  tallies: Record<string, Tally>
  attempts: ExamAttempt[]
  audit: AuditEvent[]
  toasts: Toast[]
  topics: DocumentTopic[]
  documentMeta: Record<string, Pick<DocumentModel, 'primaryTopicId' | 'secondaryTopicIds' | 'createdAt' | 'kind'>>
  graphRelations: GraphRelation[]
  graphSpaces: GraphSpace[]
}

const initialTopics: DocumentTopic[] = seedCategories.map((category) => ({
  id: category.id, name: category.name, color: category.color,
}))

const initialState: DemoState = {
  categories: seedCategories,
  elections: seedElections,
  snapshots: seedSnapshots,
  amendments: initialAmendments,
  qualifications: seedQuals,
  votes: [...seedVotes, ...myPastVotes],
  receipts: seedReceipts,
  tallies: seedTallies,
  attempts: seedAttempts,
  audit: seedAudit,
  toasts: [],
  topics: initialTopics,
  documentMeta: {},
  graphRelations: [
    {
      id: 'rel-eco-edu', fromDocumentId: 'doc-forest', toDocumentId: 'doc-exams',
      label: { ru: 'Экологическое образование', en: 'Environmental education' },
    },
  ],
  graphSpaces: [{
    id: 'all', name: { ru: 'Все документы', en: 'All documents' },
    documentIds: seedDocuments.map((document) => document.id),
  }],
}

let txCounter = 7001
export function nextTxHash(): `0x${string}` {
  txCounter += 1
  return `0x${(txCounter * 2654435761 % 0xffffffffff).toString(16).padStart(10, '0')}` as `0x${string}`
}

type Action =
  | { type: 'CAST_VOTE'; electionId: string; yesBps: number; noBps: number; abstainBps: number; weight: number; human: { ru: string; en: string } }
  | { type: 'EXAM_ATTEMPT'; attempt: ExamAttempt }
  | { type: 'APPROVE_ATTEMPT'; attemptId: string; human: { ru: string; en: string } }
  | { type: 'PUBLISH_POLICY'; categoryId: string; quotaBps: [number, number, number, number]; floors: [number, number, number, number]; cap: number; human: { ru: string; en: string } }
  | { type: 'CREATE_ELECTION'; election: Election; snapshot: ElectionSnapshot; amendment: Amendment; human: { ru: string; en: string } }
  | { type: 'TOAST'; text: string; kind?: Toast['kind'] }
  | { type: 'DISMISS_TOAST'; id: number }
  | { type: 'ADD_TOPIC'; topic: DocumentTopic }
  | { type: 'SET_DOCUMENT_TOPICS'; documentId: string; primaryTopicId: string; secondaryTopicIds: string[] }
  | { type: 'ADD_GRAPH_RELATION'; relation: GraphRelation }
  | { type: 'ADD_GRAPH_SPACE'; space: GraphSpace }

let toastId = 1

function reducer(state: DemoState, a: Action): DemoState {
  switch (a.type) {
    case 'CAST_VOTE': {
      const now = new Date().toISOString()
      const tx = nextTxHash()
      const prev = state.votes.find((v) => v.electionId === a.electionId && v.voter === ME)
      const t = { ...(state.tallies[a.electionId] ?? { yes: 0, no: 0, abstain: 0, turnoutWeight: 0 }) }
      if (prev) {
        t.yes = round2(t.yes - (prev.current.yesBps / 10000) * prev.weight)
        t.no = round2(t.no - (prev.current.noBps / 10000) * prev.weight)
        t.abstain = round2(t.abstain - (prev.current.abstainBps / 10000) * prev.weight)
        t.turnoutWeight = round2(t.turnoutWeight - prev.weight)
      }
      t.yes = round2(t.yes + (a.yesBps / 10000) * a.weight)
      t.no = round2(t.no + (a.noBps / 10000) * a.weight)
      t.abstain = round2(t.abstain + (a.abstainBps / 10000) * a.weight)
      t.turnoutWeight = round2(t.turnoutWeight + a.weight)

      const revision = prev ? prev.current.revision + 1 : 1
      const rev = { revision, at: now, yesBps: a.yesBps, noBps: a.noBps, abstainBps: a.abstainBps, txHash: tx }
      const votes = prev
        ? state.votes.map((v) => v === prev ? { ...v, current: rev, history: [v.current, ...v.history] } : v)
        : [...state.votes, { electionId: a.electionId, voter: ME, weight: a.weight, current: rev, history: [] }]

      const el = state.elections.find((e) => e.id === a.electionId)!
      const receipt: Receipt = {
        id: `r-${90 + state.receipts.length}`, electionId: a.electionId,
        voter: ME, txHash: tx, at: now, snapshotId: el.snapshotId,
      }
      const ev: AuditEvent = {
        id: `ae-${100 + state.audit.length}`, type: prev ? 'revote' : 'vote', at: now, actor: ME,
        categoryId: el.categoryId, electionId: a.electionId, txHash: tx, human: a.human,
      }
      return {
        ...state, votes, receipts: [...state.receipts, receipt],
        tallies: { ...state.tallies, [a.electionId]: t }, audit: [ev, ...state.audit],
      }
    }
    case 'EXAM_ATTEMPT':
      return { ...state, attempts: [a.attempt, ...state.attempts] }
    case 'APPROVE_ATTEMPT': {
      const at = state.attempts.find((x) => x.id === a.attemptId)
      if (!at) return state
      const exam = exams.find((x) => x.id === at.examId)!
      const now = new Date().toISOString()
      const tx = nextTxHash()
      const maxRev = Math.max(0, ...state.qualifications.map((q) => q.revision))
      const qual: QualificationRevision = {
        voter: at.voter, categoryId: exam.categoryId, level: exam.targetLevel,
        evidenceHash: at.evidenceHash, confirmedAt: now.slice(0, 10), revision: maxRev + 1,
        reason: {
          ru: `Экзамен «${exam.title.ru}», результат ${Math.round(at.scoreShare * 100)}%`,
          en: `Exam "${exam.title.en}", score ${Math.round(at.scoreShare * 100)}%`,
        },
      }
      const ev: AuditEvent = {
        id: `ae-${100 + state.audit.length}`, type: 'qualification', at: now,
        actor: '0xad0173bb41e0', categoryId: exam.categoryId, txHash: tx, human: a.human,
      }
      return {
        ...state,
        attempts: state.attempts.map((x) => x.id === a.attemptId ? { ...x, status: 'confirmed' } : x),
        qualifications: [
          ...state.qualifications.filter((q) => !(q.voter === at.voter && q.categoryId === exam.categoryId)),
          qual,
        ],
        audit: [ev, ...state.audit],
      }
    }
    case 'PUBLISH_POLICY': {
      const now = new Date().toISOString()
      const tx = nextTxHash()
      const categories = state.categories.map((c) => c.id === a.categoryId
        ? {
            ...c,
            policy: {
              ...c.policy, policyVersion: c.policy.policyVersion + 1,
              quotaBps: a.quotaBps as Category['policy']['quotaBps'],
              floorWeights: a.floors as Category['policy']['floorWeights'],
              maxIndividualWeight: a.cap,
            },
          }
        : c)
      const ev: AuditEvent = {
        id: `ae-${100 + state.audit.length}`, type: 'policy', at: now,
        actor: '0xad0173bb41e0', categoryId: a.categoryId, txHash: tx, human: a.human,
      }
      return { ...state, categories, audit: [ev, ...state.audit] }
    }
    case 'CREATE_ELECTION': {
      const now = new Date().toISOString()
      const ev: AuditEvent = {
        id: `ae-${100 + state.audit.length}`, type: 'election_created', at: now,
        actor: '0xad0173bb41e0', categoryId: a.election.categoryId,
        electionId: a.election.id, snapshotId: a.snapshot.id, txHash: nextTxHash(), human: a.human,
      }
      return {
        ...state,
        elections: [...state.elections, a.election],
        snapshots: [...state.snapshots, a.snapshot],
        amendments: state.amendments.map((am) => am.id === a.amendment.id ? a.amendment : am),
        tallies: { ...state.tallies, [a.election.id]: { yes: 0, no: 0, abstain: 0, turnoutWeight: 0 } },
        audit: [ev, ...state.audit],
      }
    }
    case 'TOAST':
      return { ...state, toasts: [...state.toasts, { id: toastId++, text: a.text, kind: a.kind ?? 'ok' }] }
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== a.id) }
    case 'ADD_TOPIC':
      return { ...state, topics: [...state.topics, a.topic] }
    case 'SET_DOCUMENT_TOPICS':
      return {
        ...state,
        documentMeta: {
          ...state.documentMeta,
          [a.documentId]: {
            ...state.documentMeta[a.documentId],
            primaryTopicId: a.primaryTopicId,
            secondaryTopicIds: a.secondaryTopicIds,
          },
        },
      }
    case 'ADD_GRAPH_RELATION':
      return { ...state, graphRelations: [...state.graphRelations, a.relation] }
    case 'ADD_GRAPH_SPACE':
      return { ...state, graphSpaces: [...state.graphSpaces, a.space] }
    default:
      return state
  }
}

const StoreCtx = createContext<{ state: DemoState; dispatch: (a: Action) => void }>({
  state: initialState, dispatch: () => {},
})

export function useStore() { return useContext(StoreCtx) }

// ---------- селекторы ----------

export function usePerson(address: string) {
  const { s } = useSettings()
  const person = persons.find((p) => p.address === address)
  return address === ME && person
    ? { ...person, name: { ru: s.profile.name, en: s.profile.name } }
    : person
}

export function useMyQual(categoryId: string) {
  const { state } = useStore()
  return state.qualifications
    .filter((q) => q.voter === ME && q.categoryId === categoryId)
    .sort((a, b) => b.revision - a.revision)[0]
}

/** Вес пользователя в снимке голосования (undefined = не в снимке). */
export function myWeightInSnapshot(state: DemoState, election: Election): { level: number; weight: number } | undefined {
  const snap = state.snapshots.find((s) => s.id === election.snapshotId)
  if (!snap) return undefined
  const qual = state.qualifications
    .filter((q) => q.voter === ME && q.categoryId === election.categoryId)
    .sort((a, b) => b.revision - a.revision)[0]
  if (!qual) return undefined // не зарегистрирован в категории на момент cutoff
  const g = snap.groups[qual.level]
  return { level: qual.level, weight: g.perAccountWeight }
}

export { ME, persons, exams, groupNames, groupColors }

// ---------- провайдер ----------

export function AppProviders({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadLS('novyi-put-settings', defaultSettings))
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    sound.enabled = settings.soundOn
    sound.volume = settings.volume
    music.setVolume(settings.musicVolume)
    if (!settings.musicOn && music.isPlaying) music.pause()
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full'
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.theme = settings.theme === 'system'
      ? (systemDark ? 'dark' : 'light')
      : settings.theme
    document.documentElement.lang = settings.lang
    saveLS('novyi-put-settings', settings)
  }, [settings])

  useEffect(() => { void music.prepare() }, [])

  const settingsValue = useMemo(() => ({
    s: settings,
    update: (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })),
  }), [settings])

  const langValue = useMemo(() => ({
    lang: settings.lang,
    setLang: (lang: Lang) => setSettings((s) => ({ ...s, lang })),
  }), [settings.lang])

  const storeValue = useMemo(() => ({ state, dispatch }), [state])

  return (
    <SettingsCtx.Provider value={settingsValue}>
      <LangCtx.Provider value={langValue}>
        <StoreCtx.Provider value={storeValue}>{children}</StoreCtx.Provider>
      </LangCtx.Provider>
    </SettingsCtx.Provider>
  )
}
