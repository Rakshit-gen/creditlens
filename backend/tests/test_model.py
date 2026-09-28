import numpy as np
import pandas as pd
import pytest

from creditlens.data import FEATURES, derive_features, load_training, validate
from creditlens.explain import counterfactuals, reasons
from creditlens.model import DIRECTION, Scorer, build


@pytest.fixture(scope="module")
def trained():
    X, y, raw = load_training()
    X, y = X.iloc[:6000], y.iloc[:6000]
    return Scorer(build().fit(X, y), X), X


def test_contributions_add_up_to_the_score(trained):
    scorer, X = trained
    rows = X.iloc[:300]
    logit = scorer.base_logit + scorer.contributions(rows).sum(axis=1)
    np.testing.assert_allclose(1 / (1 + np.exp(-logit)), scorer.predict(rows), atol=1e-9)


@pytest.mark.parametrize("feature", [f for f, d in DIRECTION.items() if d])
def test_constrained_features_only_move_risk_one_way(trained, feature):
    scorer, X = trained
    grid = np.linspace(X[feature].min(), X[feature].max(), 50)
    trial = pd.concat([X.iloc[[0]]] * len(grid), ignore_index=True)
    trial[feature] = grid
    steps = np.diff(scorer.predict(trial)) * DIRECTION[feature]
    assert (steps >= -1e-12).all()


def test_reasons_are_sorted_and_cover_every_feature(trained):
    scorer, X = trained
    out = reasons(scorer, X.iloc[[5]])
    assert sorted(r["feature"] for r in out) == sorted(FEATURES)
    assert [r["points"] for r in out] == sorted((r["points"] for r in out), reverse=True)


def test_counterfactual_lowers_risk(trained):
    scorer, X = trained
    risky = X.iloc[[int(np.argmax(scorer.predict(X)))]]
    before = scorer.predict(risky)[0]
    cfs = counterfactuals(scorer, risky, cutoff=0.3)
    assert cfs and all(c["risk"] < before for c in cfs)


def test_no_counterfactuals_when_already_approved(trained):
    scorer, X = trained
    safe = X.iloc[[int(np.argmin(scorer.predict(X)))]]
    assert counterfactuals(scorer, safe, cutoff=0.5) == []


def test_validate_keeps_good_rows_and_reports_bad_ones():
    _, _, raw = load_training()
    upload = raw.head(3).drop(columns=["defaulted"]).astype(object)
    upload.loc[1, "credit_limit"] = "lots"
    upload.loc[2, "status_m1"] = 42
    good, errors = validate(upload)
    assert len(good) == 1
    assert {(e["row"], e["column"]) for e in errors} == {(3, "credit_limit"), (4, "status_m1")}


def test_validate_reports_missing_columns():
    good, errors = validate(pd.DataFrame({"credit_limit": [1000]}))
    assert good.empty and any(e["column"] == "status_m1" for e in errors)


def test_zero_bill_history_counts_as_fully_paid():
    _, _, raw = load_training()
    row = raw.head(1).copy()
    row[[f"bill_m{i}" for i in range(1, 7)]] = 0
    assert derive_features(row)["payment_ratio"].iloc[0] == 1.0
