import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtDate, useT } from '../i18n'
import { ME, useStore, useDocuments } from '../demo/store'
import { CatChip, Countdown, PageHead, Panel, StatusChip } from '../ui/components'
import { bpsToPct } from '../domain/weights'
import type { ElectionStatus } from '../domain/types'
import { currentRuntimeMode } from '../adapters/types'
import { LiveElections } from './LiveElections'

const statusFilters: (ElectionStatus | 'all')[] = ['all', 'active', 'upcoming', 'passed', 'rejected']

export default function Elections() {
  if (currentRuntimeMode() === 'aptos-testnet') return <LiveElections />
  return <DemoElections />
}

function DemoElections() {
  const { t, l, lang } = useT()
  const { state } = useStore()
  const nav = useNavigate()
  const [status, setStatus] = useState<(typeof statusFilters)[number]>('all')
  const [cat, setCat] = useState('all')
  const docs = useDocuments()

  const rows = state.elections.filter((e) =>
    (status === 'all' || e.status === status) && (cat === 'all' || e.categoryId === cat))

  return (
    <>
      <PageHead title={t('el.title')} sub={t('el.sub')} />

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="seg" role="tablist">
          {statusFilters.map((s) => (
            <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
              {s === 'all' ? t('common.all') : t(`st.${s}` as 'st.active')}
            </button>
          ))}
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('common.category')}>
          <option value="all">{t('common.category')}: {t('common.all').toLowerCase()}</option>
          {state.categories.map((c) => (
            <option key={c.id} value={c.id}>{l(c.name)}</option>
          ))}
        </select>
      </div>

      <Panel>
        <table className="tbl responsive">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('common.category')}</th>
              <th>{t('common.document')} / {t('common.clause').toLowerCase()}</th>
              <th>{t('common.support')}</th>
              <th>{t('common.quorum')}</th>
              <th>{t('common.deadline')}</th>
              <th>{t('common.status')}</th>
              <th>{t('el.myVote')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const c = state.categories.find((x) => x.id === e.categoryId)!
              const tl = state.tallies[e.id]
              const doc = docs.find((d) => d.id === e.documentId)!
              const clause = doc.clauses.find((cl) => cl.amendment?.electionId === e.id)
              const snap = state.snapshots.find((s) => s.id === e.snapshotId)!
              const majority = tl.yes + tl.no > 0 ? Math.round((tl.yes / (tl.yes + tl.no)) * 100) : 0
              const quorumPct = snap.eligibleWeight > 0 ? Math.round((tl.turnoutWeight / snap.eligibleWeight) * 100) : 0
              const my = state.votes.find((v) => v.electionId === e.id && v.voter === ME)
              return (
                <tr key={e.id} className="rowlink" onClick={() => nav(`/elections/${e.id}`)}>
                  <td data-l="id" className="mono muted">{e.id}</td>
                  <td data-l={t('common.category')}><CatChip cat={c} /></td>
                  <td data-l={t('common.document')}>
                    <div style={{ fontWeight: 500 }}>{l(e.title)}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>
                      {l(doc.title)} · {t('common.clause').toLowerCase()} {clause?.num} · snapshot #{snap.id}
                    </div>
                  </td>
                  <td data-l={t('common.support')} className="num">{majority}%</td>
                  <td data-l={t('common.quorum')} className="num">{quorumPct}% / {bpsToPct(e.quorumBps)}</td>
                  <td data-l={t('common.deadline')} className="mono" style={{ fontSize: 12.5 }}>
                    {fmtDate(e.endsAt, lang)}
                    {e.status === 'active' && <div><Countdown endsAt={e.endsAt} /></div>}
                  </td>
                  <td data-l={t('common.status')}><StatusChip status={e.status} /></td>
                  <td data-l={t('el.myVote')}>
                    {my
                      ? <span className="chip ok"><span className="dot" />{t('st.voted')}</span>
                      : <span className="chip mute">{t('st.notVoted')}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">{t('au.empty')}</div>}
      </Panel>
    </>
  )
}
