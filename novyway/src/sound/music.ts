export type MusicStatus = 'loading' | 'ready' | 'playing' | 'paused' | 'unavailable' | 'error'

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
  private listeners = new Set<Listener>()
  private _status: MusicStatus = 'loading'
  private _error: string | null = null
  private _localPreview = false
  volume = 0.65

  get status() { return this._status }
  get error() { return this._error }
  get localPreview() { return this._localPreview }
  get isPlaying() { return this._status === 'playing' }
  get currentTrack() { return this.tracks[this.trackIndex] ?? null }

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
      if (document.hidden && this.isPlaying) this.pause()
    })
    return this.players
  }

  private targetVolume() {
    return Math.max(0, Math.min(1, this.volume)) * 0.25
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value))
    if (!this.players) return
    this.players[this.active].volume = this.targetVolume()
  }

  async play() {
    if (!this.prepared) await this.prepare()
    if (this.tracks.length === 0) {
      this.emit('unavailable', 'music_public_license_required')
      return false
    }
    const players = this.ensurePlayers()
    const generation = ++this.playbackGeneration
    const current = players[this.active]
    if (!current.src) current.src = this.tracks[this.trackIndex].url
    current.volume = this.targetVolume()
    try {
      await current.play()
      if (generation !== this.playbackGeneration) { current.pause(); return false }
      this.emit('playing')
      return true
    } catch (error) {
      this.emit('error', error instanceof Error ? error.message : 'autoplay_blocked')
      return false
    }
  }

  pause() {
    this.playbackGeneration += 1
    this.crossfading = false
    if (!this.players) return
    for (const player of this.players) player.pause()
    this.emit('paused')
  }

  private handleProgress(player: HTMLAudioElement) {
    if (!this.players || player !== this.players[this.active] || !Number.isFinite(player.duration)) return
    const remaining = player.duration - player.currentTime
    if (remaining <= 25 && remaining > 6) this.prepareNext()
    if (remaining <= 6 && remaining > 0 && !this.crossfading) void this.crossfade()
  }

  private prepareNext() {
    if (!this.players || this.tracks.length < 2) return
    const next = this.players[1 - this.active]
    const nextIndex = (this.trackIndex + 1) % this.tracks.length
    if (!next.src.endsWith(this.tracks[nextIndex].url)) {
      next.src = this.tracks[nextIndex].url
      next.preload = 'auto'
      next.load()
    }
  }

  private async crossfade() {
    if (!this.players || this.tracks.length < 2) return
    this.crossfading = true
    const generation = this.playbackGeneration
    this.prepareNext()
    const current = this.players[this.active]
    const next = this.players[1 - this.active]
    next.volume = 0
    try {
      await next.play()
      const started = performance.now()
      const duration = 6_000
      const tick = () => {
        if (generation !== this.playbackGeneration) { this.crossfading = false; return }
        const progress = Math.min(1, (performance.now() - started) / duration)
        current.volume = Math.cos(progress * Math.PI / 2) * this.targetVolume()
        next.volume = Math.sin(progress * Math.PI / 2) * this.targetVolume()
        if (progress < 1) requestAnimationFrame(tick)
        else {
          current.pause()
          current.removeAttribute('src')
          current.load()
          this.active = 1 - this.active
          this.trackIndex = (this.trackIndex + 1) % this.tracks.length
          this.crossfading = false
          this.emit('playing')
        }
      }
      requestAnimationFrame(tick)
    } catch (error) {
      this.crossfading = false
      this.emit('error', error instanceof Error ? error.message : 'crossfade_failed')
    }
  }

  private advanceWithoutFade(player: HTMLAudioElement) {
    if (!this.players || player !== this.players[this.active] || this.crossfading) return
    this.trackIndex = (this.trackIndex + 1) % Math.max(1, this.tracks.length)
    player.src = this.tracks[this.trackIndex].url
    player.volume = this.targetVolume()
    void player.play().then(() => this.emit('playing')).catch(() => this.emit('paused'))
  }
}

export const music = new BackgroundMusic()
