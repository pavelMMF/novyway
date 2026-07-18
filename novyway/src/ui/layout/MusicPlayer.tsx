import { useSettings } from '../../demo/store'
import { useT } from '../../i18n'
import { useMusic } from '../../sound/useMusic'

// Компактный проигрыватель фоновой музыки в верхней панели.
// Управление синхронизировано с переключателем в «Настройках» через useMusic().
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const PlayIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
const PauseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" /><rect x="13.6" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" /></svg>
const NextIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" {...stroke} aria-hidden><path d="M6 5.5 15 12 6 18.5z" fill="currentColor" stroke="none" /><path d="M18 5.5v13" /></svg>
const MutedIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" {...stroke} aria-hidden><path d="M4 9.5h3l4-3.2v11.4l-4-3.2H4z" /><path d="m15 9.5 5 5M20 9.5l-5 5" /></svg>
const SoundIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" {...stroke} aria-hidden><path d="M4 9.5h3l4-3.2v11.4l-4-3.2H4z" /><path d="M15.5 8.5a4.5 4.5 0 0 1 0 7M18 6a8 8 0 0 1 0 12" /></svg>

export function MusicPlayer() {
  const { lang } = useT()
  const { s, update } = useSettings()
  const ru = lang === 'ru'
  const { status, enabled, playing, waiting, busy, starting, muted, currentTrack, toggle, next, toggleMute } = useMusic()

  // В окружении без прав на публичную музыку виджет не показываем.
  if (status === 'unavailable') return null

  const playLabel = busy
    ? (ru ? 'Запуск…' : 'Starting…')
    : waiting
      ? (ru ? 'Отменить отложенный запуск' : 'Cancel delayed start')
      : enabled
        ? (ru ? 'Остановить музыку' : 'Stop music')
        : (ru ? 'Включить музыку' : 'Play music')
  const title = enabled || starting
    ? (currentTrack?.title ?? (ru ? 'Музыка' : 'Music'))
    : (ru ? 'Музыка' : 'Music')
  const muteLabel = muted ? (ru ? 'Включить звук' : 'Unmute') : (ru ? 'Заглушить' : 'Mute')
  const volume = Math.round(s.musicVolume * 100)

  const setVolume = (value: number) => {
    update({ musicVolume: value / 100 })
    if (muted && value > 0) toggleMute()
  }

  return (
    <div className={`music-player ${playing ? 'is-playing' : ''} ${muted ? 'is-muted' : ''} ${starting ? 'is-starting' : ''}`} role="group" aria-label={ru ? 'Фоновая музыка' : 'Background music'}>
      <button
        type="button"
        className="music-btn music-play"
        data-silent
        onClick={toggle}
        disabled={busy}
        aria-pressed={enabled}
        aria-label={playLabel}
        title={playLabel}
      >
        {enabled ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="music-now" aria-hidden={!enabled}>
        <span className="music-eq" aria-hidden><i /><i /><i /><i /></span>
        <span className="music-title">{title}</span>
      </div>

      <button
        type="button"
        className="music-btn music-next"
        data-silent
        onClick={next}
        aria-label={ru ? 'Следующий трек' : 'Next track'}
        title={ru ? 'Следующий трек' : 'Next track'}
      >
        <NextIcon />
      </button>

      <div className="music-volume-control" data-silent>
        <div className="music-volume-popover">
          <span className="music-volume-value" aria-hidden>{volume}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            style={{ ['--fill' as string]: `${volume}%` }}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label={ru ? 'Громкость фоновой музыки' : 'Background music volume'}
          />
        </div>
        <button
          type="button"
          className="music-btn music-mute"
          data-silent
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muteLabel}
          title={muteLabel}
        >
          {muted ? <MutedIcon /> : <SoundIcon />}
        </button>
      </div>
    </div>
  )
}
