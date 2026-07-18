import { useState } from 'react'
import { currentRuntimeMode } from '../adapters/types'
import { configuredVotingModule } from '../adapters/aptos/aptosReadGateway'
import { aptosTestnetExplorer } from '../adapters/aptos/documentAnchorGateway'
import { useLiveVoting } from '../adapters/aptos/useLiveAptos'
import { fmtDate, shortAddr, useT } from '../i18n'
import { KV, PageHead, Panel } from '../ui/components'

const samples = [26, 42, 35, 61, 47, 73, 54, 38, 66, 49, 31, 44]

export default function NetworkStatus() {
  return currentRuntimeMode() === 'aptos-testnet' ? <LiveNetworkStatus /> : <DemoNetworkStatus />
}

function LiveNetworkStatus() {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { data, loading, error, refresh } = useLiveVoting()
  return <>
    <PageHead title={ru ? 'Состояние сети' : 'Network status'} sub={ru ? 'Проверяемые данные публичного узла и модуля голосования' : 'Verifiable public-node and voting-module data'} right={<button className="btn small" onClick={refresh} disabled={loading}>{ru ? 'Обновить' : 'Refresh'}</button>} />
    {error && <div className="callout red">{ru ? 'Сеть недоступна: ' : 'Network unavailable: '}{error}</div>}
    {loading && !data && <div className="empty">{ru ? 'Читаем Aptos Testnet…' : 'Reading Aptos Testnet…'}</div>}
    {data && <>
      <div className="grid c3" style={{ marginBottom: 14 }}>
        <Panel title={ru ? 'Сеть Aptos' : 'Aptos network'} tight><strong className="metric-good">Testnet</strong><div className="muted">{ru ? 'идентификатор сети' : 'chain ID'} {data.chainId}</div></Panel>
        <Panel title={ru ? 'Версия реестра' : 'Ledger version'} tight><strong className="metric-main">{Number(data.ledgerVersion).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB')}</strong><div className="muted">{fmtDate(new Date(Number(data.ledgerTimestampUsecs) / 1000).toISOString(), lang, true)}</div></Panel>
        <Panel title={ru ? 'Голосования' : 'Elections'} tight><strong className="metric-main">{data.counters.elections}</strong><div className="muted">{ru ? `${data.counters.categories} категории` : `${data.counters.categories} categories`}</div></Panel>
      </div>
      <div className="grid c2">
        <Panel title={ru ? 'Модуль голосования' : 'Voting module'}>
          <KV k={ru ? 'Адрес' : 'Address'} v={shortAddr(configuredVotingModule())} mono />
          <KV k={ru ? 'Порог администраторов' : 'Administrator threshold'} v={`${data.adminThreshold} / ${data.administrators.length}`} mono />
          <KV k={ru ? 'Версия совета' : 'Council version'} v={data.versions.council} mono />
          <KV k={ru ? 'Версия правил' : 'Policy version'} v={data.versions.policy} mono />
          <KV k={ru ? 'Версия состава' : 'Membership version'} v={data.versions.membership} mono />
          <a className="btn small" style={{ marginTop: 12 }} href={aptosTestnetExplorer(`account/${configuredVotingModule()}/modules`)} target="_blank" rel="noreferrer">{ru ? 'Сверить в обозревателе' : 'Verify in Explorer'} ↗</a>
        </Panel>
        <Panel title={ru ? 'Счётчики истории' : 'History counters'}>
          <KV k={ru ? 'Изменения администраторов' : 'Administrator changes'} v={data.counters.adminChanges} mono />
          <KV k={ru ? 'Изменения категорий' : 'Category changes'} v={data.counters.categoryChanges} mono />
          <KV k={ru ? 'Предложения правил' : 'Policy proposals'} v={data.counters.policyProposals} mono />
          <KV k={ru ? 'Изменения правил' : 'Policy changes'} v={data.counters.policyChanges} mono />
          <KV k={ru ? 'Предложения квалификаций' : 'Qualification proposals'} v={data.counters.qualificationProposals} mono />
          <KV k={ru ? 'Изменения квалификаций' : 'Qualification changes'} v={data.counters.qualificationChanges} mono />
        </Panel>
      </div>
    </>}
  </>
}

function DemoNetworkStatus() {
  const { lang } = useT()
  const [windowSize, setWindowSize] = useState<'1h' | '24h' | '7d'>('24h')
  const ru = lang === 'ru'
  return <>
    <PageHead title={ru ? 'Состояние сети' : 'Network status'} sub={ru ? 'Демонстрационные показатели подключения и очереди транзакций' : 'Demo connection and transaction-queue telemetry'} />
    <Panel title={ru ? 'Демонстрационная нагрузка' : 'Demo load'} hint={windowSize}>
      <div className="seg" style={{ marginBottom: 16 }}>{(['1h', '24h', '7d'] as const).map((value) => <button key={value} className={windowSize === value ? 'on' : ''} onClick={() => setWindowSize(value)}>{value}</button>)}</div>
      <div className="load-chart" role="img" aria-label={ru ? 'График демонстрационной нагрузки сети' : 'Demo network load chart'}>{samples.map((value, index) => <span key={index} className="load-bar" style={{ height: `${value}%` }} />)}</div>
    </Panel>
  </>
}
