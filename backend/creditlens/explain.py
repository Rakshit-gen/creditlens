import numpy as np
import pandas as pd

from .data import FEATURES
from .model import Scorer

LABELS = {
    "credit_limit": "Credit limit",
    "utilization": "Credit utilization",
    "months_late_now": "Current delinquency",
    "late_months_6m": "Late payment history",
    "worst_delay_6m": "Worst recent delay",
    "paid_in_full_6m": "Full-balance payments",
    "payment_ratio": "Share of bills paid",
}

# Things a cardholder can change within a billing cycle or two, with the range worth trying.
ACTIONABLE = {
    "utilization": np.linspace(0, 1.5, 61),
    "payment_ratio": np.linspace(0, 1, 41),
    "months_late_now": np.arange(0, 9),
}


def _months(n) -> str:
    n = int(n)
    return f"{n} month" if n == 1 else f"{n} months"


def describe(feature: str, v: float) -> str:
    match feature:
        case "credit_limit":
            return f"Credit limit is NT${v:,.0f}"
        case "utilization":
            return f"Card is barely used ({v:.0%} of limit)" if v < 0.05 else f"Using {v:.0%} of the credit limit"
        case "months_late_now":
            return "Current on payments" if v == 0 else f"Payment is {_months(v)} past due right now"
        case "late_months_6m":
            return "No late payments in 6 months" if v == 0 else f"Paid late in {int(v)} of the last 6 months"
        case "worst_delay_6m":
            return "Never more than on time" if v == 0 else f"Fell {_months(v)} behind at worst"
        case "paid_in_full_6m":
            return "Never paid the full balance" if v == 0 else f"Paid in full {int(v)} of the last 6 months"
        case "payment_ratio":
            return f"Paid {v:.0%} of what was billed"
    raise KeyError(feature)


def reasons(scorer: Scorer, row: pd.DataFrame) -> list[dict]:
    """Every feature's pull on this score, biggest risk raisers first. Points are log-odds x 100 vs the average account."""
    contrib = scorer.contributions(row)[0]
    out = [
        {
            "feature": f,
            "label": LABELS[f],
            "value": float(row[f].iloc[0]),
            "text": describe(f, float(row[f].iloc[0])),
            "points": round(float(c) * 100, 1),
        }
        for f, c in zip(FEATURES, contrib)
    ]
    return sorted(out, key=lambda r: -r["points"])


def counterfactuals(scorer: Scorer, row: pd.DataFrame, cutoff: float) -> list[dict]:
    """Per actionable feature: the smallest change that gets under the cutoff, or failing that the change that helps most.

    The model is additive, so changing one feature moves the score by exactly that feature's curve.
    """
    current = float(scorer.predict(row)[0])
    if current < cutoff:
        return []
    out = []
    for f, grid in ACTIONABLE.items():
        now = float(row[f].iloc[0])
        trial = pd.concat([row] * len(grid), ignore_index=True)
        trial[f] = grid
        risk = scorer.predict(trial)
        ok = np.flatnonzero(risk < cutoff)
        best = ok[np.argmin(np.abs(grid[ok] - now))] if len(ok) else int(np.argmin(risk))
        if risk[best] >= current - 0.005:
            continue
        out.append({
            "feature": f,
            "label": LABELS[f],
            "from": now,
            "to": float(grid[best]),
            "text": describe(f, float(grid[best])),
            "risk": float(risk[best]),
            "meets_cutoff": bool(len(ok)),
        })
    return sorted(out, key=lambda c: (not c["meets_cutoff"], c["risk"]))


def shape(scorer: Scorer, X_train: pd.DataFrame, points: int = 40) -> dict:
    """Each feature's learned curve across its training range, for drawing in the UI."""
    base = X_train.median().to_frame().T
    curves = {}
    for i, f in enumerate(FEATURES):
        lo, hi = X_train[f].quantile([0.01, 0.99])
        grid = np.unique(np.round(np.linspace(lo, hi, points), 4))
        trial = pd.concat([base] * len(grid), ignore_index=True)
        trial[f] = grid
        curves[f] = {
            "label": LABELS[f],
            "x": grid.tolist(),
            "points": np.round(scorer.contributions(trial)[:, i] * 100, 1).tolist(),
        }
    return curves
