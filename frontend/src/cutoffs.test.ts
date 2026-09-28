import assert from 'node:assert/strict'
import { groups, histogram, impactRatio, outcome, profitCurve, type Holdout } from './cutoffs.js'

const h: Holdout = {
  risk: [0.1, 0.2, 0.6, 0.9],
  defaulted: [0, 1, 0, 1],
  sex: ['female', 'male', 'female', 'male'],
  age: [25, 35, 50, 28],
  exposure: [1000, 2000, 3000, 4000],
}
const econ = { lossGivenDefault: 0.5, margin: 0.1 }

const o = outcome(h, 0.5, econ)
assert.equal(o.approvalRate, 0.5)
assert.equal(o.badRateApproved, 0.5)
assert.equal(o.defaultersCaught, 0.5)
assert.equal(o.goodTurnedAway, 0.5)
assert.equal(o.profit, 0.1 * 1000 - 0.5 * 2000)

assert.equal(outcome(h, 0.05, econ).profit, 0, 'declining everyone earns and loses nothing')

// Approving only the first (good) account beats approving the first two.
const { best } = profitCurve(h, econ)
assert.ok(best.cutoff > 0.1 && best.cutoff <= 0.2, `best cutoff was ${best.cutoff}`)

const g = groups(h, 0.5)
assert.deepEqual(g.sex.map((x) => x.approvalRate), [0.5, 0.5])
assert.equal(impactRatio(g.sex), 1)
assert.equal(impactRatio([{ label: 'a', approvalRate: 0.4, n: 1 }, { label: 'b', approvalRate: 0.8, n: 1 }]), 0.5)

const hist = histogram(h, 10)
assert.equal(hist.reduce((s, b) => s + b.good + b.bad, 0), 4)
assert.equal(hist[9].bad, 1)

console.log('cutoff checks passed')
