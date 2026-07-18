import type { ParticipantActivityDay } from '../../adapters/participants'

type HeatmapCell = ParticipantActivityDay & { placeholder?: boolean }

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildYear(activity: ParticipantActivityDay[]) {
  const byDate = new Map(activity.map((day) => [day.date, day]))
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const first = new Date(today)
  first.setUTCDate(today.getUTCDate() - 364)
  const cells: HeatmapCell[] = Array.from({ length: first.getUTCDay() }, () => ({
    date: '', total: 0, votes: 0, documents: 0, exams: 0, proposals: 0, placeholder: true,
  }))
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(first)
    date.setUTCDate(first.getUTCDate() + offset)
    const key = isoDate(date)
    cells.push(byDate.get(key) ?? { date: key, total: 0, votes: 0, documents: 0, exams: 0, proposals: 0 })
  }
  return cells
}

function intensity(total: number) {
  if (total <= 0) return 0
  if (total === 1) return 1
  if (total <= 3) return 2
  if (total <= 6) return 3
  return 4
}

export function ParticipationHeatmap({ activity, lang = 'ru', compact = false }: {
  activity: ParticipantActivityDay[]
  lang?: 'ru' | 'en'
  compact?: boolean
}) {
  const cells = buildYear(activity)
  const total = activity.reduce((sum, day) => sum + day.total, 0)
  const activeDays = activity.filter((day) => day.total > 0).length
  const label = lang === 'ru'
    ? `${total} действий за 365 дней, активных дней: ${activeDays}`
    : `${total} actions over 365 days, ${activeDays} active days`

  return <div className={`participation-heatmap ${compact ? 'compact' : ''}`} role="img" aria-label={label}>
    <div className="heatmap-summary">
      <strong>{lang === 'ru' ? 'Год участия' : 'Participation year'}</strong>
      <span>{label}</span>
    </div>
    <div className="heatmap-scroll" tabIndex={0} aria-label={lang === 'ru' ? 'Календарь активности, прокручивается по горизонтали' : 'Activity calendar, horizontally scrollable'}>
      <div className="heatmap-grid" aria-hidden="true">
        {cells.map((day, index) => {
          if (day.placeholder) return <span className="heatmap-cell placeholder" key={`empty-${index}`} />
          const title = lang === 'ru'
            ? `${day.date}: ${day.total} действий; голоса ${day.votes}, документы ${day.documents}, экзамены ${day.exams}, предложения ${day.proposals}`
            : `${day.date}: ${day.total} actions; votes ${day.votes}, documents ${day.documents}, exams ${day.exams}, proposals ${day.proposals}`
          return <span className="heatmap-cell" data-level={intensity(day.total)} title={title} key={day.date} />
        })}
      </div>
    </div>
    <div className="heatmap-legend" aria-hidden="true">
      <span>{lang === 'ru' ? 'меньше' : 'less'}</span>
      {[0, 1, 2, 3, 4].map((level) => <i className="heatmap-cell" data-level={level} key={level} />)}
      <span>{lang === 'ru' ? 'больше' : 'more'}</span>
    </div>
  </div>
}
