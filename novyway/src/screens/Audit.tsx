import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtDate, useT } from '../i18n'
import { persons, useSettings, useStore } from '../demo/store'
import { AccountRef, PageHead, Panel, Switch } from '../ui/components'
import type { AuditEventType } from '../domain/types'
import { currentRuntimeMode } from '../adapters/types'
import { LiveAudit } from './LiveAudit'

const typeFilters: (AuditEventType | 'all')[] = ['all', 'vote', 'revote', 'receipt', 'qualification', 'policy', 'snapshot', 'election_created', 'finalized', 'admin']

const typeColors: Record<AuditEventType, string> = {
  vote: 'var(--cyan)', revote: 'var(--cyan)', receipt: 'var(--lime-ink)',
  qualification: 'var(--lime-ink)', policy: 'var(--red)', snapshot: 'var(--ink-2)',
  election_created: 'var(--red)', finalized: 'var(--ink)', admin: 'var(--red-deep)',
  category: 'var(--cat-education)', document: 'var(--cat-law)',
}

export default function Audit() {
  if (currentRuntimeMode() === 'aptos-testnet') return <LiveAudit />
  return <DemoAudit />
}

function DemoAudit() {
  const { t, l, lang } = useT()
  const { state } = useStore()
  const { s, update } = useSettings()
  const [q, setQ] = useState('')
  const [type, setType] = useState<(typeof typeFilters)[number]>('all')

  const query = q.trim().toLowerCase()
  const rows = state.audit.filter((ev) => {
    if (type !== 'all' && ev.type !== type) return false
    if (!query) return true
    const person = persons.find((p) => p.address === ev.actor)
    return [
      ev.actor, ev.txHash, ev.electionId ?? '', ev.id,
      ev.snapshotId ? `#${ev.snapshotId}` : '',
      person?.name?.ru ?? '', person?.name?.en ?? '',
      ev.human.ru, ev.human.en,
    ].some((f) => f.toLowerCase().includes(query))
  })

  return (
    <>
      <PageHead
        title={t('au.title')}
        sub={t('au.sub')}
        right={
          <div title={t('au.identityHint')}>
            <Switch checked={s.identityMode} onChange={(v) => update({ identityMode: v })} label={t('au.identityMode')} />
          </div>
        }
      />

      <div className="row" style={{ marginBottom: 14 }}>
        <input
          type="search"
          placeholder={t('au.searchPh')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
          aria-label={t('common.search')}
        />
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label={t('au.type')}>
          {typeFilters.map((tf) => (
            <option key={tf} value={tf}>{tf === 'all' ? `${t('au.type')}: ${t('common.all').toLowerCase()}` : tf}</option>
          ))}
        </select>
      </div>

      <Panel>
        <table className="tbl responsive">
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('au.type')}</th>
              <th>{t('common.actor')}</th>
              <th>{t('common.event')}</th>
              <th>{t('au.proof')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ev) => (
              <tr key={ev.id}>
                <td data-l={t('common.date')} className="mono muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {fmtDate(ev.at, lang, true)}
                </td>
                <td data-l={t('au.type')}>
                  <span className="chip mono mute" style={{ color: typeColors[ev.type], borderColor: 'currentcolor' }}>
                    {ev.type}
                  </span>
                </td>
                <td data-l={t('common.actor')}><AccountRef address={ev.actor} /></td>
                <td data-l={t('common.event')}>
                  {l(ev.human)}
                  {ev.electionId && <> · <Link to={`/elections/${ev.electionId}`} className="mono" style={{ fontSize: 12 }}>{ev.electionId}</Link></>}
                </td>
                <td data-l={t('au.proof')} className="mono muted" style={{ fontSize: 11 }}>{ev.txHash}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">{t('au.empty')} «{q}»</div>}
      </Panel>
    </>
  )
}
