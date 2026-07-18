import { useCallback, useEffect, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Deserializer, SimpleTransaction } from '@aptos-labs/ts-sdk'
import { Link } from 'react-router-dom'
import { aptosView } from '../../adapters/aptos/aptosReadGateway'
import { useAccountSession } from '../../auth/session'
import { AptosWalletBoundary } from '../../auth/AptosWalletBoundary'
import { useT } from '../../i18n'
import { sound } from '../../sound/engine'
import { Panel } from './index'

type EqualElection = { id: number; candidate: string; startsAt: number; endsAt: number; status: number; passed: boolean; eligible: number; yes: number; no: number; abstain: number; myVote: number | null }

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function toBase64(value: Uint8Array) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function shortAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
}

function AdminElectionRegisterContent() {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { user } = useAccountSession()
  const { connected, account, signTransaction } = useWallet()
  const [rows, setRows] = useState<EqualElection[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [explorer, setExplorer] = useState<string | null>(null)
  const managed = user?.walletKind === 'managed'
  const votingAddress = user?.activeAptosAddress

  const load = useCallback(async () => {
    setLoading(true)
    const countResult = await aptosView('admin_election', 'election_count')
    const count = Math.min(Number(countResult[0] ?? 0), 100)
    const loaded = await Promise.all(Array.from({ length: count }, async (_, id) => {
      const raw = await aptosView('admin_election', 'election', [id])
      if (Number(raw[1]) !== 0) return null
      const tallies = await aptosView('admin_election', 'equal_tallies', [id])
      const vote = votingAddress ? await aptosView('admin_election', 'equal_vote_of', [id, votingAddress]).catch(() => [false, '0']) : [false, '0']
      return {
        id,
        candidate: String(raw[0]),
        eligible: Number(raw[7]),
        startsAt: Number(raw[11]),
        endsAt: Number(raw[12]),
        status: Number(raw[13]),
        passed: raw[15] === true,
        yes: Number(tallies[0]), no: Number(tallies[1]), abstain: Number(tallies[2]),
        myVote: vote[0] === true ? Number(vote[1]) : null,
      }
    }))
    setRows(loaded.filter((item): item is EqualElection => item !== null).reverse())
    setLoading(false)
  }, [votingAddress])

  useEffect(() => { void load().catch((error) => { setLoading(false); setMessage(error instanceof Error ? error.message : 'load_failed') }) }, [load])

  async function vote(electionId: number, choice: 1 | 2 | 3) {
    if (!user?.csrfToken || !votingAddress || (!managed && (!connected || !account || account.address.toString().toLowerCase() !== votingAddress.toLowerCase()))) {
      setMessage(ru ? 'Войдите тем же Aptos-аккаунтом, которым подписываете голос.' : 'Sign in with the same Aptos account that signs the vote.')
      return
    }
    setBusy(electionId)
    setExplorer(null)
    try {
      const response = await fetch('/api/v1/admin-election-vote-intents', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': user.csrfToken },
        body: JSON.stringify({ adminElectionId: String(electionId), choice, idempotencyKey: crypto.randomUUID() }),
      })
      const intent = await response.json() as { intentId?: string; rawTransactionB64?: string; error?: string }
      if (!response.ok || !intent.intentId || !intent.rawTransactionB64) throw new Error(intent.error ?? `HTTP ${response.status}`)
      let endpoint = `/api/v1/vote-intents/${intent.intentId}/managed-submission`
      let submissionBody: string | undefined
      if (!managed) {
        const transaction = SimpleTransaction.deserialize(new Deserializer(fromBase64(intent.rawTransactionB64)))
        const signed = await signTransaction({ transactionOrPayload: transaction })
        endpoint = `/api/v1/vote-intents/${intent.intentId}/submission`
        submissionBody = JSON.stringify({ senderAuthenticatorB64: toBase64(signed.authenticator.bcsToBytes()) })
      }
      const submitted = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': user.csrfToken },
        body: submissionBody,
      })
      const result = await submitted.json() as { txHash?: string; explorerUrl?: string; error?: string }
      if (!submitted.ok || !result.txHash) throw new Error(result.error ?? `HTTP ${submitted.status}`)
      setExplorer(result.explorerUrl ?? null)
      setMessage(ru ? 'Голос за состав Совета отправлен в Aptos Testnet.' : 'Your Council membership vote was submitted to Aptos Testnet.')
      sound.play('voteSuccess')
      setTimeout(() => void load(), 2_000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'vote_failed')
      sound.play('warning')
    } finally {
      setBusy(null)
    }
  }

  if (!loading && rows.length === 0) return null

  return <Panel title={ru ? 'Выборы администраторов' : 'Administrator elections'} hint={ru ? 'равный голос зарегистрированных аккаунтов' : 'equal vote of registered accounts'}>
    <div className="stack compact-stack">
      {loading && <div className="empty">{ru ? 'Читаем реестр состава…' : 'Reading the membership register…'}</div>}
      {rows.map((row) => {
        const now = Date.now() / 1_000
        const open = row.status === 0 && now >= row.startsAt && now < row.endsAt
        const total = row.yes + row.no + row.abstain
        return <div className="membership-ballot" key={row.id}>
          <div className="row between"><div><span className="mono muted">#{row.id}</span> <strong>{ru ? 'Кандидат' : 'Candidate'} {shortAddress(row.candidate)}</strong></div><span className="chip">{open ? (ru ? 'идёт' : 'open') : row.status === 2 ? (ru ? 'исполнено' : 'executed') : row.passed ? (ru ? 'принято' : 'passed') : (ru ? 'завершено' : 'closed')}</span></div>
          <div className="muted">{ru ? `За ${row.yes}, против ${row.no}, воздержались ${row.abstain}; участие ${total}/${row.eligible}.` : `Yes ${row.yes}, no ${row.no}, abstain ${row.abstain}; turnout ${total}/${row.eligible}.`}</div>
          {open && user && <div className="row membership-vote-actions">
            <button className="btn small primary" disabled={busy !== null} onClick={() => void vote(row.id, 1)}>{ru ? 'За' : 'Yes'}</button>
            <button className="btn small danger" disabled={busy !== null} onClick={() => void vote(row.id, 2)}>{ru ? 'Против' : 'No'}</button>
            <button className="btn small" disabled={busy !== null} onClick={() => void vote(row.id, 3)}>{ru ? 'Воздержаться' : 'Abstain'}</button>
            {row.myVote && <span className="chip ok">{ru ? 'Ваш голос записан' : 'Your vote is recorded'}</span>}
          </div>}
          {open && !user && <Link className="btn small" to="/auth">{ru ? 'Войти для голосования' : 'Sign in to vote'}</Link>}
        </div>
      })}
      {message && <div className={`callout ${explorer ? 'lime' : 'yellow'}`} role="status" aria-live="polite">{message}{explorer && <> · <a href={explorer} target="_blank" rel="noreferrer">Aptos Explorer ↗</a></>}</div>}
    </div>
  </Panel>
}

export function AdminElectionRegister() {
  return <AptosWalletBoundary><AdminElectionRegisterContent /></AptosWalletBoundary>
}
