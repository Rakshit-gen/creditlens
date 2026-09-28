import io
import math
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .data import DATA_PATH, FEATURES, RAW_COLUMNS, derive_features, validate
from .explain import counterfactuals, reasons
from .train import load

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "dist"

bundle = load()
scorer = bundle["scorer"]
app = FastAPI(title="creditlens")


class Account(BaseModel):
    credit_limit: float = Field(gt=0, le=10_000_000)
    utilization: float = Field(ge=0, le=1.5)
    months_late_now: int = Field(ge=0, le=9)
    late_months_6m: int = Field(ge=0, le=6)
    worst_delay_6m: int = Field(ge=0, le=9)
    paid_in_full_6m: int = Field(ge=0, le=6)
    payment_ratio: float = Field(ge=0, le=1)


class ScoreRequest(BaseModel):
    account: Account
    cutoff: float = Field(0.5, gt=0, lt=1)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/model")
def model_info():
    return {**bundle["report"], "base_risk": _sigmoid(scorer.base_logit), "holdout": bundle["holdout"]}


@app.post("/api/score")
def score(req: ScoreRequest):
    row = pd.DataFrame([req.account.model_dump()])[FEATURES]
    risk = float(scorer.predict(row)[0])
    return {
        "risk": risk,
        "decision": "decline" if risk >= req.cutoff else "approve",
        "reasons": reasons(scorer, row),
        "counterfactuals": counterfactuals(scorer, row, req.cutoff),
    }


@app.post("/api/score/batch")
async def score_batch(file: UploadFile = File(...), cutoff: float = Query(0.5, gt=0, lt=1)):
    body = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is over 10 MB. Split it into smaller batches.")
    try:
        raw = pd.read_csv(io.BytesIO(body), dtype=str, keep_default_na=False)
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError):
        raise HTTPException(400, "Couldn't read that as a CSV file.")

    good, errors = validate(raw)
    if good.empty:
        return {"rows": [], "errors": errors, "scored": 0, "rejected_rows": len({e["row"] for e in errors})}

    X = derive_features(good)
    risk = scorer.predict(X)
    contrib = scorer.contributions(X)
    ids = good["account_id"] if "account_id" in good.columns else good.index + 2
    rows = []
    for i, (acct, r, c) in enumerate(zip(ids, risk, contrib)):
        top = sorted(zip(FEATURES, c), key=lambda t: -t[1])[:4]
        rows.append({
            "account_id": str(acct),
            "risk": round(float(r), 4),
            "decision": "decline" if r >= cutoff else "approve",
            "features": {f: float(X.iloc[i][f]) for f in FEATURES},
            "top_reasons": [f for f, v in top if v > 0],
        })
    rows.sort(key=lambda r: -r["risk"])
    return {"rows": rows, "errors": errors, "scored": len(rows), "rejected_rows": len({e["row"] for e in errors})}


@app.get("/api/sample.csv", response_class=PlainTextResponse)
def sample_csv():
    df = pd.read_csv(DATA_PATH, nrows=250)
    return df[["account_id", *RAW_COLUMNS]].to_csv(index=False)


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
