import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { configuredVotingModule } from '../adapters/aptos/aptosReadGateway'
import { aptosTestnetExplorer } from '../adapters/aptos/documentAnchorGateway'
import { useLiveVoting } from '../adapters/aptos/useLiveAptos'
import { fmtDate, shortAddr, useT } from '../i18n'
import { proposalMatchesDocumentBase, useDocumentProposals, verifyDocumentProposal, type ProposalVerification } from '../adapters/documentProposals'
import { KV, Meter, PageHead, Panel, StatusChip } from '../ui/components'
import { SponsoredBallot } from '../ui/components/SponsoredBallot'
import { useDocuments } from '../demo/store'

const transactions: Record<string, { created?: string; finalized?: string }> = {
  '0': {
    created: '0x9700e8001070032372e4d302d395e73e8b0ee037d7fbb5ce4cc6fdbb3a8556a8',
    finalized: '0xc5c207324a1df3b4848bda0c72ba9f781cac7b9f598b6b07544d7736eedff66c',
  },
}

function units(value: string) {
  return Number(BigInt(value) / 10000n)
}

export function LiveElectionDetail({ electionId }: { electionId: string }) {
  const { t, lang } = useT()
  const documents = useDocuments()
  const ru = lang === 'ru'
  const { data, loading, error, refresh } = useLiveVoting()
  const election = data?.elections.find((item) => item.id === electionId)
  const registry = useDocumentProposals({ electionId })
  const proposal = registry.proposals[0]
  const document = proposal ? documents.find((item) => item.id === proposal.documentId) : undefined
  const [integrity, setIntegrity] = useState<ProposalVerification | 'checking'>('unbound')

  useEffect(() => {
    let active = true
    if (!proposal || !election) {
      setIntegrity('unbound')
      return () => { active = false }
    }
    if (!document || !proposalMatchesDocumentBase(proposal, document)) {
      setIntegrity('mismatch')
      return () => { active = false }
    }
    void verifyDocumentProposal(proposal, election).then((result) => { if (active) setIntegrity(result) })
    setIntegrity('checking')
    return () => { active = false }
  }, [document, election, proposal])
  const category = data?.categories.find((item) => item.id === election?.categoryId)

  if (loading && !election) return <div className="empty">{ru ? 'Читаем голосование из Aptos Testnet…' : 'Reading election from Aptos Testnet…'}</div>
  if (error) return <div className="callout red">{ru ? 'Не удалось прочитать голосование: ' : 'Could not read the election: '}{error} <button className="btn small" onClick={refresh}>{ru ? 'Повторить' : 'Retry'}</button></div>
  if (!election) return <div className="empty">{t('au.empty')}</div>

  const yes = units(election.yesUnits)
  const no = units(election.noUnits)
  const abstain = units(election.abstainUnits)
  const total = yes + no + abstain
  const supportBase = yes + no
  const support = supportBase ? (yes / supportBase) * 100 : 0
  const turnout = Number(election.eligibleTotal) ? (total / Number(election.eligibleTotal)) * 100 : 0
  const verifiedProposal = integrity === 'verified' ? proposal : undefined
  const fallbackTx = transactions[election.id]
  const tx = {
    created: verifiedProposal?.creationTxHash ?? fallbackTx?.created,
    finalized: verifiedProposal?.finalizationTxHash ?? fallbackTx?.finalized,
  }
  const pageTitle = verifiedProposal
    ? (ru ? verifiedProposal.payload.document.title.ru + ': § ' + verifiedProposal.payload.clause.number : verifiedProposal.payload.document.title.en + ': § ' + verifiedProposal.payload.clause.number)
    : (ru ? 'Голосование №' : 'Election #') + election.id
  const subjectVerificationPending = registry.loading || Boolean(proposal && integrity === 'checking')
  const proposalAllowsVoting = !subjectVerificationPending && !registry.error && (!proposal || integrity === 'verified')
  const categoryName = ru
    ? category?.name === 'General' ? 'Общая' : category?.name === 'QA Demo' ? 'Проверка качества' : category?.name
    : category?.name

  return <>
    <PageHead
      title={pageTitle}
      sub={<span className="mono">{categoryName || `${ru ? 'Категория' : 'Category'} ${election.categoryId}`} · {ru ? 'снимок состава' : 'membership snapshot'} {election.membershipVersion} · {ru ? 'версия правил' : 'policy version'} {election.policyVersion}</span>}
      right={<StatusChip status={election.status} />}
    />
    <div className="grid c2">
      <div className="stack">
        {registry.loading && <div className="empty">{ru ? 'Проверяем предмет решения…' : 'Verifying the subject…'}</div>}
        {registry.error && <div className="callout red">{ru ? 'Не удалось проверить предмет решения. Бюллетень закрыт до восстановления связи с реестром.' : 'The subject could not be verified. The ballot is closed until the registry is available.'} <button className="btn small" onClick={registry.refresh}>{ru ? 'Повторить' : 'Retry'}</button></div>}
        {!registry.loading && proposal && integrity === 'checking' && <div className="callout cyan">{ru ? 'Сверяем хеш и параметры поправки с Aptos…' : 'Checking the amendment hash and parameters against Aptos…'}</div>}
        {proposal && integrity === 'mismatch' && <div className="callout red">{ru ? 'Текст поправки не совпал с хешем или параметрами голосования Aptos. Голосование заблокировано для безопасной проверки.' : 'The amendment text does not match its hash or Aptos election parameters. Voting is blocked for safety.'}</div>}
        {verifiedProposal && (
          <Panel
            title={ru ? 'Предмет решения' : 'Subject of the decision'}
            hint={(ru ? 'голосование №' : 'election #') + election.id}
          >
            <div className="proposal-document-ref">
              <Link to={'/documents/' + verifiedProposal.documentId}>{ru ? verifiedProposal.payload.document.title.ru : verifiedProposal.payload.document.title.en}</Link>
              <span>§ {verifiedProposal.payload.clause.number} · {ru ? verifiedProposal.payload.clause.title.ru : verifiedProposal.payload.clause.title.en}</span>
            </div>
            <div className="proposal-text-diff">
              <section className="proposal-text-block current">
                <span>{ru ? 'Действующая редакция' : 'Current text'}</span>
                <p>{ru ? verifiedProposal.payload.clause.currentText.ru : verifiedProposal.payload.clause.currentText.en}</p>
              </section>
              <section className="proposal-text-block proposed">
                <span>{ru ? 'Предлагаемая редакция' : 'Proposed text'}</span>
                <p>{ru ? verifiedProposal.payload.amendment.proposedText.ru : verifiedProposal.payload.amendment.proposedText.en}</p>
              </section>
            </div>
            <div className="callout cyan proposal-rationale">
              <strong>{ru ? 'Обоснование' : 'Rationale'}</strong>
              <p>{ru ? verifiedProposal.payload.amendment.rationale.ru : verifiedProposal.payload.amendment.rationale.en}</p>
            </div>
            <div className="proposal-proof-row">
              <code>{verifiedProposal.metadataHash}</code>
              <a href={verifiedProposal.metadataUri} target="_blank" rel="noreferrer">{ru ? 'Открыть неизменяемые метаданные' : 'Open immutable metadata'} ↗</a>
            </div>
          </Panel>
        )}
        <Panel title={ru ? 'Публичные параметры' : 'Public parameters'}>
          <div className="stack">
            <KV k={ru ? 'Создатель' : 'Creator'} v={shortAddr(election.createdBy)} mono />
            <KV k={ru ? 'Метаданные' : 'Metadata'} v={verifiedProposal ? <a href={verifiedProposal.metadataUri} target="_blank" rel="noreferrer">{shortAddr(election.metadataHash)} ↗</a> : shortAddr(election.metadataHash)} mono />
            <KV k={ru ? 'Начало' : 'Starts'} v={fmtDate(new Date(Number(election.startsAtSecs) * 1000).toISOString(), lang, true)} />
            <KV k={ru ? 'Окончание' : 'Ends'} v={fmtDate(new Date(Number(election.endsAtSecs) * 1000).toISOString(), lang, true)} />
            <KV k={ru ? 'Порог принятия' : 'Pass threshold'} v={`${election.passBps / 100}%`} mono />
            <KV k={t('common.quorum')} v={`${election.quorumBps / 100}%`} mono />
            <KV k={ru ? 'Переголосование' : 'Revoting'} v={election.allowRevote ? (ru ? 'разрешено' : 'allowed') : (ru ? 'запрещено' : 'disabled')} />
          </div>
        </Panel>
        <Panel title={ru ? 'Снимок весов' : 'Weight snapshot'}>
          <table className="tbl responsive">
            <thead><tr><th>{t('common.level')}</th><th>{ru ? 'Доля пула' : 'Pool share'}</th><th>{ru ? 'Участники' : 'Members'}</th><th>{t('common.weight')}</th><th>{ru ? 'Целевой пул' : 'Target pool'}</th></tr></thead>
            <tbody>{election.snapshot.quotas.map((quota, level) => <tr key={level}><td data-l={t('common.level')}>L{level}</td><td data-l={ru ? 'Доля пула' : 'Pool share'}>{Number(quota) / 100}%</td><td data-l={ru ? 'Участники' : 'Members'}>{election.snapshot.counts[level]}</td><td data-l={t('common.weight')} className="mono">{Number(election.snapshot.derivedWeights[level]).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB')}</td><td data-l={ru ? 'Целевой пул' : 'Target pool'} className="mono">{Number(election.snapshot.targets[level]).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB')}</td></tr>)}</tbody>
          </table>
        </Panel>
      </div>
      <div className="stack">
        <Panel title={ru ? 'Итог' : 'Result'}>
          <div className="row between"><strong>{t('common.support')}</strong><strong>{support.toFixed(2)}%</strong></div>
          <Meter total={Math.max(total, 1)} parts={[{ value: yes, color: 'var(--lime-ink)' }, { value: no, color: 'var(--red)' }, { value: abstain, color: 'var(--ink-2)' }]} />
          <div className="grid c3" style={{ marginTop: 12 }}>
            <KV k={ru ? 'За' : 'Yes'} v={yes.toLocaleString()} mono />
            <KV k={ru ? 'Против' : 'No'} v={no.toLocaleString()} mono />
            <KV k={ru ? 'Воздержались' : 'Abstain'} v={abstain.toLocaleString()} mono />
          </div>
          <div className="stack" style={{ marginTop: 14 }}>
            <KV k={t('common.quorum')} v={`${turnout.toFixed(2)}% / ${election.quorumBps / 100}%`} mono />
            <KV k={ru ? 'Уникальные участники' : 'Unique voters'} v={election.uniqueVoters} mono />
            <KV k={ru ? 'Решение' : 'Decision'} v={election.finalized ? (election.passed ? (ru ? 'принято' : 'passed') : (ru ? 'не принято' : 'not passed')) : (ru ? 'ещё не завершено' : 'not finalized')} />
          </div>
        </Panel>
        <Panel title={ru ? 'Независимая проверка' : 'Independent verification'}>
          <p className="muted">{ru ? 'Откройте те же транзакции в обозревателе Aptos и сравните адрес модуля, события и итоговые числа.' : 'Open the same transactions in Aptos Explorer and compare the module address, events, and totals.'}</p>
          <div className="row" style={{ marginTop: 12 }}>
            {tx?.created && <a className="btn small" href={aptosTestnetExplorer(`txn/${tx.created}`)} target="_blank" rel="noreferrer">{ru ? 'Создание' : 'Creation'} ↗</a>}
            {tx?.finalized && <a className="btn small" href={aptosTestnetExplorer(`txn/${tx.finalized}`)} target="_blank" rel="noreferrer">{ru ? 'Завершение' : 'Finalization'} ↗</a>}
            <a className="btn small" href={aptosTestnetExplorer(`account/${configuredVotingModule()}/modules`)} target="_blank" rel="noreferrer">{ru ? 'Модуль' : 'Module'} ↗</a>
          </div>
        </Panel>
        {subjectVerificationPending
          ? <div className="callout cyan">{ru ? 'Проверяем предмет решения перед открытием бюллетеня…' : 'Verifying the subject before opening the ballot…'}</div>
          : registry.error
            ? <div className="callout red">{ru ? 'Бюллетень временно закрыт: реестр предметов решения недоступен.' : 'The ballot is temporarily closed because the subject registry is unavailable.'}</div>
            : election.status === 'active' && proposalAllowsVoting
            ? <SponsoredBallot electionId={election.id} allowRevote={election.allowRevote} />
            : election.status === 'active'
              ? <div className="callout red">{ru ? 'Бюллетень заблокирован: предмет решения не прошёл проверку.' : 'The ballot is blocked because its subject failed verification.'}</div>
              : <div className="callout yellow">{ru ? 'Голосование сейчас не принимает новые голоса.' : 'This election is not accepting new votes.'}</div>}
        <Link className="btn" to="/elections">← {t('common.back')}</Link>
      </div>
    </div>
  </>
}
