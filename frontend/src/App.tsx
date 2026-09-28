import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getModel, type Account, type Batch, type ModelInfo } from './api'
import { PRESETS } from './AccountControls'
import Decide from './Decide'
import Policy from './Policy'
import Queue from './Queue'
import ModelCard from './ModelCard'

const VIEWS = [
  { id: 'decide', label: 'Decide' },
  { id: 'policy', label: 'Policy' },
  { id: 'queue', label: 'Queue' },
  { id: 'model', label: 'Model' },
] as const

type View = (typeof VIEWS)[number]['id']

const fromHash = (): View => {
  const h = window.location.hash.slice(1)
  return VIEWS.some((v) => v.id === h) ? (h as View) : 'decide'
}

export default function App() {
  const [view, setView] = useState<View>(fromHash)
  const [cutoff, setCutoff] = useState(0.5)
  const [model, setModel] = useState<ModelInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [account, setAccount] = useState<Account>(PRESETS[2].account)
  const [batch, setBatch] = useState<Batch | null>(null)

  const openAccount = (a: Account) => {
    setAccount(a)
    window.location.hash = 'decide'
  }

  useEffect(() => {
    getModel().then(setModel, (e: Error) => setLoadError(e.message))
    const onHash = () => setView(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="shell">
      <header className="masthead">
        <a className="wordmark" href="#decide">
          <span className="wordmark-seal" aria-hidden="true" />
          creditlens
        </a>
        <Tabs view={view} />
      </header>

      <main className="stage" key={view}>
        {loadError && (
          <p className="notice">
            Can't reach the scoring service: {loadError} Start it with <code>make api</code> and reload.
          </p>
        )}
        {view === 'decide' && (
          <Decide model={model} cutoff={cutoff} onCutoff={setCutoff} account={account} setAccount={setAccount} />
        )}
        {view === 'policy' && <Policy model={model} cutoff={cutoff} onCutoff={setCutoff} />}
        {view === 'queue' && (
          <Queue model={model} cutoff={cutoff} batch={batch} setBatch={setBatch} onOpen={openAccount} />
        )}
        {view === 'model' && <ModelCard model={model} />}
      </main>
    </div>
  )
}

function Tabs({ view }: { view: View }) {
  const nav = useRef<HTMLElement>(null)
  const [bar, setBar] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const place = () => {
      const el = nav.current?.querySelector<HTMLElement>(`[data-view="${view}"]`)
      if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [view])

  return (
    <nav className="tabs" ref={nav} aria-label="Views">
      {VIEWS.map((v) => (
        <a key={v.id} href={`#${v.id}`} data-view={v.id} aria-current={view === v.id ? 'page' : undefined}>
          {v.label}
        </a>
      ))}
      <span className="tabs-bar" style={{ transform: `translateX(${bar.left}px)`, width: bar.width }} />
    </nav>
  )
}
