import type { Account, Feature } from './api'

/** Keeps the six-month history physically possible after one field changes, bending the other fields, never the one just moved. */
export function reconcile(a: Account, changed: Feature): Account {
  const n = { ...a }
  if (n.late_months_6m + n.paid_in_full_6m > 6) {
    if (changed === 'paid_in_full_6m') n.late_months_6m = 6 - n.paid_in_full_6m
    else n.paid_in_full_6m = 6 - n.late_months_6m
  }
  if (n.late_months_6m === 0 && changed !== 'months_late_now' && changed !== 'worst_delay_6m') {
    n.months_late_now = n.worst_delay_6m = 0
  }
  if (n.months_late_now > 0) n.late_months_6m = Math.max(n.late_months_6m, 1)
  if (changed === 'worst_delay_6m') n.months_late_now = Math.min(n.months_late_now, n.worst_delay_6m)
  else n.worst_delay_6m = Math.max(n.worst_delay_6m, n.months_late_now)
  if (n.worst_delay_6m > 0) n.late_months_6m = Math.max(n.late_months_6m, 1)
  if (n.late_months_6m > 0 && n.worst_delay_6m === 0) {
    if (changed === 'worst_delay_6m') n.late_months_6m = 0
    else n.worst_delay_6m = 1
  }
  n.paid_in_full_6m = Math.min(n.paid_in_full_6m, 6 - n.late_months_6m)
  return n
}
