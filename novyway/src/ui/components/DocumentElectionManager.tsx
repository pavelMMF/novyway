import { useMemo, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAccountSession } from '../../auth/session'
import { useDocuments } from '../../demo/store'
import {
  prepareDocumentProposal,
  finalizeDocumentProposal,
  publishDocumentProposal,
  useDocumentProposals,
  type DocumentProposal,
  type PreparedProposal,
} from '../../adapters/documentProposals'
import { useLiveVoting } from '../../adapters/aptos/useLiveAptos'
import { useT } from '../../i18n'
import { sound } from '../../sound/engine'
import { useGovernanceAdmin } from './GovernanceAdminGate'
import { Panel, StatusChip } from './index'

function explorerUrl(hash: string) {
  return `https://explorer.aptoslabs.com/txn/${hash}?network=testnet`
}

function transactionFor(proposal: DocumentProposal): PreparedProposal['transaction'] {
  const voting = proposal.payload.voting
  return {
    function: `${proposal.moduleAddress}::weighted_voting::create_election`,
    functionArguments: [
      proposal.categoryId,
      Uint8Array.from(proposal.metadataHash.slice(2).match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16)),
      new TextEncoder().encode(proposal.metadataUri),
      voting.startsAtSecs,
      voting.endsAtSecs,
      voting.passBps,
      voting.quorumBps,
      voting.allowRevote,
    ],
  }
}

export function DocumentElectionManager() {
  const { lang } = useT()
  const ru = lang === 'ru'
  const [searchParams] = useSearchParams()
  const governance = useGovernanceAdmin()
  const { user } = useAccountSession()
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const documents = useDocuments()
  const requestedDocument = searchParams.get('document')
  const initialDocumentId = requestedDocument && documents.some((item) => item.id === requestedDocument) ? requestedDocument : (documents[0]?.id ?? '')
  const live = useLiveVoting()
  const registry = useDocumentProposals({ includeDrafts: true })

  const [documentId, setDocumentId] = useState(initialDocumentId)
  const document = documents.find((item) => item.id === documentId)
  const [clauseId, setClauseId] = useState(document?.clauses[0]?.id ?? '')
  const clause = document?.clauses.find((item) => item.id === clauseId) ?? document?.clauses[0]
  const [categoryId, setCategoryId] = useState('0')
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
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)
  const [messageProposalId, setMessageProposalId] = useState<string | null>(null)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const walletMatches = connected
    && account?.address.toString().toLowerCase() === governance.address.toLowerCase()
  const proposals = useMemo(() => registry.proposals.filter((item) => item.documentId === documentId), [registry.proposals, documentId])

  function selectDocument(nextId: string) {
    const next = documents.find((item) => item.id === nextId)
    setDocumentId(nextId)
    setAttemptedSubmit(false)
    setClauseId(next?.clauses[0]?.id ?? '')
    setProposedRu('')
    setProposedEn('')
    setRationaleRu('')
    setRationaleEn('')
  }

  async function signAndPublish(proposal: DocumentProposal, prepared?: PreparedProposal['transaction']) {
    setMessageProposalId(prepared ? null : proposal.id)
    setLastTxHash(null)

    if (!user?.csrfToken || !walletMatches) {
      setMessage(ru ? 'Подключите активный кошелёк администратора.' : 'Connect the active administrator wallet.')
      sound.play('warning')
      return
    }
    setBusy(true)
    setMessage(ru ? 'Подтвердите создание голосования в кошельке.' : 'Confirm election creation in your wallet.')
    try {
      const transaction = prepared ?? transactionFor(proposal)
      const result = await signAndSubmitTransaction({
        data: {
          function: transaction.function,
          functionArguments: transaction.functionArguments as never[],
        },
      })
      setMessage(ru ? 'Транзакция отправлена. Сервер сверяет её с поправкой.' : 'Transaction submitted. The server is verifying it against the amendment.')
      const published = await publishDocumentProposal(proposal.id, result.hash, user.csrfToken)
      setLastTxHash(result.hash)
      setMessage(ru ? `Голосование №${published.proposal.electionId} создано и проверено.` : `Election #${published.proposal.electionId} was created and verified.`)
      registry.refresh()
      live.refresh()
      sound.play('voteSuccess')
    } catch (reason) {
      setLastTxHash(null)
      setMessage(reason instanceof Error ? reason.message : 'transaction_failed')
      sound.play('warning')
    } finally {
      setBusy(false)
    }
  }

  async function signAndFinalize(proposal: DocumentProposal) {
    setMessageProposalId(proposal.id)
    setLastTxHash(null)
    if (!user?.csrfToken || !walletMatches || !proposal.electionId) {
      setMessage(ru ? 'Подключите активный кошелёк администратора.' : 'Connect the active administrator wallet.')
      sound.play('warning')
      return
    }
    setBusy(true)
    setMessage(ru ? 'Подтвердите завершение голосования в кошельке.' : 'Confirm election finalization in your wallet.')
    try {
      const result = await signAndSubmitTransaction({
        data: {
          function: `${proposal.moduleAddress}::weighted_voting::finalize`,
          functionArguments: [proposal.electionId],
        },
      })
      setMessage(ru ? 'Транзакция отправлена. Сервер сверяет итог с Aptos.' : 'Transaction submitted. The server is verifying the result against Aptos.')
      const finalized = await finalizeDocumentProposal(proposal.id, result.hash, user.csrfToken)
      setLastTxHash(result.hash)
      setMessage(ru ? `Голосование №${finalized.proposal.electionId} завершено и записано в аудит.` : `Election #${finalized.proposal.electionId} was finalized and recorded in the audit.`)
      registry.refresh()
      live.refresh()
      sound.play('voteSuccess')
    } catch (reason) {
      setLastTxHash(null)
      setMessage(reason instanceof Error ? reason.message : 'finalization_failed')
      sound.play('warning')
    } finally {
      setBusy(false)
    }
  }

  async function createElection() {
    setMessageProposalId(null)
    setAttemptedSubmit(true)
    setLastTxHash(null)
    if (!document || !clause || !user?.csrfToken) return
    if (!walletMatches) {
      setMessage(ru ? 'Подключите тот же Aptos-кошелёк, которым подтверждена роль администратора.' : 'Connect the same Aptos wallet used for the administrator session.')
      return
    }
    if (!textFieldsComplete) {
      setMessage(ru ? 'Заполните предлагаемый текст и обоснование на двух языках.' : 'Complete the proposed text and rationale in both languages.')
      return
    }
    if (!parametersValid) {
      setMessage(ru ? 'Проверьте срок, порог принятия и кворум.' : 'Check the duration, pass threshold, and quorum.')
      return
    }
    setBusy(true)
    setMessage(ru ? 'Фиксируем неизменяемый текст поправки.' : 'Freezing the immutable amendment text.')
    try {
      const prepared = await prepareDocumentProposal({
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
        proposedTextRu: proposedRu,
        proposedTextEn: proposedEn,
        rationaleRu,
        rationaleEn,
        categoryId,
        durationDays,
        passBps: passPct * 100,
        quorumBps: quorumPct * 100,
        allowRevote,
      }, user.csrfToken)
      setBusy(false)
      await signAndPublish(prepared.proposal, prepared.transaction)
    } catch (reason) {
      setBusy(false)
      setLastTxHash(null)
      setMessage(reason instanceof Error ? reason.message : 'proposal_creation_failed')
      sound.play('warning')
    }
  }

  const categories = live.data?.categories ?? []
  const textFieldsComplete = Boolean(proposedRu.trim() && proposedEn.trim() && rationaleRu.trim() && rationaleEn.trim())
  const parametersValid = Number.isInteger(durationDays) && durationDays >= 1 && durationDays <= 365
    && Number.isInteger(passPct) && passPct >= 50 && passPct <= 100
    && Number.isInteger(quorumPct) && quorumPct >= 0 && quorumPct <= 100
  const queuedProposals = proposals.filter((proposal) => !proposal.finalizationTxHash)
  const historicalProposals = proposals.filter((proposal) => Boolean(proposal.finalizationTxHash))


  function renderProposal(proposal: DocumentProposal) {
    const election = live.data?.elections.find((item) => item.id === proposal.electionId)
    const title = ru ? proposal.payload.clause.title.ru : proposal.payload.clause.title.en
    const canFinalize = Boolean(election && !election.finalized && Number(election.endsAtSecs) * 1000 <= Date.now())
    return <article className="proposal-queue-item" key={proposal.id}>
      <div className="row between">
        <strong>§ {proposal.payload.clause.number} · {title}</strong>
        {election ? <StatusChip status={election.status} /> : <span className="chip mute">{proposal.status === 'draft' ? (ru ? 'Черновик' : 'Draft') : (ru ? 'Проверяется' : 'Verifying')}</span>}
      </div>
      <time className="mono muted proposal-proof" dateTime={proposal.createdAt}>{new Date(proposal.createdAt).toLocaleString(ru ? 'ru-RU' : 'en-GB')}</time>
      <p>{ru ? proposal.payload.amendment.proposedText.ru : proposal.payload.amendment.proposedText.en}</p>
      <div className="mono muted proposal-proof">{proposal.metadataHash}</div>
      <div className="row proposal-actions">
        {proposal.status === 'draft' && <button className="btn small primary" disabled={busy || !walletMatches} onClick={() => void signAndPublish(proposal)}>{ru ? 'Подписать' : 'Sign'}</button>}
        {proposal.electionId && <Link className="btn small" to={`/elections/chain-${proposal.electionId}`}>{ru ? 'Голосование' : 'Election'} №{proposal.electionId}</Link>}
        {canFinalize && <button className="btn small primary" disabled={busy || !walletMatches} onClick={() => void signAndFinalize(proposal)}>{ru ? 'Завершить и сверить' : 'Finalize and verify'}</button>}
        {proposal.finalizationTxHash && <a className="btn small" href={explorerUrl(proposal.finalizationTxHash)} target="_blank" rel="noreferrer">{ru ? 'Итоговая транзакция' : 'Finalization transaction'} ↗</a>}
        {proposal.creationTxHash && <a className="btn small" href={explorerUrl(proposal.creationTxHash)} target="_blank" rel="noreferrer">{ru ? 'Транзакция' : 'Transaction'} ↗</a>}
      </div>
      {messageProposalId === proposal.id && message && <div className={`callout ${lastTxHash ? 'green' : ''}`} role="status" aria-live="polite">{message}{lastTxHash && <div style={{ marginTop: 8 }}><a href={explorerUrl(lastTxHash)} target="_blank" rel="noreferrer">{ru ? 'Сверить транзакцию' : 'Verify transaction'} ↗</a></div>}</div>}
    </article>
  }

  return <div className="stack governance-proposals">
    <div className={`callout ${walletMatches ? 'green' : 'yellow'}`}>
      {walletMatches
        ? (ru ? 'Кошелёк администратора готов. Черновик станет публичным только после проверки транзакции Aptos.' : 'The administrator wallet is ready. A draft becomes public only after its Aptos transaction is verified.')
        : (ru ? 'Для создания голосования подключите активный кошелёк администратора.' : 'Connect the active administrator wallet to create an election.')}
    </div>

    <div className="grid c2 governance-proposal-grid">
      <Panel title={ru ? 'Новая поправка' : 'New amendment'} hint={ru ? 'один пункт документа' : 'one document clause'}>
        <div className="stack">
          <label className="field"><span>{ru ? 'Документ' : 'Document'}</span>
            <select value={documentId} onChange={(event) => selectDocument(event.target.value)}>
              {documents.map((item) => <option key={item.id} value={item.id}>{ru ? item.title.ru : item.title.en}</option>)}
            </select>
          </label>
          <label className="field"><span>{ru ? 'Пункт' : 'Clause'}</span>
            <select value={clause?.id ?? ''} onChange={(event) => setClauseId(event.target.value)}>
              {document?.clauses.map((item) => <option key={item.id} value={item.id}>§ {item.num} · {ru ? item.title.ru : item.title.en}</option>)}
            </select>
          </label>
          {clause && <div className="callout proposal-current-text"><strong>{ru ? 'Действующая редакция' : 'Current text'}</strong><p>{ru ? clause.text.ru : clause.text.en}</p></div>}
          <div className="grid c2">
            <label className="field"><span>{ru ? 'Предлагаемый текст на русском' : 'Proposed text in Russian'}</span><textarea rows={6} required aria-invalid={attemptedSubmit && !proposedRu.trim()} value={proposedRu} onChange={(event) => setProposedRu(event.target.value)} /></label>
            <label className="field"><span>{ru ? 'Предлагаемый текст на английском' : 'Proposed text in English'}</span><textarea rows={6} required aria-invalid={attemptedSubmit && !proposedEn.trim()} value={proposedEn} onChange={(event) => setProposedEn(event.target.value)} /></label>
          </div>
          <div className="grid c2">
            <label className="field"><span>{ru ? 'Обоснование на русском' : 'Rationale in Russian'}</span><textarea rows={4} required aria-invalid={attemptedSubmit && !rationaleRu.trim()} value={rationaleRu} onChange={(event) => setRationaleRu(event.target.value)} /></label>
            <label className="field"><span>{ru ? 'Обоснование на английском' : 'Rationale in English'}</span><textarea rows={4} required aria-invalid={attemptedSubmit && !rationaleEn.trim()} value={rationaleEn} onChange={(event) => setRationaleEn(event.target.value)} /></label>
          </div>
          <div className="grid c4 proposal-parameters">
            <label className="field"><span>{ru ? 'Категория' : 'Category'}</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                {categories.map((item) => <option value={item.id} key={item.id}>{item.name || `#${item.id}`}</option>)}
                {categories.length === 0 && <option value="0">#0</option>}
              </select>
            </label>
            <label className="field"><span>{ru ? 'Срок, дней' : 'Duration, days'}</span><input type="number" inputMode="numeric" required min={1} max={365} aria-invalid={attemptedSubmit && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365)} value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value))} /></label>
            <label className="field"><span>{ru ? 'Порог принятия, %' : 'Pass threshold, %'}</span><input type="number" inputMode="numeric" required min={50} max={100} aria-invalid={attemptedSubmit && (!Number.isInteger(passPct) || passPct < 50 || passPct > 100)} value={passPct} onChange={(event) => setPassPct(Number(event.target.value))} /></label>
            <label className="field"><span>{ru ? 'Кворум, %' : 'Quorum, %'}</span><input type="number" inputMode="numeric" required min={0} max={100} aria-invalid={attemptedSubmit && (!Number.isInteger(quorumPct) || quorumPct < 0 || quorumPct > 100)} value={quorumPct} onChange={(event) => setQuorumPct(Number(event.target.value))} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={allowRevote} onChange={(event) => setAllowRevote(event.target.checked)} /><span>{ru ? 'Разрешить переголосование' : 'Allow revoting'}</span></label>
          <button className="btn primary" disabled={busy || !document || !clause || !walletMatches} onClick={() => void createElection()}>
            {busy ? (ru ? 'Обработка…' : 'Working…') : (ru ? 'Зафиксировать и подписать' : 'Freeze and sign')}
          </button>
          {message && !messageProposalId && <div className={`callout ${lastTxHash ? 'green' : ''}`} role="status" aria-live="polite">{message}{lastTxHash && <div style={{ marginTop: 8 }}><a href={explorerUrl(lastTxHash)} target="_blank" rel="noreferrer">{ru ? 'Сверить транзакцию' : 'Verify transaction'} ↗</a></div>}</div>}
        </div>
      </Panel>

      <Panel title={ru ? 'Очередь и история' : 'Queue and history'} hint={String(proposals.length)}>
        {registry.loading && <div className="empty">{ru ? 'Загружаем реестр…' : 'Loading registry…'}</div>}
        {registry.error && <div className="callout red">{registry.error}</div>}
        {!registry.loading && proposals.length === 0 && <div className="empty">{ru ? 'Для этого документа поправок пока нет.' : 'This document has no amendments yet.'}</div>}
        {queuedProposals.length > 0 && <section className="proposal-queue-group">
          <h3>{ru ? 'Требуют действия' : 'Needs action'}</h3>
          <div className="stack proposal-queue">{queuedProposals.map(renderProposal)}</div>
        </section>}
        {historicalProposals.length > 0 && <section className="proposal-queue-group">
          <h3>{ru ? 'Завершённые' : 'Completed'}</h3>
          <div className="stack proposal-queue">{historicalProposals.map(renderProposal)}</div>
        </section>}
      </Panel>
    </div>
  </div>
}

