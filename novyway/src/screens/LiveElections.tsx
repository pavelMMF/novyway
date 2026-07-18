import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aptosTestnetExplorer } from '../adapters/aptos/documentAnchorGateway'
import { configuredVotingModule } from '../adapters/aptos/aptosReadGateway'
import { useLiveVoting } from '../adapters/aptos/useLiveAptos'
import type { ElectionStatus } from '../domain/types'
import { fmtDate, shortAddr, useT } from '../i18n'
import { PageHead, Panel, StatusChip } from '../ui/components'
import { AdminElectionRegister } from '../ui/components/AdminElectionRegister'

const statusFilters: (ElectionStatus | 'all')[] = ['all', 'active', 'upcoming', 'awaiting_finalization', 'passed', 'rejected', 'quorum_failed']
const colors = ['var(--cyan)', 'var(--cat-law)', 'var(--cat-ecology)', 'var(--cat-education)']

function pct(numerator: string, denominator: string) {
  const top = Number(numerator)
  const bottom = Number(denominator)
  return bottom > 0 ? Math.round((top / bottom) * 100) : 0
}

function categoryName(name: string | undefined, id: string, ru: boolean) {
  if (!name) return `${ru ? 'Категория' : 'Category'} ${id}`
  if (!ru) return name
  if (name === 'General') return 'Общая'
  if (name === 'QA Demo') return 'Проверка качества'
  return name
}

export function LiveElections() {
  const { t, lang } = useT()
  const ru = lang === 'ru'
  const nav = useNavigate()
  const { data, loading, error, refresh } = useLiveVoting()
  const [status, setStatus] = useState<(typeof statusFilters)[number]>('all')
  const [category, setCategory] = useState('all')
  const rows = (data?.elections ?? []).filter((election) =>
    (status === 'all' || election.status === status) && (category === 'all' || election.categoryId === category))

  return (
    <>
      <PageHead
        title={t('el.title')}
        sub={ru ? 'Состояние загружается напрямую из модуля Aptos Testnet' : 'State is loaded directly from the Aptos Testnet module'}
        right={<a className="btn small" href={aptosTestnetExplorer(`account/${configuredVotingModule()}/modules`)} target="_blank" rel="noreferrer">{ru ? 'Модуль в обозревателе' : 'Open module in Explorer'} ↗</a>}
      />
      <div className="row live-election-toolbar">
        <div className="seg live-election-status" role="tablist" aria-label={ru ? 'Статус голосования' : 'Election status'}>
          {statusFilters.map((value) => <button key={value} className={status === value ? 'on' : ''} onClick={() => setStatus(value)}>{value === 'all' ? t('common.all') : t(`st.${value}` as 'st.active')}</button>)}
        </div>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t('common.category')}>
          <option value="all">{t('common.category')}: {t('common.all').toLowerCase()}</option>
          {data?.categories.map((item) => <option value={item.id} key={item.id}>{categoryName(item.name, item.id, ru)}</option>)}
        </select>
        <button className="btn small" onClick={refresh} disabled={loading}>{ru ? 'Обновить' : 'Refresh'}</button>
      </div>
      {error && <div className="callout red" style={{ marginBottom: 14 }}>{ru ? 'Не удалось прочитать сеть: ' : 'Could not read the network: '}{error}</div>}
      <AdminElectionRegister />
      <Panel>
        <table className="tbl responsive">
          <thead><tr><th>{ru ? '№' : 'ID'}</th><th>{t('common.category')}</th><th>{ru ? 'Данные голосования' : 'Election data'}</th><th>{t('common.support')}</th><th>{t('common.quorum')}</th><th>{t('common.deadline')}</th><th>{t('common.status')}</th><th>{ru ? 'Участники' : 'Voters'}</th></tr></thead>
          <tbody>
            {rows.map((election) => {
              const categoryItem = data?.categories.find((item) => item.id === election.categoryId)
              const yes = BigInt(election.yesUnits)
              const no = BigInt(election.noUnits)
              const totalChoice = yes + no
              const support = totalChoice > 0n ? Number((yes * 10000n) / totalChoice) / 100 : 0
              const turnoutWeight = ((BigInt(election.yesUnits) + BigInt(election.noUnits) + BigInt(election.abstainUnits)) / 10000n).toString()
              return <tr key={election.id} className="rowlink" onClick={() => nav(`/elections/chain-${election.id}`)}>
                <td data-l={ru ? '№' : 'ID'} className="mono muted">{election.id}</td>
                <td data-l={t('common.category')}><span className="chip" style={{ color: colors[Number(election.categoryId) % colors.length], borderColor: 'currentcolor' }}>{categoryName(categoryItem?.name, election.categoryId, ru)}</span></td>
                <td data-l={ru ? 'Данные голосования' : 'Election data'}><strong>{ru ? `Голосование №${election.id}` : `Election #${election.id}`}</strong><div className="muted mono" style={{ fontSize: 11 }}>{ru ? 'метаданные' : 'metadata'} {shortAddr(election.metadataHash)} · {ru ? 'снимок состава' : 'membership snapshot'} {election.membershipVersion} · {ru ? 'версия правил' : 'policy version'} {election.policyVersion}</div></td>
                <td data-l={t('common.support')} className="num">{support.toFixed(1)}%</td>
                <td data-l={t('common.quorum')} className="num">{pct(turnoutWeight, election.eligibleTotal)}% / {election.quorumBps / 100}%</td>
                <td data-l={t('common.deadline')} className="mono" style={{ fontSize: 12.5 }}>{fmtDate(new Date(Number(election.endsAtSecs) * 1000).toISOString(), lang, true)}</td>
                <td data-l={t('common.status')}><StatusChip status={election.status} /></td>
                <td data-l={ru ? 'Участники' : 'Voters'} className="num">{election.uniqueVoters}</td>
              </tr>
            })}
          </tbody>
        </table>
        {loading && !data && <div className="empty">{ru ? 'Читаем состояние Aptos Testnet…' : 'Reading Aptos Testnet state…'}</div>}
        {!loading && rows.length === 0 && <div className="empty">{t('au.empty')}</div>}
      </Panel>
    </>
  )
}
