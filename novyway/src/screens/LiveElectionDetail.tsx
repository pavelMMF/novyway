import { Link } from 'react-router-dom'
import { configuredVotingModule } from '../adapters/aptos/aptosReadGateway'
import { aptosTestnetExplorer } from '../adapters/aptos/documentAnchorGateway'
import { useLiveVoting } from '../adapters/aptos/useLiveAptos'
import { fmtDate, shortAddr, useT } from '../i18n'
import { KV, Meter, PageHead, Panel, StatusChip } from '../ui/components'
import { SponsoredBallot } from '../ui/components/SponsoredBallot'

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
  const ru = lang === 'ru'
  const { data, loading, error, refresh } = useLiveVoting()
  const election = data?.elections.find((item) => item.id === electionId)
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
  const tx = transactions[election.id]
  const categoryName = ru
    ? category?.name === 'General' ? 'Общая' : category?.name === 'QA Demo' ? 'Проверка качества' : category?.name
    : category?.name

  return <>
    <PageHead
      title={ru ? `Голосование №${election.id}` : `Election #${election.id}`}
      sub={<span className="mono">{categoryName || `${ru ? 'Категория' : 'Category'} ${election.categoryId}`} · {ru ? 'снимок состава' : 'membership snapshot'} {election.membershipVersion} · {ru ? 'версия правил' : 'policy version'} {election.policyVersion}</span>}
      right={<StatusChip status={election.status} />}
    />
    <div className="grid c2">
      <div className="stack">
        <Panel title={ru ? 'Публичные параметры' : 'Public parameters'}>
          <div className="stack">
            <KV k={ru ? 'Создатель' : 'Creator'} v={shortAddr(election.createdBy)} mono />
            <KV k={ru ? 'Метаданные' : 'Metadata'} v={shortAddr(election.metadataHash)} mono />
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
        {election.status === 'active'
          ? <SponsoredBallot electionId={election.id} allowRevote={election.allowRevote} />
          : <div className="callout yellow">{ru ? 'Голосование сейчас не принимает новые голоса.' : 'This election is not accepting new votes.'}</div>}
        <Link className="btn" to="/elections">← {t('common.back')}</Link>
      </div>
    </div>
  </>
}
