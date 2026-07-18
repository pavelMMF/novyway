import { useEffect, useRef } from 'react'
import { useSettings } from '../../demo/store'
import { sound } from '../../sound/engine'
import { music } from '../../sound/music'

// ==========================================================
// «Нити времени»: чем дольше открыта сессия, тем больше на
// заднем плане тонких синусоидальных нитей. Появляются с
// 10-й минуты, максимум (7 нитей) — к 30-й. Каждая нить —
// живая синусоида: фаза медленно бежит, амплитуда «дышит»,
// длина волны дрейфует, базовая линия плавно покачивается.
// Тёмная тема — золото, светлая — глубокий красный, мягкое
// свечение. Вместе с нитями еле слышно нарастает «эфирный
// гул» (если звук включён).
//
// Калибровка по практикам ambient-анимаций (Smashing Magazine,
// NN/g): суммарная непрозрачность ≤ ~0.14, циклы десятки секунд,
// aria-hidden, полное отключение при prefers-reduced-motion,
// пауза в фоновых вкладках (rAF сам замирает), ~24 fps.
// ==========================================================

const START_MS = 10 * 60_000
const FULL_MS = 30 * 60_000
const MAX_THREADS = 7
const FRAME_MS = 1000 / 24

function sessionStart(): number {
  try {
    const saved = sessionStorage.getItem('novyi-put-session-start')
    if (saved) return Number(saved)
    const now = Date.now()
    sessionStorage.setItem('novyi-put-session-start', String(now))
    return now
  } catch {
    return Date.now()
  }
}

interface Thread {
  base: number      // базовая линия, доля высоты экрана
  amp: number       // амплитуда синуса, px
  wl: number        // длина волны, px
  speed: number     // скорость бега фазы, рад/с
  breath: number    // частота «дыхания» амплитуды, рад/с
  bob: number       // вертикальное покачивание базовой линии, px
  phase: number
  weight: number    // относительная толщина/яркость
}

function buildThreads(): Thread[] {
  // Детерминированная россыпь — одинаковая от сессии к сессии
  let x = 20260712
  const rand = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648 }
  return Array.from({ length: MAX_THREADS }, (_, index) => ({
    base: 0.10 + index * (0.80 / MAX_THREADS) + rand() * 0.04,
    amp: 9 + rand() * 16,
    wl: 340 + rand() * 420,
    speed: 0.10 + rand() * 0.12,
    breath: 0.028 + rand() * 0.05,
    bob: 10 + rand() * 18,
    phase: rand() * Math.PI * 2,
    weight: 0.6 + rand() * 0.4,
  }))
}

export function TimeThreads() {
  const { s } = useSettings()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = s.reducedMotion
  const soundOn = s.soundOn

  useEffect(() => {
    if (reduced) {
      sound.setSessionHumLevel(0)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const startedAt = sessionStart()
    const threads = buildThreads()
    let raf = 0
    let lastFrame = 0
    let width = 0
    let height = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (frameTime: number) => {
      raf = requestAnimationFrame(draw)
      if (frameTime - lastFrame < FRAME_MS) return
      lastFrame = frameTime

      const level = Math.max(0, Math.min(1, (Date.now() - startedAt - START_MS) / (FULL_MS - START_MS)))
      ctx.clearRect(0, 0, width, height)
      if (level <= 0) return

      const dark = document.documentElement.dataset.theme === 'dark'
      const rgb = dark ? '242, 194, 75' : '181, 45, 32'
      const t = frameTime / 1000
      const visible = level * MAX_THREADS

      ctx.lineCap = 'round'
      ctx.shadowColor = `rgba(${rgb}, ${dark ? 0.5 : 0.35})`

      for (let i = 0; i < MAX_THREADS; i += 1) {
        // Каждая следующая нить проявляется по мере роста level
        const own = Math.max(0, Math.min(1, visible - i))
        if (own <= 0) continue
        const th = threads[i]

        // Медленная эволюция: амплитуда «дышит», длина волны дрейфует
        const amp = th.amp * (0.7 + 0.3 * Math.sin(t * th.breath + th.phase)) * (0.5 + 0.5 * level)
        const wl = th.wl * (1 + 0.18 * Math.sin(t * 0.021 + th.phase * 2))
        const baseY = th.base * height + Math.sin(t * 0.045 + th.phase * 3) * th.bob
        const phase = th.phase + t * th.speed

        const gradient = ctx.createLinearGradient(0, 0, width, 0)
        const alpha = (dark ? 0.13 : 0.11) * own * th.weight
        gradient.addColorStop(0, `rgba(${rgb}, 0)`)
        gradient.addColorStop(0.18, `rgba(${rgb}, ${alpha})`)
        gradient.addColorStop(0.5, `rgba(${rgb}, ${alpha * 0.72})`)
        gradient.addColorStop(0.82, `rgba(${rgb}, ${alpha})`)
        gradient.addColorStop(1, `rgba(${rgb}, 0)`)

        ctx.strokeStyle = gradient
        ctx.lineWidth = 1 + th.weight * 0.6
        ctx.shadowBlur = 10 * own

        ctx.beginPath()
        for (let x = -12; x <= width + 12; x += 12) {
          const y = baseY
            + Math.sin((x / wl) * Math.PI * 2 + phase) * amp
            + Math.sin((x / (wl * 0.53)) * Math.PI * 2 - phase * 0.6) * amp * 0.22
          if (x === -12) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }
    raf = requestAnimationFrame(draw)

    // Эфирный гул нарастает вместе с нитями (и только при включённом звуке)
    const hum = window.setInterval(() => {
      const level = Math.max(0, Math.min(1, (Date.now() - startedAt - START_MS) / (FULL_MS - START_MS)))
      sound.setSessionHumLevel(soundOn && !music.isPlaying ? level : 0)
    }, 8_000)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.clearInterval(hum)
      sound.setSessionHumLevel(0)
    }
  }, [reduced, soundOn])

  if (reduced) return null
  return <canvas ref={canvasRef} className="time-threads" aria-hidden />
}
