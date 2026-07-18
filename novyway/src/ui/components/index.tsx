/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { Category, ElectionStatus, QualificationLevel } from '../../domain/types'
import { shortAddr, useT } from '../../i18n'
import { persons, useSettings, useStore, ME } from '../../demo/store'

// ---------- панель ----------

export function Panel({ title, hint, children, className = '', tight }: {
  title?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; tight?: boolean
}) {
  return (
    <section className={`panel ${tight ? 'tight' : ''} ${className}`}>
      {title && (
        <div className="panel-title">
          {title}
          {hint && <span className="hint">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-head row between">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

// ---------- статусы ----------

export function StatusChip({ status }: { status: ElectionStatus }) {
  const { t } = useT()
  const map: Record<ElectionStatus, { cls: string; label: string }> = {
    active: { cls: 'live', label: t('st.active') },
    upcoming: { cls: 'mute', label: t('st.upcoming') },
    awaiting_finalization: { cls: 'warn', label: t('st.awaiting_finalization') },
    passed: { cls: 'ok', label: t('st.passed') },
    rejected: { cls: 'crit', label: t('st.rejected') },
    quorum_failed: { cls: 'warn', label: t('st.quorum_failed') },
  }
  const m = map[status]
  return (
    <span className={`chip ${m.cls}`}>
      <span className="dot" aria-hidden />
      {m.label}
    </span>
  )
}

export function Lvl({ level }: { level: QualificationLevel | number }) {
  return <span className={`lvl l${level}`}>L{level}</span>
}

export function CatChip({ cat }: { cat: Category }) {
  const { l } = useT()
  return (
    <span className="chip cat" style={{ background: cat.color }}>
      {l(cat.name)}
    </span>
  )
}

// ---------- аккаунт / личность ----------

/**
 * Режим исследования: адрес кошелька ↔ зарегистрированный человек.
 * Глобальный переключатель в настройках + локальный в аудите.
 */
export function AccountRef({ address, identity }: { address: string; identity?: boolean }) {
  const { s } = useSettings()
  const { t, l } = useT()
  const show = identity ?? s.identityMode
  const person = persons.find((p) => p.address === address)
  const displayName = address === ME && s.profile.name ? s.profile.name : person?.name ? l(person.name) : undefined
  const hue = parseInt(address.slice(2, 8), 16) % 360
  const avatar = (
    <span
      className="avatar"
      aria-hidden
      style={{ background: `conic-gradient(from ${hue}deg, hsl(${hue} 45% 55%), hsl(${(hue + 90) % 360} 40% 40%))` }}
    />
  )
  if (show && displayName) {
    return (
      <span className="acct" title={address}>
        {avatar}
        <span className="who">{displayName}</span>
        {address === ME && <span className="chip live" style={{ padding: '0 6px' }}>{t('common.you')}</span>}
        {person?.role === 'admin' && <span className="chip crit" style={{ padding: '0 6px' }}>{t('common.admin')}</span>}
      </span>
    )
  }
  return (
    <span className="acct" title={show ? t('common.notRegistered') : address}>
      {avatar}
      <span className="addr">{shortAddr(address)}</span>
      {show && !person?.name && <span className="muted" style={{ fontSize: 11 }}>· {t('common.notRegistered')}</span>}
    </span>
  )
}

// ---------- метрики ----------

export function Meter({ parts, total, ariaLabel }: { parts: { value: number; color: string }[]; total: number; ariaLabel?: string }) {
  return (
    <div className="meter" role="img" aria-label={ariaLabel ?? parts.map((part) => `${Math.round(total > 0 ? part.value / total * 100 : 0)}%`).join(', ')}>
      {parts.map((p, i) => (
        <div key={i} className="fill" style={{ width: `${total > 0 ? (p.value / total) * 100 : 0}%`, background: p.color }} />
      ))}
    </div>
  )
}

export function KV({ k, v, mono, big }: { k: ReactNode; v: ReactNode; mono?: boolean; big?: boolean }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className={`v ${mono ? 'mono' : ''} ${big ? 'big' : ''}`}>{v}</span>
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden />
      <span>{label}</span>
    </label>
  )
}

export function LinkBtn({ to, children, primary, small }: { to: string; children: ReactNode; primary?: boolean; small?: boolean }) {
  return (
    <Link className={`btn ${primary ? 'primary' : ''} ${small ? 'small' : ''}`} to={to}>
      {children}
    </Link>
  )
}

// ---------- тосты ----------

export function ToastHost() {
  const { state, dispatch } = useStore()
  return (
    <div className="toasts" aria-live="polite">
      {state.toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} text={t.text} kind={t.kind} onDone={() => dispatch({ type: 'DISMISS_TOAST', id: t.id })} />
      ))}
    </div>
  )
}

function ToastItem({ text, kind, onDone }: { id: number; text: string; kind: string; onDone: () => void }) {
  useEffect(() => {
    const h = setTimeout(onDone, 4200)
    return () => clearTimeout(h)
  }, [onDone])
  return <div className={`toast ${kind}`}>{text}</div>
}


// ---------- живой обратный отсчёт ----------

export function Countdown({ endsAt }: { endsAt: string }) {
  const { t } = useT()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const left = new Date(endsAt).getTime() - now
  if (left <= 0) return <span className="countdown">{t('el.closed')}</span>
  const d = Math.floor(left / 86_400_000)
  const h = Math.floor(left / 3_600_000) % 24
  const m = Math.floor(left / 60_000) % 60
  const sec = Math.floor(left / 1000) % 60
  return (
    <span className="countdown">
      {t('el.left')} {d > 0 ? `${d}${t('common.days')} ` : ''}{h}:{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}
    </span>
  )
}

// ---------- гражданский скор ----------

export function useCivicScore(voter = ME) {
  const { state } = useStore()
  const { s } = useSettings()
  const voteCount = state.votes.filter((v) => v.voter === voter).length
  const examCount = state.attempts.filter((a) => a.voter === voter && a.status === 'confirmed').length
  const docCount = s.readDocs.length
  const score = Math.min(100, voteCount * 25 + docCount * 15 + examCount * 20)
  return { score, voteCount, examCount, docCount }
}

export function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${score} / 100`}>
        <circle cx={size / 2} cy={size / 2} r={radius} className="track" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} className="value"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <strong>{score}</strong>
    </div>
  )
}

// ---------- золотой всплеск при голосе ----------

export function GoldBurst() {
  return (
    <div className="gold-burst" aria-hidden>
      {Array.from({ length: 14 }, (_, index) => (
        <i key={index} style={{ '--angle': `${index * 25.7}deg`, '--delay': `${(index % 5) * 28}ms` } as CSSProperties} />
      ))}
    </div>
  )
}
