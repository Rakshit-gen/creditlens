from pathlib import Path

import pandas as pd

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "telco.csv"

ID_COL = "customerID"
TARGET = "Churn"
NUMERIC = ["tenure", "MonthlyCharges", "TotalCharges"]
CATEGORICAL = [
    "gender", "SeniorCitizen", "Partner", "Dependents", "PhoneService",
    "MultipleLines", "InternetService", "OnlineSecurity", "OnlineBackup",
    "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies",
    "Contract", "PaperlessBilling", "PaymentMethod",
]
FEATURES = NUMERIC + CATEGORICAL


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")
    # Brand new customers (tenure 0) have a blank TotalCharges: they haven't been billed yet.
    df.loc[df["TotalCharges"].isna() & (df["tenure"] == 0), "TotalCharges"] = 0.0
    df["SeniorCitizen"] = df["SeniorCitizen"].map({0: "No", 1: "Yes", "0": "No", "1": "Yes"}).fillna(df["SeniorCitizen"])
    for c in CATEGORICAL:
        df[c] = df[c].astype(str).str.strip()
    return df


def load_training() -> tuple[pd.DataFrame, pd.Series]:
    df = clean(pd.read_csv(DATA_PATH))
    return df[FEATURES], (df[TARGET] == "Yes").astype(int)
