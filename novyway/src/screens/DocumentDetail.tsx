import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useT } from '../i18n'
import { useDocuments, groupColors, groupNames, useSettings, useStore } from '../demo/store'
import { CatChip, PageHead, Panel, StatusChip, Switch } from '../ui/components'
import type { Clause } from '../domain/types'
import { sound } from '../sound/engine'
import { currentRuntimeMode } from '../adapters/types'
import { proposalMatchesDocumentBase, useDocumentProposals, verifyDocumentProposal, type DocumentProposal, type ProposalVerification } from '../adapters/documentProposals'
import { useLiveVoting } from '../adapters/aptos/useLiveAptos'
import type { LiveElection } from '../adapters/aptos/liveVotingData'
import { useAccountSession } from '../auth/session'

// ==========================================================
// Просмотр документа внутри сайта:
//  · изменяемые пункты подсвечены красным;
//  · hover/tap показывает предлагаемую редакцию;
//  · тумблер «Новая редакция» применяет все поправки
//    и помечает изменённые/новые места;
//  · клик по пункту ведёт к его голосованию.
// ==========================================================

export default function DocumentDetail() {
  const { id } = useParams()
  const { t, l, lang } = useT()
  const { state } = useStore()
  const nav = useNavigate()
  const docs = useDocuments()
  const [showNew, setShowNew] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const { s, update } = useSettings()
  const d = docs.find((x) => x.id === id)
  const docId = d?.id
  const testnet = currentRuntimeMode() === 'aptos-testnet'
  const { user } = useAccountSession()
  const live = useLiveVoting()
  const registry = useDocumentProposals({ documentId: docId, enabled: testnet && Boolean(docId) })
  const [verification, setVerification] = useState<Record<string, ProposalVerification>>({})
  const alreadyRead = docId ? s.readDocs.includes(docId) : false
  // документ засчитывается в гражданский скор при первом открытии
  useEffect(() => {
    if (docId && !s.readDocs.includes(docId)) update({ readDocs: [...s.readDocs, docId] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  useEffect(() => {
    if (!testnet) return
    let active = true
    Promise.all(registry.proposals.map(async (proposal) => {
      const election = live.data?.elections.find((item) => item.id === proposal.electionId)
      const result = d && proposalMatchesDocumentBase(proposal, d) ? await verifyDocumentProposal(proposal, election) : 'mismatch'
      return [proposal.id, result] as const
    })).then((entries) => { if (active) setVerification(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [d, testnet, registry.proposals, live.data])
  const hasPassedVerifiedProposal = registry.proposals.some((proposal) => verification[proposal.id] === 'verified'
    && live.data?.elections.some((election) => election.id === proposal.electionId && election.status === 'passed'))
  useEffect(() => {
    if (testnet && showNew && !hasPassedVerifiedProposal) setShowNew(false)
  }, [hasPassedVerifiedProposal, showNew, testnet])

  if (!d) return <div className="empty">{t('au.empty')}</div>
  const cat = state.categories.find((c) => c.id === d.categoryId)!

  return (
    <>
      <PageHead
        title={l(d.title)}
        sub={<span className="row" style={{ gap: 8 }}>
          <span className="chip mono mute" style={{ borderColor: groupColors[d.group], color: groupColors[d.group] }}>
            {l(groupNames[d.group])}
          </span>
          <CatChip cat={cat} />
          {alreadyRead && <span className="chip mute read-chip">{t('sc.readChip')}</span>}
        </span>}
        right={(!testnet || hasPassedVerifiedProposal) ? (
          <Switch
            checked={showNew}
            onChange={(v) => { setShowNew(v); sound.play(v ? 'confirm' : 'tap') }}
            label={<span title={t('doc.showNewHint')}>{t('doc.showNew')}</span>}
          />
        ) : undefined}
      />

      <div className="callout" style={{ maxWidth: 900, marginBottom: 14 }}>
        {testnet
          ? (lang === 'ru' ? 'Действующая редакция не меняется до публикации новой версии. Подсвечиваются только поправки, чей хеш и голосование сверены с Aptos.' : 'The current text does not change until a new version is published. Only amendments whose hash and election match Aptos are highlighted.')
          : t('doc.hoverHint')}
      </div>

      <article className="doc-page">
        <h2>{l(d.title)}</h2>
        <div className="doc-meta">
          <span>{t('doc.version')} {d.version}</span>
          <span>{t('doc.hash')} {d.documentHash}</span>
          <span>{showNew ? t('el.proposedText') : t('el.currentText')}</span>
        </div>

        {d.clauses.map((c) => {
          const verifiedPairs = registry.proposals
            .filter((item) => item.clauseId === c.id && verification[item.id] === 'verified')
            .map((proposal) => ({ proposal, election: live.data?.elections.find((item) => item.id === proposal.electionId) }))
          const preferred = showNew
            ? verifiedPairs.find((pair) => pair.election?.status === 'passed')
            : verifiedPairs.find((pair) => ['active', 'upcoming', 'awaiting_finalization'].includes(pair.election?.status ?? '')) ?? verifiedPairs[0]
          const proposal = preferred?.proposal
          const election = preferred?.election
          if (testnet) {
            return <LiveClauseView key={c.id} clause={c} proposal={proposal} election={election} showNew={showNew} />
          }
          return <ClauseView
            key={c.id}
            clause={c}
            showNew={showNew}
            hovered={hovered === c.id}
            onHover={(h) => setHovered(h ? c.id : null)}
            onOpen={() => c.amendment && nav(`/elections/${c.amendment.electionId}`)}
          />
        })}

      </article>

      {testnet && <DocumentProposalQueue
        proposals={registry.proposals}
        verification={verification}
        elections={live.data?.elections ?? []}
        loading={registry.loading || live.loading}
        error={registry.error ?? live.error ?? null}
        isAdmin={user?.isAdmin === true}
        documentId={d.id}
      />}

      <div style={{ marginTop: 14 }}>
        <Link to="/documents" className="muted">← {t('doc.title')}</Link>
      </div>
    </>
  )
}

function LiveClauseView({ clause, proposal, election, showNew }: {
  clause: Clause
  proposal?: DocumentProposal
  election?: LiveElection
  showNew: boolean
}) {
  const { lang } = useT()
  const ru = lang === 'ru'
  const title = ru ? clause.title.ru : clause.title.en
  const currentText = ru ? clause.text.ru : clause.text.en
  if (!proposal || !election) {
    return <div className="clause"><span className="cnum">§ {clause.num} · {title}</span>{currentText}</div>
  }
  const proposedText = ru ? proposal.payload.amendment.proposedText.ru : proposal.payload.amendment.proposedText.en
  if (showNew) {
    return <div className="clause added-view proposal-preview">
      <span className="cnum">§ {clause.num} · {title}</span>
      {proposedText}
      <span className="flag"><StatusChip status={election.status} /></span>
      <small className="proposal-preview-note">{election.status === 'passed'
        ? (ru ? 'Принято; станет действующим после публикации новой версии.' : 'Accepted; becomes current after the new version is published.')
        : (ru ? 'Предложение, не действующая редакция.' : 'Proposal, not the current text.')}</small>
    </div>
  }
  return <Link className="clause changed live-clause-link" to={`/elections/chain-${election.id}`}>
    <span className="cnum">§ {clause.num} · {title}</span>
    {currentText}
    <span className="flag"><StatusChip status={election.status} /></span>
    <span className="proposal-inline-hint">{ru ? 'Открыть проверенную поправку' : 'Open verified amendment'} →</span>
  </Link>
}

function DocumentProposalQueue({ proposals, verification, elections, loading, error, isAdmin, documentId }: {
  proposals: DocumentProposal[]
  verification: Record<string, ProposalVerification>
  elections: LiveElection[]
  loading: boolean
  error: string | null
  isAdmin: boolean
  documentId: string
}) {
  const { lang } = useT()
  const ru = lang === 'ru'
  return <section className="document-proposal-section">
    <Panel
      title={ru ? 'Поправки: очередь и решения' : 'Amendments: queue and decisions'}
      hint={String(proposals.length)}
    >
      <div className="row between proposal-section-head">
        <p className="muted">{ru ? 'Каждая строка связывает один пункт документа с одним голосованием Aptos.' : 'Each row links one document clause to one Aptos election.'}</p>
        {isAdmin && <Link className="btn small primary" to={`/admin?tab=election&document=${encodeURIComponent(documentId)}`}>{ru ? 'Создать поправку' : 'Create amendment'}</Link>}
      </div>
      {loading && <div className="empty">{ru ? 'Сверяем реестр с Aptos…' : 'Verifying registry against Aptos…'}</div>}
      {error && <div className="callout red">{error}</div>}
      {!loading && !error && proposals.length === 0 && <div className="empty">{ru ? 'У этого документа нет активных или завершённых голосований.' : 'This document has no active or completed elections.'}</div>}
      <div className="proposal-public-list">
        {proposals.map((proposal) => {
          const integrity = verification[proposal.id] ?? 'unbound'
          const election = elections.find((item) => item.id === proposal.electionId)
          const statusText = integrity === 'mismatch'
            ? (ru ? 'Данные не совпали' : 'Data mismatch')
            : !election
              ? (ru ? 'Ожидает сверки' : 'Awaiting verification')
              : election.status === 'passed'
                ? (ru ? 'Принято, ожидает новой версии' : 'Accepted, awaiting new version')
                : election.status === 'active'
                  ? (ru ? 'Идёт голосование' : 'Voting in progress')
                  : election.status === 'upcoming'
                    ? (ru ? 'В очереди' : 'Queued')
                    : election.status === 'awaiting_finalization'
                      ? (ru ? 'Голосование окончено, итог ожидает фиксации' : 'Voting ended; finalization is pending')
                      : election.status === 'quorum_failed'
                        ? (ru ? 'Не набран кворум' : 'Quorum not reached')
                        : (ru ? 'Отклонено' : 'Rejected')
          return <article className={`proposal-public-item integrity-${integrity}`} key={proposal.id}>
            <div className="row between">
              <strong>§ {proposal.payload.clause.number} · {ru ? proposal.payload.clause.title.ru : proposal.payload.clause.title.en}</strong>
              {election && integrity === 'verified' ? <StatusChip status={election.status} /> : <span className={`chip ${integrity === 'mismatch' ? 'crit' : 'mute'}`}>{statusText}</span>}
            </div>
            <p>{ru ? proposal.payload.amendment.proposedText.ru : proposal.payload.amendment.proposedText.en}</p>
            <div className="proposal-public-meta">
              <span>{statusText}</span>
              <code>{proposal.metadataHash}</code>
            </div>
            <div className="row proposal-actions">
              {election && integrity === 'verified' && <Link className="btn small" to={`/elections/chain-${election.id}`}>{ru ? 'Открыть голосование' : 'Open election'} №{election.id}</Link>}
              {proposal.creationTxHash && <a className="btn small" href={`https://explorer.aptoslabs.com/txn/${proposal.creationTxHash}?network=testnet`} target="_blank" rel="noreferrer">{ru ? 'Сверить создание' : 'Verify creation'} ↗</a>}
              {proposal.finalizationTxHash && <a className="btn small" href={`https://explorer.aptoslabs.com/txn/${proposal.finalizationTxHash}?network=testnet`} target="_blank" rel="noreferrer">{ru ? 'Сверить итог' : 'Verify finalization'} ↗</a>}
            </div>
          </article>
        })}
      </div>
    </Panel>
  </section>
}


function ClauseView({ clause: c, showNew, hovered, onHover, onOpen }: {
  clause: Clause
  showNew: boolean
  hovered: boolean
  onHover: (h: boolean) => void
  onOpen: () => void
}) {
  const { t, l } = useT()
  const { state } = useStore()
  const am = c.amendment
  const election = am ? state.elections.find((e) => e.id === am.electionId) : undefined

  // обычный пункт без поправки
  if (!am || !election) {
    return (
      <div className="clause">
        <span className="cnum">§ {c.num} · {l(c.title)}</span>
        {l(c.text)}
      </div>
    )
  }

  // режим «новая редакция»: применяем поправку, помечаем место
  if (showNew) {
    return (
      <div className="clause added-view">
        <span className="cnum">§ {c.num} · {l(c.title)}</span>
        {l(am.proposedText)}
        <span className="flag">
          <span className="chip ok">{am.kind === 'add' ? t('doc.added') : t('doc.changed')}</span>
        </span>
      </div>
    )
  }

  // оригинал: подсветка + hover-превью замены
  return (
    <div
      className="clause changed"
      role="button"
      tabIndex={0}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      style={{ position: 'relative' }}
    >
      <span className="cnum">§ {c.num} · {l(c.title)}</span>
      {l(c.text)}
      <span className="flag">
        <StatusChip status={election.status} />
      </span>
      {hovered && (
        <div className="clause-pop" style={{ top: 'calc(100% + 4px)' }}>
          <div className="lbl">{t('doc.willReplace')} · {t('doc.election').toLowerCase()} {election.id}</div>
          {l(am.proposedText)}
          <div className="lbl" style={{ marginTop: 8, color: 'var(--cyan)' }}>
            {t('common.open')} → {l(election.title)}
          </div>
        </div>
      )}
    </div>
  )
}
