import { useState } from 'react'
import { Link } from 'react-router-dom'
import { configuredVotingModule } from '../adapters/aptos/aptosReadGateway'
import { aptosTestnetExplorer } from '../adapters/aptos/documentAnchorGateway'
import { useLiveAudit } from '../adapters/aptos/useLiveAptos'
import type { AuditEventType } from '../domain/types'
import { fmtDate, shortAddr, useT } from '../i18n'
import { PageHead, Panel } from '../ui/components'

const filters: (AuditEventType | 'all')[] = ['all', 'vote', 'revote', 'qualification', 'policy', 'election_created', 'finalized', 'admin', 'category', 'document']
const colors: Record<AuditEventType, string> = {
  vote: 'var(--cyan)', revote: 'var(--cyan)', receipt: 'var(--lime-ink)', qualification: 'var(--lime-ink)',
  policy: 'var(--red)', snapshot: 'var(--ink-2)', election_created: 'var(--red)', finalized: 'var(--ink)',
  admin: 'var(--red-deep)', category: 'var(--cat-education)', document: 'var(--cat-law)',
}

const labels: Record<AuditEventType, { ru: string; en: string }> = {
  vote: { ru: 'голос', en: 'vote' }, revote: { ru: 'переголосование', en: 'revote' }, receipt: { ru: 'квитанция', en: 'receipt' },
  qualification: { ru: 'квалификация', en: 'qualification' }, policy: { ru: 'правила', en: 'policy' }, snapshot: { ru: 'снимок', en: 'snapshot' },
  election_created: { ru: 'голосование создано', en: 'election created' }, finalized: { ru: 'завершено', en: 'finalized' },
  admin: { ru: 'управление', en: 'governance' }, category: { ru: 'категория', en: 'category' }, document: { ru: 'документ', en: 'document' },
}

export function LiveAudit() {
  const { t, l, lang } = useT()
  const ru = lang === 'ru'
  const { data = [], loading, error, refresh } = useLiveAudit()
  const [query, setQuery] = useState('')
  const [type, setType] = useState<(typeof filters)[number]>('all')
  const needle = query.trim().toLowerCase()
  const rows = data.filter((event) => (type === 'all' || event.type === type) && (!needle || [event.actor, event.txHash, event.ledgerVersion, event.functionName, event.human.ru, event.human.en].some((value) => value.toLowerCase().includes(needle))))

  return <>
    <PageHead
      title={t('au.title')}
      sub={ru ? 'Публичный журнал: данные каждой строки получены по хэшу транзакции из Aptos Testnet' : 'Public log: every row is loaded by transaction hash from Aptos Testnet'}
      right={<a className="btn small" href={aptosTestnetExplorer(`account/${configuredVotingModule()}/modules`)} target="_blank" rel="noreferrer">{ru ? 'Сверить модуль' : 'Verify module'} ↗</a>}
    />
    <div className="row" style={{ marginBottom: 14 }}>
      <input type="search" placeholder={t('au.searchPh')} value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: 1, minWidth: 220 }} aria-label={t('common.search')} />
      <select value={type} onChange={(event) => setType(event.target.value as typeof type)} aria-label={t('au.type')}>
        {filters.map((value) => <option key={value} value={value}>{value === 'all' ? `${t('au.type')}: ${t('common.all').toLowerCase()}` : labels[value][lang]}</option>)}
      </select>
      <button className="btn small" onClick={refresh} disabled={loading}>{ru ? 'Обновить' : 'Refresh'}</button>
    </div>
    {error && <div className="callout red" style={{ marginBottom: 14 }}>{ru ? 'Не удалось прочитать журнал: ' : 'Could not read the log: '}{error}</div>}
    <div className="callout" style={{ marginBottom: 14 }}>{ru ? 'Здесь показан проверяемый набор известных транзакций развёртывания и испытаний. Это не полный индекс всех действий сети.' : 'This is a verifiable set of known deployment and test transactions, not a complete index of every network action.'}</div>
    <Panel>
      <table className="tbl responsive">
        <thead><tr><th>{t('common.date')}</th><th>{t('au.type')}</th><th>{t('common.actor')}</th><th>{t('common.event')}</th><th>{t('au.proof')}</th></tr></thead>
        <tbody>{rows.map((event) => <tr key={event.id}>
          <td data-l={t('common.date')} className="mono muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(event.at, lang, true)}</td>
          <td data-l={t('au.type')}><span className="chip mono mute" style={{ color: colors[event.type], borderColor: 'currentcolor' }}>{labels[event.type][lang]}</span></td>
          <td data-l={t('common.actor')}><span className="mono" title={event.actor}>{shortAddr(event.actor)}</span></td>
          <td data-l={t('common.event')}>{l(event.human)}{event.electionId && <> · <Link to={`/elections/${event.electionId}`} className="mono">{ru ? 'голосование' : 'election'} {event.electionId.replace('chain-', '#')}</Link></>}</td>
          <td data-l={t('au.proof')}><a className="btn small explorer-link" href={aptosTestnetExplorer(`txn/${event.txHash}`)} target="_blank" rel="noreferrer" title={event.txHash}>{ru ? 'Сверить' : 'Verify'} · {shortAddr(event.txHash)} ↗</a><div className="mono muted" style={{ fontSize: 10 }}>{ru ? 'версия реестра' : 'ledger version'} {event.ledgerVersion}</div></td>
        </tr>)}</tbody>
      </table>
      {loading && data.length === 0 && <div className="empty">{ru ? 'Читаем транзакции Aptos Testnet…' : 'Reading Aptos Testnet transactions…'}</div>}
      {!loading && rows.length === 0 && <div className="empty">{t('au.empty')}</div>}
    </Panel>
  </>
}
