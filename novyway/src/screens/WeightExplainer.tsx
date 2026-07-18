import { Link, useSearchParams } from 'react-router-dom'
import { bpsToPct, fmtW } from '../domain/weights'
import { ME, myWeightInSnapshot, useStore } from '../demo/store'
import { useT } from '../i18n'
import { CatChip, Lvl, PageHead, Panel } from '../ui/components'

export default function WeightExplainer() {
  const { state } = useStore()
  const { l, lang } = useT()
  const [params] = useSearchParams()
  const election = state.elections.find((item) => item.id === params.get('election')) ?? state.elections.find((item) => item.status === 'active')
  const ru = lang === 'ru'
  if (!election) return <div className="empty">—</div>
  const snapshot = state.snapshots.find((item) => item.id === election.snapshotId)!
  const category = state.categories.find((item) => item.id === election.categoryId)!
  const qualification = state.qualifications.filter((item) => item.voter === ME && item.categoryId === category.id).sort((a, b) => b.revision - a.revision)[0]
  const mine = myWeightInSnapshot(state, election)
  const group = mine ? snapshot.groups[mine.level] : undefined

  return (
    <>
      <PageHead title={ru ? 'Как рассчитан мой вес' : 'How my weight is calculated'} sub={l(election.title)} right={<Link className="btn small" to={`/elections/${election.id}`}>{ru ? 'К голосованию' : 'Open election'}</Link>} />
      <div className="grid c3" style={{ marginBottom: 14 }}>
        <Panel title={ru ? 'Квалификация' : 'Qualification'} tight><div className="row"><CatChip cat={category} /> <Lvl level={qualification?.level ?? 0} /></div><div className="muted" style={{ marginTop: 8 }}>{qualification ? l(qualification.reason) : 'L0'}</div></Panel>
        <Panel title={ru ? 'Зафиксированный снимок' : 'Frozen snapshot'} tight><strong className="metric-main">#{snapshot.id}</strong><div className="mono muted">policy v{snapshot.policyVersion} · registry v{snapshot.registryVersion}</div></Panel>
        <Panel title={ru ? 'Итоговый вес' : 'Final weight'} tight><strong className="metric-main">{mine ? fmtW(mine.weight) : '—'}</strong><div className="muted">{ru ? 'не меняется внутри этого голосования' : 'does not change during this election'}</div></Panel>
      </div>
      {group && (
        <Panel title={ru ? 'Расчёт без скрытых коэффициентов' : 'Calculation without hidden multipliers'}>
          <div className="weight-formula">
            <div><span>S</span><strong>{fmtW(snapshot.scaleS)}</strong><small>{ru ? 'общий масштаб' : 'global scale'}</small></div>
            <b>×</b>
            <div><span>q{mine!.level}</span><strong>{bpsToPct(group.quotaBps)}</strong><small>{ru ? 'доля уровня' : 'level quota'}</small></div>
            <b>=</b>
            <div><span>T{mine!.level}</span><strong>{fmtW(group.targetUnits)}</strong><small>{ru ? 'пул группы' : 'group pool'}</small></div>
            <b>÷</b>
            <div><span>N{mine!.level}</span><strong>{group.count}</strong><small>{ru ? 'участников' : 'participants'}</small></div>
            <b>=</b>
            <div className="result"><span>w{mine!.level}</span><strong>{fmtW(group.perAccountWeight)}</strong><small>{ru ? 'ваш вес' : 'your weight'}</small></div>
          </div>
          <div className="callout" style={{ marginTop: 16 }}>{ru ? 'Вес заморожен в снимке до начала голосования. Новый экзамен повлияет только на следующие снимки, поэтому результат нельзя подкрутить задним числом.' : 'The weight is frozen before voting starts. A new exam affects only future snapshots, so this result cannot be changed retroactively.'}</div>
        </Panel>
      )}
    </>
  )
}
