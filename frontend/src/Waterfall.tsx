import { pct, type Reason } from './api'

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

/** Reasons stacked from a typical cardholder to this one. Rows are placed by rank so reordering animates. */
export default function Waterfall({ reasons, baseRisk }: { reasons: Reason[]; baseRisk: number }) {
  const baseLogit = Math.log(baseRisk / (1 - baseRisk)) * 100
  let running = 0
  const steps = reasons.map((r) => {
    const start = running
    running += r.points
    return { ...r, start, end: running }
  })
  const lo = Math.min(0, ...steps.map((s) => s.end)) - 15
  const hi = Math.max(0, ...steps.map((s) => s.end)) + 15
  const span = Math.max(hi - lo, 200)
  const x = (v: number) => ((v - lo) / span) * 100
  const order = [...reasons].map((r) => r.feature)

  return (
    <figure className="waterfall">
      <figcaption>
        <span>What moved this score</span>
        <span className="waterfall-hint" title="Points are log-odds times 100. Every 69 points doubles the odds of default.">
          +69 points doubles the odds
        </span>
      </figcaption>
      <div className="wf-row wf-edge" style={{ '--rank': 0 } as React.CSSProperties}>
        <span className="wf-text">Typical cardholder</span>
        <span className="wf-lane">
          <span className="wf-marker" style={{ left: `${x(0)}%` }} />
        </span>
        <span className="wf-points">{pct(baseRisk)}</span>
      </div>
      <div className="wf-body" style={{ '--rows': steps.length } as React.CSSProperties}>
        {steps.map((s) => {
          const up = s.points > 0
          const neutral = Math.abs(s.points) < 0.5
          return (
            <div key={s.feature} className="wf-row wf-step" style={{ '--rank': order.indexOf(s.feature) } as React.CSSProperties}>
              <span className="wf-text">
                <strong>{s.label}</strong>
                <span>{s.text}</span>
              </span>
              <span className="wf-lane">
                <span
                  className={`wf-bar ${neutral ? 'is-flat' : up ? 'is-up' : 'is-down'}`}
                  style={{ left: `${x(Math.min(s.start, s.end))}%`, width: `${Math.max((Math.abs(s.points) / span) * 100, 0.6)}%` }}
                />
              </span>
              <span className={`wf-points ${neutral ? '' : up ? 'is-up' : 'is-down'}`}>
                {neutral ? '0' : `${up ? '+' : '−'}${Math.abs(Math.round(s.points))}`}
              </span>
            </div>
          )
        })}
      </div>
      <div className="wf-row wf-edge wf-total">
        <span className="wf-text">This cardholder</span>
        <span className="wf-lane">
          <span className="wf-marker is-final" style={{ left: `${x(running)}%` }} />
        </span>
        <span className="wf-points">{pct(sigmoid((baseLogit + running) / 100))}</span>
      </div>
    </figure>
  )
}
