import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createDocumentProposal, type DocumentProposal } from '../../adapters/documentProposals'
import type { LiveCategory } from '../../adapters/aptos/liveVotingData'
import { useAccountSession } from '../../auth/session'
import type { DocumentModel } from '../../domain/types'
import { useT } from '../../i18n'
import { sound } from '../../sound/engine'

export function DocumentProposalComposer({ document, categories, onCreated, compact = false }: {
  document: DocumentModel
  categories: LiveCategory[]
  onCreated: (proposal: DocumentProposal) => void
  compact?: boolean
}) {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { user } = useAccountSession()
  const [clauseId, setClauseId] = useState(document.clauses[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '0')
  const [proposedRu, setProposedRu] = useState('')
  const [proposedEn, setProposedEn] = useState('')
  const [rationaleRu, setRationaleRu] = useState('')
  const [rationaleEn, setRationaleEn] = useState('')
  const [durationDays, setDurationDays] = useState(14)
  const [passPct, setPassPct] = useState(50)
  const [quorumPct, setQuorumPct] = useState(30)
  const [allowRevote, setAllowRevote] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const clause = useMemo(() => document.clauses.find((item) => item.id === clauseId) ?? document.clauses[0], [document, clauseId])

  useEffect(() => {
    setClauseId(document.clauses[0]?.id ?? '')
    setProposedRu('')
    setProposedEn('')
    setRationaleRu('')
    setRationaleEn('')
  }, [document.id, document.clauses])

  useEffect(() => {
    if (!categories.some((item) => item.id === categoryId)) setCategoryId(categories[0]?.id ?? '0')
  }, [categories, categoryId])

  const valid = Boolean(user?.csrfToken && clause && proposedRu.trim() && proposedEn.trim() && rationaleRu.trim() && rationaleEn.trim())
    && Number.isInteger(durationDays) && durationDays >= 1 && durationDays <= 365
    && Number.isInteger(passPct) && passPct >= 50 && passPct <= 100
    && Number.isInteger(quorumPct) && quorumPct >= 0 && quorumPct <= 100

  async function submit() {
    if (!user?.csrfToken || !clause || !valid) return
    setBusy(true)
    setMessage(ru ? 'Фиксируем предложение и ваш голос поддержки…' : 'Recording the proposal and your support…')
    try {
      const body = await createDocumentProposal({
        idempotencyKey: crypto.randomUUID(),
        documentId: document.id,
        documentTitleRu: document.title.ru,
        documentTitleEn: document.title.en,
        baseVersion: document.version,
        baseDocumentHash: document.documentHash,
        clauseId: clause.id,
        clauseNumber: clause.num,
        clauseTitleRu: clause.title.ru,
        clauseTitleEn: clause.title.en,
        currentTextRu: clause.text.ru,
        currentTextEn: clause.text.en,
        kind: 'replace',
        proposedTextRu: proposedRu.trim(),
        proposedTextEn: proposedEn.trim(),
        rationaleRu: rationaleRu.trim(),
        rationaleEn: rationaleEn.trim(),
        categoryId,
        durationDays,
        passBps: passPct * 100,
        quorumBps: quorumPct * 100,
        allowRevote,
      }, user.csrfToken)
      setMessage(ru ? 'Предложение опубликовано для предварительной поддержки.' : 'The proposal is open for preliminary support.')
      setProposedRu('')
      setProposedEn('')
      setRationaleRu('')
      setRationaleEn('')
      onCreated(body.proposal)
      sound.play('confirm')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'proposal_creation_failed')
      sound.play('warning')
    } finally {
      setBusy(false)
    }
  }

  if (!user) return <div className="proposal-signin-note"><p>{ru ? 'Чтобы предложить изменение, войдите в аккаунт.' : 'Sign in to propose an amendment.'}</p><Link className="btn small primary" to={`/auth?returnTo=${encodeURIComponent(`/documents/${document.id}`)}`}>{ru ? 'Войти' : 'Sign in'}</Link></div>

  return <div className={`proposal-composer ${compact ? 'compact' : ''}`}>
    <div className="callout proposal-launch-rule">
      {ru
        ? 'Создатель сразу считается первым сторонником. После достижения порога поддержки администратор запускает отдельное финальное голосование в Aptos.'
        : 'The creator is the first supporter. After the support threshold is reached, an administrator launches a separate final Aptos election.'}
    </div>
    <label className="field"><span>{ru ? 'Пункт документа' : 'Document clause'}</span><select value={clause?.id ?? ''} onChange={(event) => setClauseId(event.target.value)}>{document.clauses.map((item) => <option key={item.id} value={item.id}>§ {item.num} · {ru ? item.title.ru : item.title.en}</option>)}</select></label>
    {clause && <div className="proposal-current-text"><strong>{ru ? 'Сейчас' : 'Current'}</strong><p>{ru ? clause.text.ru : clause.text.en}</p></div>}
    <div className="proposal-language-grid">
      <label className="field"><span>{ru ? 'Новая редакция на русском' : 'Proposed text in Russian'}</span><textarea rows={compact ? 4 : 6} value={proposedRu} onChange={(event) => setProposedRu(event.target.value)} /></label>
      <label className="field"><span>{ru ? 'Новая редакция на английском' : 'Proposed text in English'}</span><textarea rows={compact ? 4 : 6} value={proposedEn} onChange={(event) => setProposedEn(event.target.value)} /></label>
      <label className="field"><span>{ru ? 'Обоснование на русском' : 'Rationale in Russian'}</span><textarea rows={3} value={rationaleRu} onChange={(event) => setRationaleRu(event.target.value)} /></label>
      <label className="field"><span>{ru ? 'Обоснование на английском' : 'Rationale in English'}</span><textarea rows={3} value={rationaleEn} onChange={(event) => setRationaleEn(event.target.value)} /></label>
    </div>
    <details className="proposal-advanced">
      <summary>{ru ? 'Параметры финального голосования' : 'Final election parameters'}</summary>
      <div className="proposal-parameter-grid">
        <label className="field"><span>{ru ? 'Экспертная категория' : 'Expert category'}</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((item) => <option value={item.id} key={item.id}>{item.name || `#${item.id}`}</option>)}{categories.length === 0 && <option value="0">#0</option>}</select></label>
        <label className="field"><span>{ru ? 'Срок, дней' : 'Duration, days'}</span><input type="number" min={1} max={365} value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value))} /></label>
        <label className="field"><span>{ru ? 'Порог принятия, %' : 'Pass threshold, %'}</span><input type="number" min={50} max={100} value={passPct} onChange={(event) => setPassPct(Number(event.target.value))} /></label>
        <label className="field"><span>{ru ? 'Кворум финала, %' : 'Final quorum, %'}</span><input type="number" min={0} max={100} value={quorumPct} onChange={(event) => setQuorumPct(Number(event.target.value))} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={allowRevote} onChange={(event) => setAllowRevote(event.target.checked)} /><span>{ru ? 'Разрешить переголосование в финале' : 'Allow revoting in the final election'}</span></label>
    </details>
    <button className="btn primary proposal-submit" disabled={busy || !valid} onClick={() => void submit()}>{busy ? (ru ? 'Публикуем…' : 'Publishing…') : (ru ? 'Предложить изменение' : 'Propose amendment')}</button>
    {message && <div className={`callout ${message.includes('опубликовано') || message.includes('open for') ? 'green' : ''}`} role="status" aria-live="polite">{message}</div>}
  </div>
}
