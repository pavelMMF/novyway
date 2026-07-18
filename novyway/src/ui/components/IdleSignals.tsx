import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ME, myWeightInSnapshot, useSettings, useStore } from '../../demo/store'
import { fmtW } from '../../domain/weights'
import { useT } from '../../i18n'
import { sound } from '../../sound/engine'
import { music } from '../../sound/music'

// ==========================================================
// AFK-пасхалка «эфир не молчит»: после ~45 секунд бездействия
// вверх начинают плыть «листки времени», у логотипа расходятся
// мягкие исторические орбиты, снизу появляется тихий шёпот сети
// и маленький ledger. Любое движение мыши,
// клавиша или скролл мгновенно возвращают тишину.
// Уважает reduced motion и не мешает кликам (pointer-events: none).
// ==========================================================

const IDLE_AFTER_MS = 45_000

const timeGlyphs = {
  ru: ['сумма весов', 'квитанция', 'правила 4', 'снимок', '«за»', '10 000 долей'],
  en: ['weight sum', 'receipt', 'policy 4', 'snapshot', '“yes”', '10,000 bps'],
}

const whispers = {
  ru: [
    'Сеть ждёт вашего голоса',
    'Прозрачность начинается с открытого следа',
    'Каждое решение можно проверить',
    'Вес голоса подтверждается знанием',
    'История сохраняет не обещания, а поступки',
    'Право участвовать начинается с ответственности',
    'Новый мир начинается с тебя',
    'Решение становится общим, когда его может проверить каждый',
  ],
  en: [
    'The network is waiting for your vote',
    'Transparency begins with a visible trail',
    'Every decision can be verified',
    'Voting weight is earned through proven knowledge',
    'History preserves actions, not promises',
    'Participation begins with responsibility',
    'A new world begins with you',
    'A decision becomes public when anyone can verify it',
  ],
}

interface Particle {
  id: number
  text: string
  left: number
  drift: number
  dur: number
  delay: number
  tilt: number
  size: number
  depth: number
}

function makeParticles(seed: number, glyphs: string[]): Particle[] {
  // Детерминированный поток из seed — re-render не «перемешивает»
  // уже плывущие листки времени.
  const out: Particle[] = []
  let x = seed
  const rand = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648 }
  for (let index = 0; index < 16; index += 1) {
    out.push({
      id: index,
      text: glyphs[index % glyphs.length],
      left: 4 + rand() * 92,
      drift: -46 + rand() * 92,
      dur: 16 + rand() * 14,
      delay: rand() * 12,
      tilt: -32 + rand() * 64,
      size: 10 + rand() * 5,
      depth: 0.45 + rand() * 0.75,
    })
  }
  return out
}

export function IdleSignals() {
  const { s } = useSettings()
  const { state } = useStore()
  const { lang } = useT()
  const [idle, setIdle] = useState(false)
  const [whisperIndex, setWhisperIndex] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const arm = () => {
      window.clearTimeout(timer.current)
      setIdle(false)
      timer.current = window.setTimeout(() => setIdle(true), IDLE_AFTER_MS)
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']
    for (const name of events) window.addEventListener(name, arm, { passive: true })
    arm()
    return () => {
      window.clearTimeout(timer.current)
      for (const name of events) window.removeEventListener(name, arm)
    }
  }, [])

  // Пока бездействие длится, шёпоты сменяют друг друга
  useEffect(() => {
    if (!idle) return
    const id = window.setInterval(() => setWhisperIndex((index) => index + 1), 7_000)
    return () => window.clearInterval(id)
  }, [idle])

  useEffect(() => {
    if (idle && !s.reducedMotion && s.soundOn && !music.isPlaying) sound.startIdleAmbience()
    else sound.stopIdleAmbience()
    return () => sound.stopIdleAmbience()
  }, [idle, s.reducedMotion, s.soundOn, s.volume])

  const particles = useMemo(() => makeParticles(20260712, timeGlyphs[lang] ?? timeGlyphs.ru), [lang])

  if (!idle || s.reducedMotion) return null

  const pool = whispers[lang] ?? whispers.ru
  const active = state.elections.filter((election) => election.status === 'active')
  const myWeights = active
    .map((election) => myWeightInSnapshot(state, election)?.weight ?? 0)
    .reduce((sum, weight) => sum + weight, 0)
  const receipts = state.receipts.filter((receipt) => receipt.voter === ME).length
  const nextCutoff = active[0]?.endsAt

  return (
    <div className="idle-stage" aria-hidden>
      <span className="radar" />
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="idle-particle"
          style={{
            left: `${particle.left}%`,
            fontSize: particle.size,
            '--dur': `${particle.dur}s`,
            '--delay': `${particle.delay}s`,
            '--tilt': `${particle.tilt}deg`,
            '--drift': `${particle.drift}px`,
            '--depth': particle.depth,
          } as CSSProperties}
        >
          {particle.id % 3 === 0 && <b>{particle.text}</b>}
          <i />
        </span>
      ))}
      <span className="idle-ledger">
        <span><b>{active.length}</b>{lang === 'ru' ? 'активных решений' : 'active decisions'}</span>
        <span><b>{fmtW(myWeights)}</b>{lang === 'ru' ? 'мой суммарный вес' : 'my live weight'}</span>
        <span><b>{receipts}</b>{lang === 'ru' ? 'публичных квитанций' : 'public receipts'}</span>
        {nextCutoff && <span><b>{nextCutoff.slice(5, 10)}</b>{lang === 'ru' ? 'следующий срез' : 'next cutoff'}</span>}
      </span>
      <span className="idle-whisper" key={whisperIndex}>{pool[whisperIndex % pool.length]}</span>
    </div>
  )
}
