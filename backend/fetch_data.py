"""Download the UCI 'default of credit card clients' dataset and save it as a readable CSV.

Yeh, I-C. (2009). 30,000 Taiwanese cardholders, Apr-Sep 2005, amounts in NT$.
Run once: python fetch_data.py
"""
import sys

import pandas as pd

URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/00350/default%20of%20credit%20card%20clients.xls"
OUT = "data/credit_default.csv"

src = sys.argv[1] if len(sys.argv) > 1 else URL
df = pd.read_excel(src, header=1)

# Month 1 is the most recent (Sep 2005), month 6 the oldest (Apr 2005).
rename = {"ID": "account_id", "LIMIT_BAL": "credit_limit", "AGE": "age", "default payment next month": "defaulted"}
for i, pay in enumerate(["PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6"], start=1):
    rename[pay] = f"status_m{i}"
    rename[f"BILL_AMT{i}"] = f"bill_m{i}"
    rename[f"PAY_AMT{i}"] = f"paid_m{i}"
df = df.rename(columns=rename)

df["sex"] = df["SEX"].map({1: "male", 2: "female"})
df["education"] = df["EDUCATION"].map({1: "graduate", 2: "university", 3: "high_school"}).fillna("other")
df["marriage"] = df["MARRIAGE"].map({1: "married", 2: "single"}).fillna("other")
df = df.drop(columns=["SEX", "EDUCATION", "MARRIAGE"])

df.to_csv(OUT, index=False)
print(f"wrote {len(df)} rows to {OUT}, default rate {df['defaulted'].mean():.3f}")
