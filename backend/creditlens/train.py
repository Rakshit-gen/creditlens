import json
import time
from datetime import date
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score, roc_curve
from sklearn.model_selection import cross_val_score, train_test_split

from .data import RAW_COLUMNS, load_training
from .explain import shape
from .model import Scorer, build

MODELS = Path(__file__).resolve().parent.parent / "models"
BUNDLE = MODELS / "bundle.joblib"
REPORT = MODELS / "report.json"


def ks_stat(y, p) -> float:
    fpr, tpr, _ = roc_curve(y, p)
    return float(np.max(tpr - fpr))


def calibration(y, p, bins=10) -> list[dict]:
    edges = np.quantile(p, np.linspace(0, 1, bins + 1))
    idx = np.clip(np.searchsorted(edges, p, side="right") - 1, 0, bins - 1)
    return [
        {"predicted": round(float(p[idx == b].mean()), 4), "actual": round(float(y[idx == b].mean()), 4), "n": int((idx == b).sum())}
        for b in range(bins) if (idx == b).any()
    ]


def train() -> dict:
    X, y, raw = load_training()
    Xtr, Xte, ytr, yte, rtr, rte = train_test_split(X, y, raw, test_size=0.2, stratify=y, random_state=42)

    started = time.perf_counter()
    scorer = Scorer(build().fit(Xtr, ytr), Xtr)
    fit_seconds = time.perf_counter() - started

    p = scorer.predict(Xte)
    yv = yte.to_numpy()
    black_box = HistGradientBoostingClassifier(random_state=0).fit(rtr[RAW_COLUMNS], ytr)
    cv = cross_val_score(build(), X, y, cv=5, scoring="roc_auc")

    report = {
        "trained_on": date.today().isoformat(),
        "rows_train": len(Xtr),
        "rows_test": len(Xte),
        "default_rate": round(float(y.mean()), 4),
        "fit_seconds": round(fit_seconds, 3),
        "metrics": {
            "roc_auc": round(roc_auc_score(yv, p), 4),
            "pr_auc": round(average_precision_score(yv, p), 4),
            "ks": round(ks_stat(yv, p), 4),
            "brier": round(brier_score_loss(yv, p), 4),
            "cv_roc_auc_mean": round(float(cv.mean()), 4),
            "cv_roc_auc_std": round(float(cv.std()), 4),
        },
        "black_box_roc_auc": round(roc_auc_score(yv, black_box.predict_proba(rte[RAW_COLUMNS])[:, 1]), 4),
        "calibration": calibration(yv, p),
        "curves": shape(scorer, Xtr),
    }
    holdout = {
        "risk": np.round(p, 4).tolist(),
        "defaulted": yv.tolist(),
        "sex": rte["sex"].tolist(),
        "age": rte["age"].tolist(),
        "exposure": rte["bill_m1"].clip(lower=0).round().astype(int).tolist(),
    }

    MODELS.mkdir(exist_ok=True)
    joblib.dump({"scorer": scorer, "holdout": holdout, "report": report}, BUNDLE)
    REPORT.write_text(json.dumps({k: v for k, v in report.items() if k != "curves"}, indent=2) + "\n")
    return {"scorer": scorer, "holdout": holdout, "report": report}


def load() -> dict:
    return joblib.load(BUNDLE) if BUNDLE.exists() else train()


if __name__ == "__main__":
    r = train()["report"]
    print(json.dumps({k: r[k] for k in ("fit_seconds", "metrics", "black_box_roc_auc")}, indent=2))
