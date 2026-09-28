export type Account = {
  credit_limit: number
  utilization: number
  months_late_now: number
  late_months_6m: number
  worst_delay_6m: number
  paid_in_full_6m: number
  payment_ratio: number
}

export type Feature = keyof Account

export type Reason = { feature: Feature; label: string; value: number; text: string; points: number }

export type Counterfactual = {
  feature: Feature
  label: string
  from: number
  to: number
  text: string
  risk: number
  meets_cutoff: boolean
}

export type Score = {
  risk: number
  decision: 'approve' | 'decline'
  reasons: Reason[]
  counterfactuals: Counterfactual[]
}

export type Curve = { label: string; x: number[]; points: number[] }

export type ModelInfo = {
  trained_on: string
  rows_train: number
  rows_test: number
  default_rate: number
  fit_seconds: number
  base_risk: number
  metrics: {
    roc_auc: number
    pr_auc: number
    ks: number
    brier: number
    cv_roc_auc_mean: number
    cv_roc_auc_std: number
  }
  black_box_roc_auc: number
  calibration: { predicted: number; actual: number; n: number }[]
  curves: Record<Feature, Curve>
  holdout: { risk: number[]; defaulted: number[]; sex: string[]; age: number[]; exposure: number[] }
}

export type BatchRow = {
  account_id: string
  risk: number
  decision: 'approve' | 'decline'
  features: Account
  top_reasons: Feature[]
}

export type UploadError = { row: number | null; column: string; message: string }

export type Batch = { rows: BatchRow[]; errors: UploadError[]; scored: number; rejected_rows: number }

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : `The server answered ${res.status}.`
    throw new Error(detail)
  }
  return res.json()
}

export const getModel = () => call<ModelInfo>('/api/model')

export const scoreAccount = (account: Account, cutoff: number, signal?: AbortSignal) =>
  call<Score>('/api/score', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account, cutoff }),
    signal,
  })

export function scoreBatch(file: Blob, cutoff: number) {
  const form = new FormData()
  form.append('file', file, 'upload.csv')
  return call<Batch>(`/api/score/batch?cutoff=${cutoff}`, { method: 'POST', body: form })
}

export const getSampleCsv = () => fetch('/api/sample.csv').then((r) => r.blob())

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`

export const money = (x: number) =>
  `NT$${x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${Math.round(x / 1e3)}k` : Math.round(x)}`
