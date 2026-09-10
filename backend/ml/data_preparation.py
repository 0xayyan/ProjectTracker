from pathlib import Path
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "processed"
INPUT_FILE = DATA_DIR / "paimana_march_2026_training.csv"
COST_OUTPUT = DATA_DIR / "cost_prediction_dataset.csv"
TIME_OUTPUT = DATA_DIR / "schedule_prediction_dataset.csv"

NUMERIC_FEATURES = [
    "original_cost_cr",
    "cumulative_expenditure_cr",
    "physical_progress_pct",
    "expenditure_ratio_pct",
    "expenditure_progress_gap_pct",
    "progress_remaining_pct",
    "project_age_months",
    "planned_duration_months",
    "months_to_original_target",
    "project_age_ratio",
    "original_cost_log_cr",
    "is_mega_project",
]

LEAKAGE_COLUMNS = [
    "revised_cost_cr",
    "revised_target_date",
    "revised_approval_date",
    "cost_overrun",
    "cost_overrun_pct",
    "time_overrun",
    "time_overrun_months",
]

if not INPUT_FILE.exists():
    raise FileNotFoundError(f"Input file not found:\n{INPUT_FILE}")

df = pd.read_csv(INPUT_FILE)

df["original_cost_cr"] = pd.to_numeric(df["original_cost_cr"], errors="coerce")
df["revised_cost_cr"] = pd.to_numeric(df["revised_cost_cr"], errors="coerce")
df["cumulative_expenditure_cr"] = pd.to_numeric(df["cumulative_expenditure_cr"], errors="coerce")
df["physical_progress_pct"] = pd.to_numeric(df["physical_progress_pct"], errors="coerce")

df["original_approval_date"] = pd.to_datetime(
    df["original_approval_date"],
    format="%m/%Y",
    errors="coerce",
)

df["original_target_date"] = pd.to_datetime(
    df["original_target_date"],
    format="%m/%Y",
    errors="coerce",
)

df["revised_target_date"] = pd.to_datetime(
    df["revised_target_date"],
    format="%m/%Y",
    errors="coerce",
)

df["snapshot_date"] = pd.to_datetime(
    df["snapshot_date"],
    errors="coerce",
)

df["cost_overrun"] = np.where(
    df["revised_cost_cr"].notna() & df["original_cost_cr"].notna(),
    (df["revised_cost_cr"] > df["original_cost_cr"]).astype(int),
    np.nan,
)

df["cost_overrun_pct"] = np.where(
    df["original_cost_cr"] > 0,
    ((df["revised_cost_cr"] - df["original_cost_cr"]) / df["original_cost_cr"]) * 100,
    np.nan,
)

df["time_overrun"] = np.where(
    df["revised_target_date"].notna() & df["original_target_date"].notna(),
    (df["revised_target_date"] > df["original_target_date"]).astype(int),
    np.nan,
)

df["time_overrun_months"] = np.where(
    df["revised_target_date"].notna() & df["original_target_date"].notna(),
    (
        (df["revised_target_date"].dt.year - df["original_target_date"].dt.year) * 12
        + (df["revised_target_date"].dt.month - df["original_target_date"].dt.month)
    ),
    np.nan,
)

df["expenditure_ratio_pct"] = np.where(
    df["original_cost_cr"] > 0,
    (df["cumulative_expenditure_cr"] / df["original_cost_cr"]) * 100,
    np.nan,
)

df["expenditure_progress_gap_pct"] = (
    df["expenditure_ratio_pct"] - df["physical_progress_pct"]
)
df["progress_remaining_pct"] = (100 - df["physical_progress_pct"]).clip(0, 100)

df["project_age_months"] = np.where(
    df["original_approval_date"].notna() & df["snapshot_date"].notna(),
    (
        (df["snapshot_date"].dt.year - df["original_approval_date"].dt.year) * 12
        + (df["snapshot_date"].dt.month - df["original_approval_date"].dt.month)
    ),
    np.nan,
)

df["planned_duration_months"] = np.where(
    df["original_approval_date"].notna() & df["original_target_date"].notna(),
    (
        (df["original_target_date"].dt.year - df["original_approval_date"].dt.year) * 12
        + (df["original_target_date"].dt.month - df["original_approval_date"].dt.month)
    ),
    np.nan,
)

df["months_to_original_target"] = np.where(
    df["original_target_date"].notna() & df["snapshot_date"].notna(),
    (
        (df["original_target_date"].dt.year - df["snapshot_date"].dt.year) * 12
        + (df["original_target_date"].dt.month - df["snapshot_date"].dt.month)
    ),
    np.nan,
)

df["project_age_ratio"] = np.where(
    df["planned_duration_months"] > 0,
    df["project_age_months"] / df["planned_duration_months"],
    np.nan,
)

df["original_cost_log_cr"] = np.log1p(
    df["original_cost_cr"].clip(lower=0)
)

df["is_mega_project"] = np.where(
    df["original_cost_cr"].notna(),
    (df["original_cost_cr"] >= 1000).astype(int),
    np.nan,
)

missing_features = [
    column
    for column in NUMERIC_FEATURES
    if column not in df.columns
]

if missing_features:
    raise RuntimeError(
        "Missing model features: " + ", ".join(missing_features)
    )

leakage_found = set(NUMERIC_FEATURES).intersection(LEAKAGE_COLUMNS)

if leakage_found:
    raise RuntimeError(
        "LEAKAGE DETECTED: " + ", ".join(sorted(leakage_found))
    )

cost_df = df[NUMERIC_FEATURES + ["cost_overrun"]].copy()
cost_df = cost_df[cost_df["cost_overrun"].notna()].copy()
cost_df["cost_overrun"] = cost_df["cost_overrun"].astype(int)
cost_df.to_csv(COST_OUTPUT, index=False)

time_df = df[
    NUMERIC_FEATURES + ["time_overrun"]
].copy()
time_df = time_df[
    time_df["time_overrun"].notna()
    & time_df["months_to_original_target"].notna()
    & (time_df["months_to_original_target"] >= 0)
].copy()
time_df["time_overrun"] = time_df["time_overrun"].astype(int)
time_df.to_csv(TIME_OUTPUT, index=False)

print(f"Loaded {len(df)} projects")
print(f"Cost model rows: {len(cost_df)}")
print(cost_df["cost_overrun"].value_counts().sort_index())
print()
print(f"Schedule model rows: {len(time_df)}")
print(time_df["time_overrun"].value_counts().sort_index())
print()
print(f"Created: {COST_OUTPUT}")
print(f"Created: {TIME_OUTPUT}")
print("Leakage check: PASSED")
