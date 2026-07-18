// ==========================================================
// Формула весов «Новый Путь» (PRODUCT_DESIGN_HANDOFF §3–§5)
//   S  = N0 / q0            — масштаб, привязанный к L0
//   Tk = S × qk             — целевой пул базовых голосов уровня k
//   wk = Tk / Nk (если Nk×fk ≤ Tk), иначе overload
// MVP defaults: snapshot отклоняется при N0=0, overload или weight>cap.
// ==========================================================

import type { Bps, CategoryPolicy, SnapshotGroup } from './types'

export interface SnapshotComputation {
  ok: boolean
  problems: { code: string; ru: string; en: string }[]
  scaleS: number
  groups: SnapshotGroup[]
  eligibleWeight: number
}

export function computeSnapshot(
  counts: [number, number, number, number],
  policy: Pick<CategoryPolicy, 'quotaBps' | 'floorWeights' | 'maxIndividualWeight'>,
): SnapshotComputation {
  const problems: SnapshotComputation['problems'] = []
  const q = policy.quotaBps.map((b) => b / 10_000)
  const f = policy.floorWeights

  const quotaSum = policy.quotaBps.reduce((a, b) => a + b, 0)
  if (quotaSum !== 10_000) {
    problems.push({
      code: 'QUOTA_SUM',
      ru: `Сумма квот должна быть ровно 100% (сейчас ${(quotaSum / 100).toFixed(2)}%)`,
      en: `Quota sum must be exactly 100% (now ${(quotaSum / 100).toFixed(2)}%)`,
    })
  }
  if (counts[0] === 0) {
    problems.push({
      code: 'N0_ZERO',
      ru: 'Нельзя открыть голосование без хотя бы одного допущенного аккаунта L0',
      en: 'Cannot open an election without at least one admitted L0 account',
    })
  }
  if (q[0] <= 0) {
    problems.push({
      code: 'Q0_ZERO',
      ru: 'Квота q0 должна быть больше нуля (якорь масштаба)',
      en: 'Quota q0 must be positive (scale anchor)',
    })
  }

  const S = counts[0] > 0 && q[0] > 0 ? counts[0] / q[0] : 0
  const groups: SnapshotGroup[] = [0, 1, 2, 3].map((k) => {
    const Nk = counts[k]
    const Tk = S * q[k]
    let wk = 0
    if (Nk > 0) {
      const Fk = Nk * f[k]
      if (Fk > Tk + 1e-9) {
        problems.push({
          code: `OVERLOAD_L${k}`,
          ru: `Перегрузка уровня L${k}: минимальные веса (${Fk.toFixed(1)}) превышают квоту (${Tk.toFixed(1)}). Снимок отклоняется (MVP default).`,
          en: `Level L${k} overload: floor weights (${Fk.toFixed(1)}) exceed quota target (${Tk.toFixed(1)}). Snapshot rejected (MVP default).`,
        })
        wk = f[k]
      } else {
        wk = Tk / Nk
      }
      if (wk > policy.maxIndividualWeight + 1e-9) {
        problems.push({
          code: `CAP_L${k}`,
          ru: `Вес аккаунта L${k} (${wk.toFixed(2)}) превышает cap категории (${policy.maxIndividualWeight}). Снимок отклоняется.`,
          en: `L${k} account weight (${wk.toFixed(2)}) exceeds category cap (${policy.maxIndividualWeight}). Snapshot rejected.`,
        })
      }
    }
    return {
      count: Nk,
      quotaBps: policy.quotaBps[k] as Bps,
      targetUnits: round2(Tk),
      perAccountWeight: round2(wk),
      floorWeight: f[k],
    }
  })

  const eligibleWeight = round2(groups.reduce((a, g) => a + g.count * g.perAccountWeight, 0))
  return { ok: problems.length === 0, problems, scaleS: round2(S), groups, eligibleWeight }
}

export function round2(x: number) {
  return Math.round(x * 100) / 100
}

export function fmtW(x: number) {
  return Number.isInteger(x) ? String(x) : x.toFixed(x * 10 % 1 === 0 ? 1 : 2)
}

export function bpsToPct(bps: Bps, digits = 0) {
  return (bps / 100).toFixed(digits) + '%'
}
