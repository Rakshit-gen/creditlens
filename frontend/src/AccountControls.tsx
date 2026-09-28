import type { Account, Feature } from './api'
import { money } from './api'
import { reconcile } from './history'

export const PRESETS: { name: string; account: Account }[] = [
  {
    name: 'Steady payer',
    account: { credit_limit: 200000, utilization: 0.25, months_late_now: 0, late_months_6m: 0, worst_delay_6m: 0, paid_in_full_6m: 4, payment_ratio: 0.9 },
  },
  {
    name: 'Maxed out',
    account: { credit_limit: 50000, utilization: 0.98, months_late_now: 0, late_months_6m: 1, worst_delay_6m: 1, paid_in_full_6m: 0, payment_ratio: 0.06 },
  },
  {
    name: 'Two months behind',
    account: { credit_limit: 30000, utilization: 0.9, months_late_now: 2, late_months_6m: 4, worst_delay_6m: 2, paid_in_full_6m: 0, payment_ratio: 0.03 },
  },
  {
    name: 'Dormant card',
    account: { credit_limit: 80000, utilization: 0, months_late_now: 0, late_months_6m: 0, worst_delay_6m: 0, paid_in_full_6m: 0, payment_ratio: 1 },
  },
  {
    name: 'Bouncing back',
    account: { credit_limit: 60000, utilization: 0.5, months_late_now: 0, late_months_6m: 3, worst_delay_6m: 3, paid_in_full_6m: 1, payment_ratio: 0.4 },
  },
]

type Control = {
  feature: Feature
  label: string
  min: number
  max: number
  step: number
  show: (v: number) => string
  log?: boolean
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const CONTROLS: Control[] = [
  { feature: 'credit_limit', label: 'Credit limit', min: 10000, max: 1000000, step: 0.01, log: true, show: money },
  { feature: 'utilization', label: 'Balance as share of limit', min: 0, max: 1.5, step: 0.01, show: (v) => `${Math.round(v * 100)}%` },
  { feature: 'payment_ratio', label: 'Share of bills paid, last 5 months', min: 0, max: 1, step: 0.01, show: (v) => `${Math.round(v * 100)}%` },
  { feature: 'months_late_now', label: 'Past due right now', min: 0, max: 8, step: 1, show: (v) => (v ? plural(v, 'month') : 'Current') },
  { feature: 'late_months_6m', label: 'Late months out of the last 6', min: 0, max: 6, step: 1, show: (v) => `${v} of 6` },
  { feature: 'worst_delay_6m', label: 'Worst delay in 6 months', min: 0, max: 8, step: 1, show: (v) => (v ? plural(v, 'month') : 'None') },
  { feature: 'paid_in_full_6m', label: 'Months paid in full', min: 0, max: 6, step: 1, show: (v) => `${v} of 6` },
]

export function AccountControls({ account, onChange }: { account: Account; onChange: (a: Account) => void }) {
  const set = (f: Feature, v: number) => onChange(reconcile({ ...account, [f]: v }, f))
  const activePreset = PRESETS.find((p) => JSON.stringify(p.account) === JSON.stringify(account))?.name

  return (
    <section className="controls" aria-label="Account details">
      <div className="presets" role="group" aria-label="Example accounts">
        {PRESETS.map((p) => (
          <button key={p.name} className="chip" aria-pressed={activePreset === p.name} onClick={() => onChange(p.account)}>
            {p.name}
          </button>
        ))}
      </div>

      {CONTROLS.map((c) => {
        const v = account[c.feature]
        const pos = c.log ? Math.log(v) : v
        const [lo, hi] = c.log ? [Math.log(c.min), Math.log(c.max)] : [c.min, c.max]
        const fill = ((pos - lo) / (hi - lo)) * 100
        return (
          <label key={c.feature} className="control">
            <span className="control-head">
              <span>{c.label}</span>
              <output>{c.show(v)}</output>
            </span>
            <input
              type="range"
              min={lo}
              max={hi}
              step={c.step}
              value={pos}
              style={{ '--fill': `${fill}%` } as React.CSSProperties}
              onChange={(e) => {
                const raw = +e.target.value
                set(c.feature, c.log ? Math.round(Math.exp(raw) / 1000) * 1000 : raw)
              }}
            />
          </label>
        )
      })}
    </section>
  )
}
