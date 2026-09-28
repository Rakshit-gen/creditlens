import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, SplineTransformer

from .data import FEATURES


def build() -> Pipeline:
    # Additive model (a GAM): each feature gets its own smooth curve, so a score splits exactly into per-feature parts.
    return Pipeline([
        ("log_limit", FunctionTransformer(_log_limit, feature_names_out="one-to-one")),
        ("splines", SplineTransformer(n_knots=5, degree=2)),
        ("lr", LogisticRegression(max_iter=2000)),
    ])


def _log_limit(X):
    X = X.copy()
    X["credit_limit"] = np.log(X["credit_limit"])
    return X


class Scorer:
    def __init__(self, pipe: Pipeline, X_train: pd.DataFrame):
        self.pipe = pipe
        splines = pipe.named_steps["splines"]
        lr = pipe.named_steps["lr"]
        per = splines.n_features_out_ // len(FEATURES)
        self._coef = lr.coef_[0].reshape(len(FEATURES), per)
        basis = self._basis(X_train)
        self._mean_basis = basis.mean(axis=0)
        self.base_logit = float(lr.intercept_[0] + (self._coef * self._mean_basis).sum())

    def _basis(self, X: pd.DataFrame) -> np.ndarray:
        b = self.pipe[:-1].transform(X[FEATURES])
        return b.reshape(len(X), len(FEATURES), -1)

    def contributions(self, X: pd.DataFrame) -> np.ndarray:
        """Log-odds each feature adds versus the average account. Rows sum to logit minus base_logit."""
        return ((self._basis(X) - self._mean_basis) * self._coef).sum(axis=2)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.pipe.predict_proba(X[FEATURES])[:, 1]
