import { useRef, useState } from 'react'
import type { Score } from './api'

/** Regulation B asks for the principal reasons behind an adverse action. Four is the common ceiling. */
const MAX_REASONS = 4

export function noticeText(score: Score, today = new Date()): string {
  const reasons = score.reasons.filter((r) => r.points > 0).slice(0, MAX_REASONS)
  const help = score.counterfactuals.filter((c) => c.meets_cutoff).slice(0, 2)
  const lines = [
    today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    '',
    'Dear cardholder,',
    '',
    "We reviewed your account and can't approve the change you asked for right now.",
    'The main reasons, in order of how much they counted, were:',
    '',
    ...reasons.map((r, i) => `  ${i + 1}. ${r.text}`),
  ]
  if (help.length) {
    lines.push('', 'What would most likely change the outcome next time:', '', ...help.map((c) => `  - ${c.text}`))
  }
  lines.push(
    '',
    "You can ask us for more detail about this decision within 60 days. We'll answer within 30 days of your request.",
    '',
    '[Your compliance team adds the ECOA notice and credit bureau disclosures here.]',
  )
  return lines.join('\n')
}

export default function Notice({ score }: { score: Score }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)
  const text = noticeText(score)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <>
      <button className="letter-open" onClick={() => dialog.current?.showModal()}>
        Draft the decline letter
      </button>
      <dialog ref={dialog} className="letter" aria-labelledby="letter-title" onClick={(e) => e.target === dialog.current && dialog.current.close()}>
        <div className="letter-head">
          <h2 id="letter-title">Decline letter draft</h2>
          <button className="letter-close" onClick={() => dialog.current?.close()} aria-label="Close">
            ×
          </button>
        </div>
        <pre>{text}</pre>
        <div className="letter-actions">
          <button className="try is-enough" onClick={copy}>
            {copied ? 'Copied' : 'Copy letter'}
          </button>
        </div>
      </dialog>
    </>
  )
}
