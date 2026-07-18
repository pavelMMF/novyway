import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fmtDate, shortAddr, useT } from '../i18n'
import { ME, useDocuments, myWeightInSnapshot, useStore } from '../demo/store'
import { CatChip, Countdown, GoldBurst, KV, LinkBtn, Lvl, Meter, PageHead, Panel, StatusChip } from '../ui/components'
import { bpsToPct, fmtW } from '../domain/weights'
import { sound } from '../sound/engine'
import { currentRuntimeMode } from '../adapters/types'
import { LiveElectionDetail } from './LiveElectionDetail'

export default function ElectionDetail() {
  const { id } = useParams()
  if (currentRuntimeMode() === 'aptos-testnet') {
    return id?.startsWith('chain-')
      ? <LiveElectionDetail electionId={id.slice('chain-'.length)} />
      : <MissingTestnetElection />
  }
  return <DemoElectionDetail id={id} />
}

function MissingTestnetElection() {
  const { lang } = useT()
  const ru = lang === 'ru'
  return <>
    <PageHead
      title={ru ? 'Голосование не найдено в тестовой сети' : 'Election not found on Testnet'}
      sub={ru ? 'Эта ссылка относится к старым демонстрационным данным и не является записью Aptos.' : 'This link belongs to the old demo dataset and is not an Aptos record.'}
    />
    <Panel title={ru ? 'Локальное голосование отключено' : 'Local voting is disabled'}>
      <p className="muted">{ru ? 'В режиме Aptos сайт показывает только голосования, прочитанные из опубликованного модуля. Здесь нельзя создать локальную квитанцию или запись аудита.' : 'In Aptos mode the site only shows elections read from the published module. No local receipt or audit entry can be created here.'}</p>
      <Link className="btn primary" to="/elections">{ru ? 'Открыть реестр голосований' : 'Open election registry'}</Link>
    </Panel>
  </>
}


function DemoElectionDetail({ id }: { id?: string }) {
  const { t, l, lang } = useT()
  const { state, dispatch } = useStore()
  const docs = useDocuments()

  const e = state.elections.find((x) => x.id === id)
  if (!e) return <div className="empty">{t('au.empty')}</div>

  const cat = state.categories.find((c) => c.id === e.categoryId)!
  const snap = state.snapshots.find((s) => s.id === e.snapshotId)!
  const doc = docs.find((d) => d.id === e.documentId)!
  const clause = doc.clauses.find((c) => c.amendment?.electionId === e.id)!
  const am = clause.amendment!
  const tl = state.tallies[e.id]
  const my = state.votes.find((v) => v.electionId === e.id && v.voter === ME)
  const myW = myWeightInSnapshot(state, e)
  const myReceipts = state.receipts.filter((r) => r.electionId === e.id && r.voter === ME)

  const majority = tl.yes + tl.no > 0 ? (tl.yes / (tl.yes + tl.no)) * 100 : 0
  const quorumPct = snap.eligibleWeight > 0 ? (tl.turnoutWeight / snap.eligibleWeight) * 100 : 0

  return (
    <>
      <PageHead
        title={l(e.title)}
        sub={<span className="mono">{e.id} · {l(doc.title)} · {t('common.clause').toLowerCase()} {clause.num} · {t('common.snapshot').toLowerCase()} #{snap.id} / policy v{snap.policyVersion}</span>}
        right={<StatusChip status={e.status} />}
      />

      <div className="grid c2">
        {/* ==== 1. Документ и поправка ==== */}
        <div className="stack">
          <Panel title={t('el.amendmentBlock')} hint={<CatChip cat={cat} />}>
            <div className="stack" style={{ gap: 10 }}>
              <div>
                <div className="muted mono" style={{ marginBottom: 4 }}>
                  {t('el.currentText')} — {t('common.clause').toLowerCase()} {clause.num} «{l(clause.title)}»
                </div>
                <div className="clause changed" style={{ cursor: 'default', margin: 0 }}>{l(clause.text)}</div>
              </div>
              <div>
                <div className="muted mono" style={{ marginBottom: 4, color: 'var(--lime-ink)' }}>{t('el.proposedText')}</div>
                <div className="clause added-view" style={{ margin: 0 }}>{l(am.proposedText)}</div>
              </div>
              <div className="callout">
                <strong>{t('el.rationale')}:</strong> {l(am.rationale)}
              </div>
              <div className="row between">
                <span className="mono muted" style={{ fontSize: 11 }}>
                  doc {doc.documentHash} · amendment {am.amendmentHash}
                </span>
                <LinkBtn to={`/documents/${doc.id}`} small>{t('el.openDocument')} →</LinkBtn>
              </div>
            </div>
          </Panel>

          {/* объяснение веса */}
          <Panel title={t('el.whyWeight')}>
            {myW ? (
              <>
                <table className="tbl">
                  <tbody>
                    <tr><td className="muted">{t('common.category')}</td><td>{l(cat.name)}</td></tr>
                    <tr><td className="muted">{t('common.level')}</td><td><Lvl level={myW.level} /></td></tr>
                    <tr><td className="muted">{t('common.quorum')} L{myW.level}</td><td className="mono">{bpsToPct(snap.groups[myW.level].quotaBps)}</td></tr>
                    <tr><td className="muted">N (L{myW.level})</td><td className="mono">{snap.groups[myW.level].count} {t('common.accounts')}</td></tr>
                    <tr><td className="muted">T (L{myW.level})</td><td className="mono">{fmtW(snap.groups[myW.level].targetUnits)}</td></tr>
                    <tr>
                      <td className="muted">{t('common.weight')}</td>
                      <td style={{ fontSize: 19, fontWeight: 700 }}>{fmtW(myW.weight)}</td>
                    </tr>
                    <tr><td className="muted">{t('common.snapshot')}</td><td className="mono">#{snap.id} / policy v{snap.policyVersion}</td></tr>
                  </tbody>
                </table>
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  w = T / N = {fmtW(snap.groups[myW.level].targetUnits)} / {snap.groups[myW.level].count} = {fmtW(myW.weight)}
                </div>
              </>
            ) : (
              <div className="callout yellow">{t('el.notEligible')}</div>
            )}
          </Panel>
        </div>

        {/* ==== 2–3. Бюллетень и результат ==== */}
        <div className="stack">
          {e.status === 'active' && myW && (
            <Ballot
              key={my?.current.revision ?? 0}
              electionId={e.id}
              weight={myW.weight}
              existing={my?.current}
              onCast={(y, n, a) => {
                const human = {
                  ru: `Голос в ${e.id}: ${y / 100}/${n / 100}/${a / 100}, вес ${fmtW(myW.weight)}`,
                  en: `Vote in ${e.id}: ${y / 100}/${n / 100}/${a / 100}, weight ${fmtW(myW.weight)}`,
                }
                dispatch({ type: 'CAST_VOTE', electionId: e.id, yesBps: y, noBps: n, abstainBps: a, weight: myW.weight, human })
                dispatch({ type: 'TOAST', text: my ? t('toast.revoted') : t('toast.voted') })
                sound.play('voteSuccess')
              }}
              hasVoted={Boolean(my)}
            />
          )}

          {myReceipts.length > 0 && (
            <div className="receipt">
              <div className="row between" style={{ marginBottom: 6 }}>
                <strong>{t('el.receipt')}</strong>
                <span className="chip ok"><span className="dot" /> receipt</span>
              </div>
              {myReceipts.slice(-1).map((r) => (
                <div key={r.id} className="stack" style={{ gap: 3 }}>
                  <span className="mono" style={{ fontSize: 12 }}>{r.id} · tx {r.txHash}</span>
                  <span className="mono muted" style={{ fontSize: 11 }}>
                    {fmtDate(r.at, lang, true)} · {t('common.snapshot').toLowerCase()} #{r.snapshotId} · {t('el.voteAccount').toLowerCase()}: {shortAddr(ME)}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>{t('el.receiptHint')}</span>
                </div>
              ))}
            </div>
          )}

          {e.status !== 'active' && e.status !== 'upcoming' && (
            <div className={`verdict-seal ${e.status === 'passed' ? 'passed' : 'rejected'}`}>
              <span className="medal" aria-hidden>{e.status === 'passed' ? '🏅' : '✕'}</span>
              {e.status === 'passed' ? t('el.verdictPassed') : e.status === 'quorum_failed' ? t('el.verdictNoQuorum') : t('el.verdictRejected')}
            </div>
          )}
          <Panel title={t('el.results')}>
            <div className="grid c3" style={{ marginBottom: 12 }}>
              <KV k={t('common.yes')} v={fmtW(tl.yes)} big />
              <KV k={t('common.no')} v={fmtW(tl.no)} big />
              <KV k={t('common.abstain')} v={fmtW(tl.abstain)} big />
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <div>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <span className="muted">{t('el.majority')} ({t('el.needed')} {bpsToPct(e.passBps)})</span>
                  <span className="mono">{majority.toFixed(1)}%</span>
                </div>
                <Meter total={100} parts={[
                  { value: majority, color: majority >= e.passBps / 100 ? 'var(--cat-ecology)' : 'var(--yellow)' },
                  { value: 100 - majority, color: '#d5ddd8' },
                ]} />
              </div>
              <div>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <span className="muted">{t('common.quorum')} ({t('el.needed')} {bpsToPct(e.quorumBps)} {t('el.quorumOf')})</span>
                  <span className="mono">{quorumPct.toFixed(1)}%</span>
                </div>
                <Meter total={100} parts={[
                  { value: quorumPct, color: quorumPct >= e.quorumBps / 100 ? 'var(--cyan)' : 'var(--yellow)' },
                  { value: 100 - quorumPct, color: '#d5ddd8' },
                ]} />
              </div>
              <div className="mono muted" style={{ fontSize: 11 }}>
                eligible {fmtW(snap.eligibleWeight)} · turnout {fmtW(tl.turnoutWeight)} · manifest {snap.manifestHash} · {t('common.deadline').toLowerCase()} {fmtDate(e.endsAt, lang)} {e.status === 'active' && <Countdown endsAt={e.endsAt} />}
              </div>
            </div>
          </Panel>

          <Panel title={t('el.groups')} tight>
            <table className="tbl">
              <thead>
                <tr><th>{t('common.level')}</th><th>q</th><th>N</th><th>T</th><th>w</th></tr>
              </thead>
              <tbody>
                {snap.groups.map((g, k) => (
                  <tr key={k}>
                    <td><Lvl level={k} /></td>
                    <td className="mono">{bpsToPct(g.quotaBps)}</td>
                    <td className="mono">{g.count}</td>
                    <td className="mono">{fmtW(g.targetUnits)}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{fmtW(g.perAccountWeight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {my && my.history.length > 0 && (
            <Panel title={t('el.revisions')} tight>
              <table className="tbl">
                <tbody>
                  {[my.current, ...my.history].map((r) => (
                    <tr key={r.revision}>
                      <td className="mono muted">#{r.revision}{r === my.current ? ' ●' : ''}</td>
                      <td className="mono">{r.yesBps / 100}/{r.noBps / 100}/{r.abstainBps / 100}</td>
                      <td className="mono muted" style={{ fontSize: 11 }}>{fmtDate(r.at, lang, true)} · {r.txHash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Link to="/elections" className="muted">← {t('el.title')}</Link>
      </div>
    </>
  )
}

// ==========================================================
// Дробный бюллетень: три слайдера, сумма всегда 100%
// ==========================================================

function Ballot({ electionId, weight, existing, hasVoted, onCast }: {
  electionId: string
  weight: number
  existing?: { yesBps: number; noBps: number; abstainBps: number }
  hasVoted: boolean
  onCast: (y: number, n: number, a: number) => void
}) {
  const { t } = useT()
  const [v, setV] = useState<[number, number, number]>(
    existing ? [existing.yesBps, existing.noBps, existing.abstainBps] : [10000, 0, 0],
  )
  const [burst, setBurst] = useState(false)

  /** Изменение одного значения перераспределяет остаток между двумя другими пропорционально */
  function change(i: number, raw: number) {
    const next: [number, number, number] = [...v]
    const val = Math.round(raw / 100) * 100
    next[i] = Math.max(0, Math.min(10000, val))
    const rest = 10000 - next[i]
    const others = [0, 1, 2].filter((k) => k !== i)
    const otherSum = v[others[0]] + v[others[1]]
    if (otherSum <= 0) {
      next[others[0]] = rest
      next[others[1]] = 0
    } else {
      next[others[0]] = Math.round((v[others[0]] / otherSum) * rest / 100) * 100
      next[others[1]] = rest - next[others[0]]
    }
    setV(next)
    sound.play('type')
  }

  const labels = [t('common.yes'), t('common.no'), t('common.abstain')]
  const colors = ['var(--cat-ecology)', 'var(--red)', 'var(--ink-2)']
  const sum = v[0] + v[1] + v[2]

  return (
    <Panel title={t('el.ballot')} hint={t('el.ballotHint')}>
      <div className="stack" style={{ gap: 6 }}>
        {v.map((val, i) => (
          <div className="ballot-row" key={i} style={{ ['--bc' as string]: colors[i] }}>
            <span className="name">{labels[i]}</span>
            <input
              type="range" min={0} max={10000} step={100} value={val}
              style={{ ['--slider-color' as string]: colors[i], ['--fill' as string]: `${val / 100}%` }}
              aria-label={labels[i]}
              onChange={(ev) => change(i, Number(ev.target.value))}
            />
            <span className="val">
              {(val / 100).toFixed(0)}% · {fmtW(Math.round(weight * val / 100) / 100)}
            </span>
          </div>
        ))}
      </div>

      <div className="row between" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>{t('el.presets')}:</span>
          <button className="btn small" onClick={() => setV([10000, 0, 0])}>{t('el.preset100yes')}</button>
          <button className="btn small" onClick={() => setV([5000, 5000, 0])}>{t('el.preset5050')}</button>
          <button className="btn small" onClick={() => setV([0, 0, 10000])}>{t('el.preset100abs')}</button>
        </div>
        <span className="mono" style={{ fontSize: 12, color: sum === 10000 ? 'var(--lime-ink)' : 'var(--red)' }}>
          Σ {(sum / 100).toFixed(0)}%
        </span>
      </div>

      <div className="row between" style={{ marginTop: 12 }}>
        <span className="muted" style={{ fontSize: 12 }}>
          {t('el.contribution')}: {fmtW(weight)} × {(v[0] / 100)}/{(v[1] / 100)}/{(v[2] / 100)}
        </span>
        <span className="vote-anchor">
          {burst && <GoldBurst />}
          <button
            className="btn vote-gold"
            data-silent
            disabled={sum !== 10000}
            onClick={() => {
              if (sum !== 10000) { sound.play('warning'); return }
              setBurst(true)
              window.setTimeout(() => setBurst(false), 900)
              onCast(v[0], v[1], v[2])
            }}
          >
            {hasVoted ? t('el.recast') : t('el.cast')} · {electionId}
          </button>
        </span>
      </div>
    </Panel>
  )
}
