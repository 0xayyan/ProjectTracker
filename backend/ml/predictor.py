from datetime import date
from pathlib import Path
import math

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "processed"
COST_MODEL_FILE = DATA_DIR / "cost_prediction_model.joblib"
TIME_MODEL_FILE = DATA_DIR / "schedule_prediction_model.joblib"

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

if not COST_MODEL_FILE.exists():
    raise FileNotFoundError(f"Missing cost model: {COST_MODEL_FILE}")
if not TIME_MODEL_FILE.exists():
    raise FileNotFoundError(f"Missing schedule model: {TIME_MODEL_FILE}")

cost_model = joblib.load(COST_MODEL_FILE)
time_model = joblib.load(TIME_MODEL_FILE)


def parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def month_difference(later, earlier):
    return ((later.year - earlier.year) * 12) + (later.month - earlier.month)


def build_features(project, snapshot=None):
    snapshot = snapshot or date.today()
    start_date = parse_date(project.start_date)
    end_date = parse_date(project.end_date)

    original_cost = float(project.budget or 0)
    expenditure = float(project.budget_used or 0)
    progress = float(project.progress or 0)

    project_age_months = (
        month_difference(snapshot, start_date)
        if start_date
        else None
    )

    planned_duration_months = (
        month_difference(end_date, start_date)
        if start_date and end_date
        else None
    )

    months_to_original_target = (
        month_difference(end_date, snapshot)
        if end_date
        else None
    )

    expenditure_ratio = (
        expenditure / original_cost * 100
        if original_cost > 0
        else None
    )

    gap = (
        expenditure_ratio - progress
        if expenditure_ratio is not None
        else None
    )

    age_ratio = (
        project_age_months / planned_duration_months
        if project_age_months is not None and planned_duration_months and planned_duration_months > 0
        else None
    )

    return {
        "original_cost_cr": original_cost,
        "cumulative_expenditure_cr": expenditure,
        "physical_progress_pct": progress,
        "expenditure_ratio_pct": expenditure_ratio,
        "expenditure_progress_gap_pct": gap,
        "progress_remaining_pct": max(0, min(100, 100 - progress)),
        "project_age_months": project_age_months,
        "planned_duration_months": planned_duration_months,
        "months_to_original_target": months_to_original_target,
        "project_age_ratio": age_ratio,
        "original_cost_log_cr": math.log1p(max(0, original_cost)),
        "is_mega_project": int(original_cost >= 1000),
    }


def prediction_level(probability):
    if probability >= 0.70:
        return "High"
    if probability >= 0.40:
        return "Medium"
    return "Low"


def recommendation(cost_probability, time_probability, schedule_state, over_budget=False):
    actions = []
    if over_budget:
        actions.append("Cost has already exceeded the approved budget; review the overrun magnitude and approve a revised cost estimate.")
    elif cost_probability >= 0.70:
        actions.append("Review cost variance and expenditure-to-progress mismatch.")
    elif cost_probability >= 0.40:
        actions.append("Monitor expenditure growth against physical progress.")

    if schedule_state == "Already overdue":
        actions.append("Initiate schedule recovery review for the overdue project.")
    elif time_probability is not None and time_probability >= 0.70:
        actions.append("Review critical-path activities and prepare a schedule recovery plan.")
    elif time_probability is not None and time_probability >= 0.40:
        actions.append("Increase schedule monitoring and review upcoming target activities.")

    if not actions:
        actions.append("Continue routine monitoring.")

    return actions



def predict_projects(projects):
    """Predict a portfolio in batches instead of calling sklearn once per project."""
    today = date.today()
    if not projects:
        return []

    feature_rows = [build_features(project, today) for project in projects]
    rows = pd.DataFrame(feature_rows, columns=FEATURES)

    cost_probabilities = cost_model.predict_proba(rows)[:, 1]

    schedule_indices = []
    for index, project in enumerate(projects):
        end_date = parse_date(project.end_date)
        progress = float(project.progress or 0)
        if end_date and end_date >= today:
            schedule_indices.append(index)

    schedule_probabilities = {}
    if schedule_indices:
        schedule_rows = rows.iloc[schedule_indices]
        values = time_model.predict_proba(schedule_rows)[:, 1]
        schedule_probabilities = dict(zip(schedule_indices, values))

    results = []
    for index, project in enumerate(projects):
        cost_probability = float(cost_probabilities[index])
        end_date = parse_date(project.end_date)
        progress = float(project.progress or 0)

        original_cost = float(project.budget or 0)
        expenditure = float(project.budget_used or 0)
        over_budget = original_cost > 0 and expenditure >= original_cost

        schedule_state = "Predictive"
        time_probability = None
        schedule_prediction = "Unknown"

        if end_date and end_date < today and progress < 100:
            schedule_state = "Already overdue"
            schedule_prediction = "Already overdue"
        elif end_date and end_date < today and progress >= 100:
            schedule_state = "Completed"
            schedule_prediction = "Completed"
        elif end_date and index in schedule_probabilities:
            time_probability = float(schedule_probabilities[index])
            schedule_prediction = prediction_level(time_probability)

        actions = recommendation(
            cost_probability,
            time_probability,
            schedule_state,
            over_budget,
        )

        high_cost = (not over_budget) and cost_probability >= 0.70
        high_schedule = time_probability is not None and time_probability >= 0.70
        early_warning = over_budget or high_cost or high_schedule or schedule_state == "Already overdue"

        results.append({
            "cost_overrun_probability": None if over_budget else round(cost_probability * 100, 2),
            "time_overrun_probability": round(time_probability * 100, 2) if time_probability is not None else None,
            "cost_prediction": "Already Over Budget" if over_budget else prediction_level(cost_probability),
            "schedule_prediction": schedule_prediction,
            "schedule_state": schedule_state,
            "early_warning": early_warning,
            "recommended_actions": actions,
            "model": "Random Forest",
        })

    return results

def predict_project(project):
    today = date.today()
    features = build_features(project, today)
    row = pd.DataFrame([features], columns=FEATURES)

    cost_probability = float(cost_model.predict_proba(row)[0][1])

    original_cost = float(project.budget or 0)
    expenditure = float(project.budget_used or 0)
    over_budget = original_cost > 0 and expenditure >= original_cost

    end_date = parse_date(project.end_date)
    progress = float(project.progress or 0)

    schedule_state = "Predictive"
    time_probability = None
    schedule_prediction = "Unknown"

    if end_date and end_date < today and progress < 100:
        schedule_state = "Already overdue"
        schedule_prediction = "Already overdue"
    elif end_date and end_date < today and progress >= 100:
        schedule_state = "Completed"
        schedule_prediction = "Completed"
    elif end_date:
        time_probability = float(time_model.predict_proba(row)[0][1])
        schedule_prediction = prediction_level(time_probability)

    actions = recommendation(
        cost_probability,
        time_probability,
        schedule_state,
        over_budget,
    )

    high_cost = (not over_budget) and cost_probability >= 0.70
    high_schedule = time_probability is not None and time_probability >= 0.70
    early_warning = over_budget or high_cost or high_schedule or schedule_state == "Already overdue"

    return {
        "cost_overrun_probability": None if over_budget else round(cost_probability * 100, 2),
        "time_overrun_probability": round(time_probability * 100, 2) if time_probability is not None else None,
        "cost_prediction": "Already Over Budget" if over_budget else prediction_level(cost_probability),
        "schedule_prediction": schedule_prediction,
        "schedule_state": schedule_state,
        "early_warning": early_warning,
        "recommended_actions": actions,
        "model": "Random Forest",
    }
