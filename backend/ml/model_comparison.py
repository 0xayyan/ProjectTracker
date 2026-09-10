from pathlib import Path
import json

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "processed"
BASELINE_FILE = DATA_DIR / "statistical_baseline_results.json"
ML_FILE = DATA_DIR / "machine_learning_results.json"
OUTPUT_FILE = DATA_DIR / "model_comparison_results.json"
TABLE_FILE = DATA_DIR / "model_comparison.csv"


def load_results(path):
    if not path.exists():
        raise FileNotFoundError(f"Missing file:\n{path}")
    return json.loads(path.read_text(encoding="utf-8"))


def create_comparison(baseline, machine_learning):
    rows = []
    for target in ["cost_overrun", "time_overrun"]:
        base = baseline[target]
        ml = machine_learning[target]
        rows.append({
            "target": target,
            "baseline_model": base.get("model", "Logistic Regression"),
            "ml_model": ml.get("model", "Random Forest"),
            "baseline_accuracy": base["accuracy"],
            "ml_accuracy": ml["accuracy"],
            "accuracy_change": round(ml["accuracy"] - base["accuracy"], 4),
            "baseline_precision": base["precision"],
            "ml_precision": ml["precision"],
            "precision_change": round(ml["precision"] - base["precision"], 4),
            "baseline_recall": base["recall"],
            "ml_recall": ml["recall"],
            "recall_change": round(ml["recall"] - base["recall"], 4),
            "baseline_f1": base["f1"],
            "ml_f1": ml["f1"],
            "f1_change": round(ml["f1"] - base["f1"], 4),
            "baseline_roc_auc": base["roc_auc"],
            "ml_roc_auc": ml["roc_auc"],
            "roc_auc_change": round(ml["roc_auc"] - base["roc_auc"], 4),
        })
    return rows


def main():
    baseline = load_results(BASELINE_FILE)
    machine_learning = load_results(ML_FILE)
    rows = create_comparison(baseline, machine_learning)
    pd.DataFrame(rows).to_csv(TABLE_FILE, index=False)

    results = {
        "cost_overrun": rows[0],
        "time_overrun": rows[1],
        "summary": {
            "cost_roc_auc_improved": rows[0]["roc_auc_change"] > 0,
            "time_roc_auc_improved": rows[1]["roc_auc_change"] > 0,
            "cost_f1_improved": rows[0]["f1_change"] > 0,
            "time_f1_improved": rows[1]["f1_change"] > 0,
        },
    }

    OUTPUT_FILE.write_text(
        json.dumps(results, indent=4),
        encoding="utf-8",
    )

    print()
    print("Model comparison complete")
    print(f"Results: {OUTPUT_FILE}")
    print(f"Table: {TABLE_FILE}")


if __name__ == "__main__":
    main()
