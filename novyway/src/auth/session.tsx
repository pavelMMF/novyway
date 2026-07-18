import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type AccountUser = {
  id: string
  aptosAddress: string
  activeAptosAddress: string | null
  displayName: string | null
  email: string | null
  telegram: string | null
  emailVerified: boolean
  provider: 'email' | 'google' | 'apple' | 'wallet'
  walletKind: 'managed' | 'keyless' | 'external'
  role: string
  isAdmin: boolean
  isSuperAdmin: boolean
  createdAt: string
  lastLoginAt: string
  csrfToken: string | null
}

type SessionContextValue = {
  user: AccountUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  acceptUser: (user: AccountUser) => void
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestGeneration = useRef(0)

  const refresh = useCallback(async () => {
    const generation = ++requestGeneration.current
    try {
      // A unique URL also bypasses obsolete service workers that cached /api/me
      // before API requests were explicitly excluded from the offline shell.
      const response = await fetch(`/api/me?session_probe=${Date.now().toString(36)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (generation !== requestGeneration.current) return
      if (response.status === 401) {
        setUser(null)
        setError(null)
        return
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json() as { user: AccountUser | null }
      if (generation !== requestGeneration.current) return
      setUser(body.user)
      setError(null)
    } catch {
      if (generation !== requestGeneration.current) return
      setError('session_unavailable')
    } finally {
      if (generation === requestGeneration.current) setLoading(false)
    }
  }, [])

  const acceptUser = useCallback((nextUser: AccountUser) => {
    requestGeneration.current += 1
    setUser(nextUser)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) void refresh() }
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: user?.csrfToken ? { 'X-CSRF-Token': user.csrfToken } : undefined })
    } finally {
      requestGeneration.current += 1
      setUser(null)
      setError(null)
      setLoading(false)
    }
  }, [user])

  const value = useMemo(() => ({ user, loading, error, refresh, acceptUser, logout }), [user, loading, error, refresh, acceptUser, logout])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAccountSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useAccountSession must be used inside SessionProvider')
  return context
}
