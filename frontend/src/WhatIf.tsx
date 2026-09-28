import { pct, type Account, type Counterfactual } from './api'

type Props = {
  items: Counterfactual[]
  risk: number
  onTry: (feature: keyof Account, value: number) => void
}

export default function WhatIf({ items, risk, onTry }: Props) {
  if (!items.length) return null
  return (
    <section className="whatif" aria-label="What would change this decision">
      <h2>What would flip this to approved</h2>
      <ul>
        {items.map((c, i) => (
          <li key={c.feature} style={{ animationDelay: `${i * 70}ms` }}>
            <div>
              <strong>{c.text}</strong>
              <span>
                {pct(risk)} to {pct(c.risk)}
                {c.meets_cutoff ? ', clears the cutoff on its own' : ', helps but not enough alone'}
              </span>
            </div>
            <button className={`try ${c.meets_cutoff ? 'is-enough' : ''}`} onClick={() => onTry(c.feature, c.to)}>
              Try it
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
