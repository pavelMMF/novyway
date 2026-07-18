import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { useT, shortAddr } from '../../i18n'
import { sound } from '../../sound/engine'
import { ToastHost } from '../components'
import { SignalCircuit } from '../components/SignalCircuit'
import { IdleSignals } from '../components/IdleSignals'
import { TimeThreads } from '../components/TimeThreads'
import { MusicPlayer } from './MusicPlayer'
import { BrandMark } from './BrandMark'
import { currentRuntimeMode } from '../../adapters/types'
import { useAccountSession } from '../../auth/session'

const mainNav = [
  { to: '/', key: 'nav.overview', idx: '01' },
  { to: '/elections', key: 'nav.elections', idx: '02' },
  { to: '/documents', key: 'nav.documents', idx: '03' },
] as const

const serviceNav = [
  { to: '/exams', key: 'nav.exams', idx: '04' },
  { to: '/audit', key: 'nav.audit', idx: '05' },
  { to: '/admin', key: 'nav.admin', idx: '06' },
] as const

// Пиктограммы разделов: 18px, stroke = currentcolor, без внешних зависимостей.
const strokeProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const navIcons: Record<string, ReactNode> = {
  'nav.overview': <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" /></svg>,
  'nav.elections': <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}><path d="M5 11.5h14l1.5 7a1 1 0 0 1-1 1.2h-15a1 1 0 0 1-1-1.2z" /><path d="M12 3.2v8.3M8.8 6.4 12 3.2l3.2 3.2" /></svg>,
  'nav.documents': <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" /></svg>,
  'nav.exams': <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}><path d="m12 4 9 4.4-9 4.4-9-4.4z" /><path d="M6.5 10.6v5c0 1.3 2.5 2.9 5.5 2.9s5.5-1.6 5.5-2.9v-5" /></svg>,
  'nav.audit': <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}><path d="M7 3.5h10v17l-2.5-1.6L12 20.5l-2.5-1.6L7 20.5z" /><path d="M10 8h4.5M10 11.5h4.5" /></svg>,
  'nav.admin': <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}><path d="M12 3.5 19 6v5.4c0 4.4-3 8-7 9.1-4-1.1-7-4.7-7-9.1V6z" /><path d="m9.3 11.8 2 2 3.6-3.9" /></svg>,
}

function NavItems({ items }: { items: ReadonlyArray<{ to: string; key: string; idx: string }> }) {
  const { t } = useT()
  return (
    <>
      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          data-silent
          title={t(n.key as 'nav.overview')}
          onClick={(event) => sound.play(event.currentTarget.closest('.sidebar') ? 'sidebar' : 'navigate')}
        >
          <span className="nav-ico" aria-hidden>{navIcons[n.key]}</span>
          <span className="idx">{n.idx}</span>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <span className="nav-label">{t(n.key as any)}</span>
        </NavLink>
      ))}
    </>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang } = useT()
  const { user } = useAccountSession()
  const runtimeMode = currentRuntimeMode()
  const visibleServiceNav = user?.isAdmin ? serviceNav : serviceNav.filter((item) => item.to !== '/admin')
  const profileInitials = (user?.displayName || user?.email || 'НП').trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('') || 'НП'
  const initials = lang === 'en' && /[А-Яа-яЁё]/.test(profileInitials) ? 'ME' : profileInitials
  const location = useLocation()
  const [gameOpen, setGameOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('novyi-put-sidebar') === 'collapsed' } catch { return false }
  })

  useEffect(() => {
    if (!gameOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setGameOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [gameOpen])

  useEffect(() => { setGameOpen(false) }, [location.pathname])

  useEffect(() => {
    try { localStorage.setItem('novyi-put-sidebar', sidebarCollapsed ? 'collapsed' : 'expanded') } catch { /* readonly storage */ }
  }, [sidebarCollapsed])

  useEffect(() => {
    document.title = lang === 'ru' ? 'Новый Путь' : 'New Path'
  }, [lang])

  return (
    <div className={`shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <TimeThreads />
        <aside className="sidebar">
          <div className="brand">
            <button className="brand-trigger" onClick={() => { setGameOpen(true); sound.play('confirm') }} aria-label={t('nav.game')} title={t('nav.game')}>
              <span className="brand-mark"><BrandMark /></span>
            </button>
            <NavLink to="/" className="brand-copy brand-home" data-silent onClick={() => sound.play('navigate')}>
              <div className="brand-name">{lang === 'ru' ? 'НОВЫЙ ПУТЬ' : 'NEW PATH'}</div>
              <div className="brand-sub">{lang === 'ru' ? 'прямые решения' : 'direct decisions'}</div>
            </NavLink>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? t('nav.expand') : t('nav.collapse')}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? t('nav.expand') : t('nav.collapse')}
          >
            <span />
          </button>
          <nav className="nav" aria-label={t('nav.main')}>
            <NavItems items={mainNav} />
            <div className="nav-sep">{t('nav.service')}</div>
            <NavItems items={visibleServiceNav} />
          </nav>
          <div className="sidebar-foot">
            <a className="telegram-link" href="https://t.me/online_council" target="_blank" rel="noreferrer">
              Telegram · @online_council
            </a>
            <span className="chip live"><span className="dot" /> {runtimeMode === 'demo' ? t('common.demo') : 'Aptos Testnet'}</span>
          </div>
        </aside>

      <div className="main">
        <div className="mobile-brand-trigger">
          <button onClick={() => { setGameOpen(true); sound.play('confirm') }} aria-label={t('nav.game')} title={t('nav.game')}><span className="brand-mark"><BrandMark /></span></button>
          <NavLink to="/" data-silent onClick={() => sound.play('navigate')}>{lang === 'ru' ? 'НОВЫЙ ПУТЬ' : 'NEW PATH'}</NavLink>
        </div>
        <header className="topbar app-topbar">
          <div className="spacer" />
          <MusicPlayer />
          <NavLink to="/profile" className={({ isActive }) => `top-action profile-signal ${user ? 'authenticated' : 'guest'} ${isActive ? 'active' : ''}`} data-silent onClick={() => sound.play('navigate')} title={t('nav.profile')} aria-label={user ? (lang === 'ru' ? 'Открыть личный кабинет' : 'Open profile') : (lang === 'ru' ? 'Войти в аккаунт' : 'Sign in')}>
            <span className="top-avatar" aria-hidden>
              {user
                ? <span className="top-avatar-initials">{initials}</span>
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.2" r="3.4" /><path d="M5.5 19.2a6.6 6.6 0 0 1 13 0" /></svg>}
            </span>
            <span className="profile-signal-copy">
              <span className="top-label">{user ? (user.displayName?.trim() || t('nav.profile')) : t('nav.profile')}</span>
              <small className="profile-signal-status">
                {user
                  ? shortAddr(user.activeAptosAddress ?? user.aptosAddress)
                  : (lang === 'ru' ? 'войти в кабинет' : 'sign in')}
              </small>
            </span>
            <span className="profile-signal-dot" aria-hidden />
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `top-action icon-only ${isActive ? 'active' : ''}`} data-silent onClick={() => sound.play('navigate')} aria-label={t('nav.settings')} title={t('nav.settings')}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3.1" />
              <path d="M19.2 12a7.2 7.2 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.3 7.3 0 0 0-2.1-1.3L14.3 3h-4l-.4 2.6a7.3 7.3 0 0 0-2.1 1.3l-2.3-1-2 3.4 2 1.5a7.2 7.2 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.3 7.3 0 0 0 2.1 1.3l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2.1-1.3l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z" />
            </svg>
          </NavLink>
        </header>
        <div key={location.pathname + location.search} className="content route-enter">
          {children}
        </div>
      </div>

      <nav className="bottom-nav" aria-label={t('nav.main')}>
        <NavItems items={mainNav.slice(0, 4)} />
        <details className="mobile-more">
          <summary className="nav-item"><span className="idx">•••</span>{t('nav.more')}</summary>
          <div className="mobile-more-menu"><NavItems items={visibleServiceNav} /></div>
        </details>
      </nav>

      <ToastHost />
      {!['/auth', '/profile', '/admin'].includes(location.pathname) && <IdleSignals />}

      {gameOpen && (
        <div className="game-modal" role="dialog" aria-modal="true" aria-label={t('nav.game')} onMouseDown={() => setGameOpen(false)}>
          <div className="game-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-btn game-close" onClick={() => setGameOpen(false)} aria-label={t('common.close')}>×</button>
            <SignalCircuit />
          </div>
        </div>
      )}
    </div>
  )
}
