import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getModel, type Account, type Batch, type ModelInfo } from './api'
import { PRESETS } from './AccountControls'
import Decide from './Decide'
import Policy from './Policy'
import Queue from './Queue'
import ModelCard from './ModelCard'
import Home from './Home'

const VIEWS = [
  { id: 'home', label: 'Home' },
  { id: 'decide', label: 'Decide' },
  { id: 'policy', label: 'Policy' },
  { id: 'queue', label: 'Queue' },
  { id: 'model', label: 'Model' },
] as const

type View = (typeof VIEWS)[number]['id']

const fromHash = (): View => {
  const h = window.location.hash.slice(1)
  return VIEWS.some((v) => v.id === h) ? (h as View) : 'home'
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
    const onHash = () => {
      setView(fromHash())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="shell">
      <header className="masthead">
        <a className="wordmark" href="#home">
          <span className="wordmark-seal" aria-hidden="true" />
          creditlens
        </a>
        <div className="masthead-right">
          <Tabs view={view} />
          <ThemeToggle />
        </div>
      </header>

      <main className="stage" key={view}>
        {loadError && (
          <p className="notice">
            Can't reach the scoring service: {loadError} Start it with <code>make api</code> and reload.
          </p>
        )}
        {view === 'home' && <Home model={model} cutoff={cutoff} />}
        {view === 'decide' && (
          <Decide model={model} cutoff={cutoff} onCutoff={setCutoff} account={account} setAccount={setAccount} />
        )}
        {view === 'policy' && <Policy model={model} cutoff={cutoff} onCutoff={setCutoff} />}
        {view === 'queue' && (
          <Queue model={model} cutoff={cutoff} batch={batch} setBatch={setBatch} onOpen={openAccount} />
        )}
        {view === 'model' && <ModelCard model={model} />}
      </main>

      <footer className="footer">
        <p>
          Data: <a href="https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients">Default of Credit Card Clients</a>,
          UCI Machine Learning Repository. 30,000 cardholders in Taiwan, 2005, amounts in NT$.
        </p>
        <p>
          <a href="https://github.com/Rakshit-gen/creditlens">Source on GitHub</a>. MIT licensed. Not financial or legal advice.
        </p>
      </footer>
    </div>
  )
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const t = document.documentElement.dataset.theme
    return t ? t === 'dark' : systemDark()
  })
  const flip = () => {
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Private windows can block storage; the theme still applies for this visit.
    }
    setDark(!dark)
  }
  return (
    <button className="theme" onClick={flip} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>
      <span className={`theme-orb ${dark ? 'is-dark' : ''}`} aria-hidden="true" />
    </button>
  )
}

function Tabs({ view }: { view: View }) {
  const nav = useRef<HTMLElement>(null)
  const [bar, setBar] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const place = () => {
      const el = nav.current?.querySelector<HTMLElement>(`[data-view="${view}"]`)
      setBar(el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 })
    }
    place()
    document.fonts.ready.then(place)
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [view])

  return (
    <nav className="tabs" ref={nav} aria-label="Views">
      {VIEWS.filter((v) => v.id !== 'home').map((v) => (
        <a key={v.id} href={`#${v.id}`} data-view={v.id} aria-current={view === v.id ? 'page' : undefined}>
          {v.label}
        </a>
      ))}
      <span className="tabs-bar" style={{ transform: `translateX(${bar.left}px)`, width: bar.width }} />
    </nav>
  )
}
