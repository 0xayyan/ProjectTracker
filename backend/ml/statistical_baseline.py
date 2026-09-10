from pathlib import Path
import json

import pandas as pd

from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "processed"
COST_FILE = DATA_DIR / "cost_prediction_dataset.csv"
TIME_FILE = DATA_DIR / "schedule_prediction_dataset.csv"
RESULT_FILE = DATA_DIR / "statistical_baseline_results.json"

FEATURES = [
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


def evaluate(file_path, target):
    df = pd.read_csv(file_path)
    X = df[FEATURES].copy()
    y = df[target].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)),
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_prob)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()

    result = {
        "target": target,
        "dataset_rows": len(df),
        "positive_cases": int(y.sum()),
        "negative_cases": int((y == 0).sum()),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "accuracy": round(float(accuracy), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "roc_auc": round(float(auc), 4),
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "true_positives": int(tp),
        "model": "Logistic Regression",
    }

    print()
    print("=" * 60)
    print(f"TARGET: {target}")
    print("=" * 60)
    print(f"Dataset size: {len(df)}")
    print(f"Training rows: {len(X_train)}")
    print(f"Testing rows: {len(X_test)}")
    print()
    print("BASELINE RESULTS")
    print("-" * 40)
    print(f"Accuracy : {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall   : {recall:.4f}")
    print(f"F1 Score : {f1:.4f}")
    print(f"ROC-AUC  : {auc:.4f}")
    print()
    print("CONFUSION MATRIX")
    print("-" * 40)
    print(f"True Negatives : {tn}")
    print(f"False Positives: {fp}")
    print(f"False Negatives: {fn}")
    print(f"True Positives  : {tp}")

    return result


def main():
    if not COST_FILE.exists():
        raise FileNotFoundError(f"Missing file:\n{COST_FILE}")
    if not TIME_FILE.exists():
        raise FileNotFoundError(f"Missing file:\n{TIME_FILE}")

    results = {
        "cost_overrun": evaluate(COST_FILE, "cost_overrun"),
        "time_overrun": evaluate(TIME_FILE, "time_overrun"),
    }

    RESULT_FILE.write_text(
        json.dumps(results, indent=4),
        encoding="utf-8",
    )

    print()
    print("Statistical baseline complete")
    print(f"Results saved to: {RESULT_FILE}")


if __name__ == "__main__":
    main()
