import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier

from .data import FEATURES

# +1: higher value can only raise risk, -1: can only lower it, 0: free.
# Utilization stays free because the data is truly U-shaped: barely-used cards default more than moderately used ones.
DIRECTION = {
    "credit_limit": -1,
    "utilization": 0,
    "months_late_now": 1,
    "late_months_6m": 1,
    "worst_delay_6m": 1,
    "paid_in_full_6m": -1,
    "payment_ratio": -1,
}


def build() -> HistGradientBoostingClassifier:
    # Depth-1 trees each look at one feature, so the model is a sum of per-feature curves (a GAM).
    return HistGradientBoostingClassifier(
        max_depth=1,
        monotonic_cst=[DIRECTION[f] for f in FEATURES],
        random_state=0,
    )


class Scorer:
    def __init__(self, model: HistGradientBoostingClassifier, X_train: pd.DataFrame):
        self.model = model
        self._ref = X_train[FEATURES].iloc[[0]].reset_index(drop=True)
        self._offset = self._raw_parts(X_train).mean(axis=0)
        self.base_logit = float(self._logit(self._ref)[0] + self._offset.sum())

    def _logit(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.decision_function(X[FEATURES])

    def _raw_parts(self, X: pd.DataFrame) -> np.ndarray:
        X = X[FEATURES].reset_index(drop=True)
        full = self._logit(X)
        parts = np.empty((len(X), len(FEATURES)))
        for i, f in enumerate(FEATURES):
            swapped = X.copy()
            swapped[f] = self._ref[f].iloc[0]
            parts[:, i] = full - self._logit(swapped)
        return parts

    def contributions(self, X: pd.DataFrame) -> np.ndarray:
        """Log-odds each feature adds versus the average account. Rows sum to logit minus base_logit."""
        return self._raw_parts(X) - self._offset

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.predict_proba(X[FEATURES])[:, 1]
