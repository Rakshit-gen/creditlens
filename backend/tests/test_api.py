from fastapi.testclient import TestClient

from creditlens.api import app

client = TestClient(app)

RISKY = {
    "credit_limit": 50000, "utilization": 0.95, "months_late_now": 2, "late_months_6m": 3,
    "worst_delay_6m": 2, "paid_in_full_6m": 0, "payment_ratio": 0.05,
}


def test_score_declines_risky_account_with_reasons():
    r = client.post("/api/score", json={"account": RISKY, "cutoff": 0.4}).json()
    assert r["decision"] == "decline"
    assert r["reasons"][0]["points"] > 0
    assert r["counterfactuals"]


def test_score_rejects_out_of_range_input():
    assert client.post("/api/score", json={"account": {**RISKY, "utilization": 7}}).status_code == 422


def test_batch_scores_sample_file_sorted_by_risk():
    csv = client.get("/api/sample.csv").text
    r = client.post("/api/score/batch?cutoff=0.5", files={"file": ("s.csv", csv)}).json()
    risks = [row["risk"] for row in r["rows"]]
    assert r["scored"] == 250 and r["errors"] == []
    assert risks == sorted(risks, reverse=True)


def test_batch_reports_bad_rows_without_failing():
    lines = client.get("/api/sample.csv").text.splitlines()[:4]
    cells = lines[2].split(",")
    cells[1] = "n/a"
    lines[2] = ",".join(cells)
    r = client.post("/api/score/batch", files={"file": ("s.csv", "\n".join(lines))}).json()
    assert r["scored"] == 2 and r["rejected_rows"] == 1
    assert r["errors"][0] == {"row": 3, "column": "credit_limit", "message": "'n/a' is not a number"}


def test_batch_rejects_non_csv():
    r = client.post("/api/score/batch", files={"file": ("x.csv", b"\xff\xfe\x00garbage")})
    assert r.status_code == 400


def test_model_info_has_holdout_for_simulator():
    r = client.get("/api/model").json()
    assert len(r["holdout"]["risk"]) == r["rows_test"]
    assert 0 < r["base_risk"] < 1
