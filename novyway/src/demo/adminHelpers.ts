// Вспомогательные реэкспорты для админ-панели
import { groupCounts } from './data'

export { exams, useDocuments, useStore } from './store'

/** Счётчики допущенных аккаунтов Nk категории (реестр допуска на момент cutoff) */
export function groupCountsOf(categoryId: string): [number, number, number, number] {
  return groupCounts[categoryId] ?? [0, 0, 0, 0]
}
