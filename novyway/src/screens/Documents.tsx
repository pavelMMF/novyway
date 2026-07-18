import { Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useT } from '../i18n'
import { groupColors, groupNames, useDocuments, useSettings, useStore } from '../demo/store'
import type { DocumentModel } from '../domain/types'
import { CatChip, PageHead } from '../ui/components'
import { OnChainDocumentRegistry } from '../ui/components/OnChainDocumentRegistry'
import { currentRuntimeMode } from '../adapters/types'
import { useDocumentProposals } from '../adapters/documentProposals'
import { useLiveVoting } from '../adapters/aptos/useLiveAptos'
// three.js — самый тяжёлый модуль бандла; грузим сцену только когда она видима
const Graph = lazy(() => import('./Graph'))

type ViewMode = 'list' | 'graph' | 'combined'
type SortMode = 'newest' | 'oldest' | 'name'

export default function Documents() {
  const { t, l, lang } = useT()
  const { state } = useStore()
  const { s } = useSettings()
  const nav = useNavigate()
  const docs = useDocuments()
  const [params, setParams] = useSearchParams()
  const testnet = currentRuntimeMode() === 'aptos-testnet'
  const live = useLiveVoting()
  const proposalRegistry = useDocumentProposals({ enabled: testnet })
  const requestedView = params.get('view') as ViewMode | null
  const view: ViewMode = ['list', 'graph', 'combined'].includes(requestedView ?? '') ? requestedView! : s.documentsView
  const [query, setQuery] = useState('')
  const [primaryTopicId, setPrimaryTopicId] = useState('all')
  const [secondaryTopicId, setSecondaryTopicId] = useState('all')
  const [sort, setSort] = useState<SortMode>('newest')
  const [activeOnly, setActiveOnly] = useState(false)
  const [spaceId, setSpaceId] = useState('all')
  const proposalDataLoading = testnet && (live.loading || proposalRegistry.loading)
  const proposalDataError = testnet ? (live.error ?? proposalRegistry.error) : null
  const activeByDocument = useMemo(() => {
    if (!testnet) return new Map<string, number>()
    const activeElectionIds = new Set((live.data?.elections ?? [])
      .filter((election) => election.status === 'active')
      .map((election) => election.id))
    return proposalRegistry.proposals.reduce((counts, proposal) => {
      if (proposal.electionId && activeElectionIds.has(proposal.electionId)) counts.set(proposal.documentId, (counts.get(proposal.documentId) ?? 0) + 1)
      return counts
    }, new Map<string, number>())
  }, [live.data?.elections, proposalRegistry.proposals, testnet])


  const visibleDocs = useMemo(() => docs
    .filter((document) => {
      const text = `${l(document.title)} ${l(groupNames[document.group])}`.toLowerCase()
      const primaryTopicMatch = primaryTopicId === 'all' || document.primaryTopicId === primaryTopicId
      const secondaryTopicMatch = secondaryTopicId === 'all' || document.secondaryTopicIds?.includes(secondaryTopicId)
      const activeCount = testnet
        ? (activeByDocument.get(document.id) ?? 0)
        : documentActiveVoteCount(document, state.elections)
      const activeMatch = !activeOnly || activeCount > 0
      return text.includes(query.trim().toLowerCase()) && primaryTopicMatch && secondaryTopicMatch && activeMatch
    })
    .sort((a, b) => {
      if (sort === 'name') return l(a.title).localeCompare(l(b.title))
      const delta = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
      return sort === 'newest' ? -delta : delta
    }), [activeByDocument, activeOnly, docs, l, primaryTopicId, query, secondaryTopicId, sort, state.elections, testnet])
  const visibleDocumentIds = useMemo(() => visibleDocs.map((document) => document.id), [visibleDocs])

  function changeView(next: ViewMode) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('view', next)
    setParams(nextParams)
  }

  return (
    <section className={`documents-workspace documents-workspace--${view}`} data-document-view={view}>
      <PageHead
        title={t('doc.workspace')}
        sub={t('doc.workspaceSub')}
        right={(
          <div className="seg workspace-view-switch" aria-label={t('doc.workspace')}>
            <button className={view === 'list' ? 'on' : ''} data-document-view-option="list" aria-pressed={view === 'list'} onClick={() => changeView('list')}>{t('gr.listView')}</button>
            <button className={view === 'graph' ? 'on' : ''} data-document-view-option="graph" aria-pressed={view === 'graph'} onClick={() => changeView('graph')}>{t('gr.3dView')}</button>
            <button className={view === 'combined' ? 'on' : ''} data-document-view-option="combined" aria-pressed={view === 'combined'} onClick={() => changeView('combined')}>{t('doc.combinedView')}</button>
          </div>
        )}
      />

      <div className="document-toolbar panel tight" data-document-toolbar={view}>
        <label className="field grow"><span>{t('common.search')}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="field topic-filter primary-topic-filter"><span>{t('doc.primaryTopic')}</span>
          <select value={primaryTopicId} onChange={(event) => setPrimaryTopicId(event.target.value)}>
            <option value="all">{t('common.all')}</option>
            {state.topics.map((topic) => <option key={topic.id} value={topic.id}>{l(topic.name)}</option>)}
          </select>
        </label>
        <label className="field topic-filter secondary-topic-filter"><span>{t('doc.secondaryTopics')}</span>
          <select value={secondaryTopicId} onChange={(event) => setSecondaryTopicId(event.target.value)}>
            <option value="all">{t('common.all')}</option>
            {state.topics.map((topic) => <option key={topic.id} value={topic.id}>{l(topic.name)}</option>)}
          </select>
        </label>
        <label className="field"><span>{t('doc.sort')}</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
            <option value="newest">{t('doc.newest')}</option>
            <option value="oldest">{t('doc.oldest')}</option>
            <option value="name">{t('doc.nameSort')}</option>
          </select>
        </label>
        <label className="switch compact"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} /><span className="track" aria-hidden /><span>{t('doc.activeOnly')}</span></label>
        {(view === 'graph' || view === 'combined') && (
          <label className="field"><span>{t('doc.graphSpace')}</span>
            <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)}>
              {state.graphSpaces.map((space) => <option key={space.id} value={space.id}>{l(space.name)}</option>)}
            </select>
          </label>
        )}
      </div>
      {proposalDataError && <div className="callout red" role="alert">
        {lang === 'ru' ? 'Не удалось обновить сведения об активных голосованиях. Фильтр временно недоступен.' : 'Active-election data could not be refreshed. The filter is temporarily unavailable.'}
        {' '}<button className="btn small" onClick={() => { live.refresh(); proposalRegistry.refresh() }}>{lang === 'ru' ? 'Повторить' : 'Retry'}</button>
      </div>}


      <div className={`documents-layout documents-layout--${view}`}>
        {(view === 'list' || view === 'combined') && (
          <div
            className={view === 'combined' ? 'document-list compact-list documents-list-pane' : 'grid c2 documents-list-pane'}
            data-document-pane="list"
          >
            {visibleDocs.map((document) => (
              <DocumentCard key={document.id} document={document} activeCount={testnet ? (activeByDocument.get(document.id) ?? 0) : documentActiveVoteCount(document, state.elections)} onOpen={() => nav(`/documents/${document.id}`)} />
            ))}
            {visibleDocs.length === 0 && <div className="empty panel" aria-live="polite">
              {activeOnly && proposalDataError
                ? (lang === 'ru' ? 'Фильтр активных голосований временно недоступен.' : 'The active-election filter is temporarily unavailable.')
                : activeOnly && proposalDataLoading
                  ? (lang === 'ru' ? 'Проверяем активные голосования…' : 'Checking active elections…')
                  : (lang === 'ru' ? 'Документы по выбранным условиям не найдены.' : 'No documents match the selected filters.')}
            </div>}
          </div>
        )}
        {(view === 'graph' || view === 'combined') && (
          <div className="documents-graph-pane" data-document-pane="graph">
            <Suspense fallback={<div className="empty">…</div>}>
              <Graph layout={view === 'graph' ? 'primary' : 'combined'} spaceId={spaceId} documentIds={visibleDocumentIds} />
            </Suspense>
          </div>
        )}
      </div>

      {view === 'list' && <OnChainDocumentRegistry />}
    </section>
  )
}

function documentActiveVoteCount(document: DocumentModel, elections: ReturnType<typeof useStore>['state']['elections']) {
  return document.clauses.filter((clause) => clause.amendment
    && elections.some((election) => election.id === clause.amendment?.electionId && election.status === 'active')).length
}

function DocumentCard({ document, activeCount, onOpen }: { document: DocumentModel; activeCount: number; onOpen: () => void }) {
  const { t, l } = useT()
  const { state } = useStore()
  const category = state.categories.find((item) => item.id === document.categoryId)!
  const primary = state.topics.find((topic) => topic.id === document.primaryTopicId)
  const secondary = state.topics.filter((topic) => document.secondaryTopicIds?.includes(topic.id))

  return (
    <button className="panel document-card" style={{ borderTopColor: groupColors[document.group] }} onClick={onOpen}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="chip mono mute">{l(groupNames[document.group])}</span>
        <CatChip cat={category} />
      </div>
      <h3>{l(document.title)}</h3>
      <div className="mono muted document-meta">{t('doc.version')} {document.version} · {document.createdAt}</div>
      <div className="topic-row">
        {primary && <span className="chip" style={{ borderColor: primary.color }}>{l(primary.name)}</span>}
        {secondary.map((topic) => <span key={topic.id} className="chip mute">+ {l(topic.name)}</span>)}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {activeCount > 0
          ? <span className="chip crit"><span className="dot" /> {activeCount} {t('doc.amendments')}</span>
          : <span className="chip mute">{document.clauses.length} §</span>}
      </div>
    </button>
  )
}
