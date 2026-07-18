import { useCallback, useEffect, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { aptosView, configuredAptosRpc, configuredVotingModule } from '../../adapters/aptos/aptosReadGateway'
import type { GovernanceAdminState } from '../../adapters/aptos/adminAccess'
import { AptosWalletBoundary } from '../../auth/AptosWalletBoundary'
import { useT } from '../../i18n'
import { sound } from '../../sound/engine'
import { Panel } from './index'

type RegisteredUser = {
  id: string
  aptosAddress: string
  displayName: string | null
  provider: string
  role: string
  equalVoter?: boolean
}

type ChainCategory = { id: number; name: string }

type AdminElectionRow = {
  id: number
  candidate: string
  mode: number
  categoryId: number
  ballotId: string
  status: number
  passed: boolean
  startsAt: string
  endsAt: string
}

type PendingAction = { title: string; details: string; run: () => Promise<void>; danger?: boolean }

function decodeBytes(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('0x')) return ''
  const hex = value.slice(2)
  const bytes = Uint8Array.from(hex.match(/.{1,2}/g) ?? [], (part) => Number.parseInt(part, 16))
  return new TextDecoder().decode(bytes)
}

function shortAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
}

async function waitForTransaction(hash: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${configuredAptosRpc()}/transactions/by_hash/${hash}`, { cache: 'no-store' })
    if (response.ok) {
      const transaction = await response.json() as { success?: boolean; vm_status?: string }
      if (!transaction.success) throw new Error(transaction.vm_status ?? 'transaction_failed')
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error('transaction_confirmation_timeout')
}

function AdminMembershipContent({ governance }: { governance: GovernanceAdminState }) {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const [users, setUsers] = useState<RegisteredUser[]>([])
  const [categories, setCategories] = useState<ChainCategory[]>([])
  const [elections, setElections] = useState<AdminElectionRow[]>([])
  const [appointmentCandidate, setAppointmentCandidate] = useState('')
  const [electionCandidate, setElectionCandidate] = useState('')
  const [mode, setMode] = useState<0 | 1>(1)
  const [categoryId, setCategoryId] = useState(0)
  const [days, setDays] = useState(14)
  const [passPct, setPassPct] = useState(50)
  const [quorumPct, setQuorumPct] = useState(30)
  const [allowRevote, setAllowRevote] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [explorer, setExplorer] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const walletMatches = connected && account?.address.toString().toLowerCase() === governance.creator.toLowerCase()

  const load = useCallback(async () => {
    setLoading(true)
    const [usersResponse, counters, electionCount] = await Promise.all([
      fetch('/api/v1/governance/users', { credentials: 'same-origin', cache: 'no-store' }),
      aptosView('weighted_voting', 'counters'),
      aptosView('admin_election', 'election_count'),
    ])
    if (!usersResponse.ok) throw new Error(`users_http_${usersResponse.status}`)
    const userBody = await usersResponse.json() as { users: RegisteredUser[] }
    const categoryCount = Number(counters[0] ?? 0)
    const loadedCategories = await Promise.all(Array.from({ length: categoryCount }, async (_, id) => {
      const raw = await aptosView('weighted_voting', 'category', [id])
      return { id, name: decodeBytes(raw[0]) || `#${id}` }
    }))
    const loadedUsers = await Promise.all(userBody.users.map(async (user) => {
      const eligible = await aptosView('admin_election', 'is_equal_voter', [user.aptosAddress]).catch(() => [false])
      return { ...user, equalVoter: eligible[0] === true }
    }))
    const count = Math.min(Number(electionCount[0] ?? 0), 100)
    const loadedElections = await Promise.all(Array.from({ length: count }, async (_, id) => {
      const raw = await aptosView('admin_election', 'election', [id])
      return {
        id,
        candidate: String(raw[0]),
        mode: Number(raw[1]),
        categoryId: Number(raw[2]),
        ballotId: String(raw[3]),
        startsAt: String(raw[11]),
        endsAt: String(raw[12]),
        status: Number(raw[13]),
        passed: raw[15] === true,
      }
    }))
    setUsers(loadedUsers)
    setCategories(loadedCategories)
    setElections(loadedElections.reverse())
    setAppointmentCandidate((current) => current || loadedUsers[0]?.aptosAddress || '')
    setElectionCandidate((current) => current || loadedUsers[0]?.aptosAddress || '')
    setCategoryId((current) => loadedCategories.some((item) => item.id === current) ? current : loadedCategories[0]?.id ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { void load().catch((error) => { setLoading(false); setMessage(error instanceof Error ? error.message : 'load_failed') }) }, [load])

  const validAppointmentCandidate = /^0x[0-9a-f]{1,64}$/i.test(appointmentCandidate)
  const validElectionCandidate = /^0x[0-9a-f]{1,64}$/i.test(electionCandidate)

  async function submit(moduleName: 'weighted_voting' | 'admin_election', functionName: string, args: unknown[], action: string, reloadPage = false) {
    if (!walletMatches) {
      setMessage(ru ? 'Подключите кошелёк creator. Вход на сайт сам по себе не даёт права подписи.' : 'Connect the creator wallet. A site session alone cannot sign governance actions.')
      sound.play('warning')
      return
    }
    setBusy(action)
    setMessage(ru ? 'Подтвердите транзакцию в кошельке…' : 'Confirm the transaction in your wallet…')
    setExplorer(null)
    try {
      const result = await signAndSubmitTransaction({
        data: {
          function: `${configuredVotingModule()}::${moduleName}::${functionName}` as `${string}::${string}::${string}`,
          functionArguments: args as never[],
        },
      })
      await waitForTransaction(result.hash)
      setExplorer(`https://explorer.aptoslabs.com/txn/${result.hash}?network=testnet`)
      setMessage(ru ? 'Транзакция подтверждена Aptos Testnet.' : 'The transaction is confirmed on Aptos Testnet.')
      sound.play('voteSuccess')
      if (reloadPage) setTimeout(() => window.location.reload(), 700)
      else await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'transaction_failed')
      sound.play('warning')
    } finally {
      setBusy(null)
    }
  }

  async function createAdminElection() {
    if (!validElectionCandidate || !Number.isInteger(days) || days < 1 || days > 365 || !Number.isInteger(passPct) || passPct < 50 || passPct > 100 || !Number.isInteger(quorumPct) || quorumPct < 0 || quorumPct > 100) {
      setMessage(ru ? 'Проверьте Aptos-адрес, срок, порог и кворум.' : 'Check the Aptos address, duration, threshold, and quorum.')
      return
    }
    const payload = {
      candidate: electionCandidate,
      mode,
      categoryId: mode === 1 ? categoryId : 0,
      passBps: passPct * 100,
      quorumBps: quorumPct * 100,
      allowRevote,
      createdAt: new Date().toISOString(),
    }
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload))))
    const endsAt = Math.floor(Date.now() / 1_000) + days * 86_400
    await submit('admin_election', 'create_election', [
      electionCandidate,
      mode,
      mode === 1 ? categoryId : 0,
      hash,
      new TextEncoder().encode(`https://novyway.com/audit?admin-candidate=${encodeURIComponent(electionCandidate)}`),
      0,
      endsAt,
      passPct * 100,
      quorumPct * 100,
      allowRevote,
    ], 'create-election')
  }

  if (!governance.isCreator) return <Panel title={ru ? 'Состав Совета' : 'Council membership'}>
    <p className="muted">{ru ? 'Назначать администраторов и создавать выборы состава может только неизменяемый creator.' : 'Only the immutable creator can appoint administrators or create membership elections.'}</p>
    <code className="mono governance-address">{governance.creator}</code>
  </Panel>

  return <div className="stack governance-membership">
    <div className={`callout ${walletMatches ? 'green' : 'yellow'}`}>
      <strong>{ru ? 'Супер-администратор' : 'Super administrator'}:</strong>{' '}{shortAddress(governance.creator)}.{' '}
      {walletMatches ? (ru ? 'Кошелёк готов подписывать.' : 'The wallet is ready to sign.') : (ru ? 'Подключённый кошелёк не совпадает с creator.' : 'The connected wallet does not match the creator.')}
    </div>

    <div className="grid c2">
      <Panel title={ru ? 'Прямое назначение' : 'Direct appointment'} hint={ru ? 'решение creator' : 'creator decision'}>
        <div className="stack">
          <label className="field"><span>{ru ? 'Пользователь' : 'User'}</span>
            <select value={appointmentCandidate} onChange={(event) => setAppointmentCandidate(event.target.value)}>
              {users.map((user) => <option value={user.aptosAddress} key={user.id}>{user.displayName || shortAddress(user.aptosAddress)} · {user.provider}</option>)}
            </select>
          </label>
          <label className="field"><span>{ru ? 'Aptos-адрес' : 'Aptos address'}</span><input className="mono" value={appointmentCandidate} onChange={(event) => setAppointmentCandidate(event.target.value.trim())} /></label>
          <button className="btn primary" disabled={!validAppointmentCandidate || busy !== null || governance.administrators.some((item) => item.toLowerCase() === appointmentCandidate.toLowerCase())} onClick={() => setPending({ title: ru ? 'Подтвердить назначение' : 'Confirm appointment', details: ru ? `Адрес ${shortAddress(appointmentCandidate)} сразу войдёт в состав Совета. Порог подтверждений может измениться.` : `${shortAddress(appointmentCandidate)} will immediately join the Council. The approval threshold may change.`, run: () => submit('weighted_voting', 'add_admin', [appointmentCandidate], 'add-admin', true) })}>{ru ? 'Назначить администратором' : 'Appoint administrator'}</button>
          <p className="muted">{ru ? 'Назначение фиксируется напрямую в Aptos и отдельно от выборного назначения.' : 'The appointment is recorded directly on Aptos and remains distinct from an elected appointment.'}</p>
        </div>
      </Panel>

      <Panel title={ru ? 'Действующий состав' : 'Current council'} hint={`${governance.administrators.length}`}>
        <div className="stack compact-stack">
          {governance.administrators.map((address) => <div className="admin-member-row" key={address}>
            <div><strong>{address.toLowerCase() === governance.creator.toLowerCase() ? (ru ? 'Creator' : 'Creator') : (ru ? 'Администратор' : 'Administrator')}</strong><div className="mono muted">{shortAddress(address)}</div></div>
            {address.toLowerCase() !== governance.creator.toLowerCase() && <button className="btn small danger" disabled={busy !== null} onClick={() => setPending({ title: ru ? 'Удалить администратора?' : 'Remove administrator?', details: ru ? `${shortAddress(address)} потеряет административные полномочия. Операция останется в публичном журнале.` : `${shortAddress(address)} will lose administrative privileges. The action remains in the public log.`, run: () => submit('weighted_voting', 'remove_admin', [address], `remove-${address}`, true), danger: true })}>{ru ? 'Удалить' : 'Remove'}</button>}
          </div>)}
        </div>
      </Panel>
    </div>

    <div className="grid c2">
      <Panel title={ru ? 'Выборы администратора' : 'Administrator election'} hint={ru ? 'публичный on-chain процесс' : 'public on-chain process'}>
        <div className="stack">
          <label className="field"><span>{ru ? 'Кандидат' : 'Candidate'}</span>
            <select value={electionCandidate} onChange={(event) => setElectionCandidate(event.target.value)}>{users.map((user) => <option value={user.aptosAddress} key={user.id}>{user.displayName || shortAddress(user.aptosAddress)}</option>)}</select>
          </label>
          <div className="seg" role="radiogroup" aria-label={ru ? 'Способ подсчёта' : 'Counting mode'}>
            <button type="button" role="radio" aria-checked={mode === 1} className={mode === 1 ? 'on' : ''} onClick={() => setMode(1)}>{ru ? 'Экспертные веса' : 'Expert weights'}</button>
            <button type="button" role="radio" aria-checked={mode === 0} className={mode === 0 ? 'on' : ''} onClick={() => setMode(0)}>{ru ? 'Один аккаунт — один голос' : 'One account, one vote'}</button>
          </div>
          {mode === 1 && <label className="field"><span>{ru ? 'Тема экспертных весов' : 'Expert category'}</span><select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>}
          <div className="grid c3">
            <label className="field"><span>{ru ? 'Дней' : 'Days'}</span><input type="number" min={1} max={365} value={days} onChange={(event) => setDays(Number(event.target.value))} /></label>
            <label className="field"><span>{ru ? 'Порог, %' : 'Pass, %'}</span><input type="number" min={50} max={100} value={passPct} onChange={(event) => setPassPct(Number(event.target.value))} /></label>
            <label className="field"><span>{ru ? 'Кворум, %' : 'Quorum, %'}</span><input type="number" min={0} max={100} value={quorumPct} onChange={(event) => setQuorumPct(Number(event.target.value))} /></label>
          </div>
          <label className="check-row"><input type="checkbox" checked={allowRevote} onChange={(event) => setAllowRevote(event.target.checked)} /><span>{ru ? 'Разрешить переголосование' : 'Allow revoting'}</span></label>
          <button className="btn primary" disabled={!validElectionCandidate || busy !== null || (mode === 0 && users.filter((user) => user.equalVoter).length === 0)} onClick={() => setPending({ title: ru ? 'Опубликовать выборы?' : 'Publish election?', details: ru ? `${mode === 1 ? `Экспертные веса темы «${categories.find((item) => item.id === categoryId)?.name ?? categoryId}»` : 'Один допущенный аккаунт — один голос'}; порог ${passPct}%, кворум ${quorumPct}%, срок ${days} дн.` : `${mode === 1 ? `Expert weights in ${categories.find((item) => item.id === categoryId)?.name ?? categoryId}` : 'One admitted account, one vote'}; pass ${passPct}%, quorum ${quorumPct}%, ${days} days.`, run: createAdminElection })}>{ru ? 'Создать on-chain голосование' : 'Create on-chain election'}</button>
          {mode === 1 && <p className="muted">{ru ? 'Право голоса и вес берутся из замороженного снимка выбранной темы. Квалификации, изменённые после открытия, на эти выборы не влияют.' : 'Eligibility and weight come from a frozen snapshot of the selected category. Later qualification changes do not affect this election.'}</p>}
          {mode === 0 && <p className="muted">{ru ? `В снапшот войдут только заранее допущенные аккаунты: ${users.filter((user) => user.equalVoter).length}. Это не паспортная проверка личности.` : `Only pre-approved accounts enter the snapshot: ${users.filter((user) => user.equalVoter).length}. This is not proof of personhood.`}</p>}
        </div>
      </Panel>

      <Panel title={ru ? 'Реестр равных голосов' : 'Equal-vote registry'} hint={`${users.filter((user) => user.equalVoter).length}/${users.length}`}>
        <div className="stack compact-stack governance-user-list">
          {loading && <div className="empty">{ru ? 'Загружаем пользователей и реестр Aptos…' : 'Loading users and the Aptos registry…'}</div>}
          {!loading && users.length === 0 && <div className="empty">{ru ? 'Зарегистрированных пользователей пока нет.' : 'There are no registered users yet.'}</div>}
          {users.map((user) => <div className="admin-member-row" key={user.id}>
            <div><strong>{user.displayName || shortAddress(user.aptosAddress)}</strong><div className="mono muted">{shortAddress(user.aptosAddress)}</div></div>
            <button className={`btn small ${user.equalVoter ? 'danger' : 'primary'}`} disabled={busy !== null} onClick={() => setPending({ title: user.equalVoter ? (ru ? 'Исключить из равного голосования?' : 'Exclude from equal voting?') : (ru ? 'Допустить к равному голосованию?' : 'Admit to equal voting?'), details: ru ? `${user.displayName || shortAddress(user.aptosAddress)}: изменение войдёт только в будущие снапшоты.` : `${user.displayName || shortAddress(user.aptosAddress)}: the change affects future snapshots only.`, run: () => submit('admin_election', user.equalVoter ? 'unregister_equal_voter' : 'register_equal_voter', [user.aptosAddress], `voter-${user.id}`), danger: user.equalVoter })}>{user.equalVoter ? (ru ? 'Исключить' : 'Exclude') : (ru ? 'Допустить' : 'Admit')}</button>
          </div>)}
        </div>
      </Panel>
    </div>

    <Panel title={ru ? 'Голосования за состав' : 'Membership elections'} hint={`${elections.length}`}>
      {loading ? <div className="empty">{ru ? 'Читаем голосования из Aptos…' : 'Reading elections from Aptos…'}</div> : elections.length === 0 ? <div className="empty">{ru ? 'Голосований пока нет.' : 'No elections yet.'}</div> : <div className="stack compact-stack">{elections.map((election) => <div className="admin-election-row" key={election.id}>
        <span className="mono">#{election.id}</span><strong>{users.find((user) => user.aptosAddress.toLowerCase() === election.candidate.toLowerCase())?.displayName || shortAddress(election.candidate)}</strong>
        <span className="chip">{election.mode === 1 ? (ru ? `эксперты · ${categories.find((item) => item.id === election.categoryId)?.name ?? `тема #${election.categoryId}`}` : `experts · ${categories.find((item) => item.id === election.categoryId)?.name ?? `category #${election.categoryId}`}`) : (ru ? 'равный голос' : 'equal vote')}</span>
        <span className="muted">{election.status === 0 ? (ru ? 'идёт' : 'open') : election.status === 1 ? (election.passed ? (ru ? 'принято' : 'passed') : (ru ? 'отклонено' : 'rejected')) : (ru ? 'исполнено' : 'executed')}</span>
        {election.ballotId !== '18446744073709551615' && <span className="mono muted">ballot #{election.ballotId}</span>}
        {election.status === 1 && election.passed && <button className="btn small primary" disabled={busy !== null} onClick={() => setPending({ title: ru ? 'Исполнить результат выборов?' : 'Execute election result?', details: ru ? `${shortAddress(election.candidate)} будет добавлен в состав Совета отдельной on-chain транзакцией creator.` : `${shortAddress(election.candidate)} will be added to the Council by a separate creator transaction.`, run: () => submit('admin_election', 'execute', [election.id], `execute-${election.id}`, true) })}>{ru ? 'Назначить по итогам' : 'Execute appointment'}</button>}
      </div>)}</div>}
    </Panel>

    {pending && <div className="governance-confirm" role="dialog" aria-modal="true" aria-labelledby="governance-confirm-title">
      <div className="governance-confirm__body"><strong id="governance-confirm-title">{pending.title}</strong><p>{pending.details}</p><div className="row"><button className="btn" onClick={() => setPending(null)}>{ru ? 'Отмена' : 'Cancel'}</button><button autoFocus className={`btn ${pending.danger ? 'danger' : 'primary'}`} onClick={() => { const action = pending.run; setPending(null); void action() }}>{ru ? 'Подтвердить' : 'Confirm'}</button></div></div>
    </div>}
    {message && <div className={`callout ${explorer ? 'lime' : 'cyan'}`} role={explorer ? 'status' : 'alert'} aria-live="polite">{message}{explorer && <> · <a href={explorer} target="_blank" rel="noreferrer">Aptos Explorer ↗</a></>}</div>}
  </div>
}

export function AdminMembership({ governance }: { governance: GovernanceAdminState }) {
  return <AptosWalletBoundary><AdminMembershipContent governance={governance} /></AptosWalletBoundary>
}
