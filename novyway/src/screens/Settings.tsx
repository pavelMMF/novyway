import { useT } from '../i18n'
import { useSettings } from '../demo/store'
import { PageHead, Panel, Switch } from '../ui/components'
import { sound } from '../sound/engine'
import { music } from '../sound/music'
import { useMusic } from '../sound/useMusic'

export default function Settings() {
  const { t } = useT()
  const { s, update } = useSettings()
  const { status: musicStatus, starting: musicStarting, waiting: musicWaiting, setEnabled: setMusicEnabled } = useMusic()

  return (
    <>
      <PageHead title={t('se.title')} />
      <div className="grid c2">
        <Panel title={t('se.theme')}>
          <div className="seg">
            <button className={s.theme === 'light' ? 'on' : ''} onClick={() => update({ theme: 'light' })}>{t('se.light')}</button>
            <button className={s.theme === 'dark' ? 'on' : ''} onClick={() => update({ theme: 'dark' })}>{t('se.dark')}</button>
            <button className={s.theme === 'system' ? 'on' : ''} onClick={() => update({ theme: 'system' })}>{t('se.system')}</button>
          </div>
        </Panel>
        <Panel title={t('se.sound')} hint={t('se.soundHint')}>
          <div className="stack">
            <Switch
              checked={s.soundOn}
              onChange={(v) => { update({ soundOn: v }); if (v) setTimeout(() => sound.play('confirm'), 50) }}
              label={s.soundOn ? t('common.unmute') : t('common.mute')}
            />
            <label className="field" style={{ maxWidth: 260 }}>
              <span>{t('se.volume')} · {Math.round(s.volume * 100)}%</span>
              <input
                type="range" min={0} max={100} value={s.volume * 100}
                style={{ ['--fill' as string]: `${s.volume * 100}%` }}
                onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
                onPointerUp={() => sound.play('tap')}
              />
            </label>
            <div className="row" style={{ gap: 6 }}>
              {(['tap', 'navigate', 'sidebar', 'graphSelect', 'confirm', 'warning', 'receipt', 'voteSuccess'] as const).map((n) => (
                <button key={n} className="btn small" data-silent onClick={() => sound.play(n)}>
                  {s.lang === 'ru'
                    ? ({ tap: 'касание', navigate: 'переход', sidebar: 'боковая панель', graphSelect: 'выбор в графе', confirm: 'подтверждение', warning: 'предупреждение', receipt: 'квитанция', voteSuccess: 'голос принят' } as const)[n]
                    : ({ tap: 'tap', navigate: 'navigation', sidebar: 'sidebar', graphSelect: 'graph selection', confirm: 'confirmation', warning: 'warning', receipt: 'receipt', voteSuccess: 'vote accepted' } as const)[n]}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title={s.lang === 'ru' ? 'Фоновая музыка' : 'Background music'} hint={s.lang === 'ru' ? 'отдельно от звуков интерфейса' : 'separate from interface sounds'}>
          <div className="stack">
            <Switch
              checked={s.musicOn}
              onChange={(value) => void setMusicEnabled(value)}
              label={musicWaiting
                ? (s.lang === 'ru' ? 'Музыка включится после короткой паузы' : 'Music starts after a short pause')
                : musicStatus === 'playing'
                  ? (s.lang === 'ru' ? 'Музыка играет' : 'Music is playing')
                  : s.musicOn
                    ? (s.lang === 'ru' ? 'Музыка ждёт активную вкладку' : 'Music is waiting for this tab')
                    : musicStarting
                      ? (s.lang === 'ru' ? 'Запускаем музыку…' : 'Starting music…')
                      : (s.lang === 'ru' ? 'Включить музыку' : 'Enable music')}
            />
            <label className="field" style={{ maxWidth: 260 }}>
              <span>{s.lang === 'ru' ? 'Громкость музыки' : 'Music volume'} · {Math.round(s.musicVolume * 100)}%</span>
              <input type="range" min={0} max={100} value={s.musicVolume * 100} style={{ ['--fill' as string]: `${s.musicVolume * 100}%` }} onChange={(event) => update({ musicVolume: Number(event.target.value) / 100 })} />
            </label>
            {music.currentTrack && <div className="mono muted">{music.currentTrack.title}</div>}
            <div className="music-background-setting">
              <Switch checked={s.musicInBackground} onChange={(value) => update({ musicInBackground: value })} label={s.lang === 'ru' ? 'Продолжать в других вкладках' : 'Keep playing outside this tab'} />
              <p className="muted">{s.lang === 'ru' ? 'Если выключено, скрытая вкладка ставит музыку на паузу. После открытия сайта музыка всегда ждёт 30 секунд.' : 'When disabled, hiding this tab pauses the music. Music always waits 30 seconds after the site opens.'}</p>
            </div>
            {musicStatus === 'unavailable' && <div className="callout yellow">{s.lang === 'ru' ? 'Музыка недоступна в этом окружении.' : 'Music is unavailable in this environment.'}</div>}
            {musicStatus === 'error' && <div className="callout red">{music.error}</div>}
            {music.localPreview && <p className="muted">{s.lang === 'ru' ? 'Локальный предпросмотр: семь треков идут по порядку, загружается только текущий, переход длится 10 секунд.' : 'Local preview: seven tracks play in order, only the current track is streamed, with a ten-second crossfade.'}</p>}
          </div>
        </Panel>

        <Panel title={t('se.motion')} hint={t('se.motionHint')}>
          <Switch checked={s.reducedMotion} onChange={(v) => update({ reducedMotion: v })} label={t('se.motion')} />
        </Panel>

        <Panel title={t('se.lang')}>
          <div className="seg">
            <button className={s.lang === 'ru' ? 'on' : ''} onClick={() => update({ lang: 'ru' })}>{s.lang === 'ru' ? 'Русский' : 'Russian'}</button>
            <button className={s.lang === 'en' ? 'on' : ''} onClick={() => update({ lang: 'en' })}>{s.lang === 'ru' ? 'Английский' : 'English'}</button>
          </div>
        </Panel>

        <Panel title={t('se.dataLanguage')}>
          <div className="seg">
            <button className={s.dataLanguage === 'auto' ? 'on' : ''} onClick={() => update({ dataLanguage: 'auto' })}>{t('se.auto')}</button>
            <button className={s.dataLanguage === 'ru' ? 'on' : ''} onClick={() => update({ dataLanguage: 'ru' })}>{s.lang === 'ru' ? 'Русский' : 'Russian'}</button>
            <button className={s.dataLanguage === 'en' ? 'on' : ''} onClick={() => update({ dataLanguage: 'en' })}>{s.lang === 'ru' ? 'Английский' : 'English'}</button>
          </div>
        </Panel>

        <Panel title={t('se.defaultDocumentsView')}>
          <div className="seg">
            <button className={s.documentsView === 'list' ? 'on' : ''} onClick={() => update({ documentsView: 'list' })}>{t('gr.listView')}</button>
            <button className={s.documentsView === 'graph' ? 'on' : ''} onClick={() => update({ documentsView: 'graph' })}>{t('gr.3dView')}</button>
            <button className={s.documentsView === 'combined' ? 'on' : ''} onClick={() => update({ documentsView: 'combined' })}>{t('doc.combinedView')}</button>
          </div>
        </Panel>

        <Panel title={t('au.identityMode')} hint={t('au.identityHint')}>
          <Switch checked={s.identityMode} onChange={(v) => update({ identityMode: v })} label={t('se.identity')} />
        </Panel>

      </div>
    </>
  )
}
