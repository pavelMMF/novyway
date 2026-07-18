import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccountSession } from '../../auth/session'
import { useT } from '../../i18n'
import { sound } from '../../sound/engine'

type GameProfile = {
  score: number
  answeredCount: number
  correctCount: number
  currentStreak: number
  bestStreak: number
}

type LogicChallenge = {
  id: string
  category: string
  categoryLabel: string
  difficulty: 1 | 2 | 3
  segments: string[]
}

type Feedback = {
  correct: boolean
  correctIndex: number
  points: number
  explanation: string
  recorded: boolean
}

const emptyProfile: GameProfile = { score: 0, answeredCount: 0, correctCount: 0, currentStreak: 0, bestStreak: 0 }

function gameError(code: string, ru: boolean) {
  const messages: Record<string, [string, string]> = {
    logic_round_invalid_or_expired: ['Время ответа истекло. Откройте следующий пример.', 'This round expired. Open the next example.'],
    logic_round_session_mismatch: ['Аккаунт изменился во время игры. Загрузите новый пример.', 'The account changed during the round. Load a new example.'],
    invalid_csrf: ['Сессия обновилась. Закройте игру, войдите снова и продолжите.', 'The session changed. Close the game, sign in again, and continue.'],
    too_many_requests: ['Слишком быстрый темп. Сделайте короткую паузу.', 'Too many requests. Take a short break.'],
  }
  return messages[code]?.[ru ? 0 : 1] ?? (ru ? 'Не удалось загрузить игру. Попробуйте ещё раз.' : 'The game could not be loaded. Try again.')
}

export function SignalCircuit() {
  const { lang } = useT()
  const ru = lang === 'ru'
  const { user } = useAccountSession()
  const [profile, setProfile] = useState<GameProfile>(emptyProfile)
  const [guestScore, setGuestScore] = useState(0)
  const [guestAnswered, setGuestAnswered] = useState(0)
  const [total, setTotal] = useState(150)
  const [roundToken, setRoundToken] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<LogicChallenge | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [loading, setLoading] = useState(true)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRound = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelected(null)
    setFeedback(null)
    try {
      const response = await fetch('/api/logic-game/round', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.csrfToken ? { 'X-CSRF-Token': user.csrfToken } : {}),
        },
        body: JSON.stringify({ lang }),
      })
      const body = await response.json() as {
        complete?: boolean
        roundToken?: string
        challenge?: LogicChallenge
        profile?: GameProfile
        totalChallenges?: number
        error?: string
      }
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
      setTotal(body.totalChallenges ?? 150)
      if (body.profile) setProfile(body.profile)
      setComplete(Boolean(body.complete))
      setRoundToken(body.roundToken ?? null)
      setChallenge(body.challenge ?? null)
    } catch (cause) {
      setError(gameError(cause instanceof Error ? cause.message : 'logic_game_unavailable', ru))
    } finally {
      setLoading(false)
    }
  }, [lang, ru, user?.csrfToken])

  useEffect(() => {
    setProfile(emptyProfile)
    setGuestScore(0)
    setGuestAnswered(0)
    void loadRound()
  }, [loadRound, user?.id])

  async function submitAnswer() {
    if (selected === null || !roundToken || feedback || loading) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/logic-game/answer', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.csrfToken ? { 'X-CSRF-Token': user.csrfToken } : {}),
        },
        body: JSON.stringify({ roundToken, selectedIndex: selected }),
      })
      const body = await response.json() as Feedback & { profile?: GameProfile; totalChallenges?: number; error?: string }
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
      setFeedback(body)
      if (body.profile && user) setProfile(body.profile)
      if (!user) {
        setGuestScore((value) => value + body.points)
        setGuestAnswered((value) => value + 1)
      }
      if (body.totalChallenges) setTotal(body.totalChallenges)
      sound.play(body.correct ? 'receipt' : 'warning')
    } catch (cause) {
      setError(gameError(cause instanceof Error ? cause.message : 'logic_game_unavailable', ru))
      sound.play('warning')
    } finally {
      setLoading(false)
    }
  }

  const score = user ? profile.score : guestScore
  const answered = user ? profile.answeredCount : guestAnswered
  const correctCount = user ? profile.correctCount : 0

  return <div className="logic-game">
    <div className="logic-game__head">
      <div>
        <div className="mono logic-game__kicker">{ru ? 'ЛАБОРАТОРИЯ АРГУМЕНТОВ' : 'ARGUMENT LAB'} · {String(answered + 1).padStart(3, '0')}</div>
        <h2>{ru ? 'Найдите разрыв в рассуждении' : 'Find the break in the reasoning'}</h2>
        <p className="muted">{ru ? 'Выберите фрагмент, где вывод перестаёт следовать из оснований.' : 'Choose the fragment where the conclusion stops following from the reasons.'}</p>
      </div>
      <div className="logic-game__metrics" aria-label={ru ? 'Результат игры' : 'Game result'}>
        <span><small>{ru ? 'очки' : 'score'}</small><strong>{score}</strong></span>
        <span><small>{ru ? 'решено' : 'solved'}</small><strong>{answered}/{total}</strong></span>
      </div>
    </div>

    {!user && <div className="logic-game__notice">
      <span>{ru ? 'Гостевой режим: результат действует до закрытия страницы.' : 'Guest mode: progress lasts until this page is closed.'}</span>
      <Link to="/auth?returnTo=%2F">{ru ? 'Войти и сохранять очки' : 'Sign in to save score'}</Link>
    </div>}

    {loading && !challenge && <div className="empty" role="status">{ru ? 'Подбираем пример…' : 'Preparing an example…'}</div>}

    {complete && <div className="logic-game__complete" role="status">
      <strong>{ru ? 'Все 150 примеров разобраны' : 'All 150 examples completed'}</strong>
      <p>{ru ? `Итог: ${profile.score} очков, верных ответов ${profile.correctCount} из ${profile.answeredCount}.` : `Final score: ${profile.score}; ${profile.correctCount} correct out of ${profile.answeredCount}.`}</p>
    </div>}

    {challenge && !complete && <>
      <div className="logic-game__meta">
        <span>{challenge.categoryLabel}</span>
        <span>{ru ? 'сложность' : 'difficulty'} {'◆'.repeat(challenge.difficulty)}{'◇'.repeat(3 - challenge.difficulty)}</span>
      </div>
      <div className="logic-game__segments" role="group" aria-label={ru ? 'Фрагменты рассуждения' : 'Reasoning fragments'}>
        {challenge.segments.map((segment, index) => {
          const chosen = selected === index
          const isCorrect = Boolean(feedback && feedback.correctIndex === index)
          const isWrong = Boolean(feedback && chosen && !feedback.correct)
          return <button
            key={`${challenge.id}-${index}`}
            type="button"
            className={`logic-segment ${chosen ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
            aria-pressed={chosen}
            disabled={Boolean(feedback) || loading}
            onClick={() => { setSelected(index); sound.play('tap') }}
          >
            <span className="mono">{String(index + 1).padStart(2, '0')}</span>
            <span>{segment}</span>
          </button>
        })}
      </div>

      {feedback && <div className={`logic-game__feedback ${feedback.correct ? 'correct' : 'wrong'}`} role="status" aria-live="polite">
        <strong>{feedback.correct
          ? (ru ? `Точно. +${feedback.points} очков` : `Correct. +${feedback.points} points`)
          : (ru ? 'Не здесь. Ошибочный переход подсвечен.' : 'Not here. The flawed step is highlighted.')}</strong>
        <p>{feedback.explanation}</p>
        {user && !feedback.recorded && <small>{ru ? 'Этот пример уже учитывался; повторные очки не начислены.' : 'This example was already recorded; no duplicate points were awarded.'}</small>}
      </div>}

      <div className="logic-game__footer">
        <div className="muted" aria-live="polite">
          {user
            ? (ru ? `Верно: ${correctCount} · серия: ${profile.currentStreak} · лучшая: ${profile.bestStreak}` : `Correct: ${correctCount} · streak: ${profile.currentStreak} · best: ${profile.bestStreak}`)
            : (ru ? 'Очки гостя не влияют на квалификации и вес голоса.' : 'Guest points do not affect qualifications or voting weight.')}
        </div>
        {!feedback
          ? <button className="btn primary" disabled={selected === null || loading} onClick={() => void submitAnswer()}>{loading ? (ru ? 'Проверяем…' : 'Checking…') : (ru ? 'Проверить' : 'Check')}</button>
          : <button className="btn primary" disabled={loading} onClick={() => void loadRound()}>{ru ? 'Следующий пример' : 'Next example'}</button>}
      </div>
    </>}

    {error && <div className="callout red logic-game__error" role="alert">
      <span>{error}</span>
      <button className="btn small" onClick={() => void loadRound()}>{ru ? 'Повторить' : 'Retry'}</button>
    </div>}
  </div>
}
