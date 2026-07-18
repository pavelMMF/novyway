import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { serializeSignInOutput } from '@aptos-labs/siwa'
import { useT } from '../../i18n'
import { useStore } from '../../demo/store'
import { useAccountSession, type AccountUser } from '../../auth/session'
import { AptosWalletBoundary } from '../../auth/AptosWalletBoundary'
import { Panel } from './index'
import { sound } from '../../sound/engine'

type Provider = 'google' | 'apple' | 'wallet'
type EmailMode = 'login' | 'register'
type RecoveryStep = 'request' | 'confirm' | null

function GoogleIcon() { return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> }
function AppleIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg> }
function WalletIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="2.5" y="5.5" width="19" height="14" rx="2.5"/><path d="M16 12h3.5M2.5 9h19"/></svg> }

const providers: Array<{ id: Provider; walletName?: string; icon: typeof GoogleIcon }> = [
  { id: 'google', walletName: 'Continue with Google', icon: GoogleIcon },
  { id: 'apple', walletName: 'Continue with Apple', icon: AppleIcon },
  { id: 'wallet', icon: WalletIcon },
]

const PETRA_BROWSER_WALLET_URL = 'https://chromewebstore.google.com/detail/petra-aptos-wallet/ejjladinnckdgjemekebdpeokbikhfci'

function messageFor(error: string, ru: boolean) {
  const messages: Record<string, [string, string]> = {
    email_delivery_not_configured: ['Отправка почты ещё не настроена оператором.', 'Email delivery is not configured yet.'],
    email_or_password_invalid: ['Неверная почта или пароль.', 'Invalid email or password.'],
    email_already_registered: ['Эта почта уже используется.', 'This email is already registered.'],
    verification_invalid: ['Код неверен, истёк или уже использован.', 'The code is invalid, expired, or already used.'],
    password_reset_invalid: ['Код восстановления неверен, истёк или уже использован.', 'The recovery code is invalid, expired, or already used.'],
    too_many_requests: ['Слишком много попыток. Попробуйте позже.', 'Too many attempts. Try again later.'],
    session_unavailable: ['Не удалось проверить сессию. Обновите страницу через несколько секунд.', 'The session could not be checked. Refresh the page in a few seconds.'],
    challenge_invalid_or_expired: ['Подтверждение устарело. Начните вход ещё раз.', 'The confirmation expired. Start sign-in again.'],
    signature_verification_failed: ['Не удалось проверить подтверждение аккаунта.', 'The account confirmation could not be verified.'],
    wallet_already_linked: ['Этот кошелёк уже связан с другим аккаунтом.', 'This wallet is already linked to another account.'],
    identity_already_linked: ['Этот способ входа уже связан с другим аккаунтом.', 'This sign-in method is already linked to another account.'],
    linked_sign_in_method_required: ['Сначала добавьте этот способ входа в аккаунт.', 'Link this sign-in method to the account first.'],
    link_session_mismatch: ['Сессия изменилась. Обновите страницу и повторите.', 'The session changed. Refresh the page and try again.'],
    registration_closed: ['Регистрация временно закрыта.', 'Registration is temporarily closed.'],
    wallet_did_not_return_signature: ['Подтверждение было отменено.', 'The confirmation was cancelled.'],
  }
  return messages[error]?.[ru ? 0 : 1] ?? (ru ? 'Не удалось выполнить запрос. Попробуйте ещё раз.' : 'The request could not be completed. Try again.')
}

function AuthPanelContent() {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { dispatch } = useStore()
  const { wallets, signIn, disconnect } = useWallet()
  const { user, loading, error: sessionError, acceptUser, logout } = useAccountSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [connecting, setConnecting] = useState<Provider | 'email' | null>(null)
  const [emailMode, setEmailMode] = useState<EmailMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>(null)
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [walletHelpOpen, setWalletHelpOpen] = useState(false)
  const [linkedConnections, setLinkedConnections] = useState<Map<Provider, string>>(new Map())
  const fallbackWallet = useMemo(() => wallets.find((item) => !item.name.startsWith('Continue with ') && Boolean(item.features['aptos:signIn'])), [wallets])

  useEffect(() => {
    if (fallbackWallet) setWalletHelpOpen(false)
  }, [fallbackWallet])

  useEffect(() => {
    if (!user) { setLinkedConnections(new Map()); return }
    let active = true
    fetch('/api/me/connections', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<{ identities: Array<{ provider: string; subject: string }> }> : { identities: [] })
      .then((body) => {
        if (!active) return
        const next = new Map<Provider, string>()
        for (const identity of body.identities) {
          if (identity.provider === 'google' || identity.provider === 'apple' || identity.provider === 'wallet') {
            next.set(identity.provider, identity.subject.toLowerCase())
          }
        }
        setLinkedConnections(next)
      })
      .catch(() => { if (active) setLinkedConnections(new Map()) })
    return () => { active = false }
  }, [user])

  async function authenticate(provider: Provider, requestedWallet?: string) {
    const walletName = requestedWallet ?? fallbackWallet?.name
    if (connecting) return
    if (!walletName) {
      if (provider === 'wallet') {
        setWalletHelpOpen(true)
        setError(null)
        sound.play('navigate')
      } else {
        setError(ru ? 'Этот способ входа сейчас недоступен в браузере.' : 'This sign-in method is currently unavailable in the browser.')
      }
      return
    }
    const linkedAddress = linkedConnections.get(provider)
    const action = user ? (linkedAddress ? 'activate' : 'link') : 'sign_in'
    setConnecting(provider)
    setError(null)
    sound.play('navigate')
    try {
      const challengeResponse = await fetch('/api/auth/challenge', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(user?.csrfToken ? { 'X-CSRF-Token': user.csrfToken } : {}) },
        body: JSON.stringify({ provider, lang, action }),
      })
      if (!challengeResponse.ok) throw new Error((await challengeResponse.json()).error ?? `HTTP ${challengeResponse.status}`)
      const input = await challengeResponse.json()
      const output = await signIn({ walletName, input })
      if (!output) throw new Error('wallet_did_not_return_signature')
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(user?.csrfToken ? { 'X-CSRF-Token': user.csrfToken } : {}) },
        body: JSON.stringify({ provider, output: serializeSignInOutput(output) }),
      })
      const body = await verifyResponse.json() as { user?: AccountUser; error?: string }
      if (!verifyResponse.ok || !body.user) throw new Error(body.error ?? `HTTP ${verifyResponse.status}`)
      acceptUser(body.user)
      setLinkedConnections((current) => new Map(current).set(provider, body.user!.activeAptosAddress?.toLowerCase() ?? linkedAddress ?? ''))
      dispatch({ type: 'TOAST', text: action === 'link'
        ? (ru ? 'Способ входа добавлен' : 'Sign-in method added')
        : (ru ? 'Вход выполнен' : 'Signed in') })
      sound.play('receipt')
      const returnTo = new URLSearchParams(location.search).get('returnTo')
      if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) navigate(returnTo, { replace: true })
    } catch (cause) {
      setError(messageFor(cause instanceof Error ? cause.message : 'authentication_failed', ru))
    } finally { setConnecting(null) }
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault()
    if (connecting) return
    setConnecting('email')
    setError(null)
    try {
      const endpoint = emailMode === 'login' ? '/api/auth/password/login' : '/api/auth/password/register'
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailMode === 'login' ? { email, password } : { email, password, displayName, lang }),
      })
      const body = await response.json() as { user?: AccountUser; error?: string; verificationRequired?: boolean; email?: string }
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
      if (body.user) { acceptUser(body.user); sound.play('receipt') }
      else if (body.verificationRequired && body.email) setVerificationEmail(body.email)
    } catch (cause) {
      setError(messageFor(cause instanceof Error ? cause.message : 'authentication_failed', ru))
    } finally { setConnecting(null) }
  }

  async function verifyRegistration(event: FormEvent) {
    event.preventDefault()
    if (!verificationEmail || connecting) return
    setConnecting('email')
    setError(null)
    try {
      const response = await fetch('/api/auth/password/verify', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, code, lang }),
      })
      const body = await response.json() as { user?: AccountUser; error?: string }
      if (!response.ok || !body.user) throw new Error(body.error ?? `HTTP ${response.status}`)
      acceptUser(body.user)
      sound.play('receipt')
    } catch (cause) {
      setError(messageFor(cause instanceof Error ? cause.message : 'verification_invalid', ru))
    } finally { setConnecting(null) }
  }

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault()
    if (connecting) return
    setConnecting('email')
    setError(null)
    setInfo(null)
    try {
      const response = await fetch('/api/auth/password/reset/request', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
      setRecoveryStep('confirm')
      setCode('')
      setPassword('')
      setPasswordRepeat('')
      setInfo(ru
        ? 'Если этот адрес зарегистрирован, на него отправлен шестизначный код. Он действует 10 минут.'
        : 'If this address is registered, a six-digit code was sent. It expires in 10 minutes.')
    } catch (cause) {
      setError(messageFor(cause instanceof Error ? cause.message : 'authentication_failed', ru))
    } finally { setConnecting(null) }
  }

  async function confirmPasswordReset(event: FormEvent) {
    event.preventDefault()
    if (connecting || password !== passwordRepeat) return
    setConnecting('email')
    setError(null)
    try {
      const response = await fetch('/api/auth/password/reset/confirm', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password, lang }),
      })
      const body = await response.json() as { error?: string; changed?: boolean }
      if (!response.ok || !body.changed) throw new Error(body.error ?? `HTTP ${response.status}`)
      setRecoveryStep(null)
      setEmailMode('login')
      setCode('')
      setPassword('')
      setPasswordRepeat('')
      setInfo(ru ? 'Пароль изменён. Все прежние сеансы закрыты — войдите заново.' : 'Password changed. All previous sessions were closed; sign in again.')
      sound.play('receipt')
    } catch (cause) {
      setError(messageFor(cause instanceof Error ? cause.message : 'password_reset_invalid', ru))
    } finally { setConnecting(null) }
  }

  async function signOut() {
    try { await logout() } finally { disconnect() }
  }

  const walletSetupHelp = walletHelpOpen && !fallbackWallet ? <div className="wallet-setup-help" role="status" aria-live="polite">
    <div className="wallet-setup-copy">
      <strong>{ru ? 'Браузер не видит Aptos-кошелёк' : 'The browser cannot detect an Aptos wallet'}</strong>
      <span>{ru
        ? 'Установите официальное расширение Petra, откройте в нём нужный аккаунт и обновите эту страницу.'
        : 'Install the official Petra extension, open the required account in it, and refresh this page.'}</span>
      {user?.isSuperAdmin && <span>{ru ? 'Для подписи действий супер-администратора нужен именно адрес:' : 'Super-administrator actions must be signed by this exact address:'} <code>{user.aptosAddress}</code></span>}
      <small>{ru
        ? 'Приватный ключ или фразу восстановления вводите только внутри расширения Petra, никогда на этом сайте.'
        : 'Enter a private key or recovery phrase only inside the Petra extension, never on this site.'}</small>
    </div>
    <a className="btn small" href={PETRA_BROWSER_WALLET_URL} target="_blank" rel="noreferrer">{ru ? 'Открыть Petra' : 'Open Petra'} ↗</a>
  </div> : null

  if (loading) return <Panel tight title={ru ? 'Аккаунт' : 'Account'}><span className="muted">{ru ? 'Проверяем сессию…' : 'Checking session…'}</span></Panel>
  if (user) return <Panel tight title={ru ? 'Аккаунт' : 'Account'}>
    <div className="auth-connected">
      <span className="auth-avatar"><WalletIcon /></span>
      <div className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 13.5 }}>{user.displayName || user.email || `${user.provider} · Aptos`}</strong>
        <span className="muted mono auth-address">{user.aptosAddress}</span>
        <span className="muted" style={{ fontSize: 11 }}>{user.walletKind === 'managed'
          ? (ru ? 'Кошелёк для голосования готов' : 'Voting wallet ready')
          : user.activeAptosAddress
            ? (ru ? 'Подпись для голосования активна' : 'Voting signature active')
            : (ru ? 'Аккаунт подключён; перед голосованием выберите способ подтверждения' : 'Account connected; choose a confirmation method before voting')}</span>
      </div>
      <button className="btn small" onClick={() => void signOut()}>{ru ? 'Выйти' : 'Sign out'}</button>
    </div>
    <div className="auth-link-providers">
      <span className="muted">{ru ? 'Способы входа и подтверждения:' : 'Sign-in and confirmation methods:'}</span>
      <div className="row">
        {providers.map(({ id, walletName, icon: Icon }) => {
          const available = id === 'wallet' ? Boolean(fallbackWallet) : wallets.some((item) => item.name === walletName)
          const linkedAddress = linkedConnections.get(id)
          const linked = Boolean(linkedAddress)
          const active = Boolean(linkedAddress && user.activeAptosAddress?.toLowerCase() === linkedAddress)
          const label = id === 'google' ? 'Google' : id === 'apple' ? 'Apple' : (fallbackWallet?.name ?? (ru ? 'Aptos-кошелёк' : 'Aptos wallet'))
          const text = id === 'wallet' && !available
            ? (ru ? 'Настроить Aptos-кошелёк' : 'Set up Aptos wallet')
            : active
            ? `${label} · ${ru ? 'используется' : 'active'}`
            : linked
              ? `${ru ? 'Продолжить с' : 'Continue with'} ${label}`
              : `${ru ? 'Добавить' : 'Add'} ${label}`
          return <button key={id} className="btn small" disabled={connecting !== null || active || (!available && id !== 'wallet')} onClick={() => void authenticate(id, walletName)}><Icon /> {text}</button>
        })}
      </div>
    </div>
    {walletSetupHelp}
    {error && <div className="callout red auth-error">{error}</div>}
  </Panel>

  return <div className="auth-stack">
    <Panel tight title={recoveryStep ? (ru ? 'Восстановление пароля' : 'Password recovery') : (ru ? 'Почта и пароль' : 'Email and password')}>
      {recoveryStep ? <>
        <button type="button" className="auth-back" onClick={() => { setRecoveryStep(null); setError(null); setInfo(null); setCode(''); setPassword(''); setPasswordRepeat('') }}>{ru ? '← Вернуться ко входу' : '← Back to sign in'}</button>
        {recoveryStep === 'request' ? <form className="stack auth-form" onSubmit={requestPasswordReset}>
          <p className="muted auth-copy">{ru ? 'Введите почту аккаунта. Мы не сообщаем, зарегистрирован ли адрес, чтобы защитить список пользователей.' : 'Enter the account email. We do not reveal whether an address is registered.'}</p>
          <label className="field"><span>{ru ? 'Почта' : 'Email'}</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <button className="btn primary" disabled={connecting !== null}>{connecting === 'email' ? (ru ? 'Отправляем…' : 'Sending…') : (ru ? 'Получить код' : 'Get code')}</button>
        </form> : <form className="stack auth-form" onSubmit={confirmPasswordReset}>
          {info && <div className="callout" role="status" aria-live="polite">{info}</div>}
          <label className="field"><span>{ru ? 'Шестизначный код' : 'Six-digit code'}</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required /></label>
          <div className="auth-password-grid">
            <label className="field"><span>{ru ? 'Новый пароль' : 'New password'}</span><input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <label className="field"><span>{ru ? 'Повторите пароль' : 'Repeat password'}</span><input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} required /></label>
          </div>
          {passwordRepeat && password !== passwordRepeat && <small className="field-error" role="alert">{ru ? 'Пароли не совпадают.' : 'Passwords do not match.'}</small>}
          <button className="btn primary" disabled={connecting !== null || code.length !== 6 || password.length < 12 || password !== passwordRepeat}>{ru ? 'Изменить пароль' : 'Change password'}</button>
        </form>}
        {error && <div className="callout red auth-error" role="alert">{error}</div>}
      </> : <>
      <div className="seg auth-mode-switch">
        <button type="button" className={emailMode === 'login' ? 'on' : ''} onClick={() => { setEmailMode('login'); setVerificationEmail(null); setError(null) }}>{ru ? 'Вход' : 'Sign in'}</button>
        <button type="button" className={emailMode === 'register' ? 'on' : ''} onClick={() => { setEmailMode('register'); setError(null) }}>{ru ? 'Регистрация' : 'Register'}</button>
      </div>
      {verificationEmail ? <form className="stack auth-form" onSubmit={verifyRegistration}>
        <p className="muted">{ru ? `Код отправлен на ${verificationEmail}. Он действует 10 минут.` : `A code was sent to ${verificationEmail}. It expires in 10 minutes.`}</p>
        <label className="field"><span>{ru ? 'Шестизначный код' : 'Six-digit code'}</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required /></label>
        <button className="btn primary" disabled={connecting !== null || code.length !== 6}>{ru ? 'Подтвердить аккаунт' : 'Confirm account'}</button>
      </form> : <form className="stack auth-form" onSubmit={submitEmail}>
        {emailMode === 'register' && <label className="field"><span>{ru ? 'Имя' : 'Name'}</span><input type="text" autoComplete="name" minLength={2} maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>}
        <label className="field"><span>{ru ? 'Почта' : 'Email'}</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="field"><span>{ru ? 'Пароль' : 'Password'}</span><input type="password" autoComplete={emailMode === 'login' ? 'current-password' : 'new-password'} minLength={emailMode === 'register' ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {emailMode === 'login' && <button type="button" className="auth-forgot" onClick={() => { setRecoveryStep('request'); setError(null); setInfo(null); setPassword('') }}>{ru ? 'Забыли пароль?' : 'Forgot password?'}</button>}
        {emailMode === 'register' && <small className="muted">{ru ? 'Не менее 12 символов. Будет создан отдельный Aptos-кошелёк для голосования.' : 'At least 12 characters. A dedicated Aptos voting wallet will be created.'}</small>}
        <button className="btn primary" disabled={connecting !== null}>{connecting === 'email' ? (ru ? 'Проверяем…' : 'Checking…') : emailMode === 'login' ? (ru ? 'Войти' : 'Sign in') : (ru ? 'Создать аккаунт' : 'Create account')}</button>
      </form>}
      {info && <div className="callout auth-info" role="status" aria-live="polite">{info}</div>}
      </>}
    </Panel>

    <div className="auth-divider"><span>{ru ? 'или без отдельного пароля' : 'or without a separate password'}</span></div>

    <Panel tight title={ru ? 'Быстрый вход' : 'Quick sign-in'} hint={ru ? 'Выберите привычный способ. Отдельный пароль не потребуется.' : 'Choose a familiar method. No separate password is required.'}>
      <div className="auth-buttons">
        {providers.map(({ id, walletName, icon: Icon }) => {
          const available = id === 'wallet' ? Boolean(fallbackWallet) : wallets.some((item) => item.name === walletName)
          const label = id === 'google' ? 'Google' : id === 'apple' ? 'Apple' : !available ? (ru ? 'Настроить Aptos-кошелёк' : 'Set up Aptos wallet') : (fallbackWallet?.name ?? (ru ? 'Aptos-кошелёк' : 'Aptos wallet'))
          const sub = !available
            ? id === 'wallet'
              ? (ru ? 'расширение не найдено' : 'extension not detected')
              : (ru ? 'недоступно в этом браузере' : 'unavailable in this browser')
            : id === 'wallet'
              ? (ru ? 'существующий адрес' : 'existing address')
              : (ru ? 'без отдельного пароля' : 'no separate password')
          return <button key={id} type="button" className="auth-btn" data-silent disabled={connecting !== null || (!available && id !== 'wallet')} onClick={() => void authenticate(id, walletName)}><Icon /><span className="auth-provider-name">{connecting === id ? (ru ? 'Подтверждение…' : 'Confirming…') : label}</span><span className="sub">{sub}</span></button>
        })}
      </div>
      {walletSetupHelp}
    </Panel>
    {!recoveryStep && (error || sessionError) && <div className="callout red auth-error">{error || messageFor(sessionError ?? 'session_unavailable', ru)}</div>}
  </div>
}

export function AuthPanel() {
  return <AptosWalletBoundary><AuthPanelContent /></AptosWalletBoundary>
}
