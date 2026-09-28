# creditlens

Credit card default risk scoring where every score comes with the exact reasons behind it, the reasons a lender is legally required to give.

It predicts whether a cardholder will miss next month's payment, explains the score in plain English, tells you what would flip a decline, drafts the decline letter, and lets you pick a cutoff while watching approval rate, losses and group fairness move together. It runs on a laptop. The model trains in about a tenth of a second.

## The problems it goes after

I started from what actually goes wrong when a small lender or fintech puts a risk model into production, not from what model gets the highest score on a leaderboard.

**1. "Why was I declined?" has to have a real answer.**
In the US, ECOA and Regulation B require lenders to give the specific principal reasons for an adverse action, and that includes cutting the limit on an existing card. The CFPB said in Circular 2022-03 that "our model is too complex" is not an excuse. Most teams bolt SHAP onto a black box and hope the approximation holds up.
*What creditlens does:* the model is a sum of one curve per feature, so each reason is the exact amount that feature moved the score. The parts add up to the prediction down to floating-point rounding, and a test checks it.

**2. Reasons that contradict common sense.**
Unconstrained models happily learn that paying more of your bill makes you riskier, because of some quirk in the data. Put that in a decline letter and model risk review (SR 11-7 in the US) sends it back. My first version, a spline model, did exactly this.
*What creditlens does:* monotonic constraints. More months late can only raise risk and a higher share of the bill paid can only lower it, and tests check both directions. Utilization is the one feature left free, because the data really is U-shaped: cards that are barely used default more than moderately used ones.

**3. A "no" with no way forward.**
Customers and support agents get a decline and no idea what would change it.
*What creditlens does:* for each thing a cardholder can actually change (getting current, paying down the balance, paying more of each bill) it finds the smallest change that clears the cutoff, or the one that helps most if none can do it alone. One click tries it on the sliders.

**4. Cutoffs picked in a spreadsheet.**
Where you set the decline line decides approval rate, losses and growth, but those tradeoffs usually live in someone's Excel file.
*What creditlens does:* drag the cutoff across 6,000 held-out cardholders and see approval rate, bad rate among approved, defaulters caught, good payers turned away, and one-cycle profit. You set your own loss rate and margin, and one button jumps to the most profitable cutoff.

**5. Accuracy is the wrong number.**
With 22% of cardholders defaulting, a model that says "nobody defaults" is 78% accurate and useless.
*What creditlens does:* reports ROC-AUC, the KS statistic lenders actually use, PR-AUC and Brier score, each with a one-line plain-English meaning.

**6. Scores treated as probabilities without checking.**
If the model says 30%, pricing and loss provisioning assume 30%.
*What creditlens does:* a calibration chart on held-out data. Across the whole test set the model predicts 22.0% and 22.1% actually defaulted.

**7. Fairness checked late or never.**
*What creditlens does:* sex and age never go into the model. They're only used afterwards to compare approval rates across groups at whatever cutoff you pick, against the four-fifths rule of thumb (borrowed from US employment law and commonly used in lending reviews).

**8. One bad cell kills the whole upload.**
*What creditlens does:* batch scoring checks every row, lists what's wrong with each bad one (quoting what you actually typed, not "nan"), and scores the rest.

**9. It needs an ML platform to run.**
*What creditlens does:* one Python process, one CSV, no GPU. The full training run including cross-validation and the black-box comparison takes about 2 seconds.

## Quickstart

Needs Python 3.12+ and Node 20+.

```
make setup     # venv, backend deps, frontend deps
make train     # trains the model and writes backend/models/report.json
make api       # API on http://127.0.0.1:8765
make web       # in a second terminal: UI on http://localhost:5173
```

Or build the UI and serve everything from one process with `make serve`, then open http://127.0.0.1:8765.

`make test` runs the backend tests and the frontend logic checks.

## Measured vs Claimed

Every number here comes from `backend/models/report.json` or the held-out set saved alongside the model. Update this table instead of writing new numbers anywhere else.

| Claim | Value | How measured | Date |
|---|---|---|---|
| ROC-AUC | 0.758 | 6,000 held-out cardholders, stratified 80/20 split, seed 42 | 2026-09-28 |
| ROC-AUC, 5-fold CV | 0.769 ± 0.021 | `cross_val_score`, all 30,000 rows | 2026-09-28 |
| KS statistic | 0.388 | Same held-out set | 2026-09-28 |
| PR-AUC | 0.518 | Same held-out set, base rate 0.221 | 2026-09-28 |
| Brier score | 0.139 | Same held-out set | 2026-09-28 |
| Black-box ROC-AUC for comparison | 0.774 | `HistGradientBoostingClassifier` defaults on all 19 raw columns, same split | 2026-09-28 |
| Mean predicted vs actual default rate | 22.0% vs 22.1% | Same held-out set | 2026-09-28 |
| Approval rate at a 50% cutoff | 88.6%, and 16.2% of those default | Same held-out set | 2026-09-28 |
| Group approval ratio at a 50% cutoff | 0.99 by sex, 0.97 by age band | Lowest group approval rate over the highest | 2026-09-28 |
| Model fit time | 0.14 s | `make train`, Apple Silicon MacBook, 10 cores, 16 GB | 2026-09-28 |
| Full training run | about 2 s wall clock | Same, including CV and the black-box model | 2026-09-28 |

The honest tradeoff: the black box gets 0.017 more ROC-AUC on the same split. That's what exact, always-sensible reasons cost here.

## How it works

```
backend/
  fetch_data.py         downloads the UCI dataset once and renames columns
  creditlens/data.py    7 features an analyst would recognise, plus row-level upload validation
  creditlens/model.py   boosted depth-1 trees with monotonic constraints (a GAM), and the exact contribution split
  creditlens/explain.py reason text, counterfactuals, per-feature curves
  creditlens/train.py   split, fit, evaluate, save model bundle and report.json
  creditlens/api.py     FastAPI: /api/score, /api/score/batch, /api/model, /api/sample.csv
frontend/               React + Vite, no UI or chart libraries, light and dark themes
  Home                  a live two-slider demo, the problems above, and measured results
  Decide                sliders, live score, reason waterfall, what-ifs, decline letter
  Policy                cutoff histogram, outcomes, profit curve, group approval rates
  Queue                 CSV upload, ranked accounts, bad-row report, export
  Model                 metrics, black-box comparison, calibration, learned curves
```

Why depth-1 trees: each tree looks at one feature, so the model is a sum of per-feature step curves. That makes it additive like a traditional scorecard. Swapping one feature back to a reference value and re-scoring gives that feature's exact contribution. It also means the curves on the Model page are the whole model, with nothing hidden behind them.

The seven features: credit limit, balance as a share of the limit, months past due right now, late months out of the last six, worst delay in six months, months paid in full, and share of bills paid over five months.

## Data

[Default of Credit Card Clients](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients) from the UCI Machine Learning Repository (Yeh and Lien, 2009). That's 30,000 cardholders in Taiwan, April to September 2005, with amounts in New Taiwan dollars. `backend/data/credit_default.csv` is the same data with readable column names.

## Status

Works: training, single and batch scoring, all four views, backend tests (19) and frontend logic checks.

Known limits:
- The data is 20 years old and from one market. The workflow carries over to other data; these particular numbers don't.
- The profit math is one billing cycle with a flat loss rate and margin. It's there to show the shape of the tradeoff, not to price a portfolio.
- The fairness check compares approval rates only. It doesn't test for proxies or check whether error rates are equal across groups.
- The 250-row sample file is the first 250 rows of the dataset, so some of them were in the training split.
- The decline letter is a draft. Your compliance team still adds the ECOA notice and bureau disclosures.
- The UI was checked with type checks, a production build and API tests, not in a real browser yet.

## License

MIT
