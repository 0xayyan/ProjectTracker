"""Shared portfolio analytics helpers.

This mirrors the rule-based risk scoring already used on the frontend
(frontend/src/utils/risk.js) so the backend can reason about the same
"System Calculated Risk" when answering assistant queries or building
benchmark comparisons, without duplicating the ML model.
"""

from datetime import date


def _parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def overdue_milestone_count(project):
    today = date.today()
    count = 0
    for milestone in getattr(project, "milestones", []) or []:
        if milestone.status == "Completed":
            continue
        due = _parse_date(milestone.due_date)
        if due and due < today:
            count += 1
    return count


def budget_utilization(project):
    budget = float(project.budget or 0)
    budget_used = float(project.budget_used or 0)
    if budget <= 0:
        return 0.0
    return (budget_used / budget) * 100


def risk_score(project):
    progress = float(project.progress or 0)
    planned_progress = float(project.planned_progress or 0)
    budget = float(project.budget or 0)
    budget_used = float(project.budget_used or 0)

    progress_variance = progress - planned_progress
    score = 0

    if progress_variance <= -15:
        score += 40
    elif progress_variance <= -5:
        score += 25

    if budget > 0:
        utilization = (budget_used / budget) * 100
        if utilization >= 90:
            score += 35
        elif utilization >= 75:
            score += 25
        if utilization - progress >= 20:
            score += 20

    overdue = overdue_milestone_count(project)
    if overdue >= 2:
        score += 25
    elif overdue == 1:
        score += 15

    if project.status == "Delayed":
        score += 20
    elif project.status == "At Risk":
        score += 10

    return min(score, 100)


def risk_level(score):
    if score >= 60:
        return "High"
    if score >= 30:
        return "Medium"
    return "Low"


def project_summary(project):
    score = risk_score(project)
    return {
        "id": project.id,
        "name": project.name,
        "department": project.department,
        "status": project.status,
        "progress": float(project.progress or 0),
        "planned_progress": float(project.planned_progress or 0),
        "budget": float(project.budget or 0),
        "budget_used": float(project.budget_used or 0),
        "budget_utilization": round(budget_utilization(project), 1),
        "risk_score": score,
        "risk_level": risk_level(score),
        "overdue_milestones": overdue_milestone_count(project),
    }


def portfolio_averages(projects):
    if not projects:
        return {"avg_progress": 0, "avg_utilization": 0, "avg_risk_score": 0, "count": 0}

    summaries = [project_summary(project) for project in projects]
    count = len(summaries)
    return {
        "avg_progress": round(sum(s["progress"] for s in summaries) / count, 1),
        "avg_utilization": round(sum(s["budget_utilization"] for s in summaries) / count, 1),
        "avg_risk_score": round(sum(s["risk_score"] for s in summaries) / count, 1),
        "count": count,
    }


def department_averages(projects, department):
    matched = [p for p in projects if p.department == department]
    return portfolio_averages(matched)
