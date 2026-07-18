import { useCallback, useEffect, useReducer, useState } from 'react'
import { useSettings } from '../demo/store'
import { sound } from './engine'
import { music } from './music'

/**
 * Shared background-music controller. Both the Settings panel and the topbar
 * player mount this hook, so toggling in one place is reflected in the other:
 * the on/off intent lives in settings (`musicOn`), while the transport state
 * (playing, muted, current track) comes straight from the single music engine.
 */
export function useMusic() {
  const { s, update } = useSettings()
  const [, force] = useReducer((x) => x + 1, 0)
  const [busy, setBusy] = useState(false)

  // Re-render whenever the engine changes status / track / mute.
  useEffect(() => music.subscribe(force), [])

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (busy) return
    update({ musicOn: enabled })
    if (!enabled) {
      music.pause()
      return
    }
    sound.stopIdleAmbience()
    setBusy(true)
    const started = await music.play()
    setBusy(false)
    if (!started) update({ musicOn: false })
  }, [busy, update])

  const playing = s.musicOn && music.status === 'playing'
  const enabled = s.musicOn
  const waiting = s.musicOn && music.status === 'waiting'
  const toggle = useCallback(() => { void setEnabled(!enabled) }, [enabled, setEnabled])
  const next = useCallback(() => { void music.skipNext() }, [])
  const toggleMute = useCallback(() => music.toggleMute(), [])

  return {
    status: music.status,
    playing,
    enabled,
    waiting,
    busy,
    starting: busy || waiting,
    muted: music.muted,
    currentTrack: music.currentTrack,
    trackCount: music.trackCount,
    error: music.error,
    localPreview: music.localPreview,
    /** Music can actually be produced in this environment. */
    available: music.status !== 'unavailable' && music.status !== 'error',
    setEnabled,
    toggle,
    next,
    toggleMute,
  }
}
