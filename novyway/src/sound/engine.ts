// ==========================================================
// Звуковой язык «Новый Путь»: короткие синтезированные
// earcons через WebAudio. Без файлов, без autoplay, с mute.
// ==========================================================

export type EarconName =
  | 'tap'
  | 'navigate'
  | 'sidebar'
  | 'graphSelect'
  | 'confirm'
  | 'type'
  | 'warning'
  | 'receipt'
  | 'voteSuccess'

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private idleNodes: AudioNode[] = []
  private idleTimer: number | undefined
  private idleGain: GainNode | null = null
  private humGain: GainNode | null = null
  private humNodes: AudioNode[] = []
  enabled = true
  volume = 0.5 // 0..1, внутренняя громкость всё равно низкая
  private lastType = 0

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.14 * this.volume
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.master) this.master.gain.value = 0.14 * this.volume
    return this.ctx
  }

  private tone(
    freq: number, dur: number, at = 0,
    type: OscillatorType = 'sine', gain = 1,
    glideTo?: number,
  ) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime + at
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  play(name: EarconName) {
    if (!this.enabled) return
    switch (name) {
      case 'tap': // тихий triangle click 20–35ms
        this.tone(1400, 0.028, 0, 'triangle', 0.5)
        break
      case 'navigate': // чуть более высокий переход 40–60ms
        this.tone(880, 0.05, 0, 'triangle', 0.45, 1320)
        break
      case 'sidebar': // короткий такт переключения секции: мягкий импульс + светлый отклик
        this.tone(196, 0.055, 0, 'triangle', 0.24, 246.94)
        this.tone(740, 0.065, 0.018, 'sine', 0.28, 932.33)
        break
      case 'graphSelect': // пространственный скан узла без резкого цифрового щелчка
        this.tone(329.63, 0.11, 0, 'sine', 0.36, 523.25)
        this.tone(1046.5, 0.075, 0.045, 'triangle', 0.18, 1318.51)
        break
      case 'confirm': // мягкий sine chime 90–130ms
        this.tone(660, 0.11, 0, 'sine', 0.6)
        this.tone(990, 0.1, 0.03, 'sine', 0.35)
        break
      case 'type': { // очень тихий tick с throttling
        const now = performance.now()
        if (now - this.lastType < 70) return
        this.lastType = now
        this.tone(2100, 0.014, 0, 'triangle', 0.16)
        break
      }
      case 'warning': // два коротких понижающихся тона
        this.tone(620, 0.07, 0, 'square', 0.22)
        this.tone(470, 0.09, 0.09, 'square', 0.22)
        break
      case 'receipt': // спокойный двухнотный сигнал
        this.tone(523.25, 0.12, 0, 'sine', 0.5)
        this.tone(784, 0.16, 0.1, 'sine', 0.42)
        break
      case 'voteSuccess': // «золотая печать»: низкий удар фиксации + тёплая восходящая гармония + мерцание
        this.tone(150, 0.18, 0, 'sine', 0.5, 62) // печатный удар — решение зафиксировано
        this.tone(392, 0.22, 0.02, 'sine', 0.44, 440)
        this.tone(523.25, 0.27, 0.075, 'sine', 0.34, 587.33)
        this.tone(783.99, 0.34, 0.15, 'sine', 0.27, 880)
        this.tone(1567.98, 0.16, 0.21, 'triangle', 0.12, 1760)
        this.tone(2637, 0.4, 0.28, 'sine', 0.06, 2794) // верхнее мерцание — золотая пыль
        break
    }
  }

  /**
   * «Эфирный гул» долгой сессии: очень тихий коричневый шум через
   * низкочастотный фильтр с медленным LFO. level 0..1 масштабирует
   * громкость (потолок намеренно почти неслышный); 0 — плавный стоп.
   */
  setSessionHumLevel(level: number) {
    const target = this.enabled ? Math.max(0, Math.min(1, level)) * 0.030 : 0
    if (target <= 0.0005) {
      if (this.humGain && this.ctx) {
        const gain = this.humGain
        gain.gain.cancelScheduledValues(this.ctx.currentTime)
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), this.ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.4)
        const nodes = this.humNodes
        this.humGain = null
        this.humNodes = []
        window.setTimeout(() => {
          for (const node of nodes) { try { node.disconnect() } catch { /* уже отключено */ } }
        }, 1600)
      }
      return
    }
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    if (!this.humGain) {
      // 2 секунды зацикленного коричневого шума
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      let lastOut = 0
      for (let i = 0; i < data.length; i += 1) {
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + 0.02 * white) / 1.02
        data[i] = lastOut * 3.5
      }
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 190
      filter.Q.value = 0.5
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.type = 'sine'
      lfo.frequency.value = 0.05
      lfoGain.gain.value = 55
      lfo.connect(lfoGain).connect(filter.frequency)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      src.connect(filter).connect(gain).connect(this.master)
      src.start()
      lfo.start()
      this.humGain = gain
      this.humNodes = [src, filter, gain, lfo, lfoGain]
    }
    this.humGain.gain.cancelScheduledValues(ctx.currentTime)
    this.humGain.gain.setValueAtTime(Math.max(this.humGain.gain.value, 0.0001), ctx.currentTime)
    this.humGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 3)
  }

  startIdleAmbience() {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx || !this.master || this.idleGain) return

    const base = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    base.gain.setValueAtTime(0.0001, ctx.currentTime)
    base.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 2.2)
    filter.type = 'lowpass'
    filter.frequency.value = 1200
    filter.Q.value = 0.72
    lfo.type = 'sine'
    lfo.frequency.value = 0.045
    lfoGain.gain.value = 260
    lfo.connect(lfoGain).connect(filter.frequency)
    base.connect(filter).connect(this.master)
    lfo.start()

    this.idleGain = base
    this.idleNodes = [base, filter, lfo, lfoGain]

    const pattern = [
      [196, 0],
      [246.94, 1.7],
      [293.66, 3.2],
      [392, 5.4],
      [329.63, 7.8],
      [246.94, 10.2],
    ] as const
    const spawn = () => {
      if (!this.idleGain || !this.enabled) return
      const now = ctx.currentTime
      for (const [freq, offset] of pattern) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        const pan = ctx.createStereoPanner()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + offset)
        osc.detune.setValueAtTime(-4 + (offset % 3) * 4, now + offset)
        g.gain.setValueAtTime(0.0001, now + offset)
        g.gain.exponentialRampToValueAtTime(0.11, now + offset + 1.8)
        g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 7.6)
        pan.pan.setValueAtTime(Math.sin(offset) * 0.42, now + offset)
        osc.connect(g).connect(pan).connect(this.idleGain)
        osc.start(now + offset)
        osc.stop(now + offset + 7.9)
      }
      this.tone(1567.98, 2.4, 0.2, 'sine', 0.018, 1174.66)
      this.tone(987.77, 3.2, 6.6, 'sine', 0.016, 1318.51)
    }
    spawn()
    this.idleTimer = window.setInterval(spawn, 12_000)
  }

  stopIdleAmbience() {
    if (this.idleTimer) window.clearInterval(this.idleTimer)
    this.idleTimer = undefined
    if (!this.ctx || !this.idleGain) return
    const gain = this.idleGain
    gain.gain.cancelScheduledValues(this.ctx.currentTime)
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8)
    window.setTimeout(() => {
      for (const node of this.idleNodes) {
        try { node.disconnect() } catch { /* already disconnected */ }
      }
      this.idleNodes = []
      this.idleGain = null
    }, 900)
  }
}

export const sound = new SoundEngine()

/**
 * Делегированный обработчик: единый «тактильный» звук
 * для кнопок/ссылок/переключателей без ручной разметки.
 */
export function installSoundDelegate() {
  const onPointer = (e: Event) => {
    const el = (e.target as HTMLElement).closest(
      'button, a, [role="button"], input[type="checkbox"], select',
    )
    if (!el) return
    if (el.closest('[data-silent]')) return
    sound.play(el instanceof HTMLAnchorElement ? 'navigate' : 'tap')
  }
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement
    if (el.matches('input[type="text"], input[type="search"], input[type="number"], textarea')) {
      sound.play('type')
    }
  }
  document.addEventListener('pointerdown', onPointer, { passive: true })
  document.addEventListener('keydown', onKey, { passive: true })
}
