import type { Exam, ExamAnswer, ExamItem } from './types'

export function isScoredItem(item: ExamItem): item is Exclude<ExamItem, { kind: 'scenario' }> {
  return item.kind !== 'scenario'
}

export function questionCount(exam: Exam) {
  return exam.items.filter(isScoredItem).length
}

export function isAnswered(item: ExamItem, answer: ExamAnswer | undefined) {
  if (!isScoredItem(item)) return true
  if (!answer || answer.kind !== item.kind) return false
  if (answer.kind === 'multiple_choice') return answer.choiceIds.length > 0
  if (answer.kind === 'numeric') return Number.isFinite(answer.value)
  return Boolean(answer.choiceId)
}

export function scoreExam(exam: Exam, answers: Record<string, ExamAnswer>) {
  let earned = 0
  let possible = 0
  const perQuestion: Record<string, boolean | 'unanswered' | 'unscored'> = {}

  exam.items.forEach((item) => {
    if (!isScoredItem(item)) {
      perQuestion[item.id] = 'unscored'
      return
    }
    const points = item.points ?? 1
    possible += points
    const answer = answers[item.id]
    if (!isAnswered(item, answer)) {
      perQuestion[item.id] = 'unanswered'
      return
    }

    let correct = false
    if (item.kind === 'single_choice' && answer?.kind === 'single_choice') {
      correct = answer.choiceId === item.correct
    } else if (item.kind === 'multiple_choice' && answer?.kind === 'multiple_choice') {
      const expected = [...new Set(item.correct)].sort()
      const actual = [...new Set(answer.choiceIds)].sort()
      correct = expected.length === actual.length && expected.every((value, index) => value === actual[index])
    } else if (item.kind === 'numeric' && answer?.kind === 'numeric') {
      correct = Math.abs(answer.value - item.answer) <= item.tolerance
    }
    if (correct) earned += points
    perQuestion[item.id] = correct
  })

  const scoreShare = possible > 0 ? earned / possible : 0
  return { earned, possible, scoreShare, passed: scoreShare >= exam.passShare, perQuestion }
}

export function parseLocalizedNumber(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return undefined
  const number = Number(normalized)
  return Number.isFinite(number) ? number : undefined
}
