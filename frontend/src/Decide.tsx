import { useEffect, useState } from 'react'
import { AccountControls } from './AccountControls'
import { pct, scoreAccount, type Account, type ModelInfo, type Score } from './api'
import { useTween } from './motion'
import Waterfall from './Waterfall'
import WhatIf from './WhatIf'
import Notice from './Notice'
import Guilloche from './Guilloche'
import { reconcile } from './history'

type Props = {
  model: ModelInfo | null
  cutoff: number
  onCutoff: (c: number) => void
  account: Account
  setAccount: React.Dispatch<React.SetStateAction<Account>>
}

export default function Decide({ model, cutoff, onCutoff, account, setAccount }: Props) {
  const [score, setScore] = useState<Score | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      scoreAccount(account, cutoff, ctrl.signal).then(
        (s) => {
          setScore(s)
          setError('')
        },
        (e: Error) => e.name !== 'AbortError' && setError(e.message),
      )
    }, 40)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [account, cutoff])

  return (
    <div className="decide">
      <div className="decide-intro">
        <h1>Score a cardholder and see exactly why</h1>
        <p>
          Drag any slider. The score, the decision and every reason behind it update as you go, and each reason is
          the real amount it moved this score, not an after-the-fact guess.
        </p>
      </div>

      {score && (
        <p className={`mini-score is-${score.decision}`} aria-hidden="true">
          <strong>{pct(score.risk)}</strong> risk, {score.decision === 'approve' ? 'approved' : 'declined'} at a {pct(cutoff)} cutoff
        </p>
      )}

      <AccountControls account={account} onChange={setAccount} />

      <section className="sheet instrument" aria-live="polite">
        {error && <p className="notice">{error}</p>}
        {score && <Readout score={score} baseRisk={model?.base_risk} cutoff={cutoff} onCutoff={onCutoff} />}
        {score && (
          <WhatIf
            items={score.counterfactuals}
            risk={score.risk}
            onTry={(f, v) => setAccount((a) => reconcile({ ...a, [f]: v }, f))}
          />
        )}
        {score?.decision === 'decline' && <Notice score={score} />}
      </section>
    </div>
  )
}

function Readout({ score, baseRisk, cutoff, onCutoff }: { score: Score; baseRisk?: number; cutoff: number; onCutoff: (c: number) => void }) {
  const shown = useTween(score.risk)
  return (
    <>
      <div className={`readout is-${score.decision}`}>
        <Guilloche risk={shown} />
        <div>
          <p className="risk-figure">{pct(shown)}</p>
          <p className="risk-caption">
            chance of missing next month's payment
            {baseRisk !== undefined && <>. A typical cardholder sits at {pct(baseRisk)}.</>}
          </p>
        </div>
        <Stamp decision={score.decision} />
      </div>
      <RiskScale risk={shown} cutoff={cutoff} onCutoff={onCutoff} />
      {baseRisk !== undefined && <Waterfall reasons={score.reasons} baseRisk={baseRisk} />}
    </>
  )
}

function Stamp({ decision }: { decision: Score['decision'] }) {
  return (
    <div key={decision} className={`stamp stamp-${decision}`} role="status">
      {decision === 'approve' ? 'Approved' : 'Declined'}
    </div>
  )
}

function RiskScale({ risk, cutoff, onCutoff }: { risk: number; cutoff: number; onCutoff: (c: number) => void }) {
  // Shifting each tag by its own position keeps it inside the track at both ends.
  const tag = (at: number) => ({ left: `${at * 100}%`, transform: `translateX(-${at * 100}%)` })
  return (
    <div className="scale">
      <span className="scale-tag is-risk" style={tag(risk)}>
        This cardholder {pct(risk)}
      </span>
      <div className="scale-track" style={{ '--cut': `${cutoff * 100}%` } as React.CSSProperties}>
        <span className="scale-end is-approve" aria-hidden="true">Approve</span>
        <span className="scale-end is-decline" aria-hidden="true">Decline</span>
        <span className="scale-needle" style={{ left: `${risk * 100}%` }} />
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={cutoff}
          aria-label="Decline cutoff"
          aria-valuetext={`Decline at ${pct(cutoff)} risk or higher`}
          onChange={(e) => onCutoff(+e.target.value)}
        />
      </div>
      <span className="scale-tag is-cut" style={tag(cutoff)}>
        Cutoff {pct(cutoff)}, drag to move
      </span>
    </div>
  )
}
