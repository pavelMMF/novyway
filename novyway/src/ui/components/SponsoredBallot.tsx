import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Deserializer, SimpleTransaction } from '@aptos-labs/ts-sdk'
import { useAccountSession } from '../../auth/session'
import { AptosWalletBoundary } from '../../auth/AptosWalletBoundary'
import { useT } from '../../i18n'
import { sound } from '../../sound/engine'
import { Panel } from './index'

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function toBase64(value: Uint8Array) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function SponsoredBallotContent({ electionId, allowRevote }: { electionId: string; allowRevote: boolean }) {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { user } = useAccountSession()
  const { connected, account, signTransaction } = useWallet()
  const [values, setValues] = useState<[number, number, number]>([10_000, 0, 0])
  const [status, setStatus] = useState<'idle' | 'preparing' | 'signing' | 'submitting' | 'confirmed' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const managed = user?.walletKind === 'managed'
  const votingAddress = user?.activeAptosAddress

  function change(index: number, raw: number) {
    const next = [...values] as [number, number, number]
    next[index] = Math.round(Math.max(0, Math.min(10_000, raw)) / 100) * 100
    const others = [0, 1, 2].filter((item) => item !== index)
    const remaining = 10_000 - next[index]
    const currentOther = values[others[0]] + values[others[1]]
    if (currentOther === 0) {
      next[others[0]] = remaining
      next[others[1]] = 0
    } else {
      next[others[0]] = Math.round((values[others[0]] / currentOther) * remaining / 100) * 100
      next[others[1]] = remaining - next[others[0]]
    }
    setValues(next)
    setIdempotencyKey(crypto.randomUUID())
    sound.play('type')
  }

  async function castVote() {
    if (!user?.csrfToken || !votingAddress || (!managed && (!connected || !account))) return
    if (!managed && account && account.address.toString().toLowerCase() !== votingAddress.toLowerCase()) {
      setStatus('error')
      setMessage(ru ? 'Сейчас подключён другой адрес. Активируйте нужный способ подтверждения и повторите.' : 'A different address is connected. Activate the required confirmation method and try again.')
      return
    }
    setExplorerUrl(null)
    try {
      setStatus('preparing')
      setMessage(ru ? 'Готовим бюллетень…' : 'Preparing the ballot…')
      const intentResponse = await fetch('/api/v1/vote-intents', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': user.csrfToken },
        body: JSON.stringify({ electionId, yesBps: values[0], noBps: values[1], abstainBps: values[2], idempotencyKey }),
      })
      const intent = await intentResponse.json() as { intentId?: string; rawTransactionB64?: string; error?: string }
      if (!intentResponse.ok || !intent.intentId || !intent.rawTransactionB64) throw new Error(intent.error ?? `HTTP ${intentResponse.status}`)
      let endpoint = `/api/v1/vote-intents/${intent.intentId}/managed-submission`
      let submissionBody: string | undefined
      if (!managed) {
        const transaction = SimpleTransaction.deserialize(new Deserializer(fromBase64(intent.rawTransactionB64)))
        setStatus('signing')
        setMessage(ru ? 'Подтвердите выбранное распределение. Сетевую комиссию оплатит платформа.' : 'Confirm the selected distribution. The platform will pay the network fee.')
        const signed = await signTransaction({ transactionOrPayload: transaction })
        endpoint = `/api/v1/vote-intents/${intent.intentId}/submission`
        submissionBody = JSON.stringify({ senderAuthenticatorB64: toBase64(signed.authenticator.bcsToBytes()) })
      }
      setStatus('submitting')
      setMessage(ru ? 'Отправляем подтверждённый голос в сеть…' : 'Submitting the confirmed vote to the network…')
      const submitResponse = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': user.csrfToken },
        body: submissionBody,
      })
      const result = await submitResponse.json() as { txHash?: string; explorerUrl?: string; error?: string }
      if (!submitResponse.ok || !result.txHash) throw new Error(result.error ?? `HTTP ${submitResponse.status}`)
      setStatus('confirmed')
      setIdempotencyKey(crypto.randomUUID())
      setExplorerUrl(result.explorerUrl ?? null)
      setMessage(ru ? `Голос отправлен: ${result.txHash.slice(0, 12)}…` : `Vote submitted: ${result.txHash.slice(0, 12)}…`)
      sound.play('voteSuccess')
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'vote_failed'
      const friendly: Record<string, string> = {
        sponsorship_disabled: ru ? 'Спонсирование пока выключено в локальной админ-панели.' : 'Sponsorship is currently disabled in the local operator console.',
        sponsorship_rate_limited: ru ? 'Лимит оплачиваемых голосов на этот час исчерпан.' : 'The hourly sponsored-vote limit has been reached.',
        relayer_unfunded: ru ? 'На Testnet-relayer пока нет APT. Пополните его через Faucet из локальной админ-панели.' : 'The Testnet relayer has no APT yet. Fund it through the Faucet link in the local operator console.',
        sponsorship_emergency_locked: ru ? 'Оплата комиссий временно остановлена оператором.' : 'Fee sponsorship was temporarily stopped by the operator.',
        contract_source_mismatch: ru ? 'Проверка контракта не пройдена. Голос не отправлен.' : 'The contract verification failed. The vote was not submitted.',
        aptos_signature_required: ru ? 'Активируйте Google, Apple или Aptos-кошелёк для подтверждения голоса.' : 'Activate Google, Apple, or an Aptos wallet to confirm the vote.',
        intent_expired: ru ? 'Бюллетень устарел. Нажмите кнопку ещё раз, чтобы подготовить новый.' : 'The ballot expired. Press the button again to prepare a new one.',
        intent_already_used: ru ? 'Этот бюллетень уже был отправлен.' : 'This ballot has already been submitted.',
        idempotency_payload_mismatch: ru ? 'Распределение изменилось. Повторите отправку ещё раз.' : 'The distribution changed. Submit it once more.',
        authentication_required: ru ? 'Сессия закончилась. Войдите снова, затем вернитесь к голосованию.' : 'Your session ended. Sign in again, then return to the vote.',
        invalid_csrf: ru ? 'Сессия обновилась. Перезагрузите страницу перед голосованием.' : 'The session changed. Reload the page before voting.',
        sender_mismatch: ru ? 'Подключён не тот адрес. Активируйте нужный способ подтверждения.' : 'The wrong address is connected. Activate the required confirmation method.',
        wallet_did_not_return_signature: ru ? 'Подтверждение было отменено; голос не отправлен.' : 'Confirmation was cancelled; the vote was not submitted.',
      }
      setStatus('error')
      setMessage(friendly[code] ?? (ru ? 'Не удалось отправить голос. Попробуйте ещё раз.' : 'The vote could not be submitted. Try again.'))
      sound.play('warning')
    }
  }

  if (!user) return <div className="callout yellow">{ru ? 'Чтобы подписать голос, создайте Aptos-аккаунт через Google, Apple или кошелёк.' : 'Create an Aptos account through Google, Apple, or a wallet to sign your vote.'} <Link className="inline-link" to="/auth">{ru ? 'Перейти ко входу' : 'Sign in'}</Link></div>

  const labels = ru ? ['За', 'Против', 'Воздержаться'] : ['Yes', 'No', 'Abstain']
  const colors = ['var(--cat-ecology)', 'var(--red)', 'var(--ink-2)']
  const busy = !['idle', 'confirmed', 'error'].includes(status)

  const authReturn = `/auth?returnTo=${encodeURIComponent(`/elections/${electionId}`)}`
  const actionLabel = status === 'preparing'
    ? (ru ? 'Готовим…' : 'Preparing…')
    : status === 'signing'
      ? (ru ? 'Ждём подтверждения…' : 'Waiting for confirmation…')
      : status === 'submitting'
        ? (ru ? 'Отправляем…' : 'Submitting…')
        : allowRevote ? (ru ? 'Подтвердить голос' : 'Confirm vote') : (ru ? 'Проголосовать один раз' : 'Vote once')

  return <Panel title={ru ? 'Дробный голос' : 'Fractional vote'} hint={ru ? 'Сумма всегда равна 100%. Вы подтверждаете выбор, а платформа оплачивает сетевую комиссию.' : 'The total always equals 100%. You confirm the choice, and the platform pays the network fee.'}>
    <div className="stack" style={{ gap: 6 }}>
      {values.map((value, index) => <div className="ballot-row" key={labels[index]} style={{ ['--bc' as string]: colors[index] }}>
        <span className="name">{labels[index]}</span>
        <input type="range" min={0} max={10_000} step={100} value={value} aria-label={labels[index]} aria-valuetext={`${value / 100}%`} style={{ ['--slider-color' as string]: colors[index], ['--fill' as string]: `${value / 100}%` }} onChange={(event) => change(index, Number(event.target.value))}/>
        <span className="val">{(value / 100).toFixed(0)}%</span>
      </div>)}
    </div>
    <div className="row" style={{ gap: 6, marginTop: 10 }}>
      <button className="btn small" onClick={() => { setValues([10_000, 0, 0]); setIdempotencyKey(crypto.randomUUID()) }}>{ru ? '100% за' : '100% yes'}</button>
      <button className="btn small" onClick={() => { setValues([5_000, 5_000, 0]); setIdempotencyKey(crypto.randomUUID()) }}>50 / 50</button>
      <button className="btn small" onClick={() => { setValues([0, 0, 10_000]); setIdempotencyKey(crypto.randomUUID()) }}>{ru ? 'Воздержаться' : 'Abstain'}</button>
    </div>
    <div className="row between sponsored-submit">
      <span className="muted mono sponsored-address">{votingAddress ?? (ru ? 'Подпись Aptos не подключена' : 'Aptos signature not connected')}</span>
      <button className="btn vote-gold" data-silent disabled={busy || !votingAddress || (!managed && !connected)} onClick={() => void castVote()}>{actionLabel}</button>
    </div>
    {!managed && !connected && <div className="callout yellow auth-error">{ru ? 'Способ подтверждения сейчас не подключён.' : 'The confirmation method is not connected.'} <Link className="inline-link" to={authReturn}>{ru ? 'Подключить' : 'Connect'}</Link></div>}
    {!managed && !votingAddress && <div className="callout yellow auth-error">{ru ? 'Этот аккаунт открыт по паролю. Активируйте связанный Google, Apple или Aptos-кошелёк — выходить из аккаунта не нужно.' : 'This account was opened with a password. Activate its linked Google, Apple, or Aptos wallet without signing out.'} <Link className="inline-link" to={authReturn}>{ru ? 'Выбрать способ' : 'Choose method'}</Link></div>}
    {message && <div className={`callout ${status === 'error' ? 'red' : status === 'confirmed' ? 'green' : 'cyan'} auth-error`} role={status === 'error' ? 'alert' : 'status'} aria-live="polite">{message} {explorerUrl && <a className="inline-link" href={explorerUrl} target="_blank" rel="noreferrer">Aptos Explorer ↗</a>}</div>}
  </Panel>
}

export function SponsoredBallot(props: { electionId: string; allowRevote: boolean }) {
  return <AptosWalletBoundary><SponsoredBallotContent {...props} /></AptosWalletBoundary>
}
