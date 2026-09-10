from database import SessionLocal
from models import Project, Milestone

projects = [
    {
        "id": 1,
        "name": "Highway Expansion Project",
        "department": "Infrastructure",
        "progress": 72,
        "planned_progress": 78,
        "budget": 45,
        "budget_used": 31,
        "status": "On Track",
        "start_date": "2026-01-15",
        "end_date": "2026-12-15",
        "milestones": [
            {"name": "Land Acquisition", "due_date": "2026-03-15", "status": "Completed"},
            {"name": "Foundation Work", "due_date": "2026-06-30", "status": "Completed"},
            {"name": "Road Construction", "due_date": "2026-10-15", "status": "In Progress"},
        ],
    },
    {
        "id": 2,
        "name": "Railway Development Project",
        "department": "Transport",
        "progress": 48,
        "planned_progress": 70,
        "budget": 82,
        "budget_used": 68,
        "status": "Delayed",
        "start_date": "2026-01-01",
        "end_date": "2026-10-15",
        "milestones": [
            {"name": "Land Survey", "due_date": "2026-03-30", "status": "Completed"},
            {"name": "Track Foundation", "due_date": "2026-06-15", "status": "Delayed"},
            {"name": "Track Installation", "due_date": "2026-10-15", "status": "In Progress"},
        ],
    },
    {
        "id": 3,
        "name": "District Hospital Construction",
        "department": "Health",
        "progress": 61,
        "planned_progress": 68,
        "budget": 28,
        "budget_used": 22,
        "status": "At Risk",
        "start_date": "2026-02-01",
        "end_date": "2026-11-30",
        "milestones": [
            {"name": "Site Preparation", "due_date": "2026-04-20", "status": "Completed"},
            {"name": "Building Structure", "due_date": "2026-07-15", "status": "In Progress"},
            {"name": "Electrical Installation", "due_date": "2026-10-30", "status": "Not Started"},
        ],
    },
    {
        "id": 4,
        "name": "City Water Supply Project",
        "department": "Public Works",
        "progress": 35,
        "planned_progress": 60,
        "budget": 60,
        "budget_used": 52,
        "status": "Delayed",
        "start_date": "2025-12-01",
        "end_date": "2026-09-30",
        "milestones": [
            {"name": "Pipeline Survey", "due_date": "2026-02-15", "status": "Completed"},
            {"name": "Pipeline Installation", "due_date": "2026-06-30", "status": "Delayed"},
            {"name": "Water Treatment Setup", "due_date": "2026-11-15", "status": "Not Started"},
        ],
    },
]


db = SessionLocal()

try:
    if db.query(Project).count() == 0:
        for project_data in projects:
            project = Project(
                id=project_data["id"],
                name=project_data["name"],
                department=project_data["department"],
                progress=project_data["progress"],
                planned_progress=project_data["planned_progress"],
                budget=project_data["budget"],
                budget_used=project_data["budget_used"],
                status=project_data["status"],
                start_date=project_data["start_date"],
                end_date=project_data["end_date"],
            )

            for milestone_data in project_data["milestones"]:
                project.milestones.append(
                    Milestone(
                        name=milestone_data["name"],
                        due_date=milestone_data["due_date"],
                        status=milestone_data["status"],
                    )
                )

            db.add(project)

        db.commit()
        print("Project data inserted successfully!")
    else:
        print("Project data already exists.")
finally:
    db.close()
