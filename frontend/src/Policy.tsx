import { useMemo, useState } from 'react'
import { money, pct, type ModelInfo } from './api'
import { useTween } from './motion'
import { CUTOFFS, groups, histogram, impactRatio, outcome, profitCurve, type Economics, type Group } from './cutoffs'

type Props = { model: ModelInfo | null; cutoff: number; onCutoff: (c: number) => void }

const HIST_MAX = 1

export default function Policy({ model, cutoff, onCutoff }: Props) {
  const [econ, setEcon] = useState<Economics>({ lossGivenDefault: 0.65, margin: 0.12 })
  const h = model?.holdout

  const bins = useMemo(() => (h ? histogram(h, 40, HIST_MAX) : []), [h])
  const curve = useMemo(() => (h ? profitCurve(h, econ) : null), [h, econ])
  const now = h ? outcome(h, cutoff, econ) : null
  const approveAll = h ? outcome(h, 1.01, econ) : null
  const fair = h ? groups(h, cutoff) : null

  if (!h || !now || !curve || !approveAll || !fair) return <p className="loading">Loading the held-out cardholders…</p>

  return (
    <div className="policy">
      <div className="decide-intro">
        <h1>Pick a cutoff with every tradeoff in view</h1>
        <p>
          These are {h.risk.length.toLocaleString()} cardholders the model never saw in training. Drag the red line and
          watch who gets approved, what it costs, and whether any group gets treated differently.
        </p>
      </div>

      <section className="sheet">
        <Histogram bins={bins} cutoff={cutoff} onCutoff={onCutoff} />
      </section>

      <div className="stats">
        <Stat label="Approved" value={now.approvalRate} />
        <Stat label="Of those, go on to default" value={now.badRateApproved} tone="decline" />
        <Stat label="Defaulters caught" value={now.defaultersCaught} tone="approve" />
        <Stat label="Good payers turned away" value={now.goodTurnedAway} />
      </div>

      <div className="policy-pair">
        <section className="sheet money">
          <h2>What it's worth</h2>
          <p className="muted">
            Profit on these {h.risk.length.toLocaleString()} balances for one cycle, against approving everyone.
          </p>
          <ProfitChart points={curve.points} best={curve.best} cutoff={cutoff} />
          <Money value={now.profit - approveAll.profit} />
          <button className="try is-enough" onClick={() => onCutoff(+curve.best.cutoff.toFixed(2))}>
            Use the most profitable cutoff ({pct(curve.best.cutoff)})
          </button>
          <label className="control">
            <span className="control-head">
              <span>Loss when a cardholder defaults</span>
              <output>{pct(econ.lossGivenDefault)} of balance</output>
            </span>
            <input
              type="range" min={0.2} max={1} step={0.01} value={econ.lossGivenDefault}
              style={{ '--fill': `${((econ.lossGivenDefault - 0.2) / 0.8) * 100}%` } as React.CSSProperties}
              onChange={(e) => setEcon({ ...econ, lossGivenDefault: +e.target.value })}
            />
          </label>
          <label className="control">
            <span className="control-head">
              <span>Margin on a good balance</span>
              <output>{pct(econ.margin)}</output>
            </span>
            <input
              type="range" min={0.02} max={0.3} step={0.005} value={econ.margin}
              style={{ '--fill': `${((econ.margin - 0.02) / 0.28) * 100}%` } as React.CSSProperties}
              onChange={(e) => setEcon({ ...econ, margin: +e.target.value })}
            />
          </label>
        </section>

        <section className="sheet fairness">
          <h2>Who gets approved</h2>
          <p className="muted">
            Sex and age never go into the model. They're only used here, to check the outcome.
          </p>
          <GroupBars title="By sex" groups={fair.sex} />
          <GroupBars title="By age" groups={fair.age} />
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'approve' | 'decline' }) {
  const v = useTween(value)
  return (
    <div className={`stat ${tone ? `is-${tone}` : ''}`}>
      <span className="stat-value">{pct(v, 1)}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function Money({ value }: { value: number }) {
  const v = useTween(value)
  return (
    <p className={`money-delta ${v >= 0 ? 'is-approve' : 'is-decline'}`}>
      {v >= 0 ? '+' : '−'}
      {money(Math.abs(v))}
      <span> vs approving everyone</span>
    </p>
  )
}

function Histogram({ bins, cutoff, onCutoff }: { bins: ReturnType<typeof histogram>; cutoff: number; onCutoff: (c: number) => void }) {
  const peak = Math.max(...bins.map((b) => b.good + b.bad))
  const w = 100 / bins.length
  return (
    <figure className="hist">
      <figcaption>
        <span>
          <i className="key key-good" /> Paid next month
        </span>
        <span>
          <i className="key key-bad" /> Defaulted
        </span>
        <span className="muted">Predicted risk, left to right</span>
      </figcaption>
      <div className="hist-plot" style={{ '--cut': `${(cutoff / HIST_MAX) * 100}%` } as React.CSSProperties}>
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
          {bins.map((b, i) => {
            const declined = b.from >= cutoff - 1e-9
            const gh = (b.good / peak) * 58
            const bh = (b.bad / peak) * 58
            return (
              <g key={i} className={`hist-bin ${declined ? 'is-declined' : ''}`} style={{ animationDelay: `${i * 18}ms` }}>
                <rect className="bar-good" x={i * w + 0.15} width={w - 0.3} y={60 - gh - bh} height={gh} />
                <rect className="bar-bad" x={i * w + 0.15} width={w - 0.3} y={60 - bh} height={bh} />
              </g>
            )
          })}
        </svg>
        <span className="hist-cut" />
        <input
          type="range" min={0.05} max={0.95} step={0.01} value={cutoff}
          aria-label="Decline cutoff" onChange={(e) => onCutoff(+e.target.value)}
        />
      </div>
      <div className="hist-axis">
        <span>0%</span>
        <span>Decline at {pct(cutoff)} and above</span>
        <span>{pct(HIST_MAX)}</span>
      </div>
    </figure>
  )
}

function ProfitChart({ points, best, cutoff }: { points: { cutoff: number; profit: number }[]; best: { cutoff: number; profit: number }; cutoff: number }) {
  const lo = Math.min(...points.map((p) => p.profit))
  const hi = Math.max(...points.map((p) => p.profit))
  const x = (c: number) => ((c - CUTOFFS[0]) / (CUTOFFS[CUTOFFS.length - 1] - CUTOFFS[0])) * 100
  const y = (p: number) => 38 - ((p - lo) / (hi - lo || 1)) * 34
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.cutoff).toFixed(2)} ${y(p.profit).toFixed(2)}`).join('')
  const nearest = points.reduce((a, b) => (Math.abs(b.cutoff - cutoff) < Math.abs(a.cutoff - cutoff) ? b : a))
  return (
    <svg className="profit" viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label={`Profit peaks at a ${pct(best.cutoff)} cutoff`}>
      <path d={d} className="profit-line" vectorEffect="non-scaling-stroke" />
      <line x1={x(best.cutoff)} x2={x(best.cutoff)} y1={0} y2={42} className="profit-best" vectorEffect="non-scaling-stroke" />
      <line x1={x(cutoff)} x2={x(cutoff)} y1={0} y2={42} className="profit-now" vectorEffect="non-scaling-stroke" />
      <circle cx={x(nearest.cutoff)} cy={y(nearest.profit)} r={1.4} className="profit-dot" />
    </svg>
  )
}

function GroupBars({ title, groups: gs }: { title: string; groups: Group[] }) {
  const ratio = impactRatio(gs)
  const pass = ratio >= 0.8
  return (
    <div className="groups">
      <div className="groups-head">
        <h3>{title}</h3>
        <span className={`verdict ${pass ? 'is-approve' : 'is-decline'}`}>
          {pass ? 'Within' : 'Fails'} the four-fifths rule ({ratio.toFixed(2)})
        </span>
      </div>
      {gs.map((g) => (
        <div key={g.label} className="group-row">
          <span>{g.label}</span>
          <span className="group-track">
            <span className="group-fill" style={{ width: `${g.approvalRate * 100}%` }} />
          </span>
          <span className="group-value">{pct(g.approvalRate)}</span>
        </div>
      ))}
    </div>
  )
}
