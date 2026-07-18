import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useT } from '../i18n'
import { ME, exams, nextTxHash, useStore } from '../demo/store'
import { CatChip, Lvl, PageHead, Panel } from '../ui/components'
import { isAnswered, isScoredItem, parseLocalizedNumber, questionCount, scoreExam } from '../domain/exams'
import { sound } from '../sound/engine'
import type { Exam, ExamAnswer, ExamAttempt, ExamItem } from '../domain/types'

export default function ExamDetail() {
  const { id } = useParams()
  const { t, l, lang } = useT()
  const { state, dispatch } = useStore()
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({})
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({})
  const [cursor, setCursor] = useState(0)
  const [reviewing, setReviewing] = useState(false)
  const [result, setResult] = useState<ExamAttempt | null>(null)
  const ru = lang === 'ru'

  const foundExam = exams.find((item) => item.id === id)
  if (!foundExam) return <div className="empty">{t('au.empty')}</div>
  const exam: Exam = foundExam
  const category = state.categories.find((item) => item.id === exam.categoryId)!
  const myQualification = state.qualifications
    .filter((item) => item.voter === ME && item.categoryId === exam.categoryId)
    .sort((a, b) => b.revision - a.revision)[0]
  const currentItem = exam.items[cursor]
  const scoredItems = exam.items.filter(isScoredItem)
  const answeredCount = scoredItems.filter((item) => isAnswered(item, answers[item.id])).length
  const allAnswered = answeredCount === scoredItems.length
  const progress = ((cursor + 1) / exam.items.length) * 100
  const score = result ? scoreExam(exam, answers) : null

  function setAnswer(questionId: string, answer: ExamAnswer | undefined) {
    setAnswers((current) => {
      if (!answer) {
        const next = { ...current }
        delete next[questionId]
        return next
      }
      return { ...current, [questionId]: answer }
    })
  }

  function continueFlow() {
    if (isScoredItem(currentItem) && !isAnswered(currentItem, answers[currentItem.id])) return
    if (cursor < exam.items.length - 1) setCursor((value) => value + 1)
    else setReviewing(true)
    sound.play('navigate')
  }

  function submit() {
    const scored = scoreExam(exam, answers)
    const attempt: ExamAttempt = {
      id: `at-${Date.now() % 100000}`,
      examId: exam.id, voter: ME, at: new Date().toISOString(),
      scoreShare: scored.scoreShare,
      status: scored.passed ? 'passed_pending_admin' : 'failed',
      evidenceHash: nextTxHash(),
    }
    dispatch({ type: 'EXAM_ATTEMPT', attempt })
    setResult(attempt)
    setReviewing(false)
    sound.play(scored.passed ? 'receipt' : 'warning')
  }

  return (
    <>
      <PageHead
        title={l(exam.title)}
        sub={<span className="row" style={{ gap: 8 }}><CatChip cat={category} /><span className="row" style={{ gap: 4 }}>{t('xm.currentLevel')}: {myQualification ? <Lvl level={myQualification.level} /> : '—'}<span className="muted">→ {t('xm.target').toLowerCase()}:</span><Lvl level={exam.targetLevel} /></span></span>}
      />

      <div className="exam-layout">
        <main>
          {result && score ? (
            <ExamResult exam={exam} result={result} answers={answers} />
          ) : reviewing ? (
            <ExamReview exam={exam} answers={answers} onBack={() => setReviewing(false)} onJump={(index) => { setCursor(index); setReviewing(false) }} onSubmit={submit} allAnswered={allAnswered} />
          ) : (
            <Panel className="exam-stage">
              <div className="exam-progress-head row between">
                <span className="mono">{ru ? 'Экран' : 'Screen'} {cursor + 1} / {exam.items.length}</span>
                <span className="muted">{ru ? 'Отвечено' : 'Answered'} {answeredCount} / {scoredItems.length}</span>
              </div>
              <div className="exam-progress-track"><span style={{ width: `${progress}%` }} /></div>
              <QuestionScreen item={currentItem} answer={answers[currentItem.id]} numericDraft={numericDrafts[currentItem.id] ?? ''} onAnswer={(answer) => setAnswer(currentItem.id, answer)} onNumericDraft={(value) => {
                setNumericDrafts((current) => ({ ...current, [currentItem.id]: value }))
                const parsed = parseLocalizedNumber(value)
                setAnswer(currentItem.id, parsed === undefined ? undefined : { kind: 'numeric', value: parsed })
              }} />
              <div className="exam-actions row between">
                <button className="btn" disabled={cursor === 0} onClick={() => { setCursor((value) => Math.max(0, value - 1)); sound.play('navigate') }}>← {t('common.back')}</button>
                <button className="btn primary" disabled={isScoredItem(currentItem) && !isAnswered(currentItem, answers[currentItem.id])} onClick={continueFlow}>{cursor === exam.items.length - 1 ? (ru ? 'К проверке' : 'Review answers') : (ru ? 'Продолжить' : 'Continue')} →</button>
              </div>
            </Panel>
          )}
        </main>

        <aside className="exam-sidebar">
          <Panel title={ru ? 'Параметры экзамена' : 'Exam parameters'} tight>
            <div className="stack">
              <div className="kv"><span className="k">{t('xm.q')}</span><span className="v mono">{questionCount(exam)}</span></div>
              <div className="kv"><span className="k">{t('xm.minutes')}</span><span className="v mono">{exam.minutes}</span></div>
              <div className="kv"><span className="k">{t('xm.pass')}</span><span className="v mono">{Math.round(exam.passShare * 100)}%</span></div>
              <div className="kv"><span className="k">{ru ? 'версия' : 'version'}</span><span className="v mono">{exam.version}</span></div>
            </div>
          </Panel>
          <Panel title={ru ? 'Основа вопросов' : 'Question sources'} tight>
            <div className="stack">
              {exam.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="exam-source">{l(source.label)} ↗</a>)}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  )
}

function QuestionScreen({ item, answer, numericDraft, onAnswer, onNumericDraft }: {
  item: ExamItem
  answer?: ExamAnswer
  numericDraft: string
  onAnswer: (answer: ExamAnswer) => void
  onNumericDraft: (value: string) => void
}) {
  const { l, lang } = useT()
  const ru = lang === 'ru'

  if (item.kind === 'scenario') {
    return <div className="exam-scenario"><div className="mono exam-kind">{ru ? 'СИТУАЦИЯ / УСЛОВИЯ' : 'CASE / CONTEXT'}</div><h2>{l(item.prompt)}</h2><p>{ru ? 'Следующие десять вопросов проверяют применение принципов, а не запоминание формулировок.' : 'The next ten questions test application of principles, not memorization.'}</p></div>
  }

  return (
    <fieldset className="exam-question">
      <legend><span className="mono exam-kind">{item.kind === 'single_choice' ? (ru ? 'ОДИН ОТВЕТ' : 'ONE ANSWER') : item.kind === 'multiple_choice' ? (ru ? 'НЕСКОЛЬКО ОТВЕТОВ' : 'MULTIPLE ANSWERS') : (ru ? 'ЧИСЛОВОЙ ОТВЕТ' : 'NUMERIC')}</span><h2>{l(item.prompt)}</h2></legend>
      {item.kind === 'single_choice' && <div className="exam-options">{item.options.map((option, index) => {
        const checked = answer?.kind === 'single_choice' && answer.choiceId === option.id
        return <label key={option.id} className={`exam-option ${checked ? 'selected' : ''}`}><input type="radio" name={item.id} checked={checked} onChange={() => { onAnswer({ kind: 'single_choice', choiceId: option.id }); sound.play('tap') }} /><span className="mono option-index">{String(index + 1).padStart(2, '0')}</span><span>{l(option.label)}</span></label>
      })}</div>}
      {item.kind === 'multiple_choice' && <><p className="muted exam-hint">{ru ? 'Выберите все подходящие варианты.' : 'Select every option that applies.'}</p><div className="exam-options">{item.options.map((option, index) => {
        const selected = answer?.kind === 'multiple_choice' ? answer.choiceIds : []
        const checked = selected.includes(option.id)
        return <label key={option.id} className={`exam-option ${checked ? 'selected' : ''}`}><input type="checkbox" checked={checked} onChange={() => { onAnswer({ kind: 'multiple_choice', choiceIds: checked ? selected.filter((id) => id !== option.id) : [...selected, option.id] }); sound.play('tap') }} /><span className="mono option-index">{String(index + 1).padStart(2, '0')}</span><span>{l(option.label)}</span></label>
      })}</div></>}
      {item.kind === 'numeric' && <div className="numeric-answer"><label className="field"><span>{ru ? 'Числовой ответ' : 'Numeric answer'}</span><div className="numeric-input-wrap"><input type="text" inputMode="decimal" value={numericDraft} onChange={(event) => onNumericDraft(event.target.value)} autoFocus /><span>{item.unit ? l(item.unit) : ''}</span></div><small>{ru ? 'Можно использовать точку или запятую.' : 'A dot or comma decimal separator is accepted.'}</small></label></div>}
    </fieldset>
  )
}

function ExamReview({ exam, answers, onBack, onJump, onSubmit, allAnswered }: {
  exam: Exam
  answers: Record<string, ExamAnswer>
  onBack: () => void
  onJump: (index: number) => void
  onSubmit: () => void
  allAnswered: boolean
}) {
  const { l, lang } = useT()
  const ru = lang === 'ru'
  return <Panel title={ru ? 'Проверка ответов' : 'Review answers'} hint={`${Object.keys(answers).length}/${questionCount(exam)}`}><div className="review-list">{exam.items.map((item, index) => {
    if (!isScoredItem(item)) return null
    const answered = isAnswered(item, answers[item.id])
    return <button key={item.id} className={`review-row ${answered ? 'answered' : 'missing'}`} onClick={() => onJump(index)}><span className="mono">{String(index).padStart(2, '0')}</span><span>{l(item.prompt)}</span><strong>{answered ? '✓' : '!'}</strong></button>
  })}</div><div className="exam-actions row between"><button className="btn" onClick={onBack}>← {ru ? 'Назад к вопросам' : 'Back to questions'}</button><button className="btn primary" disabled={!allAnswered} onClick={onSubmit}>{ru ? 'Завершить экзамен' : 'Submit exam'}</button></div></Panel>
}

function ExamResult({ exam, result, answers }: { exam: Exam; result: ExamAttempt; answers: Record<string, ExamAnswer> }) {
  const { t, l, lang } = useT()
  const ru = lang === 'ru'
  const score = scoreExam(exam, answers)
  return <Panel title={t('xm.yourScore')}><div className="result-hero"><strong>{Math.round(result.scoreShare * 100)}%</strong><span>{score.earned} / {score.possible}</span></div>{result.status === 'failed' ? <div className="callout red">{t('xm.failed')}</div> : <><div className="callout lime">{t('xm.passed')}</div><div className="mono muted result-hash">exam v{exam.version} · evidence {result.evidenceHash}</div><div className="callout yellow">{t('xm.pendingNote')}</div></>}<div className="result-breakdown">{exam.items.filter(isScoredItem).map((item, index) => <div key={item.id} className={score.perQuestion[item.id] === true ? 'correct' : 'wrong'}><span className="mono">{String(index + 1).padStart(2, '0')}</span><span>{l(item.prompt)}</span><strong>{score.perQuestion[item.id] === true ? '✓' : '×'}</strong>{item.explanation && <small>{l(item.explanation)}</small>}</div>)}</div><div className="row"><Link className="btn" to="/exams">← {t('xm.title')}</Link><span className="muted">{ru ? 'Ответы связаны с версией экзамена в evidence.' : 'Answers are tied to the exam version in evidence.'}</span></div></Panel>
}
