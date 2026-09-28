import assert from 'node:assert/strict'
import type { Account, Feature } from './api.js'
import { reconcile } from './history.js'

const clean: Account = {
  credit_limit: 50000, utilization: 0.5, months_late_now: 0, late_months_6m: 0,
  worst_delay_6m: 0, paid_in_full_6m: 0, payment_ratio: 0.5,
}
const move = (a: Account, f: Feature, v: number) => reconcile({ ...a, [f]: v }, f)

const late = move(clean, 'months_late_now', 3)
assert.equal(late.late_months_6m, 1)
assert.equal(late.worst_delay_6m, 3)

const cleared = move(late, 'late_months_6m', 0)
assert.deepEqual([cleared.late_months_6m, cleared.months_late_now, cleared.worst_delay_6m], [0, 0, 0])

const worstDown = move(late, 'worst_delay_6m', 1)
assert.equal(worstDown.months_late_now, 1)

const noWorst = move(late, 'worst_delay_6m', 0)
assert.deepEqual([noWorst.late_months_6m, noWorst.months_late_now], [0, 0])

const lateHistory = move(clean, 'late_months_6m', 2)
assert.deepEqual([lateHistory.late_months_6m, lateHistory.worst_delay_6m], [2, 1])

const full = move({ ...late, late_months_6m: 4, worst_delay_6m: 3 }, 'paid_in_full_6m', 6)
assert.equal(full.paid_in_full_6m, 6)
assert.equal(full.late_months_6m, 0)

// Every single-field move from every preset stays possible.
for (let v = 0; v <= 8; v++) {
  for (const f of ['months_late_now', 'late_months_6m', 'worst_delay_6m', 'paid_in_full_6m'] as Feature[]) {
    const a = move(late, f, Math.min(v, f.endsWith('6m') && f !== 'worst_delay_6m' ? 6 : 8))
    assert.ok(a.late_months_6m + a.paid_in_full_6m <= 6)
    assert.ok(a.months_late_now <= a.worst_delay_6m)
    assert.equal(a.late_months_6m > 0, a.worst_delay_6m > 0)
  }
}

console.log('history checks passed')
