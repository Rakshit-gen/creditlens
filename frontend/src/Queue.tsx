import { useState } from 'react'
import { getSampleCsv, pct, scoreBatch, type Account, type Batch, type BatchRow, type ModelInfo } from './api'

type Props = {
  model: ModelInfo | null
  cutoff: number
  batch: Batch | null
  setBatch: (b: Batch) => void
  onOpen: (a: Account) => void
}
type Filter = 'all' | 'decline' | 'approve'

const PAGE = 100

export default function Queue({ model, cutoff, batch, setBatch, onOpen }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [shown, setShown] = useState(PAGE)

  const run = async (file: Blob) => {
    setBusy(true)
    setError('')
    try {
      setBatch(await scoreBatch(file, cutoff))
      setShown(PAGE)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const decide = (r: BatchRow) => (r.risk >= cutoff ? 'decline' : 'approve')
  const rows = batch?.rows.filter((r) => filter === 'all' || decide(r) === filter) ?? []
  const declined = batch?.rows.filter((r) => decide(r) === 'decline').length ?? 0
  const label = (f: string) => model?.curves[f as keyof Account]?.label ?? f

  const exportCsv = () => {
    if (!batch) return
    const lines = ['account_id,risk,decision,reasons']
    for (const r of batch.rows) {
      lines.push([r.account_id, r.risk, decide(r), `"${r.top_reasons.map(label).join('; ')}"`].join(','))
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'creditlens-decisions.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="queue">
      <div className="decide-intro">
        <h1>Work through a whole book of accounts</h1>
        <p>
          Drop in a CSV of cardholders. You get them ranked by risk with the reasons attached. Rows with bad data get
          listed with what's wrong, and the rest still get scored.
        </p>
      </div>

      <label
        className={`drop ${dragging ? 'is-over' : ''} ${busy ? 'is-busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) run(f)
        }}
      >
        <input type="file" accept=".csv,text/csv" className="visually-hidden" onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
        <span className="drop-title">{busy ? 'Scoring…' : dragging ? 'Let go to score it' : 'Drop a CSV here, or click to pick one'}</span>
        <span className="muted">
          Needs credit_limit, status_m1 to status_m6, bill_m1 to bill_m6 and paid_m1 to paid_m6. Up to 10 MB.
        </span>
      </label>
      <div className="queue-actions">
        <button className="chip" onClick={() => getSampleCsv().then(run)} disabled={busy}>
          Score the 250-row sample
        </button>
        <a className="chip" href="/api/sample.csv" download="creditlens-sample.csv">
          Download the sample
        </a>
      </div>

      {error && <p className="notice">{error}</p>}

      {batch && (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat-value">{batch.scored.toLocaleString()}</span>
              <span className="stat-label">Scored</span>
            </div>
            <div className="stat is-decline">
              <span className="stat-value">{declined.toLocaleString()}</span>
              <span className="stat-label">Declined at {pct(cutoff)}</span>
            </div>
            <div className="stat is-approve">
              <span className="stat-value">{(batch.scored - declined).toLocaleString()}</span>
              <span className="stat-label">Approved</span>
            </div>
            <div className={`stat ${batch.rejected_rows ? 'is-decline' : ''}`}>
              <span className="stat-value">{batch.rejected_rows}</span>
              <span className="stat-label">Rows with bad data</span>
            </div>
          </div>

          {batch.errors.length > 0 && (
            <details className="errors" open={batch.scored === 0}>
              <summary>
                {batch.errors.length} problem{batch.errors.length === 1 ? '' : 's'} in the file
              </summary>
              <ul>
                {batch.errors.slice(0, 200).map((e, i) => (
                  <li key={i}>
                    {e.row ? `Row ${e.row}, ` : ''}
                    <code>{e.column}</code> {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {batch.rows.length > 0 && (
            <section className="sheet ledger">
              <div className="ledger-bar">
                <div className="segmented" role="group" aria-label="Filter">
                  {(['all', 'decline', 'approve'] as Filter[]).map((f) => (
                    <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                      {f === 'all' ? 'All' : f === 'decline' ? 'Declined' : 'Approved'}
                    </button>
                  ))}
                </div>
                <button className="chip" onClick={exportCsv}>
                  Export decisions
                </button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Risk</th>
                    <th scope="col">Decision</th>
                    <th scope="col">Main reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, shown).map((r, i) => (
                    <tr key={r.account_id} style={{ animationDelay: `${Math.min(i, 30) * 15}ms` }}>
                      <td>
                        <button className="link" onClick={() => onOpen(r.features)} title="Open in Decide">
                          {r.account_id}
                        </button>
                      </td>
                      <td>
                        <span className="riskbar">
                          <span style={{ width: `${r.risk * 100}%` }} className={decide(r) === 'decline' ? 'is-decline' : ''} />
                        </span>
                        {pct(r.risk)}
                      </td>
                      <td>
                        <span className={`pill is-${decide(r)}`}>{decide(r) === 'decline' ? 'Decline' : 'Approve'}</span>
                      </td>
                      <td className="reasons">
                        {r.top_reasons.length ? r.top_reasons.slice(0, 3).map((f) => <span key={f}>{label(f)}</span>) : <span className="muted">None raise risk</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > shown && (
                <button className="chip more" onClick={() => setShown(shown + PAGE)}>
                  Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
