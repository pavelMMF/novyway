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
  const [starting, setStarting] = useState(false)

  // Re-render whenever the engine changes status / track / mute.
  useEffect(() => music.subscribe(force), [])

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (starting) return
    update({ musicOn: enabled })
    if (!enabled) {
      music.pause()
      return
    }
    sound.stopIdleAmbience()
    setStarting(true)
    const started = await music.play()
    setStarting(false)
    if (!started) update({ musicOn: false })
  }, [starting, update])

  const playing = s.musicOn && music.status === 'playing'
  const toggle = useCallback(() => { void setEnabled(!playing) }, [playing, setEnabled])
  const next = useCallback(() => { void music.skipNext() }, [])
  const toggleMute = useCallback(() => music.toggleMute(), [])

  return {
    status: music.status,
    playing,
    starting,
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
