import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { recordDocumentOpened } from '../adapters/participants'
import {
  proposalMatchesDocumentBase,
  supportDocumentProposal,
  useDocumentProposals,
  verifyDocumentProposal,
  type DocumentProposal,
  type ProposalVerification,
} from '../adapters/documentProposals'
import { useLiveVoting } from '../adapters/aptos/useLiveAptos'
import type { LiveCategory, LiveElection } from '../adapters/aptos/liveVotingData'
import { useAccountSession, type AccountUser } from '../auth/session'
import { useDocuments, groupColors, groupNames, useSettings, useStore } from '../demo/store'
import type { Clause, DocumentModel } from '../domain/types'
import { useT } from '../i18n'
import { sound } from '../sound/engine'
import { currentRuntimeMode } from '../adapters/types'
import { CatChip, PageHead, Panel, StatusChip, Switch } from '../ui/components'
import { DocumentProposalComposer } from '../ui/components/DocumentProposalComposer'

export default function DocumentDetail() {
  const { id } = useParams()
  const { t, l, lang } = useT()
  const { state } = useStore()
  const nav = useNavigate()
  const docs = useDocuments()
  const [showNew, setShowNew] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const { s, update } = useSettings()
  const d = docs.find((item) => item.id === id)
  const docId = d?.id
  const testnet = currentRuntimeMode() === 'aptos-testnet'
  const { user } = useAccountSession()
  const live = useLiveVoting()
  const registry = useDocumentProposals({ documentId: docId, enabled: testnet && Boolean(docId) })
  const [verification, setVerification] = useState<Record<string, ProposalVerification>>({})
  const alreadyRead = docId ? s.readDocs.includes(docId) : false

  useEffect(() => {
    if (!docId || !user?.csrfToken) return
    const timer = window.setTimeout(() => {
      recordDocumentOpened(docId, user.csrfToken!)
        .then(() => {
          if (!s.readDocs.includes(docId)) update({ readDocs: [...s.readDocs, docId] })
        })
        .catch(() => null)
    }, 8_000)
    return () => window.clearTimeout(timer)
  }, [docId, user?.csrfToken, s.readDocs, update])

  useEffect(() => {
    if (!testnet) return
    let active = true
    Promise.all(registry.proposals.map(async (proposal) => {
      if (!d || !proposalMatchesDocumentBase(proposal, d)) return [proposal.id, 'mismatch'] as const
      const election = live.data?.elections.find((item) => item.id === proposal.electionId)
      return [proposal.id, await verifyDocumentProposal(proposal, election)] as const
    })).then((entries) => { if (active) setVerification(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [d, testnet, registry.proposals, live.data])

  const hasPassedVerifiedProposal = registry.proposals.some((proposal) => verification[proposal.id] === 'verified'
    && live.data?.elections.some((election) => election.id === proposal.electionId && election.status === 'passed'))
  useEffect(() => {
    if (testnet && showNew && !hasPassedVerifiedProposal) setShowNew(false)
  }, [hasPassedVerifiedProposal, showNew, testnet])

  if (!d) return <div className="empty">{t('au.empty')}</div>
  const cat = state.categories.find((category) => category.id === d.categoryId)!

  return <>
    <PageHead
      title={l(d.title)}
      sub={<span className="row" style={{ gap: 8 }}>
        <span className="chip mono mute" style={{ borderColor: groupColors[d.group], color: groupColors[d.group] }}>{l(groupNames[d.group])}</span>
        <CatChip cat={cat} />
        {alreadyRead && <span className="chip mute read-chip">{t('sc.readChip')}</span>}
      </span>}
      right={(!testnet || hasPassedVerifiedProposal) ? <Switch checked={showNew} onChange={(value) => { setShowNew(value); sound.play(value ? 'confirm' : 'tap') }} label={<span title={t('doc.showNewHint')}>{t('doc.showNew')}</span>} /> : undefined}
    />

    <div className="callout" style={{ marginBottom: 14 }}>
      {testnet
        ? (lang === 'ru' ? 'Действующая редакция не меняется до принятия поправки и публикации новой версии. Предварительная поддержка только открывает путь к финальному голосованию.' : 'The current text changes only after an amendment passes and a new version is published. Preliminary support only opens the final election.')
        : t('doc.hoverHint')}
    </div>

    <div className={testnet ? 'document-detail-workspace' : undefined}>
      <main className="document-detail-main">
        <article className="doc-page">
          <h2>{l(d.title)}</h2>
          <div className="doc-meta"><span>{t('doc.version')} {d.version}</span><span>{t('doc.hash')} {d.documentHash}</span><span>{showNew ? t('el.proposedText') : t('el.currentText')}</span></div>
          {d.clauses.map((clause) => {
            const clauseProposals = registry.proposals.filter((item) => item.clauseId === clause.id)
            const verifiedPairs = clauseProposals
              .filter((item) => verification[item.id] === 'verified')
              .map((proposal) => ({ proposal, election: live.data?.elections.find((item) => item.id === proposal.electionId) }))
            const preferred = showNew
              ? verifiedPairs.find((pair) => pair.election?.status === 'passed')
              : verifiedPairs.find((pair) => ['active', 'upcoming', 'awaiting_finalization'].includes(pair.election?.status ?? '')) ?? verifiedPairs[0]
            if (testnet) return <LiveClauseView key={clause.id} clause={clause} proposal={preferred?.proposal} election={preferred?.election} pending={clauseProposals.filter((item) => item.status === 'supporting' || item.status === 'ready')} showNew={showNew} />
            return <ClauseView key={clause.id} clause={clause} showNew={showNew} hovered={hovered === clause.id} onHover={(value) => setHovered(value ? clause.id : null)} onOpen={() => clause.amendment && nav(`/elections/${clause.amendment.electionId}`)} />
          })}
        </article>
      </main>

      {testnet && <aside className="document-detail-side">
        <DocumentProposalQueue
          document={d}
          proposals={registry.proposals}
          verification={verification}
          elections={live.data?.elections ?? []}
          categories={live.data?.categories ?? []}
          loading={registry.loading}
          error={registry.error ?? null}
          user={user}
          refresh={registry.refresh}
        />
      </aside>}
    </div>

    <div style={{ marginTop: 14 }}><Link to="/documents" className="muted">← {t('doc.title')}</Link></div>
  </>
}

function LiveClauseView({ clause, proposal, election, pending, showNew }: {
  clause: Clause
  proposal?: DocumentProposal
  election?: LiveElection
  pending: DocumentProposal[]
  showNew: boolean
}) {
  const { lang } = useT()
  const ru = lang === 'ru'
  const title = ru ? clause.title.ru : clause.title.en
  const currentText = ru ? clause.text.ru : clause.text.en
  if (!proposal || !election) {
    return <div className={`clause ${pending.length ? 'proposal-preview' : ''}`}>
      <span className="cnum">§ {clause.num} · {title}</span>{currentText}
      {pending.length > 0 && <a className="proposal-inline-hint" href={`#proposal-${pending[0].id}`}>{pending.length} {ru ? 'предложений ждут поддержки' : 'proposals await support'} →</a>}
    </div>
  }
  const proposedText = ru ? proposal.payload.amendment.proposedText.ru : proposal.payload.amendment.proposedText.en
  if (showNew) {
    return <div className="clause added-view proposal-preview"><span className="cnum">§ {clause.num} · {title}</span>{proposedText}<span className="flag"><StatusChip status={election.status} /></span><small className="proposal-preview-note">{election.status === 'passed' ? (ru ? 'Принято; станет действующим после публикации новой версии.' : 'Accepted; becomes current after the new version is published.') : (ru ? 'Предложение, не действующая редакция.' : 'Proposal, not the current text.')}</small></div>
  }
  return <Link className="clause changed live-clause-link" to={`/elections/chain-${election.id}`}><span className="cnum">§ {clause.num} · {title}</span>{currentText}<span className="flag"><StatusChip status={election.status} /></span><span className="proposal-inline-hint">{ru ? 'Открыть финальное голосование' : 'Open final election'} →</span></Link>
}

type QueueFilter = 'support' | 'election' | 'history'

function DocumentProposalQueue({ document, proposals, verification, elections, categories, loading, error, user, refresh }: {
  document: DocumentModel
  proposals: DocumentProposal[]
  verification: Record<string, ProposalVerification>
  elections: LiveElection[]
  categories: LiveCategory[]
  loading: boolean
  error: string | null
  user: AccountUser | null
  refresh: () => void
}) {
  const { lang } = useT()
  const ru = lang === 'ru'
  const [filter, setFilter] = useState<QueueFilter>('support')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const visible = proposals.filter((proposal) => {
    if (filter === 'support') return proposal.status === 'supporting' || proposal.status === 'ready'
    if (filter === 'election') return proposal.status === 'published' && !proposal.finalizationTxHash
    return proposal.status === 'expired' || Boolean(proposal.finalizationTxHash)
  })

  async function support(proposal: DocumentProposal) {
    if (!user?.csrfToken || proposal.support?.currentUserSupported) return
    setBusyId(proposal.id)
    setMessage(null)
    try {
      await supportDocumentProposal(proposal.id, user.csrfToken)
      setMessage(ru ? 'Поддержка записана. Порог пересчитан атомарно.' : 'Support recorded. The threshold was recalculated atomically.')
      refresh()
      sound.play('confirm')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'proposal_support_failed')
      sound.play('warning')
    } finally {
      setBusyId(null)
    }
  }

  return <section className="document-proposal-section">
    <Panel title={ru ? 'Изменения документа' : 'Document changes'} hint={String(proposals.length)}>
      <div className="row between proposal-section-head"><p className="muted">{ru ? 'Сначала поддержка запуска, затем отдельное взвешенное голосование Aptos.' : 'First launch support, then a separate weighted Aptos election.'}</p></div>
      <details className="proposal-create-details">
        <summary>{ru ? 'Предложить изменение' : 'Propose an amendment'}</summary>
        <DocumentProposalComposer document={document} categories={categories} compact onCreated={() => { refresh(); setFilter('support') }} />
      </details>
      <div className="proposal-queue-filters" role="tablist" aria-label={ru ? 'Стадия изменения' : 'Amendment stage'}>
        <button className={filter === 'support' ? 'active' : ''} onClick={() => setFilter('support')}>{ru ? 'Поддержка' : 'Support'}</button>
        <button className={filter === 'election' ? 'active' : ''} onClick={() => setFilter('election')}>{ru ? 'Голосование' : 'Election'}</button>
        <button className={filter === 'history' ? 'active' : ''} onClick={() => setFilter('history')}>{ru ? 'История' : 'History'}</button>
      </div>
      {loading && <div className="empty">{ru ? 'Сверяем реестр…' : 'Verifying registry…'}</div>}
      {error && <div className="callout red">{error}</div>}
      {message && <div className="callout" role="status">{message}</div>}
      {!loading && !error && visible.length === 0 && <div className="empty">{filter === 'support' ? (ru ? 'Предложений, собирающих поддержку, пока нет.' : 'No proposals are collecting support.') : filter === 'election' ? (ru ? 'Финальных голосований сейчас нет.' : 'No final elections are running.') : (ru ? 'История пока пуста.' : 'History is empty.')}</div>}
      <div className="proposal-public-list">{visible.map((proposal) => {
        const integrity = verification[proposal.id] ?? 'unbound'
        const election = elections.find((item) => item.id === proposal.electionId)
        const supportData = proposal.support
        const required = supportData?.requiredSupporters ?? 0
        const count = supportData?.supporterCount ?? 0
        const progress = required > 0 ? Math.min(100, Math.round(count / required * 100)) : 0
        const creator = proposal.creator.displayName || (proposal.creator.aptosAddress ? `${proposal.creator.aptosAddress.slice(0, 8)}…${proposal.creator.aptosAddress.slice(-5)}` : '—')
        const statusText = proposal.status === 'supporting' ? (ru ? 'Собирает поддержку' : 'Collecting support')
          : proposal.status === 'ready' ? (ru ? 'Порог достигнут' : 'Threshold reached')
            : proposal.status === 'expired' ? (ru ? 'Срок поддержки истёк' : 'Support window expired')
              : integrity === 'mismatch' ? (ru ? 'Данные не совпали' : 'Data mismatch')
                : election?.status === 'passed' ? (ru ? 'Принято, ожидает новой версии' : 'Accepted, awaiting new version')
                  : election?.status === 'active' ? (ru ? 'Идёт финальное голосование' : 'Final election in progress')
                    : election?.status === 'upcoming' ? (ru ? 'Финальное голосование скоро' : 'Final election upcoming')
                      : election?.status === 'quorum_failed' ? (ru ? 'Нет финального кворума' : 'Final quorum failed')
                        : (ru ? 'Отклонено' : 'Rejected')
        return <article id={`proposal-${proposal.id}`} className={`proposal-public-item status-${proposal.status} integrity-${integrity}`} key={proposal.id}>
          <div className="row between"><strong>§ {proposal.payload.clause.number} · {ru ? proposal.payload.clause.title.ru : proposal.payload.clause.title.en}</strong><span className={`chip ${proposal.status === 'ready' ? 'ok' : proposal.status === 'supporting' ? 'mute' : election?.status === 'active' ? 'live' : 'mute'}`}>{statusText}</span></div>
          <span className="proposal-creator">{ru ? 'Предложил' : 'Proposed by'}: {creator}</span>
          <p>{ru ? proposal.payload.amendment.proposedText.ru : proposal.payload.amendment.proposedText.en}</p>
          <details><summary className="muted">{ru ? 'Обоснование и доказательства' : 'Rationale and proofs'}</summary><p>{ru ? proposal.payload.amendment.rationale.ru : proposal.payload.amendment.rationale.en}</p><div className="proposal-public-meta"><span>{statusText}</span><code>{proposal.metadataHash}</code></div></details>
          {supportData && (proposal.status === 'supporting' || proposal.status === 'ready') && <div className="proposal-support-progress"><div className="proposal-support-track"><span style={{ '--support-progress': `${progress}%` } as CSSProperties} /></div><strong>{count}/{required}</strong><small>{ru ? `${progress}% порога запуска` : `${progress}% of launch threshold`}</small><small>{ru ? `до ${new Date(supportData.deadlineAt).toLocaleDateString('ru-RU')}` : `until ${new Date(supportData.deadlineAt).toLocaleDateString('en-GB')}`}</small></div>}
          <div className="row proposal-actions">
            {proposal.status === 'supporting' && user && <button className={`btn small ${supportData?.currentUserSupported ? '' : 'primary'}`} disabled={busyId === proposal.id || supportData?.currentUserSupported} onClick={() => void support(proposal)}>{supportData?.currentUserSupported ? (ru ? 'Вы поддержали' : 'Supported') : (ru ? 'Поддержать запуск' : 'Support launch')}</button>}
            {proposal.status === 'ready' && user?.isAdmin && <Link className="btn small primary" to={`/admin?tab=election&document=${encodeURIComponent(document.id)}`}>{ru ? 'Запустить в Aptos' : 'Launch on Aptos'}</Link>}
            {election && integrity === 'verified' && <Link className="btn small" to={`/elections/chain-${election.id}`}>{ru ? 'Открыть голосование' : 'Open election'} №{election.id}</Link>}
            {proposal.creationTxHash && <a className="btn small" href={`https://explorer.aptoslabs.com/txn/${proposal.creationTxHash}?network=testnet`} target="_blank" rel="noreferrer">{ru ? 'Создание в Aptos' : 'Aptos creation'} ↗</a>}
          </div>
        </article>
      })}</div>
    </Panel>
  </section>
}

function ClauseView({ clause, showNew, hovered, onHover, onOpen }: { clause: Clause; showNew: boolean; hovered: boolean; onHover: (value: boolean) => void; onOpen: () => void }) {
  const { t, l } = useT()
  const { state } = useStore()
  const amendment = clause.amendment
  const election = amendment ? state.elections.find((item) => item.id === amendment.electionId) : undefined
  if (!amendment || !election) return <div className="clause"><span className="cnum">§ {clause.num} · {l(clause.title)}</span>{l(clause.text)}</div>
  if (showNew) return <div className="clause added-view"><span className="cnum">§ {clause.num} · {l(clause.title)}</span>{l(amendment.proposedText)}<span className="flag"><span className="chip ok">{amendment.kind === 'add' ? t('doc.added') : t('doc.changed')}</span></span></div>
  return <div className="clause changed" role="button" tabIndex={0} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onFocus={() => onHover(true)} onBlur={() => onHover(false)} onClick={onOpen} onKeyDown={(event) => event.key === 'Enter' && onOpen()} style={{ position: 'relative' }}>
    <span className="cnum">§ {clause.num} · {l(clause.title)}</span>{l(clause.text)}<span className="flag"><StatusChip status={election.status} /></span>
    {hovered && <div className="clause-pop" style={{ top: 'calc(100% + 4px)' }}><div className="lbl">{t('doc.willReplace')} · {t('doc.election').toLowerCase()} {election.id}</div>{l(amendment.proposedText)}<div className="lbl" style={{ marginTop: 8, color: 'var(--cyan)' }}>{t('common.open')} → {l(election.title)}</div></div>}
  </div>
}
