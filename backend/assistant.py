"""ProjectWatch Intelligence Assistant.

A lightweight, template-driven natural-language layer over the existing
risk engine (analytics_utils) and the trained cost/schedule overrun
models (ml/predictor). It answers plain-English questions about the
portfolio without requiring any external LLM API or key, so it works
out of the box in any deployment -- in line with the problem
statement's "Open-Source Tools/Software" guidance and its suggested
"LLM-enabled Project Intelligence Assistant" outcome.
"""

from analytics_utils import (
    budget_utilization,
    portfolio_averages,
    project_summary,
    risk_level,
    risk_score,
)
from ml.predictor import predict_project

SUGGESTED_QUESTIONS = [
    "Give me a portfolio summary",
    "Which projects are high risk?",
    "Which projects are over budget?",
    "Which projects are behind schedule?",
    "How is the Transport department doing?",
]


def _format_currency(value):
    return f"\u20b9{value:.2f} Cr"


def _safe_prediction(project):
    try:
        return predict_project(project)
    except Exception:
        return None


def _portfolio_overview(projects):
    if not projects:
        return "There are no projects in the portfolio yet."

    averages = portfolio_averages(projects)
    high_risk = [p for p in projects if risk_level(risk_score(p)) == "High"]
    delayed = [p for p in projects if p.status == "Delayed"]
    total_budget = sum(float(p.budget or 0) for p in projects)
    used_budget = sum(float(p.budget_used or 0) for p in projects)

    lines = [
        f"The portfolio has {averages['count']} project(s) with an average progress of "
        f"{averages['avg_progress']}% against an average system risk score of "
        f"{averages['avg_risk_score']}/100.",
        f"Total budget is {_format_currency(total_budget)}, of which "
        f"{_format_currency(used_budget)} has been used "
        f"({(used_budget / total_budget * 100) if total_budget else 0:.1f}% utilization).",
    ]

    if high_risk:
        names = ", ".join(p.name for p in high_risk[:5])
        lines.append(f"{len(high_risk)} project(s) are flagged High system risk: {names}.")
    else:
        lines.append("No projects are currently flagged as High system risk.")

    if delayed:
        names = ", ".join(p.name for p in delayed[:5])
        lines.append(f"{len(delayed)} project(s) are reported Delayed: {names}.")

    return " ".join(lines)


def _high_risk_answer(projects):
    scored = sorted(
        (project_summary(p) for p in projects),
        key=lambda s: s["risk_score"],
        reverse=True,
    )
    high = [s for s in scored if s["risk_level"] == "High"]

    if not high:
        return "No projects currently fall into the High system-risk band."

    lines = [f"{len(high)} project(s) are High system risk, ranked by risk score:"]
    for summary in high[:8]:
        lines.append(
            f"- {summary['name']} ({summary['department']}): risk score "
            f"{summary['risk_score']}/100, progress {summary['progress']:.0f}% "
            f"vs planned {summary['planned_progress']:.0f}%."
        )
    return "\n".join(lines)


def _over_budget_answer(projects):
    scored = sorted(
        (project_summary(p) for p in projects),
        key=lambda s: s["budget_utilization"],
        reverse=True,
    )
    flagged = [s for s in scored if s["budget_utilization"] >= 75]

    if not flagged:
        return "No projects currently show elevated budget utilization (75% or higher)."

    lines = ["Projects with elevated budget utilization:"]
    for summary in flagged[:8]:
        lines.append(
            f"- {summary['name']} ({summary['department']}): "
            f"{summary['budget_utilization']}% of {_format_currency(summary['budget'])} used, "
            f"physical progress {summary['progress']:.0f}%."
        )
    return "\n".join(lines)


def _behind_schedule_answer(projects):
    scored = []
    for project in projects:
        summary = project_summary(project)
        variance = summary["progress"] - summary["planned_progress"]
        if variance <= -5 or project.status in ("Delayed", "At Risk"):
            scored.append((variance, summary, project.status))

    if not scored:
        return "No projects currently appear behind their planned schedule."

    scored.sort(key=lambda item: item[0])
    lines = ["Projects behind schedule, most behind first:"]
    for variance, summary, status in scored[:8]:
        lines.append(
            f"- {summary['name']} ({summary['department']}): {variance:.0f} percentage "
            f"points behind plan, reported status \"{status}\"."
        )
    return "\n".join(lines)


def _department_answer(projects, department):
    matched = [p for p in projects if p.department.lower() == department.lower()]
    if not matched:
        return f"I couldn't find any projects in a department matching \"{department}\"."

    averages = portfolio_averages(matched)
    high_risk = [p for p in matched if risk_level(risk_score(p)) == "High"]
    total_budget = sum(float(p.budget or 0) for p in matched)
    used_budget = sum(float(p.budget_used or 0) for p in matched)

    lines = [
        f"{department} has {averages['count']} project(s), averaging "
        f"{averages['avg_progress']}% progress and a risk score of "
        f"{averages['avg_risk_score']}/100.",
        f"Budget: {_format_currency(total_budget)} allocated, "
        f"{_format_currency(used_budget)} used "
        f"({averages['avg_utilization']}% average utilization).",
    ]
    if high_risk:
        names = ", ".join(p.name for p in high_risk[:5])
        lines.append(f"High-risk projects in this department: {names}.")

    return " ".join(lines)


def _project_answer(project):
    summary = project_summary(project)
    prediction = _safe_prediction(project)

    lines = [
        f"{project.name} ({project.department}) is reported \"{project.status}\", "
        f"{summary['progress']:.0f}% complete against a planned {summary['planned_progress']:.0f}%.",
        f"Budget: {_format_currency(summary['budget'])} allocated, "
        f"{_format_currency(summary['budget_used'])} used "
        f"({summary['budget_utilization']}% utilization).",
        f"System-calculated risk: {summary['risk_level']} ({summary['risk_score']}/100), "
        f"with {summary['overdue_milestones']} overdue milestone(s).",
    ]

    if prediction:
        schedule_bit = (
            "N/A"
            if prediction["time_overrun_probability"] is None
            else f"{prediction['time_overrun_probability']}% ({prediction['schedule_prediction']})"
        )
        lines.append(
            f"AI early-warning model: {prediction['cost_overrun_probability']}% "
            f"cost-overrun probability ({prediction['cost_prediction']}), "
            f"schedule-overrun probability {schedule_bit}."
        )
        if prediction["recommended_actions"]:
            lines.append("Recommended action: " + " ".join(prediction["recommended_actions"]))

    return " ".join(lines)


def answer_query(query, projects):
    text = (query or "").strip().lower()

    if not text or any(word in text for word in ["summary", "overview", "how are we", "how's the portfolio"]):
        return _portfolio_overview(projects)

    if any(word in text for word in ["high risk", "risky", "critical", "highest risk"]):
        return _high_risk_answer(projects)

    if any(word in text for word in ["over budget", "budget", "cost overrun", "expenditure"]):
        return _over_budget_answer(projects)

    if any(word in text for word in ["behind schedule", "delayed", "late", "slipping", "schedule"]):
        return _behind_schedule_answer(projects)

    for project in projects:
        if project.name.lower() in text or text in project.name.lower():
            return _project_answer(project)

    departments = {p.department for p in projects}
    for department in departments:
        if department.lower() in text:
            return _department_answer(projects, department)

    return (
        "I can answer questions about portfolio status, department performance, "
        "individual projects, budget utilization, and schedule risk. Try one of "
        "the suggested questions, or ask about a specific project or department by name."
    )
