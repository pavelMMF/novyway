import { useEffect, useMemo, useState } from 'react'
import { fetchParticipant, fetchParticipants, type Participant, type ParticipantSort } from '../adapters/participants'
import { useAccountSession } from '../auth/session'
import { fmtDate, useT } from '../i18n'
import { PageHead, Panel } from '../ui/components'
import { ParticipationHeatmap } from '../ui/components/ParticipationHeatmap'

const roles = ['voter', 'admin', 'super_admin'] as const

function shortAddress(address: string) {
  return address.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address
}

function roleLabel(role: string, ru: boolean) {
  if (role === 'super_admin') return ru ? 'суперадминистратор' : 'super administrator'
  if (role === 'admin') return ru ? 'администратор' : 'administrator'
  return ru ? 'участник' : 'participant'
}

function displayName(participant: Participant, ru: boolean) {
  return participant.displayName?.trim() || (ru ? 'Участник без имени' : 'Unnamed participant')
}

export default function Participants() {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { user } = useAccountSession()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [sort, setSort] = useState<ParticipantSort>('registered')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [details, setDetails] = useState<Record<string, Participant>>({})

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      fetchParticipants({ search: search.trim() || undefined, role: role || undefined, sort, direction, pageSize: 100 }, controller.signal)
        .then((body) => { setParticipants(body.participants); setTotal(body.total) })
        .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'participant_load_failed') })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 220)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [search, role, sort, direction])

  useEffect(() => {
    const missing = selected.filter((id) => !details[id])
    if (missing.length === 0) return
    const controller = new AbortController()
    Promise.all(missing.map((id) => fetchParticipant(id, controller.signal)))
      .then((loaded) => setDetails((current) => Object.fromEntries([...Object.entries(current), ...loaded.map((participant) => [participant.id, participant])])) )
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'participant_load_failed') })
    return () => controller.abort()
  }, [selected, details])

  const visibleTotals = useMemo(() => participants.reduce((sum, participant) => ({
    votes: sum.votes + participant.stats.votes,
    documents: sum.documents + participant.stats.documents,
    exams: sum.exams + participant.stats.exams,
  }), { votes: 0, documents: 0, exams: 0 }), [participants])

  function toggleCompare(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 3 ? [...current, id] : [...current.slice(1), id])
  }

  return <>
    <PageHead
      title={ru ? 'Участники' : 'Participants'}
      sub={ru ? 'Публичная активность аккаунтов без раскрытия почты, способов входа и закрытых данных.' : 'Public account activity without exposing email, sign-in methods, or private data.'}
      right={<span className="participant-total"><strong>{total}</strong><small>{ru ? 'активных аккаунтов' : 'active accounts'}</small></span>}
    />

    <div className="participant-overview" aria-label={ru ? 'Сводка по текущей выборке' : 'Current result summary'}>
      <div><strong>{participants.length}</strong><span>{ru ? 'показано' : 'shown'}</span></div>
      <div><strong>{visibleTotals.votes}</strong><span>{ru ? 'голосов' : 'votes'}</span></div>
      <div><strong>{visibleTotals.documents}</strong><span>{ru ? 'документов' : 'documents'}</span></div>
      <div><strong>{visibleTotals.exams}</strong><span>{ru ? 'экзаменов' : 'exams'}</span></div>
    </div>

    <Panel className="participant-controls">
      <div className="participant-filter-grid">
        <label className="field"><span>{ru ? 'Поиск' : 'Search'}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ru ? 'Имя или Aptos-адрес' : 'Name or Aptos address'} /></label>
        <label className="field"><span>{ru ? 'Роль' : 'Role'}</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="">{ru ? 'Все роли' : 'All roles'}</option>{roles.map((item) => <option value={item} key={item}>{roleLabel(item, ru)}</option>)}</select></label>
        <label className="field"><span>{ru ? 'Сортировка' : 'Sort by'}</span><select value={sort} onChange={(event) => setSort(event.target.value as ParticipantSort)}>
          <option value="registered">{ru ? 'Дата регистрации' : 'Registration date'}</option>
          <option value="score">{ru ? 'Индекс участия' : 'Participation score'}</option>
          <option value="votes">{ru ? 'Голоса' : 'Votes'}</option>
          <option value="documents">{ru ? 'Документы' : 'Documents'}</option>
          <option value="exams">{ru ? 'Экзамены' : 'Exams'}</option>
          <option value="qualifications">{ru ? 'Квалификации' : 'Qualifications'}</option>
          <option value="role">{ru ? 'Роль' : 'Role'}</option>
          <option value="name">{ru ? 'Имя' : 'Name'}</option>
        </select></label>
        <button className="btn participant-direction" onClick={() => setDirection((value) => value === 'asc' ? 'desc' : 'asc')} aria-label={direction === 'asc' ? (ru ? 'По возрастанию' : 'Ascending') : (ru ? 'По убыванию' : 'Descending')}>
          <span aria-hidden>{direction === 'asc' ? '↑' : '↓'}</span>{direction === 'asc' ? (ru ? 'по возрастанию' : 'ascending') : (ru ? 'по убыванию' : 'descending')}
        </button>
      </div>
    </Panel>

    {error && <div className="callout red" role="alert">{error}</div>}
    <Panel className="participant-directory" title={ru ? 'Реестр участников' : 'Participant registry'} hint={String(total)}>
      {loading && <div className="empty">{ru ? 'Загружаем участников…' : 'Loading participants…'}</div>}
      {!loading && participants.length === 0 && <div className="empty">{ru ? 'По выбранным условиям никого не найдено.' : 'No participants match these filters.'}</div>}
      {participants.length > 0 && <div className="participant-table-wrap"><table className="tbl participant-table"><thead><tr>
        <th>{ru ? 'Участник' : 'Participant'}</th><th>{ru ? 'Роль' : 'Role'}</th><th>{ru ? 'Регистрация' : 'Registered'}</th><th>{ru ? 'Индекс' : 'Score'}</th><th>{ru ? 'Голоса' : 'Votes'}</th><th>{ru ? 'Документы' : 'Documents'}</th><th>{ru ? 'Экзамены' : 'Exams'}</th><th>{ru ? 'Квалификации' : 'Qualifications'}</th><th />
      </tr></thead><tbody>{participants.map((participant) => {
        const isMe = user?.id === participant.id
        const compared = selected.includes(participant.id)
        return <tr key={participant.id} className={isMe ? 'is-current-user' : ''}>
          <td><strong>{displayName(participant, ru)} {isMe && <span className="chip live">{ru ? 'вы' : 'you'}</span>}</strong><a className="mono participant-address" href={`https://explorer.aptoslabs.com/account/${participant.aptosAddress}?network=testnet`} target="_blank" rel="noreferrer">{shortAddress(participant.aptosAddress)} ↗</a></td>
          <td><span className={`chip role-${participant.role}`}>{roleLabel(participant.role, ru)}</span></td>
          <td className="mono">{fmtDate(participant.registeredAt, lang)}</td>
          <td><strong className="participant-score">{participant.participationScore}</strong></td>
          <td className="mono">{participant.stats.votes}</td><td className="mono">{participant.stats.documents}</td><td className="mono">{participant.stats.exams}</td>
          <td><span className="mono">{participant.stats.qualifications}</span>{participant.stats.highestLevel > 0 && <small className="participant-level">L{participant.stats.highestLevel}</small>}</td>
          <td><button className={`btn small ${compared ? 'primary' : ''}`} aria-pressed={compared} onClick={() => toggleCompare(participant.id)}>{compared ? (ru ? 'Убрать' : 'Remove') : (ru ? 'Сравнить' : 'Compare')}</button></td>
        </tr>
      })}</tbody></table></div>}
    </Panel>

    {selected.length > 0 && <section className="participant-compare" aria-label={ru ? 'Сравнение участников' : 'Participant comparison'}>
      <div className="row between participant-compare-head"><div><strong>{ru ? 'Сравнение' : 'Comparison'}</strong><span className="muted"> {selected.length}/3</span></div><button className="btn small" onClick={() => setSelected([])}>{ru ? 'Очистить' : 'Clear'}</button></div>
      <div className="participant-compare-grid">{selected.map((id) => {
        const participant = details[id] ?? participants.find((item) => item.id === id)
        if (!participant) return <div className="participant-compare-card" key={id}>{ru ? 'Загрузка…' : 'Loading…'}</div>
        return <article className="participant-compare-card" key={id}>
          <div className="row between"><div><strong>{displayName(participant, ru)}</strong><span className="mono participant-address">{shortAddress(participant.aptosAddress)}</span></div><strong className="participant-score">{participant.participationScore}</strong></div>
          <div className="participant-stat-strip"><span><b>{participant.stats.votes}</b>{ru ? 'голосов' : 'votes'}</span><span><b>{participant.stats.documents}</b>{ru ? 'документов' : 'documents'}</span><span><b>{participant.stats.exams}</b>{ru ? 'экзаменов' : 'exams'}</span><span><b>{participant.stats.qualifications}</b>{ru ? 'квалификаций' : 'qualifications'}</span></div>
          {participant.activity && <ParticipationHeatmap activity={participant.activity} lang={lang} compact />}
        </article>
      })}</div>
    </section>}
  </>
}
