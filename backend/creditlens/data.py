from pathlib import Path

import numpy as np
import pandas as pd

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "credit_default.csv"

MONTHS = range(1, 7)
STATUS = [f"status_m{i}" for i in MONTHS]
BILLS = [f"bill_m{i}" for i in MONTHS]
PAID = [f"paid_m{i}" for i in MONTHS]
RAW_COLUMNS = ["credit_limit", *STATUS, *BILLS, *PAID]
# Used only for the fairness audit, never as model inputs.
PROTECTED = ["sex", "age"]

FEATURES = [
    "credit_limit",
    "utilization",
    "months_late_now",
    "late_months_6m",
    "worst_delay_6m",
    "paid_in_full_6m",
    "payment_ratio",
]


def derive_features(raw: pd.DataFrame) -> pd.DataFrame:
    status = raw[STATUS].to_numpy()
    owed = raw[BILLS[1:]].clip(lower=0).sum(axis=1)
    # paid_m1 pays the bill_m2 statement, and so on down the months.
    paid = raw[PAID[:-1]].sum(axis=1)
    return pd.DataFrame({
        "credit_limit": raw["credit_limit"],
        "utilization": (raw["bill_m1"] / raw["credit_limit"]).clip(0, 1.5),
        "months_late_now": np.maximum(status[:, 0], 0),
        "late_months_6m": (status > 0).sum(axis=1),
        "worst_delay_6m": np.maximum(status.max(axis=1), 0),
        "paid_in_full_6m": (status == -1).sum(axis=1),
        "payment_ratio": np.where(owed > 0, (paid / owed.where(owed > 0, 1)).clip(0, 1), 1.0),
    }, index=raw.index)


def load_training() -> tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    raw = pd.read_csv(DATA_PATH)
    return derive_features(raw), raw["defaulted"], raw


def validate(raw: pd.DataFrame) -> tuple[pd.DataFrame, list[dict]]:
    """Split an uploaded table into scoreable rows and row-level errors, instead of failing the whole file."""
    raw = raw.rename(columns=lambda c: str(c).strip().lower())
    missing = [c for c in RAW_COLUMNS if c not in raw.columns]
    if missing:
        return raw.iloc[0:0], [{"row": None, "column": c, "message": "column is missing"} for c in missing]

    errors = []
    raw = raw.copy()
    for c in RAW_COLUMNS:
        num = pd.to_numeric(raw[c], errors="coerce")
        for i in raw.index[num.isna()]:
            cell = str(raw.at[i, c]).strip()
            errors.append({"row": int(i) + 2, "column": c, "message": f"'{cell}' is not a number" if cell else "is empty"})
        raw[c] = num
    for i in raw.index[raw["credit_limit"] <= 0]:
        errors.append({"row": int(i) + 2, "column": "credit_limit", "message": "credit limit must be above 0"})
    for c in STATUS:
        for i in raw.index[(raw[c] < -2) | (raw[c] > 9)]:
            errors.append({"row": int(i) + 2, "column": c, "message": "status must be between -2 and 9"})

    bad = {e["row"] - 2 for e in errors}
    return raw.drop(index=list(bad)), errors
