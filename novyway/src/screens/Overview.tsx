import { Link, useNavigate } from 'react-router-dom'
import { daysLeft, fmtDate, shortAddr, useT } from '../i18n'
import { ME, exams, useStore } from '../demo/store'
import { myWeightInSnapshot } from '../demo/store'
import { AccountRef, CatChip, KV, LinkBtn, Lvl, Meter, Panel, PageHead, ScoreRing, StatusChip, useCivicScore } from '../ui/components'
import { bpsToPct, fmtW } from '../domain/weights'
import { currentRuntimeMode } from '../adapters/types'
import { useLiveAudit, useLiveVoting } from '../adapters/aptos/useLiveAptos'
import { configuredVotingModule } from '../adapters/aptos/aptosReadGateway'
import { aptosTestnetExplorer } from '../adapters/aptos/documentAnchorGateway'

export default function Overview() {
  const { t, l, lang } = useT()
  const { state } = useStore()
  const nav = useNavigate()
  const civic = useCivicScore()
  const runtimeMode = currentRuntimeMode()

  const active = state.elections.filter((e) => e.status === 'active')
  const needVote = active.filter((e) =>
    myWeightInSnapshot(state, e) && !state.votes.some((v) => v.electionId === e.id && v.voter === ME))
  const myQuals = state.qualifications
    .filter((q) => q.voter === ME)
    .sort((a, b) => b.level - a.level)
  const events = state.audit.slice(0, 6)

  return (
    <>
      <PageHead
        title={t('ov.title')}
        sub={t('ov.sub')}
        right={
          <Link to="/profile" className="row" style={{ gap: 10, alignItems: 'center', textDecoration: 'none' }} title={t('sc.title')}>
            <ScoreRing score={civic.score} size={52} />
          </Link>
        }
      />

      {runtimeMode === 'aptos-testnet' && (
        <div className="callout" style={{ marginBottom: 14 }}>
          {lang === 'ru'
            ? 'Сеть, голосования и журнал читаются из Aptos Testnet. Личный профиль, экзамены и редактор документов пока работают как демонстрация.'
            : 'Network, elections, and audit data come from Aptos Testnet. The personal profile, exams, and document editor are still demonstrations.'}
        </div>
      )}

      {runtimeMode === 'demo' && needVote.length > 0 && (
        <div className="callout red" style={{ marginBottom: 14 }}>
          <strong>{t('ov.yourAction')}:</strong>{' '}
          {needVote.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ' · '}
              <Link to={`/elections/${e.id}`}>{l(e.title)}</Link>
            </span>
          ))}
        </div>
      )}

      <div className="grid c3" style={{ marginBottom: 14 }}>
        <Panel title={<Link to="/network" className="panel-title-link">{t('ov.networkState')}</Link>} tight>
          {runtimeMode === 'aptos-testnet' ? <LiveNetworkState /> : <div className="stack" style={{ gap: 8 }}>
            <span className="chip live"><span className="dot" /> {t('common.demo')}</span>
            <KV k={t('ov.contract')} v="0x…council_online::weighted_voting" mono />
          </div>}
        </Panel>
        <Panel title={<Link to="/exams" className="panel-title-link">{t('ov.myLevels')}</Link>} tight>
          <div className="stack" style={{ gap: 7 }}>
            {myQuals.map((q) => {
              const cat = state.categories.find((c) => c.id === q.categoryId)!
              return (
                <Link key={q.categoryId} to={`/exams?category=${q.categoryId}`} className="row between dashboard-row-link">
                  <CatChip cat={cat} />
                  <span className="row" style={{ gap: 6 }}>
                    <Lvl level={q.level} />
                    <span className="muted mono">{lang === 'ru' ? 'версия правил' : 'policy version'} {cat.policy.policyVersion}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </Panel>
        <Panel title={<Link to="/documents?view=graph" className="panel-title-link">{t('ov.graphEntry')}</Link>} tight>
          <p className="muted" style={{ marginTop: 0 }}>{t('ov.graphEntryHint')}</p>
          <MiniConstellation />
          <LinkBtn to="/documents?view=graph" primary small>{t('ov.openGraph')} →</LinkBtn>
        </Panel>
      </div>

      {runtimeMode === 'aptos-testnet' ? <LiveActiveElections /> : <Panel title={t('ov.activeElections')} hint={`${active.length}`}>
        <div className="grid c3">
          {active.map((e) => {
            const cat = state.categories.find((c) => c.id === e.categoryId)!
            const tl = state.tallies[e.id]
            const snap = state.snapshots.find((s) => s.id === e.snapshotId)!
            const my = state.votes.find((v) => v.electionId === e.id && v.voter === ME)
            const majority = tl.yes + tl.no > 0 ? (tl.yes / (tl.yes + tl.no)) * 100 : 0
            return (
              <button
                key={e.id}
                className="panel tight"
                style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
                onClick={() => nav(`/elections/${e.id}`)}
              >
                <div className="row between" style={{ marginBottom: 6 }}>
                  <CatChip cat={cat} />
                  <StatusChip status={e.status} />
                </div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{l(e.title)}</div>
                <Meter total={100} parts={[
                  { value: majority, color: 'var(--cat-ecology)' },
                  { value: 100 - majority, color: '#d5ddd8' },
                ]} />
                <div className="row between" style={{ marginTop: 8 }}>
                  <span className="muted mono">
                    {t('common.snapshot')} #{snap.id} · {t('common.quorum')} {bpsToPct(e.quorumBps)}
                  </span>
                  <span className="muted mono">{daysLeft(e.endsAt)} {t('common.days')}</span>
                </div>
                <div style={{ marginTop: 6 }}>
                  {my
                    ? <span className="chip ok"><span className="dot" /> {t('st.voted')}</span>
                    : <span className="chip warn"><span className="dot" /> {t('st.notVoted')}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </Panel>}

      <div className="grid c2" style={{ marginTop: 14 }}>
        {runtimeMode === 'aptos-testnet' ? <LiveRecentEvents /> : <Panel title={t('ov.recentEvents')}>
          <table className="tbl">
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ width: 90 }} className="muted mono">{fmtDate(ev.at, lang)}</td>
                  <td><AccountRef address={ev.actor} /></td>
                  <td>{l(ev.human)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8 }}><LinkBtn to="/audit" small>{t('nav.audit')} →</LinkBtn></div>
        </Panel>}

        <Panel title={t('ov.upcomingExams')}>
          <div className="stack">
            {exams.slice(0, 4).map((x) => {
              const cat = state.categories.find((c) => c.id === x.categoryId)!
              return (
                <div key={x.id} className="row between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <CatChip cat={cat} />
                    <span>{l(x.title)}</span>
                  </span>
                  <LinkBtn to={`/exams/${x.id}`} small>{t('common.open')}</LinkBtn>
                </div>
              )
            })}
            <div className="muted">
              {t('xm.sub')} — <Link to="/exams">{t('nav.exams')}</Link>
            </div>
          </div>
        </Panel>
      </div>

      {runtimeMode === 'demo' && <MyWeightsStrip />}
    </>
  )
}

function chainCategoryName(name: string, lang: 'ru' | 'en') {
  if (lang === 'en') return name
  if (name === 'General') return 'Общая'
  if (name === 'QA Demo') return 'Проверка качества'
  return name
}

function LiveNetworkState() {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { data, loading, error } = useLiveVoting()
  if (loading && !data) return <div className="muted">{ru ? 'Читаем сеть…' : 'Reading network…'}</div>
  if (error || !data) return <div className="callout red">{ru ? 'Сеть недоступна' : 'Network unavailable'}</div>
  return <div className="stack" style={{ gap: 8 }}>
    <span className="chip live"><span className="dot" /> Aptos Testnet</span>
    <KV k={ru ? 'Модуль' : 'Module'} v={`${shortAddr(configuredVotingModule())}::weighted_voting`} mono />
    <KV k={ru ? 'Порог подтверждения' : 'Approval threshold'} v={`${data.adminThreshold} ${ru ? 'из' : 'of'} ${data.administrators.length}`} mono />
    <KV k={ru ? 'Администраторов в реестре' : 'Registered administrators'} v={`${data.administrators.length}`} mono />
    <KV k={ru ? 'Версия реестра' : 'Ledger version'} v={data.ledgerVersion} mono />
    <KV k={ru ? 'Версии' : 'Versions'} v={`${ru ? 'совет' : 'council'} ${data.versions.council} · ${ru ? 'правила' : 'policy'} ${data.versions.policy} · ${ru ? 'состав' : 'membership'} ${data.versions.membership}`} mono />
    <a className="inline-link" href={aptosTestnetExplorer(`account/${configuredVotingModule()}/modules`)} target="_blank" rel="noreferrer">{ru ? 'Сверить в обозревателе' : 'Verify in Explorer'} ↗</a>
  </div>
}

function LiveActiveElections() {
  const { t, lang } = useT()
  const ru = lang === 'ru'
  const { data, loading, error } = useLiveVoting()
  const active = data?.elections.filter((election) => election.status === 'active') ?? []
  return <Panel title={t('ov.activeElections')} hint={loading ? '…' : `${active.length}`}>
    {error && <div className="callout red">{ru ? 'Не удалось прочитать голосования' : 'Could not read elections'}</div>}
    {!loading && active.length === 0 && <div className="empty">{ru ? 'Сейчас в сети нет активных голосований' : 'There are no active on-chain elections'}</div>}
    <div className="grid c3">{active.map((election) => {
      const yes = Number(BigInt(election.yesUnits) / 10000n)
      const no = Number(BigInt(election.noUnits) / 10000n)
      const support = yes + no ? yes / (yes + no) * 100 : 0
      const category = data?.categories.find((item) => item.id === election.categoryId)
      return <Link key={election.id} to={`/elections/chain-${election.id}`} className="panel tight" style={{ textDecoration: 'none' }}>
        <div className="row between"><span className="chip">{chainCategoryName(category?.name ?? `${ru ? 'Категория' : 'Category'} ${election.categoryId}`, lang)}</span><StatusChip status={election.status} /></div>
        <strong>{ru ? `Голосование №${election.id}` : `Election #${election.id}`}</strong>
        <Meter total={100} parts={[{ value: support, color: 'var(--lime-ink)' }, { value: 100 - support, color: 'var(--border)' }]} />
      </Link>
    })}</div>
    <div style={{ marginTop: 8 }}><LinkBtn to="/elections" small>{t('nav.elections')} →</LinkBtn></div>
  </Panel>
}

function LiveRecentEvents() {
  const { t, l, lang } = useT()
  const ru = lang === 'ru'
  const { data = [], loading, error } = useLiveAudit()
  return <Panel title={t('ov.recentEvents')}>
    {error && <div className="callout red">{ru ? 'Не удалось прочитать журнал' : 'Could not read audit log'}</div>}
    {loading && data.length === 0 && <div className="muted">{ru ? 'Читаем транзакции…' : 'Reading transactions…'}</div>}
    <table className="tbl responsive"><tbody>{data.slice(0, 6).map((event) => <tr key={event.id}><td data-l={t('common.date')} className="muted mono">{fmtDate(event.at, lang)}</td><td data-l={t('common.actor')} className="mono">{shortAddr(event.actor)}</td><td data-l={t('common.event')}>{l(event.human)}</td></tr>)}</tbody></table>
    <div style={{ marginTop: 8 }}><LinkBtn to="/audit" small>{t('nav.audit')} →</LinkBtn></div>
  </Panel>
}

/** Полоса «мой вес в активных снимках» — объяснение, не магия */
function MyWeightsStrip() {
  const { t, l } = useT()
  const { state } = useStore()
  const rows = state.elections
    .filter((e) => e.status === 'active')
    .map((e) => ({ e, w: myWeightInSnapshot(state, e) }))
    .filter((r) => r.w)
  if (rows.length === 0) return null
  return (
    <Panel title={t('el.whyWeight')} className="" tight>
      <hr className="hr-red" style={{ marginTop: 0 }} />
      <div className="grid c3">
        {rows.map(({ e, w }) => {
          const snap = state.snapshots.find((s) => s.id === e.snapshotId)!
          const g = snap.groups[w!.level]
          const cat = state.categories.find((c) => c.id === e.categoryId)!
          return (
            <Link key={e.id} to={`/weights?election=${e.id}`} className="stack weight-link" style={{ gap: 4 }}>
              <div className="row" style={{ gap: 6 }}>
                <CatChip cat={cat} /> <Lvl level={w!.level} />
              </div>
              <span className="mono muted" style={{ fontSize: 12 }}>
                {t('common.quorum').toLowerCase()} L{w!.level}: {bpsToPct(g.quotaBps)} · N={g.count} · T={fmtW(g.targetUnits)}
              </span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>
                {t('common.weight')}: {fmtW(w!.weight)}
              </span>
              <span className="mono muted" style={{ fontSize: 11 }}>
                {t('common.snapshot')} #{snap.id} / policy v{snap.policyVersion} — {l(e.title)}
              </span>
            </Link>
          )
        })}
      </div>
    </Panel>
  )
}

/** Декоративный мини-граф на обзоре (вход в 3D-пространство) */
function MiniConstellation() {
  const pts = [
    [10, 30], [40, 14], [72, 26], [96, 12], [28, 52], [60, 48], [88, 44], [120, 30], [104, 52],
  ]
  const links = [[0, 1], [1, 2], [2, 3], [1, 4], [2, 5], [5, 6], [3, 7], [6, 8], [7, 8]]
  const colors = ['#E64232', '#00A9BD', '#7B5EA7', '#679B1E', '#EFB31E', '#E64232', '#00A9BD', '#7B5EA7', '#679B1E']
  return (
    <svg viewBox="0 0 130 64" style={{ width: '100%', height: 64, marginBottom: 8 }} aria-hidden>
      {links.map(([a, b], i) => (
        <line key={i} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]}
          stroke="#a9b6af" strokeWidth="0.8" />
      ))}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4 : 2.6} fill={colors[i]} />
      ))}
    </svg>
  )
}
