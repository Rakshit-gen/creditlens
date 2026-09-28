export type Holdout = { risk: number[]; defaulted: number[]; sex: string[]; age: number[]; exposure: number[] }

export type Economics = { lossGivenDefault: number; margin: number }

export type Outcome = {
  approvalRate: number
  badRateApproved: number
  defaultersCaught: number
  goodTurnedAway: number
  profit: number
}

export function outcome(h: Holdout, cutoff: number, econ: Economics): Outcome {
  let approved = 0, approvedBad = 0, bad = 0, good = 0, goodDeclined = 0, badDeclined = 0, profit = 0
  for (let i = 0; i < h.risk.length; i++) {
    const isBad = h.defaulted[i] === 1
    const ok = h.risk[i] < cutoff
    if (isBad) bad++
    else good++
    if (ok) {
      approved++
      if (isBad) approvedBad++
      profit += isBad ? -econ.lossGivenDefault * h.exposure[i] : econ.margin * h.exposure[i]
    } else if (isBad) badDeclined++
    else goodDeclined++
  }
  return {
    approvalRate: approved / h.risk.length,
    badRateApproved: approved ? approvedBad / approved : 0,
    defaultersCaught: bad ? badDeclined / bad : 0,
    goodTurnedAway: good ? goodDeclined / good : 0,
    profit,
  }
}

export const CUTOFFS = Array.from({ length: 91 }, (_, i) => 0.05 + i * 0.01)

export function profitCurve(h: Holdout, econ: Economics) {
  const points = CUTOFFS.map((c) => ({ cutoff: c, profit: outcome(h, c, econ).profit }))
  const best = points.reduce((a, b) => (b.profit > a.profit ? b : a))
  return { points, best }
}

export const AGE_BANDS = [
  { label: 'Under 30', test: (a: number) => a < 30 },
  { label: '30 to 44', test: (a: number) => a >= 30 && a < 45 },
  { label: '45 and over', test: (a: number) => a >= 45 },
]

export type Group = { label: string; approvalRate: number; n: number }

export function groups(h: Holdout, cutoff: number) {
  const rate = (keep: (i: number) => boolean, label: string): Group => {
    let n = 0, ok = 0
    for (let i = 0; i < h.risk.length; i++) {
      if (!keep(i)) continue
      n++
      if (h.risk[i] < cutoff) ok++
    }
    return { label, approvalRate: n ? ok / n : 0, n }
  }
  const sex = [rate((i) => h.sex[i] === 'female', 'Women'), rate((i) => h.sex[i] === 'male', 'Men')]
  const age = AGE_BANDS.map((b) => rate((i) => b.test(h.age[i]), b.label))
  return { sex, age }
}

/** Lowest group approval rate over the highest. Under 0.8 fails the four-fifths rule of thumb. */
export function impactRatio(gs: Group[]): number {
  const rates = gs.map((g) => g.approvalRate)
  const hi = Math.max(...rates)
  return hi ? Math.min(...rates) / hi : 1
}

export function histogram(h: Holdout, bins = 40, max = 1) {
  const out = Array.from({ length: bins }, (_, i) => ({ from: (i / bins) * max, good: 0, bad: 0 }))
  for (let i = 0; i < h.risk.length; i++) {
    const b = Math.min(bins - 1, Math.floor((h.risk[i] / max) * bins))
    if (h.defaulted[i]) out[b].bad++
    else out[b].good++
  }
  return out
}
