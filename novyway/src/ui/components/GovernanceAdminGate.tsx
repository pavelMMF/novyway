import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAccountSession } from '../../auth/session'
import { readGovernanceAdminState, type GovernanceAdminState } from '../../adapters/aptos/adminAccess'
import { useT } from '../../i18n'
import { PageHead, Panel } from './index'

const AdminContext = createContext<GovernanceAdminState | null>(null)

export function GovernanceAdminGate({ children }: { children: ReactNode }) {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { user, loading: sessionLoading } = useAccountSession()
  const [state, setState] = useState<GovernanceAdminState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const signingAddress = user?.activeAptosAddress
    if (!user?.isAdmin || !signingAddress) { setState(null); setLoading(false); return }
    let active = true
    setLoading(true)
    setError(null)
    readGovernanceAdminState(signingAddress)
      .then((next) => { if (active) setState(next) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'admin_check_failed') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user])

  if (sessionLoading || loading) return <div className="empty">{ru ? 'Проверяем полномочия администратора в Aptos…' : 'Checking administrator permissions on Aptos…'}</div>
  if (!user) return <>
    <PageHead title={ru ? 'Управление Советом' : 'Council governance'} sub={ru ? 'Административный кабинет сети, а не панель сервера.' : 'Network governance console, separate from server operations.'} />
    <Panel title={ru ? 'Нужна авторизация' : 'Sign-in required'}><p className="muted">{ru ? 'Войдите аккаунтом, к которому привязан адрес администратора Совета.' : 'Sign in to the account linked to a Council administrator address.'}</p><Link className="btn primary" to="/auth?returnTo=%2Fadmin">{ru ? 'Перейти ко входу' : 'Sign in'}</Link></Panel>
  </>
  if (!user.isAdmin || !user.activeAptosAddress) return <>
    <PageHead title={ru ? 'Управление Советом' : 'Council governance'} sub={ru ? 'Административный кабинет сети, а не панель сервера.' : 'Network governance console, separate from server operations.'} />
    <Panel title={ru ? 'Нужна подпись администратора' : 'Administrator signature required'}>
      <p>{ru ? 'Текущая сессия не подтверждена адресом, записанным администратором в контракте. Активируйте нужный способ входа; выходить из профиля не требуется.' : 'The current session is not confirmed by an address registered as a contract administrator. Activate the required sign-in method without leaving the profile.'}</p>
      <Link className="btn primary" to="/auth?returnTo=%2Fadmin">{ru ? 'Выбрать адрес' : 'Choose address'}</Link>
    </Panel>
  </>
  if (error) return <div className="callout red">{ru ? 'Не удалось проверить on-chain роль: ' : 'Could not verify the on-chain role: '}{error}</div>
  if (!state?.isAdmin) return <>
    <PageHead title={ru ? 'Управление Советом' : 'Council governance'} sub={ru ? 'Административный кабинет сети, а не панель сервера.' : 'Network governance console, separate from server operations.'} />
    <Panel title={ru ? 'Доступ закрыт' : 'Access denied'}>
      <p>{ru ? 'Этот Aptos-адрес не входит в действующий список администраторов контракта.' : 'This Aptos address is not in the contract administrator set.'}</p>
      <code className="mono" style={{ overflowWrap: 'anywhere' }}>{user.activeAptosAddress}</code>
      <p className="muted">{ru ? `Сейчас в сети ${state?.administrators.length ?? 0} администраторов; порог подтверждения ${state?.threshold ?? 0}.` : `The network currently has ${state?.administrators.length ?? 0} administrators with threshold ${state?.threshold ?? 0}.`}</p>
    </Panel>
  </>
  return <AdminContext.Provider value={state}>{children}</AdminContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useGovernanceAdmin() {
  const state = useContext(AdminContext)
  if (!state) throw new Error('useGovernanceAdmin must be used inside GovernanceAdminGate')
  return state
}
