export type MusicStatus = 'loading' | 'ready' | 'waiting' | 'playing' | 'paused' | 'unavailable' | 'error'

export const MUSIC_INITIAL_DELAY_MS = 30_000
export const MUSIC_FADE_MS = 10_000

type MusicTrack = { id: number; title: string; url: string }
type PlaylistResponse = { enabled: boolean; localPreview: boolean; tracks: MusicTrack[]; legalNotice: string | null }
type Listener = () => void

class BackgroundMusic {
  private tracks: MusicTrack[] = []
  private players: [HTMLAudioElement, HTMLAudioElement] | null = null
  private active = 0
  private trackIndex = 0
  private crossfading = false
  private prepared = false
  private preparePromise: Promise<void> | null = null
  private playbackGeneration = 0
  private transitionTimer: number | null = null
  private delayedPlayTimer: number | null = null
  private requestedPlayback = false
  private backgroundPlayback = false
  private envelopes: [number, number] = [0, 0]
  private readonly initialPlaybackAt = Date.now() + MUSIC_INITIAL_DELAY_MS
  private listeners = new Set<Listener>()
  private _status: MusicStatus = 'loading'
  private _error: string | null = null
  private _localPreview = false
  private _muted = false
  volume = 0.59

  get status() { return this._status }
  get error() { return this._error }
  get localPreview() { return this._localPreview }
  get isPlaying() { return this._status === 'playing' }
  get muted() { return this._muted }
  get trackCount() { return this.tracks.length }
  get currentTrack() { return this.tracks[this.trackIndex] ?? null }

  get enabledIntent() { return this.requestedPlayback }
  get playsInBackground() { return this.backgroundPlayback }
  get initialDelayRemaining() { return Math.max(0, this.initialPlaybackAt - Date.now()) }
  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private emit(status?: MusicStatus, error: string | null = null) {
    if (status) this._status = status
    this._error = error
    for (const listener of this.listeners) listener()
  }

  async prepare() {
    if (this.prepared) return
    if (this.preparePromise) return this.preparePromise
    this.emit('loading')
    this.preparePromise = (async () => {
      try {
        const response = await fetch('/api/music/playlist', { cache: 'no-store' })
        if (!response.ok) throw new Error(`playlist_http_${response.status}`)
        const body = await response.json() as PlaylistResponse
        this.tracks = body.tracks
        this._localPreview = body.localPreview
        this.prepared = true
        this.emit(body.enabled && body.tracks.length > 0 ? 'ready' : 'unavailable')
      } catch (error) {
        this.emit('error', error instanceof Error ? error.message : 'playlist_unavailable')
      } finally {
        this.preparePromise = null
      }
    })()
    return this.preparePromise
  }

  private ensurePlayers() {
    if (this.players) return this.players
    const first = new Audio()
    const second = new Audio()
    for (const player of [first, second]) {
      player.preload = 'none'
      player.setAttribute('playsinline', '')
      player.addEventListener('timeupdate', () => this.handleProgress(player))
      player.addEventListener('ended', () => this.advanceWithoutFade(player))
      player.addEventListener('error', () => this.emit('error', 'music_stream_failed'))
    }
    this.players = [first, second]
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.backgroundPlayback && this.requestedPlayback) {
        this.suspendPlayback()
      } else if (!document.hidden && this.requestedPlayback && !this.isPlaying) {
        void this.play()
      }
    })
    return this.players
  }

  private targetVolume() {
    if (this._muted) return 0
    // Background music stays deliberately quieter than interface sounds.
    return Math.max(0, Math.min(1, this.volume)) * 0.25
  }

  private applyVolumes() {
    if (!this.players) return
    const target = this.targetVolume()
    this.players[0].volume = target * this.envelopes[0]
    this.players[1].volume = target * this.envelopes[1]
  }

  private clearTransition() {
    if (this.transitionTimer === null) return
    window.clearInterval(this.transitionTimer)
    this.transitionTimer = null
  }

  private clearDelayedPlay() {
    if (this.delayedPlayTimer === null) return
    window.clearTimeout(this.delayedPlayTimer)
    this.delayedPlayTimer = null
  }

  private scheduleDelayedPlay(delay: number) {
    this.clearDelayedPlay()
    this.delayedPlayTimer = window.setTimeout(() => {
      this.delayedPlayTimer = null
      if (this.requestedPlayback) void this.play()
    }, delay)
  }

  private fadeInActive(generation: number) {
    if (!this.players) return
    this.clearTransition()
    const active = this.active
    this.envelopes[active] = 0
    this.applyVolumes()
    const started = performance.now()
    const tick = () => {
      if (generation !== this.playbackGeneration || !this.players || active !== this.active) {
        this.clearTransition()
        return
      }
      const progress = Math.min(1, (performance.now() - started) / MUSIC_FADE_MS)
      this.envelopes[active] = Math.sin(progress * Math.PI / 2)
      this.applyVolumes()
      if (progress >= 1) this.clearTransition()
    }
    tick()
    this.transitionTimer = window.setInterval(tick, 100)
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value))
    this.applyVolumes()
  }

  setMuted(value: boolean) {
    if (this._muted === value) return
    this._muted = value
    this.applyVolumes()
    this.emit()
  }

  toggleMute() {
    this.setMuted(!this._muted)
    return this._muted
  }

  setBackgroundPlayback(value: boolean) {
    if (this.backgroundPlayback === value) return
    this.backgroundPlayback = value
    if (document.hidden && !value && this.requestedPlayback) {
      this.fadeOutAndSuspend()
    } else if (this.requestedPlayback && !this.isPlaying) {
      void this.play()
    }
    this.emit()
  }

  /** Immediately jump to the next track with a short fade, without waiting for the crossfade window. */
  async skipNext() {
    if (!this.prepared) await this.prepare()
    if (this.tracks.length === 0) return false
    this.trackIndex = (this.trackIndex + 1) % this.tracks.length
    if (!this.requestedPlayback) {
      this.emit()
      return true
    }
    const delay = this.initialDelayRemaining
    if (delay > 0) {
      this.scheduleDelayedPlay(delay)
      this.emit('waiting')
      return true
    }
    if (document.hidden && !this.backgroundPlayback) {
      this.emit('paused')
      return true
    }
    const players = this.ensurePlayers()
    this.clearTransition()
    this.crossfading = false
    const generation = ++this.playbackGeneration
    const current = players[this.active]
    const nextIndex = 1 - this.active
    const next = players[nextIndex]
    next.src = this.tracks[this.trackIndex].url
    next.preload = 'auto'
    this.envelopes[nextIndex] = 0
    this.applyVolumes()
    try {
      await next.play()
      if (generation !== this.playbackGeneration) { next.pause(); return false }
      current.pause()
      current.removeAttribute('src')
      current.load()
      this.envelopes[this.active] = 0
      this.active = nextIndex
      this.applyVolumes()
      this.emit('playing')
      this.fadeInActive(generation)
      return true
    } catch (error) {
      this.emit('error', error instanceof Error ? error.message : 'skip_failed')
      return false
    }
  }

  async play() {
    this.requestedPlayback = true
    if (!this.prepared) await this.prepare()
    if (this.tracks.length === 0) {
      this.emit('unavailable', 'music_public_license_required')
      return false
    }
    const players = this.ensurePlayers()
    if (this.isPlaying) return true
    if (document.hidden && !this.backgroundPlayback) {
      this.emit('paused')
      return true
    }
    const delay = this.initialDelayRemaining
    if (delay > 0) {
      this.scheduleDelayedPlay(delay)
      this.emit('waiting')
      return true
    }
    this.clearDelayedPlay()
    const generation = ++this.playbackGeneration
    const current = players[this.active]
    if (!current.src) current.src = this.tracks[this.trackIndex].url
    this.envelopes[this.active] = 0
    this.applyVolumes()
    try {
      await current.play()
      if (generation !== this.playbackGeneration) { current.pause(); return false }
      this.emit('playing')
      this.fadeInActive(generation)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'autoplay_blocked'
      const blocked = error instanceof DOMException
        ? error.name === 'NotAllowedError'
        : /autoplay|notallowed/i.test(message)
      this.emit(blocked ? 'paused' : 'error', message)
      return blocked
    }
  }

  pause() {
    this.requestedPlayback = false
    this.clearDelayedPlay()
    if (this.isPlaying) {
      this.fadeOutAndSuspend()
      return
    }
    this.suspendPlayback()
  }

  private fadeOutAndSuspend() {
    if (!this.players || !this.isPlaying) {
      this.suspendPlayback()
      return
    }
    const players = this.players
    const generation = ++this.playbackGeneration
    this.crossfading = false
    this.clearTransition()
    const starts: [number, number] = [this.envelopes[0], this.envelopes[1]]
    const started = performance.now()
    this.emit('paused')
    const tick = () => {
      if (generation !== this.playbackGeneration || this.players !== players) {
        this.clearTransition()
        return
      }
      const progress = Math.min(1, (performance.now() - started) / MUSIC_FADE_MS)
      const envelope = Math.cos(progress * Math.PI / 2)
      this.envelopes = [starts[0] * envelope, starts[1] * envelope]
      this.applyVolumes()
      if (progress >= 1) {
        this.clearTransition()
        for (const player of players) player.pause()
        this.envelopes = [0, 0]
        this.applyVolumes()
      }
    }
    tick()
    this.transitionTimer = window.setInterval(tick, 100)
  }

  private suspendPlayback() {
    this.playbackGeneration += 1
    this.crossfading = false
    this.clearTransition()
    if (!this.players) return
    for (const player of this.players) player.pause()
    this.envelopes = [0, 0]
    this.applyVolumes()
    this.emit('paused')
  }

  private handleProgress(player: HTMLAudioElement) {
    if (!this.players || player !== this.players[this.active] || !Number.isFinite(player.duration)) return
    const remaining = player.duration - player.currentTime
    if (remaining <= 35 && remaining > MUSIC_FADE_MS) this.prepareNext()
    if (remaining <= MUSIC_FADE_MS && remaining > 0 && !this.crossfading) void this.crossfade()
  }

  private prepareNext() {
    if (!this.players || this.tracks.length < 2) return
    const next = this.players[1 - this.active]
    const nextIndex = (this.trackIndex + 1) % this.tracks.length
    if (!next.src.endsWith(this.tracks[nextIndex].url)) {
      next.src = this.tracks[nextIndex].url
      next.preload = 'auto'
      this.envelopes[1 - this.active] = 0
      next.load()
    }
  }

  private async crossfade() {
    if (!this.players || this.tracks.length < 2) return
    this.clearTransition()
    this.crossfading = true
    const generation = this.playbackGeneration
    this.prepareNext()
    const next = this.players[1 - this.active]
    this.envelopes[this.active] = 1
    this.envelopes[1 - this.active] = 0
    this.applyVolumes()
    try {
      await next.play()
      const started = performance.now()
      const tick = () => {
        if (generation !== this.playbackGeneration) {
          this.crossfading = false
          this.clearTransition()
          return
        }
        const progress = Math.min(1, (performance.now() - started) / MUSIC_FADE_MS)
        this.envelopes[this.active] = Math.cos(progress * Math.PI / 2)
        this.envelopes[1 - this.active] = Math.sin(progress * Math.PI / 2)
        this.applyVolumes()
        if (progress >= 1) this.finishCrossfade(generation)
      }
      tick()
      this.transitionTimer = window.setInterval(tick, 100)
    } catch (error) {
      this.crossfading = false
      this.clearTransition()
      this.emit('error', error instanceof Error ? error.message : 'crossfade_failed')
    }
  }

  private finishCrossfade(generation: number) {
    if (!this.players || generation !== this.playbackGeneration || !this.crossfading) return
    this.clearTransition()
    const currentIndex = this.active
    const nextIndex = 1 - currentIndex
    const current = this.players[currentIndex]
    current.pause()
    current.removeAttribute('src')
    current.load()
    this.envelopes[currentIndex] = 0
    this.envelopes[nextIndex] = 1
    this.active = nextIndex
    this.trackIndex = (this.trackIndex + 1) % this.tracks.length
    this.crossfading = false
    this.applyVolumes()
    this.emit('playing')
  }

  private advanceWithoutFade(player: HTMLAudioElement) {
    if (!this.players || player !== this.players[this.active]) return
    if (this.crossfading) {
      this.finishCrossfade(this.playbackGeneration)
      return
    }
    this.trackIndex = (this.trackIndex + 1) % Math.max(1, this.tracks.length)
    player.src = this.tracks[this.trackIndex].url
    this.envelopes[this.active] = 0
    this.applyVolumes()
    const generation = this.playbackGeneration
    void player.play()
      .then(() => {
        this.emit('playing')
        this.fadeInActive(generation)
      })
      .catch(() => this.emit('paused'))
  }
}

export const music = new BackgroundMusic()
