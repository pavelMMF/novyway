import { useMemo, useState, type CSSProperties } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  finalizeDocumentProposal,
  prepareDocumentProposalElection,
  publishDocumentProposal,
  useDocumentProposals,
  type DocumentProposal,
} from '../../adapters/documentProposals'
import { useLiveVoting } from '../../adapters/aptos/useLiveAptos'
import { useAccountSession } from '../../auth/session'
import { useDocuments } from '../../demo/store'
import { useT } from '../../i18n'
import { sound } from '../../sound/engine'
import { DocumentProposalComposer } from './DocumentProposalComposer'
import { useGovernanceAdmin } from './GovernanceAdminGate'
import { Panel, StatusChip } from './index'

function explorerUrl(hash: string) {
  return `https://explorer.aptoslabs.com/txn/${hash}?network=testnet`
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
  const [documentId, setDocumentId] = useState(initialDocumentId)
  const document = documents.find((item) => item.id === documentId) ?? documents[0]
  const live = useLiveVoting()
  const registry = useDocumentProposals({ includeDrafts: true })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)
  const walletMatches = connected && account?.address.toString().toLowerCase() === governance.address.toLowerCase()
  const proposals = useMemo(() => registry.proposals.filter((item) => item.documentId === document?.id), [registry.proposals, document?.id])

  async function launchFinalElection(proposal: DocumentProposal) {
    if (!user?.csrfToken || !walletMatches) {
      setMessage(ru ? 'Подключите активный кошелёк администратора.' : 'Connect the active administrator wallet.')
      sound.play('warning')
      return
    }
    setBusyId(proposal.id)
    setLastTxHash(null)
    setMessage(ru ? 'Готовим параметры после проверки порога поддержки…' : 'Preparing parameters after verifying the support threshold…')
    try {
      const prepared = await prepareDocumentProposalElection(proposal.id, user.csrfToken)
      setMessage(ru ? 'Подтвердите запуск финального голосования в кошельке.' : 'Confirm the final election launch in your wallet.')
      const result = await signAndSubmitTransaction({ data: { function: prepared.transaction.function, functionArguments: prepared.transaction.functionArguments as never[] } })
      setMessage(ru ? 'Транзакция отправлена. Сервер сверяет её с неизменяемым предложением.' : 'Transaction submitted. The server is verifying it against the immutable proposal.')
      const published = await publishDocumentProposal(proposal.id, result.hash, user.csrfToken)
      setLastTxHash(result.hash)
      setMessage(ru ? `Финальное голосование №${published.proposal.electionId} запущено.` : `Final election #${published.proposal.electionId} was launched.`)
      registry.refresh()
      live.refresh()
      sound.play('voteSuccess')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'election_launch_failed')
      sound.play('warning')
    } finally {
      setBusyId(null)
    }
  }

  async function finalize(proposal: DocumentProposal) {
    if (!user?.csrfToken || !walletMatches || !proposal.electionId) {
      setMessage(ru ? 'Подключите активный кошелёк администратора.' : 'Connect the active administrator wallet.')
      sound.play('warning')
      return
    }
    setBusyId(proposal.id)
    setLastTxHash(null)
    setMessage(ru ? 'Подтвердите фиксацию итога в кошельке.' : 'Confirm finalization in your wallet.')
    try {
      const result = await signAndSubmitTransaction({ data: { function: `${proposal.moduleAddress}::weighted_voting::finalize`, functionArguments: [proposal.electionId] } })
      const finalized = await finalizeDocumentProposal(proposal.id, result.hash, user.csrfToken)
      setLastTxHash(result.hash)
      setMessage(ru ? `Итог голосования №${finalized.proposal.electionId} проверен и добавлен в аудит.` : `Election #${finalized.proposal.electionId} was verified and added to the audit.`)
      registry.refresh()
      live.refresh()
      sound.play('voteSuccess')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'finalization_failed')
      sound.play('warning')
    } finally {
      setBusyId(null)
    }
  }

  function renderProposal(proposal: DocumentProposal) {
    const election = live.data?.elections.find((item) => item.id === proposal.electionId)
    const support = proposal.support
    const required = support?.requiredSupporters ?? 0
    const count = support?.supporterCount ?? 0
    const canFinalize = Boolean(election && !election.finalized && Number(election.endsAtSecs) * 1000 <= Date.now())
    const label = proposal.status === 'supporting' ? (ru ? 'Собирает поддержку' : 'Collecting support')
      : proposal.status === 'ready' ? (ru ? 'Готово к запуску' : 'Ready to launch')
        : proposal.status === 'expired' ? (ru ? 'Срок истёк' : 'Expired')
          : election ? null : (ru ? 'Сверяется' : 'Verifying')
    return <article className={`proposal-queue-item status-${proposal.status}`} key={proposal.id}>
      <div className="row between"><strong>§ {proposal.payload.clause.number} · {ru ? proposal.payload.clause.title.ru : proposal.payload.clause.title.en}</strong>{election ? <StatusChip status={election.status} /> : <span className={`chip ${proposal.status === 'ready' ? 'ok' : 'mute'}`}>{label}</span>}</div>
      <time className="mono muted proposal-proof" dateTime={proposal.createdAt}>{new Date(proposal.createdAt).toLocaleString(ru ? 'ru-RU' : 'en-GB')}</time>
      <p>{ru ? proposal.payload.amendment.proposedText.ru : proposal.payload.amendment.proposedText.en}</p>
      {support && <div className="proposal-support-progress"><div className="proposal-support-track"><span style={{ '--support-progress': `${required ? Math.min(100, Math.round(count / required * 100)) : 0}%` } as CSSProperties} /></div><strong>{count}/{required}</strong><small>{ru ? 'поддержка запуска' : 'launch support'}</small></div>}
      <div className="row proposal-actions">
        <Link className="btn small" to={`/documents/${proposal.documentId}#proposal-${proposal.id}`}>{ru ? 'Открыть предложение' : 'Open proposal'}</Link>
        {proposal.status === 'ready' && <button className="btn small primary" disabled={busyId === proposal.id || !walletMatches} onClick={() => void launchFinalElection(proposal)}>{ru ? 'Запустить финальное голосование' : 'Launch final election'}</button>}
        {proposal.electionId && <Link className="btn small" to={`/elections/chain-${proposal.electionId}`}>{ru ? 'Голосование' : 'Election'} №{proposal.electionId}</Link>}
        {canFinalize && <button className="btn small primary" disabled={busyId === proposal.id || !walletMatches} onClick={() => void finalize(proposal)}>{ru ? 'Завершить и сверить' : 'Finalize and verify'}</button>}
        {proposal.creationTxHash && <a className="btn small" href={explorerUrl(proposal.creationTxHash)} target="_blank" rel="noreferrer">{ru ? 'Транзакция запуска' : 'Launch transaction'} ↗</a>}
        {proposal.finalizationTxHash && <a className="btn small" href={explorerUrl(proposal.finalizationTxHash)} target="_blank" rel="noreferrer">{ru ? 'Транзакция итога' : 'Finalization transaction'} ↗</a>}
      </div>
    </article>
  }

  const needsLaunch = proposals.filter((proposal) => proposal.status === 'ready')
  const collecting = proposals.filter((proposal) => proposal.status === 'supporting')
  const onChain = proposals.filter((proposal) => proposal.status === 'published' && !proposal.finalizationTxHash)
  const history = proposals.filter((proposal) => proposal.status === 'expired' || Boolean(proposal.finalizationTxHash))

  return <div className="stack governance-proposals">
    <div className={`callout ${walletMatches ? 'green' : 'yellow'}`}>{walletMatches
      ? (ru ? 'Кошелёк администратора готов. Запуск доступен только предложениям, набравшим предварительный порог.' : 'The administrator wallet is ready. Only proposals that reached the preliminary threshold can be launched.')
      : (ru ? 'Предложения можно создавать без кошелька; для запуска финального голосования подключите активный кошелёк администратора.' : 'Proposals can be created without a wallet; connect the active administrator wallet to launch a final election.')}</div>

    <div className="grid c2 governance-proposal-grid">
      <Panel title={ru ? 'Новое предложение' : 'New proposal'} hint={ru ? 'доступно всем участникам' : 'available to every participant'}>
        <label className="field"><span>{ru ? 'Документ' : 'Document'}</span><select value={document?.id ?? ''} onChange={(event) => setDocumentId(event.target.value)}>{documents.map((item) => <option key={item.id} value={item.id}>{ru ? item.title.ru : item.title.en}</option>)}</select></label>
        {document && <DocumentProposalComposer document={document} categories={live.data?.categories ?? []} onCreated={() => registry.refresh()} />}
      </Panel>

      <Panel title={ru ? 'Поддержка, запуск и история' : 'Support, launch, and history'} hint={String(proposals.length)}>
        {registry.loading && <div className="empty">{ru ? 'Загружаем реестр…' : 'Loading registry…'}</div>}
        {registry.error && <div className="callout red">{registry.error}</div>}
        {message && <div className={`callout ${lastTxHash ? 'green' : ''}`} role="status">{message}{lastTxHash && <div><a href={explorerUrl(lastTxHash)} target="_blank" rel="noreferrer">{ru ? 'Сверить транзакцию' : 'Verify transaction'} ↗</a></div>}</div>}
        {!registry.loading && proposals.length === 0 && <div className="empty">{ru ? 'У документа пока нет предложений.' : 'The document has no proposals yet.'}</div>}
        {needsLaunch.length > 0 && <section className="proposal-queue-group"><h3>{ru ? 'Порог достигнут' : 'Threshold reached'}</h3><div className="stack proposal-queue">{needsLaunch.map(renderProposal)}</div></section>}
        {collecting.length > 0 && <section className="proposal-queue-group"><h3>{ru ? 'Собирают поддержку' : 'Collecting support'}</h3><div className="stack proposal-queue">{collecting.map(renderProposal)}</div></section>}
        {onChain.length > 0 && <section className="proposal-queue-group"><h3>{ru ? 'Финальные голосования' : 'Final elections'}</h3><div className="stack proposal-queue">{onChain.map(renderProposal)}</div></section>}
        {history.length > 0 && <section className="proposal-queue-group"><h3>{ru ? 'История' : 'History'}</h3><div className="stack proposal-queue">{history.map(renderProposal)}</div></section>}
      </Panel>
    </div>
  </div>
}
