import { useEffect, useState } from 'react'
import { AccountControls, PRESETS } from './AccountControls'
import { pct, scoreAccount, type Account, type ModelInfo, type Score } from './api'
import { useTween } from './motion'
import Waterfall from './Waterfall'

type Props = { model: ModelInfo | null; cutoff: number; onCutoff: (c: number) => void }

export default function Decide({ model, cutoff, onCutoff }: Props) {
  const [account, setAccount] = useState<Account>(PRESETS[2].account)
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

      <AccountControls account={account} onChange={setAccount} />

      <section className="sheet instrument" aria-live="polite">
        {error && <p className="notice">{error}</p>}
        {score && <Readout score={score} baseRisk={model?.base_risk} cutoff={cutoff} onCutoff={onCutoff} />}
      </section>
    </div>
  )
}

function Readout({ score, baseRisk, cutoff, onCutoff }: { score: Score; baseRisk?: number; cutoff: number; onCutoff: (c: number) => void }) {
  const shown = useTween(score.risk)
  return (
    <>
      <div className="readout">
        <div>
          <p className="risk-figure">{pct(shown)}</p>
          <p className="risk-caption">
            chance of missing next month's payment
            {baseRisk !== undefined && <>. The average cardholder sits at {pct(baseRisk)}.</>}
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
  return (
    <div className="scale">
      <div className="scale-track" style={{ '--cut': `${cutoff * 100}%` } as React.CSSProperties}>
        <span className="scale-needle" style={{ left: `${risk * 100}%` }} />
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={cutoff}
          aria-label="Decline cutoff"
          onChange={(e) => onCutoff(+e.target.value)}
        />
      </div>
      <p className="scale-legend">
        <span>Approve below {pct(cutoff)}</span>
        <span>Drag the line to move the cutoff</span>
      </p>
    </div>
  )
}
