import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchParticipant, syncMyQualifications, type Participant } from '../adapters/participants'
import { fmtDate, useT } from '../i18n'
import { useSettings, useStore } from '../demo/store'
import { CatChip, KV, Lvl, PageHead, Panel } from '../ui/components'
import { ParticipationHeatmap } from '../ui/components/ParticipationHeatmap'
import { AuthPanel } from '../ui/components/AuthPanel'
import { fmtW } from '../domain/weights'
import { useAccountSession, type AccountUser } from '../auth/session'

function profileErrorMessage(error: string, ru: boolean) {
  const messages: Record<string, [string, string]> = {
    email_delivery_not_configured: ['Служебная почта ещё не настроена. Откройте локальную операторскую панель и завершите настройку SMTP.', 'Service email is not configured yet. Open the local operator application and finish SMTP setup.'],
    verification_invalid: ['Код неверен, истёк или уже использован.', 'The code is invalid, expired, or already used.'],
    email_already_registered: ['Эта почта уже связана с другим аккаунтом.', 'This email is already linked to another account.'],
    old_email_verification_required: ['Сначала подтвердите смену через прежнюю почту.', 'Confirm the change through the previous email first.'],
    too_many_requests: ['Слишком много попыток. Повторите позже.', 'Too many attempts. Try again later.'],
  }
  return messages[error]?.[ru ? 0 : 1] ?? (ru ? 'Не удалось выполнить запрос. Попробуйте ещё раз.' : 'The request could not be completed. Try again.')
}

export default function Profile() {
  const { t, l, lang } = useT()
  const { state } = useStore()
  const { s, update } = useSettings()
  const { user, acceptUser } = useAccountSession()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [telegram, setTelegram] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailPending, setEmailPending] = useState(false)
  const [emailStage, setEmailStage] = useState<'old' | 'new'>('new')
  const [emailInfo, setEmailInfo] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [participantLoading, setParticipantLoading] = useState(false)
  const [participantError, setParticipantError] = useState<string | null>(null)
  const ru = lang === 'ru'
  const participantUserId = user?.id ?? null
  const participantCsrfToken = user?.csrfToken ?? null

  useEffect(() => {
    if (!participantUserId) {
      setParticipant(null)
      return
    }
    const controller = new AbortController()
    setParticipantLoading(true)
    setParticipantError(null)
    const load = () => fetchParticipant(participantUserId, controller.signal)
      .then((value) => setParticipant(value))
      .catch((reason) => {
        if (!controller.signal.aborted) setParticipantError(reason instanceof Error ? reason.message : 'participant_load_failed')
      })
      .finally(() => { if (!controller.signal.aborted) setParticipantLoading(false) })
    if (participantCsrfToken) {
      syncMyQualifications(participantCsrfToken).catch(() => null).finally(() => { if (!controller.signal.aborted) void load() })
    } else {
      void load()
    }
    return () => controller.abort()
  }, [participantUserId, participantCsrfToken])

  if (!user) return <>
    <PageHead title={t('pr.title')} sub={ru ? 'Войдите, чтобы открыть личные данные, квалификации и голоса.' : 'Sign in to view your identity, qualifications, and votes.'} />
    <div style={{ maxWidth: 680 }}><AuthPanel /></div>
  </>

  const accountUser = user

  const accountAddresses = new Set([accountUser.aptosAddress, accountUser.activeAptosAddress].filter(Boolean).map((address) => address!.toLowerCase()))
  const sameVoter = (address: string) => accountAddresses.has(address.toLowerCase())
  const myQuals = state.qualifications.filter((item) => sameVoter(item.voter)).sort((a, b) => b.level - a.level)
  const myVotes = state.votes.filter((item) => sameVoter(item.voter))
  const myReceipts = state.receipts.filter((item) => sameVoter(item.voter))
  const participationStats = participant?.stats ?? { votes: myVotes.length, documents: 0, exams: 0, proposals: 0, qualifications: myQuals.length, highestLevel: myQuals[0]?.level ?? 0 }
  const participationScore = participant?.participationScore ?? 0

  async function saveProfile() {
    if (!accountUser.csrfToken) return
    setMessage(null)
    setEmailInfo(null)
    const response = await fetch('/api/me', {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': accountUser.csrfToken },
      body: JSON.stringify({ displayName: name.trim(), telegram: telegram.trim() }),
    })
    const body = await response.json() as { user?: AccountUser; error?: string }
    if (!response.ok || !body.user) { setMessage(body.error ?? `HTTP ${response.status}`); return }
    acceptUser(body.user)
    update({ profile: { ...s.profile, name: body.user.displayName || '', email: body.user.email || '', telegram: body.user.telegram || '' } })
    setEditing(false)
  }

  async function requestEmailChange() {
    if (!accountUser.csrfToken) return
    setMessage(null)
    const response = await fetch('/api/me/email-change', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': accountUser.csrfToken },
      body: JSON.stringify({ email: newEmail, lang }),
    })
    const body = await response.json() as { error?: string; stage?: 'old' | 'new' }
    if (!response.ok) { setMessage(profileErrorMessage(body.error ?? `HTTP ${response.status}`, ru)); return }
    setEmailStage(body.stage ?? 'new')
    setEmailPending(true)
  }

  async function verifyEmailChange() {
    if (!accountUser.csrfToken) return
    setMessage(null)
    const response = await fetch('/api/me/email-change/verify', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': accountUser.csrfToken },
      body: JSON.stringify({ email: newEmail, code: emailCode, lang }),
    })
    const body = await response.json() as { user?: AccountUser; error?: string; nextVerificationRequired?: boolean; stage?: 'new' }
    if (!response.ok) { setMessage(profileErrorMessage(body.error ?? `HTTP ${response.status}`, ru)); return }
    if (body.nextVerificationRequired) {
      setEmailStage('new')
      setEmailCode('')
      setEmailInfo(ru ? 'Старый адрес подтверждён. Второй код отправлен на новую почту.' : 'The old address is confirmed. A second code was sent to the new email.')
      return
    }
    if (!body.user) { setMessage(profileErrorMessage('verification_invalid', ru)); return }
    acceptUser(body.user)
    setEmailPending(false)
    setEmailCode('')
    setNewEmail('')
    setEmailStage('new')
    setEmailInfo(null)
  }

  return <>
    <PageHead
      title={t('pr.title')}
      sub={ru ? 'Данные аккаунта, Aptos-адрес и подтверждённая история участия.' : 'Account data, Aptos address, and verified participation history.'}
      right={<button className="btn small" onClick={() => {
        if (!editing) { setName(user.displayName || ''); setTelegram(user.telegram || '') }
        setEditing((value) => !value)
      }}>{editing ? t('common.close') : t('pr.editProfile')}</button>}
    />

    {editing && <Panel title={t('pr.editProfile')} className="profile-editor">
      <div className="grid c2">
        <label className="field"><span>{t('pr.name')}</span><input value={name} minLength={2} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field"><span>{t('pr.telegram')}</span><input value={telegram} maxLength={80} onChange={(event) => setTelegram(event.target.value)} /></label>
      </div>
      <div className="row" style={{ marginTop: 12 }}><button className="btn primary" disabled={name.trim().length < 2} onClick={() => void saveProfile()}>{t('common.save')}</button></div>
    </Panel>}

    <div className="grid c2" style={{ marginBottom: 14 }}>
      <Panel tight title={ru ? 'Личность в реестре' : 'Registry identity'} className="profile-identity-card">
        <div className="profile-identity-layout">
          <div className="stack" style={{ gap: 7 }}>
            <strong style={{ fontSize: 18 }}>{user.displayName || '—'}</strong>
            {user.email && <a href={`mailto:${user.email}`} className="muted">{user.email}</a>}
            <span className="muted">{user.telegram || '—'}</span>
            <KV k={t('pr.role')} v={user.role} mono />
            <KV k={t('pr.registered')} v={fmtDate(user.createdAt, lang)} mono />
            <Link className="inline-link muted" to="/participants">{ru ? 'Сравнить с участниками' : 'Compare with participants'} →</Link>
          </div>
          <div className="profile-participation-summary" aria-label={ru ? 'Индекс участия' : 'Participation index'}>
            <div className="profile-participation-score" title={ru ? 'Баллы публичной активности, не вес голоса' : 'Public activity points, not voting weight'}>{participationScore}</div>
            <div className="profile-stat-grid">
              <span><b>{participationStats.votes}</b>{t('sc.votes')}</span>
              <span><b>{participationStats.documents}</b>{t('sc.docs')}</span>
              <span><b>{participationStats.exams}</b>{t('sc.exams')}</span>
              <span><b>{participationStats.proposals}</b>{ru ? 'предложений' : 'proposals'}</span>
            </div>
          </div>
        </div>
      </Panel>
      <Panel tight title={t('pr.address')}>
        <div className="stack" style={{ gap: 7 }}>
          <span className="mono" style={{ wordBreak: 'break-all' }}>{user.aptosAddress}</span>
          <span className="chip live">{user.walletKind === 'managed'
            ? (ru ? 'кошелёк для голосования готов' : 'voting wallet ready')
            : user.activeAptosAddress
              ? (ru ? 'подтверждение голосов активно' : 'vote confirmation active')
              : (ru ? 'нужно выбрать способ подтверждения' : 'confirmation method required')}</span>
          <span className="muted" style={{ fontSize: 12 }}>{ru ? 'Адрес используется для подписанных голосов и публичных квитанций.' : 'This address is used for signed votes and public receipts.'}</span>
          <Link className="btn small" to="/auth?returnTo=%2Fprofile">{ru ? 'Способы входа' : 'Sign-in methods'}</Link>
        </div>
      </Panel>
    </div>

    <Panel className="profile-year-panel" title={ru ? 'Активность за год' : 'Yearly activity'} hint={participantLoading ? (ru ? 'обновляется' : 'updating') : undefined}>
      {participantError && <div className="callout red" role="alert">{participantError}</div>}
      <ParticipationHeatmap activity={participant?.activity ?? []} lang={lang} />
      <p className="muted" style={{ fontSize: 11.5 }}>{ru ? 'Индекс отражает действия на платформе и подтверждённые голоса. Он не меняет квалификационный вес.' : 'The index reflects platform actions and confirmed votes. It does not change qualification weight.'}</p>
    </Panel>

    <Panel title={ru ? 'Почта и безопасность' : 'Email and security'} tight>
      <div className="stack profile-security">
        <div>{user.email || (ru ? 'Почта не указана' : 'No email')} {user.emailVerified && <span className="chip ok">{ru ? 'подтверждена' : 'verified'}</span>}</div>
        <p className="muted" style={{ margin: 0 }}>{user.isSuperAdmin
          ? (ru ? 'Смена почты обновит привязку супер-администратора только после подтверждения кода.' : 'A verified code is required before the super-administrator email binding changes.')
          : (ru ? 'Новая почта применяется только после подтверждения.' : 'A new email is applied only after verification.')}</p>
        <div className="row profile-email-row">
          <label className="field grow"><span>{ru ? 'Новая почта' : 'New email'}</span><input type="email" autoComplete="email" value={newEmail} disabled={emailPending} onChange={(event) => setNewEmail(event.target.value)} /></label>
          {!emailPending ? <button className="btn" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)} onClick={() => void requestEmailChange()}>{ru ? 'Отправить код' : 'Send code'}</button> : <>
            <label className="field"><span>{emailStage === 'old' ? (ru ? 'Код со старой почты' : 'Code from old email') : (ru ? 'Код с новой почты' : 'Code from new email')}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ''))} /></label>
            <button className="btn primary" disabled={emailCode.length !== 6} onClick={() => void verifyEmailChange()}>{ru ? 'Подтвердить' : 'Verify'}</button>
            <button className="icon-btn" aria-label={ru ? 'Отменить смену почты' : 'Cancel email change'} title={ru ? 'Отменить' : 'Cancel'} onClick={() => { setEmailPending(false); setEmailCode(''); setEmailStage('new'); setEmailInfo(null); setMessage(null) }}>×</button>
          </>}
        </div>
        {emailInfo && <div className="callout" role="status" aria-live="polite">{emailInfo}</div>}
        {message && <div className="callout red" role="alert" aria-live="polite">{message}</div>}
      </div>
    </Panel>

    <Panel tight title={t('pr.receipts')}>
      <div className="stack">{myReceipts.length === 0 ? <span className="muted">—</span> : myReceipts.map((receipt) => <Link key={receipt.id} to={`/elections/${receipt.electionId}`} className="mono">{receipt.id} · {receipt.txHash.slice(0, 12)}…</Link>)}</div>
    </Panel>

    <Panel title={t('pr.myQuals')}>
      {myQuals.length === 0 ? <div className="empty">{ru ? 'Для этого Aptos-адреса квалификации пока не назначены.' : 'No qualifications are assigned to this Aptos address yet.'}</div> : <table className="tbl responsive"><thead><tr><th>{t('common.category')}</th><th>{t('common.level')}</th><th>{t('pr.confirmed')}</th><th /></tr></thead><tbody>{myQuals.map((qualification) => {
        const category = state.categories.find((item) => item.id === qualification.categoryId)!
        return <tr key={`${qualification.categoryId}-${qualification.revision}`}><td data-l={t('common.category')}><CatChip cat={category} /></td><td data-l={t('common.level')}><Lvl level={qualification.level} /></td><td data-l={t('pr.confirmed')}><span className="mono">{qualification.confirmedAt}</span><div className="muted">{l(qualification.reason)}</div></td><td><Link className="btn small" to={`/exams?category=${category.id}`}>{t('pr.openExams')}</Link></td></tr>
      })}</tbody></table>}
    </Panel>

    <Panel title={t('pr.votes')}>
      {myVotes.length === 0 ? <div className="empty">{t('pr.noVotes')}</div> : <table className="tbl responsive"><thead><tr><th>{t('doc.election')}</th><th>{t('common.yes')}/{t('common.no')}/{t('common.abstain')}</th><th>{t('common.weight')}</th><th>tx</th></tr></thead><tbody>{myVotes.map((vote) => <tr key={vote.electionId}><td><Link to={`/elections/${vote.electionId}`}>{vote.electionId}</Link></td><td className="mono">{vote.current.yesBps / 100}/{vote.current.noBps / 100}/{vote.current.abstainBps / 100}</td><td className="mono">{fmtW(vote.weight)}</td><td className="mono muted">{vote.current.txHash}</td></tr>)}</tbody></table>}
    </Panel>
  </>
}
