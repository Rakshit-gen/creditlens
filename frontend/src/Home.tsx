import { useEffect, useState } from 'react'
import { pct, scoreAccount, type Account, type ModelInfo, type Score } from './api'
import { useTween } from './motion'
import { reconcile } from './history'
import Guilloche from './Guilloche'

const DEMO: Account = {
  credit_limit: 50000, utilization: 0.85, months_late_now: 2, late_months_6m: 3,
  worst_delay_6m: 2, paid_in_full_6m: 0, payment_ratio: 0.08,
}

const PROBLEMS = [
  {
    now: 'A black-box score with an approximate explainer bolted on. Regulators want the specific reasons for every decline, and "the model is complex" doesn\'t count.',
    fix: 'The model is a sum of one curve per factor, so each reason is the exact amount it moved the score. The parts add back up to the prediction.',
  },
  {
    now: 'A model that quietly learned "paying more makes you riskier" from a quirk in the data. Try putting that in a decline letter.',
    fix: 'Direction constraints: being late can only raise risk and paying more can only lower it. Tests check every one.',
  },
  {
    now: 'The customer hears no and has no idea what would change it. Support has no idea either.',
    fix: 'For each thing a cardholder can actually change, the smallest change that gets them approved, and one click to try it.',
  },
  {
    now: 'The cutoff gets picked in a spreadsheet, and nobody sees what it does to approvals, losses and different groups at the same time.',
    fix: 'Drag one line across 6,000 held-out cardholders and watch approval rate, bad rate, profit and group approval rates move together.',
  },
  {
    now: '"78% accurate" on a book where 22% default, which is what you get by predicting nobody ever defaults.',
    fix: 'ROC-AUC, the KS statistic lenders use, a calibration check, and the accuracy given up against a black box, all stated up front.',
  },
  {
    now: 'One bad cell in a 20,000-row upload and the whole batch fails with a stack trace.',
    fix: 'Every bad row listed with what\'s wrong, quoting what was typed. Everything else still gets scored.',
  },
]

const DESKS = [
  { id: 'decide', title: 'Decide', text: 'One cardholder. Live score, every reason, what would flip it, and the decline letter.' },
  { id: 'policy', title: 'Policy', text: 'Set the cutoff with approvals, losses, profit and fairness all in view.' },
  { id: 'queue', title: 'Queue', text: 'Drop in a CSV and get the whole book ranked, with reasons and a bad-row report.' },
  { id: 'model', title: 'Model', text: 'The report card: metrics, calibration, and every curve the model learned.' },
]

export default function Home({ model, cutoff }: { model: ModelInfo | null; cutoff: number }) {
  const [account, setAccount] = useState(DEMO)
  const [score, setScore] = useState<Score | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => scoreAccount(account, cutoff, ctrl.signal).then(setScore, () => {}), 30)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [account, cutoff])

  const set = (f: keyof Account, v: number) => setAccount((a) => reconcile({ ...a, [f]: v }, f))

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <h1>Every decline comes with a reason you can defend.</h1>
          <p className="hero-lede">
            creditlens predicts which cardholders will miss next month's payment, and shows exactly what drove each
            score, what would change it, and what your cutoff costs. It's built for lenders who have to explain themselves.
          </p>
          <div className="hero-actions">
            <a className="button" href="#decide">
              Score a cardholder
            </a>
            <a className="button is-quiet" href="#model">
              See the model's report card
            </a>
          </div>
        </div>

        <div className="demo sheet" aria-label="Try the scorer">
          <p className="demo-hint">Try it: bring this cardholder current and watch the decision flip.</p>
          <DemoReadout score={score} />
          <label className="control">
            <span className="control-head">
              <span>Past due right now</span>
              <output>{account.months_late_now ? `${account.months_late_now} month${account.months_late_now > 1 ? 's' : ''}` : 'Current'}</output>
            </span>
            <input
              type="range" min={0} max={3} step={1} value={account.months_late_now}
              style={{ '--fill': `${(account.months_late_now / 3) * 100}%` } as React.CSSProperties}
              onChange={(e) => set('months_late_now', +e.target.value)}
            />
          </label>
          <label className="control">
            <span className="control-head">
              <span>Share of bills paid</span>
              <output>{pct(account.payment_ratio)}</output>
            </span>
            <input
              type="range" min={0} max={1} step={0.01} value={account.payment_ratio}
              style={{ '--fill': `${account.payment_ratio * 100}%` } as React.CSSProperties}
              onChange={(e) => set('payment_ratio', +e.target.value)}
            />
          </label>
          {score && <DemoReasons score={score} />}
        </div>
      </section>

      <section className="problems" aria-labelledby="problems-title">
        <h2 id="problems-title">What goes wrong when a risk model meets real customers</h2>
        <div className="ledger-table" role="table">
          <div className="ledger-head" role="row">
            <span role="columnheader">What usually happens</span>
            <span role="columnheader">What creditlens does</span>
          </div>
          {PROBLEMS.map((p) => (
            <div className="ledger-row" role="row" key={p.fix}>
              <p role="cell" className="ledger-now">{p.now}</p>
              <p role="cell" className="ledger-fix">{p.fix}</p>
            </div>
          ))}
        </div>
      </section>

      {model && (
        <section className="proof" aria-label="Measured results">
          <Proof value={model.metrics.roc_auc.toFixed(3)} text={`ROC-AUC on ${model.rows_test.toLocaleString()} cardholders it never trained on`} />
          <Proof
            value={`${pct(model.holdout.risk.reduce((a, b) => a + b, 0) / model.holdout.risk.length, 1)}`}
            text={`average predicted risk, against ${pct(model.holdout.defaulted.reduce((a, b) => a + b, 0) / model.holdout.defaulted.length, 1)} who actually defaulted`}
          />
          <Proof value={`${model.fit_seconds.toFixed(2)}s`} text="to train on a laptop CPU. No GPU, no platform." />
          <Proof value={`${((model.black_box_roc_auc - model.metrics.roc_auc) * 100).toFixed(1)}`} text="AUC points given up against an unconstrained black box, in exchange for exact reasons" />
        </section>
      )}

      <section className="desks" aria-labelledby="desks-title">
        <h2 id="desks-title">Four tools, one cutoff</h2>
        <p className="muted">Move the cutoff in any of them and every decision updates everywhere.</p>
        <div className="desk-list">
          {DESKS.map((d) => (
            <a key={d.id} className="desk" href={`#${d.id}`}>
              <strong>{d.title}</strong>
              <span>{d.text}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

function DemoReadout({ score }: { score: Score | null }) {
  const risk = useTween(score?.risk ?? 0)
  return (
    <div className={`demo-readout ${score ? `is-${score.decision}` : ''}`}>
      <Guilloche risk={risk} />
      <div>
        <p className="demo-figure">{score ? pct(risk) : '…'}</p>
        <p className="muted">chance of missing next month's payment</p>
      </div>
      {score && (
        <div key={score.decision} className={`stamp stamp-${score.decision}`} role="status">
          {score.decision === 'approve' ? 'Approved' : 'Declined'}
        </div>
      )}
    </div>
  )
}

function DemoReasons({ score }: { score: Score }) {
  const top = [...score.reasons].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 3)
  const max = Math.max(...top.map((r) => Math.abs(r.points)), 1)
  return (
    <ul className="demo-reasons" aria-label="Biggest reasons">
      {top.map((r) => (
        <li key={r.feature}>
          <span>{r.text}</span>
          <span className="demo-bar">
            <span className={r.points > 0 ? 'is-up' : 'is-down'} style={{ width: `${(Math.abs(r.points) / max) * 100}%` }} />
          </span>
          <span className={r.points > 0 ? 'is-up' : 'is-down'}>
            {r.points > 0 ? '+' : '−'}
            {Math.abs(Math.round(r.points))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Proof({ value, text }: { value: string; text: string }) {
  return (
    <div className="proof-item">
      <span className="proof-value">{value}</span>
      <span>{text}</span>
    </div>
  )
}
