"""Import the March 2026 PAIMANA project snapshot into PostgreSQL.

This script intentionally imports the existing CSV snapshot into the current
Project model so the existing FastAPI /projects endpoint can serve all records.

Usage:
    python import_paimana_projects.py --replace

--replace deletes existing project and milestone rows first. It does NOT delete
users. This is recommended for replacing the current demo projects with the
1,911 PAIMANA records.
"""

import argparse
import csv
from datetime import datetime
from pathlib import Path

from sqlalchemy import text

from database import SessionLocal
from models import Milestone, Project

CSV_PATH = (
    Path(__file__).resolve().parent
    / "ml"
    / "data"
    / "processed"
    / "paimana_march_2026_training.csv"
)


def parse_month(value: str) -> str:
    """Convert MM/YYYY to YYYY-MM-01 for the existing string date fields."""
    value = (value or "").strip()
    if not value or value.upper() in {"NA", "N/A", "NULL", "NONE"}:
        return ""
    return datetime.strptime(value, "%m/%Y").date().replace(day=1).isoformat()


def parse_float(value: str, default: float = 0.0) -> float:
    value = (value or "").strip()
    if not value or value.upper() in {"NA", "N/A", "NULL", "NONE"}:
        return default
    return float(value)


def parse_int(value: str, default: int = 0) -> int:
    value = (value or "").strip()
    if not value or value.upper() in {"NA", "N/A", "NULL", "NONE"}:
        return default
    return int(float(value))


def derive_status(row: dict) -> str:
    """Use the source snapshot's overrun flags to derive the app status."""
    if parse_int(row.get("time_overrun")) == 1:
        return "Delayed"
    if parse_int(row.get("cost_overrun")) == 1:
        return "At Risk"
    return "On Track"


def derive_planned_progress(row: dict) -> float:
    """Calculate planned progress from original dates at the snapshot date.

    The CSV does not contain an official planned-progress percentage, so this
    is explicitly derived rather than presented as source data.
    """
    start = parse_month(row.get("original_approval_date"))
    target = parse_month(row.get("original_target_date"))
    snapshot = (row.get("snapshot_date") or "").strip()

    if not start or not target or not snapshot:
        return 0.0

    try:
        start_date = datetime.fromisoformat(start).date()
        target_date = datetime.fromisoformat(target).date()
        snapshot_date = datetime.fromisoformat(snapshot).date()
    except ValueError:
        return 0.0

    duration_days = (target_date - start_date).days
    if duration_days <= 0:
        return 0.0

    elapsed_days = (snapshot_date - start_date).days
    planned = (elapsed_days / duration_days) * 100
    return round(max(0.0, min(100.0, planned)), 2)


def import_projects(replace: bool) -> int:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found: {CSV_PATH}")

    db = SessionLocal()
    try:
        with CSV_PATH.open("r", newline="", encoding="utf-8-sig") as file:
            rows = list(csv.DictReader(file))

        if not rows:
            raise RuntimeError("The PAIMANA CSV contains no project records.")

        if replace:
            print("Removing existing milestones and projects...")
            db.query(Milestone).delete(synchronize_session=False)
            db.query(Project).delete(synchronize_session=False)
            db.flush()

        projects = []
        for row in rows:
            project_id = parse_int(row.get("project_no"))
            if project_id <= 0:
                raise ValueError(f"Invalid project_no: {row.get('project_no')}")

            start_date = parse_month(row.get("original_approval_date"))
            end_date = parse_month(row.get("original_target_date"))

            project = Project(
                id=project_id,
                name=(row.get("project_name") or "Unnamed Project").strip(),
                department=(row.get("agency") or "Unknown Agency").strip(),
                progress=parse_float(row.get("physical_progress_pct")),
                planned_progress=derive_planned_progress(row),
                budget=parse_float(row.get("original_cost_cr")),
                budget_used=parse_float(row.get("cumulative_expenditure_cr")),
                status=derive_status(row),
                start_date=start_date,
                end_date=end_date,
            )
            projects.append(project)

        db.add_all(projects)
        db.flush()

        # Keep PostgreSQL's SERIAL/identity sequence aligned with the imported IDs.
        db.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('projects', 'id'), "
                "COALESCE((SELECT MAX(id) FROM projects), 1), true)"
            )
        )

        db.commit()
        return len(projects)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import PAIMANA projects")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing project/milestone records before importing.",
    )
    args = parser.parse_args()

    if not args.replace:
        raise SystemExit(
            "Refusing to import without --replace. "
            "Use: python import_paimana_projects.py --replace"
        )

    count = import_projects(replace=True)
    print(f"Imported {count} PAIMANA projects successfully.")
    print("Users were not modified.")


if __name__ == "__main__":
    main()
