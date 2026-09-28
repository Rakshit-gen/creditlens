import { useState } from 'react'
import { money, pct, type Curve, type Feature, type ModelInfo } from './api'

const VALUE_FORMAT: Record<Feature, (v: number) => string> = {
  credit_limit: money,
  utilization: (v) => pct(v),
  payment_ratio: (v) => pct(v),
  months_late_now: (v) => months(v),
  late_months_6m: (v) => `${Math.round(v)} of 6`,
  worst_delay_6m: (v) => months(v),
  paid_in_full_6m: (v) => `${Math.round(v)} of 6`,
}

function months(v: number) {
  const m = Math.round(v)
  return m ? `${m} month${m > 1 ? 's' : ''} late` : 'on time'
}

export default function ModelCard({ model }: { model: ModelInfo | null }) {
  if (!model) return <p className="loading">Loading the model report…</p>
  const m = model.metrics
  const gap = model.black_box_roc_auc - m.roc_auc

  return (
    <div className="modelcard">
      <div className="decide-intro">
        <h1>How far to trust these scores</h1>
        <p>
          Trained on {model.rows_train.toLocaleString()} cardholders in {model.fit_seconds.toFixed(2)} seconds, tested on{' '}
          {model.rows_test.toLocaleString()} it never saw. {pct(model.default_rate, 1)} of them defaulted the next month.
        </p>
      </div>

      <div className="stats">
        <Metric value={m.roc_auc.toFixed(3)} label="ROC-AUC" note={`Pick a defaulter and a payer at random: the defaulter scores higher ${pct(m.roc_auc)} of the time.`} />
        <Metric value={m.ks.toFixed(3)} label="KS statistic" note="Largest gap between how defaulters and payers are spread across scores. Lenders usually want 0.3 or more." />
        <Metric value={m.pr_auc.toFixed(3)} label="PR-AUC" note={`How well it finds defaulters when only ${pct(model.default_rate)} are. Guessing would score about ${model.default_rate.toFixed(2)}.`} />
        <Metric value={m.brier.toFixed(3)} label="Brier score" note="Average squared miss on the probabilities. Lower is better." />
      </div>

      <div className="policy-pair">
        <section className="sheet tradeoff">
          <h2>What explainability costs</h2>
          <p className="muted">
            A gradient-boosted model with free rein over all 19 raw columns does a little better. It can't say why it
            declined anyone without approximations like SHAP, and nothing stops it from learning that paying more makes
            you riskier.
          </p>
          <Compare label="creditlens" value={m.roc_auc} />
          <Compare label="Unconstrained black box" value={model.black_box_roc_auc} faint />
          <p className="tradeoff-gap">
            {(gap * 100).toFixed(1)} AUC points given up for reasons that are exact and always point the right way. Five-fold
            cross-validation puts this model at {m.cv_roc_auc_mean.toFixed(3)} ± {m.cv_roc_auc_std.toFixed(3)}.
          </p>
        </section>

        <section className="sheet">
          <h2>Does 30% mean 30%?</h2>
          <p className="muted">Each dot is a tenth of the test set: what the model predicted against what really happened.</p>
          <Calibration points={model.calibration} />
        </section>
      </div>

      <section className="curves-wrap">
        <h2>What the model learned, one feature at a time</h2>
        <p className="muted">
          Because the model is a sum of these curves, this is the whole model. Nothing else hides behind it. Hover to read
          a value.
        </p>
        <div className="curves">
          {(Object.entries(model.curves) as [Feature, Curve][]).map(([f, c]) => (
            <CurvePlot key={f} curve={c} format={VALUE_FORMAT[f]} />
          ))}
        </div>
      </section>
    </div>
  )
}

function Metric({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="stat metric">
      <span className="stat-value">{value}</span>
      <span className="metric-label">{label}</span>
      <span className="stat-label">{note}</span>
    </div>
  )
}

function Compare({ label, value, faint }: { label: string; value: number; faint?: boolean }) {
  const lo = 0.5
  return (
    <div className="compare">
      <span>{label}</span>
      <span className="group-track">
        <span className={`group-fill ${faint ? 'is-faint' : ''}`} style={{ width: `${((value - lo) / (1 - lo)) * 100}%` }} />
      </span>
      <span className="group-value">{value.toFixed(3)}</span>
    </div>
  )
}

function Calibration({ points }: { points: ModelInfo['calibration'] }) {
  // Round the axis up to a multiple of 20% so the gridlines land on even numbers.
  const max = Math.min(1, Math.ceil(Math.max(...points.flatMap((p) => [p.predicted, p.actual])) * 5) / 5)
  const s = (v: number) => (v / max) * 100
  const [hover, setHover] = useState<number | null>(null)
  const h = hover !== null ? points[hover] : null
  return (
    <div className="calib">
      <svg viewBox="-8 -4 116 116" role="img" aria-label="Calibration: predicted against observed default rate">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t} className="calib-grid">
            <line x1={0} x2={100} y1={100 - t * 100} y2={100 - t * 100} />
            <text x={-2} y={100 - t * 100 + 1.5} textAnchor="end">
              {pct(t * max)}
            </text>
          </g>
        ))}
        <line x1={0} y1={100} x2={100} y2={0} className="calib-ideal" />
        <polyline className="calib-line" points={points.map((p) => `${s(p.predicted)},${100 - s(p.actual)}`).join(' ')} />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={s(p.predicted)}
            cy={100 - s(p.actual)}
            r={hover === i ? 3.4 : 2.4}
            className="calib-dot"
            style={{ animationDelay: `${i * 60}ms` }}
            tabIndex={0}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          />
        ))}
      </svg>
      <p className="calib-read" aria-live="polite">
        {h
          ? `Predicted ${pct(h.predicted, 1)}, actually ${pct(h.actual, 1)} of ${h.n.toLocaleString()} cardholders defaulted.`
          : 'On the dashed line means the probabilities can be taken at face value.'}
      </p>
    </div>
  )
}

function CurvePlot({ curve, format }: { curve: Curve; format: (v: number) => string }) {
  const [i, setI] = useState<number | null>(null)
  const lo = Math.min(0, ...curve.points) - 10
  const hi = Math.max(0, ...curve.points) + 10
  const n = curve.x.length
  const x = (k: number) => (k / (n - 1)) * 100
  const y = (p: number) => 50 - ((p - lo) / (hi - lo)) * 46 - 2
  const d = curve.points.map((p, k) => `${k ? 'L' : 'M'}${x(k).toFixed(2)} ${y(p).toFixed(2)}`).join('')
  const flat = hi - lo - 20 < 5

  return (
    <figure className="curve">
      <figcaption>
        <strong>{curve.label}</strong>
        <span className={i === null ? 'muted' : curve.points[i] > 0 ? 'is-decline' : 'is-approve'}>
          {i === null
            ? `${format(curve.x[0])} to ${format(curve.x[n - 1])}`
            : `${format(curve.x[i])}: ${curve.points[i] > 0 ? '+' : ''}${curve.points[i]} pts`}
        </span>
      </figcaption>
      <svg
        viewBox="0 0 100 50"
        preserveAspectRatio="none"
        aria-hidden="true"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setI(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))))
        }}
        onPointerLeave={() => setI(null)}
      >
        <line x1={0} x2={100} y1={y(0)} y2={y(0)} className="curve-zero" vectorEffect="non-scaling-stroke" />
        <path d={d} className="curve-line" vectorEffect="non-scaling-stroke" />
        {i !== null && <line x1={x(i)} x2={x(i)} y1={0} y2={50} className="curve-cursor" vectorEffect="non-scaling-stroke" />}
      </svg>
      {flat && <p className="curve-note">Barely moves the score once the other factors are known.</p>}
    </figure>
  )
}
