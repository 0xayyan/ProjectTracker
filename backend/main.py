import asyncio
import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Literal

import jwt
from fastapi import Depends, FastAPI, Form, HTTPException, status
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from analytics_utils import department_averages, portfolio_averages, project_summary
from assistant import SUGGESTED_QUESTIONS, answer_query
from auth import ALGORITHM, SECRET_KEY, create_access_token, hash_password, verify_password
from database import Base, SessionLocal, engine
from ml.predictor import predict_project, predict_projects
from models import Milestone, Project, User

app = FastAPI(
    title="ProjectWatch API",
    description="Project monitoring, risk analytics and predictive early-warning API",
    version="1.0.0",
)
def initialize_database():
    # Create tables if they do not already exist.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Create default users if they do not already exist.
        users = [
            {
                "username": "admin",
                "password": "Admin@123",
                "role": "admin",
            },
            {
                "username": "officer",
                "password": "Officer@123",
                "role": "officer",
            },
        ]

        for user_data in users:
            existing_user = (
                db.query(User)
                .filter(User.username == user_data["username"])
                .first()
            )

            if existing_user is None:
                db.add(
                    User(
                        username=user_data["username"],
                        password_hash=hash_password(user_data["password"]),
                        role=user_data["role"],
                    )
                )

        db.commit()

        # Import the 1,911 PAIMANA projects only when the database is empty.
        project_count = db.query(Project).count()

    finally:
        db.close()

    if project_count == 0:
        from import_paimana_projects import import_projects

        count = import_projects(replace=False)
        print(f"Imported {count} PAIMANA projects successfully.")
    else:
        print(f"Database already contains {project_count} projects.")


initialize_database()

# Keep the computed portfolio prediction in server memory until project data is
# changed or FastAPI restarts. This avoids rerunning ML on every navigation/reload.
_prediction_cache = None
_prediction_cache_lock = asyncio.Lock()

def clear_prediction_cache():
    global _prediction_cache
    _prediction_cache = None

def generate_project_predictions():
    db = SessionLocal()
    try:
        projects = db.query(Project).order_by(Project.id.asc()).all()
        predictions = predict_projects(projects)
        return [
            {
                "project": project_to_dict(project),
                "prediction_available": True,
                **prediction,
            }
            for project, prediction in zip(projects, predictions)
        ]
    finally:
        db.close()

# Local dev origins always work. For a deployed frontend, set ALLOWED_ORIGINS in the
# backend's .env to a comma-separated list, e.g.:
#   ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
_extra_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def validate_project_dates(start_date: str, end_date: str):
    if not start_date or not end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date and end date are required.",
        )

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Dates must use YYYY-MM-DD format.",
        )

    if end <= start:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date.",
        )


def validate_milestone_date(due_date: str):
    try:
        datetime.strptime(due_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Milestone due date must use YYYY-MM-DD format.",
        )


def validate_budget(budget: float, budget_used: float):
    if budget_used > budget:
        raise HTTPException(
            status_code=400,
            detail="Budget used cannot exceed total budget.",
        )


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    department: str = Field(min_length=2, max_length=100)
    progress: float = Field(default=0, ge=0, le=100)
    planned_progress: float = Field(default=0, ge=0, le=100)
    budget: float = Field(default=0, ge=0)
    budget_used: float = Field(default=0, ge=0)
    status: Literal["On Track", "At Risk", "Delayed"] = "On Track"
    start_date: str = Field(min_length=10, max_length=10)
    end_date: str = Field(min_length=10, max_length=10)


class ProjectUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    department: str = Field(min_length=2, max_length=100)
    progress: float = Field(ge=0, le=100)
    planned_progress: float = Field(ge=0, le=100)
    budget: float = Field(ge=0)
    budget_used: float = Field(ge=0)
    status: Literal["On Track", "At Risk", "Delayed"]
    start_date: str = Field(min_length=10, max_length=10)
    end_date: str = Field(min_length=10, max_length=10)


class MilestoneCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    due_date: str = Field(min_length=10, max_length=10)
    status: Literal["Not Started", "In Progress", "Completed", "Delayed"] = "Not Started"


class MilestoneUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    due_date: str = Field(min_length=10, max_length=10)
    status: Literal["Not Started", "In Progress", "Completed", "Delayed"]

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=100)
    role: Literal["admin", "officer"] = "officer"


class PasswordChange(BaseModel):
    old_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=100)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    role = payload.get("role")

    if username is None or role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"username": username, "role": role}


def require_project_access(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "officer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )
    return current_user


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


def project_to_dict(project):
    return {
        "id": project.id,
        "name": project.name,
        "department": project.department,
        "progress": project.progress,
        "plannedProgress": project.planned_progress,
        "budget": project.budget,
        "budgetUsed": project.budget_used,
        "status": project.status,
        "startDate": project.start_date,
        "endDate": project.end_date,
        "milestones": [
            {
                "id": milestone.id,
                "name": milestone.name,
                "dueDate": milestone.due_date,
                "status": milestone.status,
            }
            for milestone in project.milestones
        ],
    }


@app.get("/")
def home():
    return {"message": "ProjectWatch API is running"}


@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
):

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == form_data.username).first()
        if user is None or not verify_password(form_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = create_access_token(
            username=user.username,
            role=user.role,
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": user.role,
            "username": user.username,
        }
    finally:
        db.close()


@app.get("/projects")
def get_projects(current_user: dict = Depends(require_project_access)):
    db = SessionLocal()
    try:
        projects = db.query(Project).order_by(Project.id.asc()).all()
        return [project_to_dict(project) for project in projects]
    finally:
        db.close()


@app.get("/projects/predictions")
async def get_project_predictions(current_user: dict = Depends(require_project_access)):
    global _prediction_cache

    if _prediction_cache is not None:
        return _prediction_cache

    # If several pages/viewers request predictions at the same time, only the
    # first request performs the calculation; the others wait for its result.
    async with _prediction_cache_lock:
        if _prediction_cache is not None:
            return _prediction_cache
        try:
            # Run the synchronous DB/model work off the FastAPI worker thread.
            result = await run_in_threadpool(generate_project_predictions)
            _prediction_cache = result
            return result
        except Exception as error:
            raise HTTPException(
                status_code=503,
                detail=f"Unable to generate project predictions: {error}",
            )

@app.get("/analytics/model-performance")
def get_model_performance(current_user: dict = Depends(require_project_access)):
    data_dir = Path(__file__).resolve().parent / "ml" / "data" / "processed"
    files = {
        "baseline": data_dir / "statistical_baseline_results.json",
        "machine_learning": data_dir / "machine_learning_results.json",
        "comparison": data_dir / "model_comparison_results.json",
    }

    if not all(path.exists() for path in files.values()):
        raise HTTPException(
            status_code=503,
            detail="Model evaluation results are not available.",
        )

    baseline = json.loads(files["baseline"].read_text(encoding="utf-8"))
    machine_learning = json.loads(files["machine_learning"].read_text(encoding="utf-8"))
    comparison = json.loads(files["comparison"].read_text(encoding="utf-8"))

    cost_features_file = data_dir / "cost_overrun_feature_importance.csv"
    time_features_file = data_dir / "time_overrun_feature_importance.csv"

    def top_features(path):
        if not path.exists():
            return []
        import csv
        with path.open("r", encoding="utf-8") as file:
            rows = list(csv.DictReader(file))[:6]
        return [
            {
                "feature": row["feature"],
                "importance": round(float(row["importance"]), 6),
            }
            for row in rows
        ]

    training_file = data_dir / "paimana_march_2026_training.csv"
    source_summary = {
        "source": "PAIMANA March 2026 Flash Report",
        "projects_in_source": 0,
        "cost_labelled_projects": 0,
        "schedule_labelled_projects": 0,
        "cost_overrun_cases": 0,
        "schedule_overrun_cases": 0,
    }

    if training_file.exists():
        import pandas as pd
        frame = pd.read_csv(training_file)
        source_summary["projects_in_source"] = int(len(frame))
        source_summary["cost_labelled_projects"] = int(frame["cost_overrun"].notna().sum())
        source_summary["schedule_labelled_projects"] = int(
            (
                frame["time_overrun"].notna()
                & frame["months_to_original_target"].notna()
                & (frame["months_to_original_target"] >= 0)
            ).sum()
        )
        source_summary["cost_overrun_cases"] = int(
            frame.loc[frame["cost_overrun"].notna(), "cost_overrun"].sum()
        )
        schedule_mask = (
            frame["time_overrun"].notna()
            & frame["months_to_original_target"].notna()
            & (frame["months_to_original_target"] >= 0)
        )
        source_summary["schedule_overrun_cases"] = int(
            frame.loc[schedule_mask, "time_overrun"].sum()
        )

    return {
        "source_summary": source_summary,
        "baseline": baseline,
        "machine_learning": machine_learning,
        "comparison": comparison,
        "top_cost_drivers": top_features(cost_features_file),
        "top_schedule_drivers": top_features(time_features_file),
    }


@app.get("/projects/{project_id}")
def get_project(project_id: int, current_user: dict = Depends(require_project_access)):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return project_to_dict(project)
    finally:
        db.close()


@app.get("/projects/{project_id}/prediction")
def get_project_prediction(project_id: int, current_user: dict = Depends(require_project_access)):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        try:
            prediction = predict_project(project)
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"Prediction failed: {error}")
        return {
            "project_id": project.id,
            "project_name": project.name,
            **prediction,
        }
    finally:
        db.close()


@app.post("/projects")
def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(require_project_access),
):
    db = SessionLocal()
    try:
        validate_project_dates(project_data.start_date, project_data.end_date)
        validate_budget(project_data.budget, project_data.budget_used)
        new_project = Project(
            name=project_data.name,
            department=project_data.department,
            progress=project_data.progress,
            planned_progress=project_data.planned_progress,
            budget=project_data.budget,
            budget_used=project_data.budget_used,
            status=project_data.status,
            start_date=project_data.start_date,
            end_date=project_data.end_date,
        )
        db.add(new_project)
        db.commit()
        clear_prediction_cache()
        db.refresh(new_project)
        return project_to_dict(new_project)
    finally:
        db.close()


@app.put("/projects/{project_id}")
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: dict = Depends(require_project_access),
):
    db = SessionLocal()
    try:
        validate_project_dates(project_data.start_date, project_data.end_date)
        validate_budget(project_data.budget, project_data.budget_used)
        project = db.query(Project).filter(Project.id == project_id).first()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")

        project.name = project_data.name
        project.department = project_data.department
        project.progress = project_data.progress
        project.planned_progress = project_data.planned_progress
        project.budget = project_data.budget
        project.budget_used = project_data.budget_used
        project.status = project_data.status
        project.start_date = project_data.start_date
        project.end_date = project_data.end_date

        db.commit()
        clear_prediction_cache()
        db.refresh(project)
        return project_to_dict(project)
    finally:
        db.close()


@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    current_user: dict = Depends(require_admin),
):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        db.delete(project)
        db.commit()
        clear_prediction_cache()
        return {"message": "Project deleted successfully"}
    finally:
        db.close()


@app.post("/projects/{project_id}/milestones")
def create_milestone(
    project_id: int,
    milestone_data: MilestoneCreate,
    current_user: dict = Depends(require_project_access),
):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        validate_milestone_date(milestone_data.due_date)
        milestone = Milestone(
            project_id=project_id,
            name=milestone_data.name,
            due_date=milestone_data.due_date,
            status=milestone_data.status,
        )
        db.add(milestone)
        db.commit()
        clear_prediction_cache()
        db.refresh(milestone)
        return {
            "id": milestone.id,
            "project_id": milestone.project_id,
            "name": milestone.name,
            "dueDate": milestone.due_date,
            "status": milestone.status,
        }
    finally:
        db.close()


@app.put("/projects/{project_id}/milestones/{milestone_id}")
def update_milestone(
    project_id: int,
    milestone_id: int,
    milestone_data: MilestoneUpdate,
    current_user: dict = Depends(require_project_access),
):
    db = SessionLocal()
    try:
        milestone = db.query(Milestone).filter(
            Milestone.id == milestone_id,
            Milestone.project_id == project_id,
        ).first()
        if milestone is None:
            raise HTTPException(status_code=404, detail="Milestone not found")
        validate_milestone_date(milestone_data.due_date)
        milestone.name = milestone_data.name
        milestone.due_date = milestone_data.due_date
        milestone.status = milestone_data.status
        db.commit()
        clear_prediction_cache()
        db.refresh(milestone)
        return {
            "id": milestone.id,
            "project_id": milestone.project_id,
            "name": milestone.name,
            "dueDate": milestone.due_date,
            "status": milestone.status,
        }
    finally:
        db.close()


@app.delete("/projects/{project_id}/milestones/{milestone_id}")
def delete_milestone(
    project_id: int,
    milestone_id: int,
    current_user: dict = Depends(require_project_access),
):
    db = SessionLocal()
    try:
        milestone = db.query(Milestone).filter(
            Milestone.id == milestone_id,
            Milestone.project_id == project_id,
        ).first()
        if milestone is None:
            raise HTTPException(status_code=404, detail="Milestone not found")
        db.delete(milestone)
        db.commit()
        clear_prediction_cache()
        return {"message": "Milestone deleted successfully"}
    finally:
        db.close()


@app.get("/assistant/suggestions")
def get_assistant_suggestions(current_user: dict = Depends(require_project_access)):
    return {"suggestions": SUGGESTED_QUESTIONS}


@app.get("/assistant/query")
def query_assistant(
    q: str = "",
    current_user: dict = Depends(require_project_access),
):
    db = SessionLocal()
    try:
        projects = db.query(Project).order_by(Project.id.asc()).all()
        answer = answer_query(q, projects)
        return {"query": q, "answer": answer}
    finally:
        db.close()


@app.get("/projects/{project_id}/benchmark")
def get_project_benchmark(
    project_id: int,
    current_user: dict = Depends(require_project_access),
):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")

        all_projects = db.query(Project).order_by(Project.id.asc()).all()

        return {
            "project": project_summary(project),
            "department_average": department_averages(all_projects, project.department),
            "portfolio_average": portfolio_averages(all_projects),
        }
    finally:
        db.close()
@app.get("/admin/users")
def list_users(current_user: dict = Depends(require_admin)):
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.id.asc()).all()
        return [{"id": u.id, "username": u.username, "role": u.role} for u in users]
    finally:
        db.close()


@app.post("/admin/users")
def create_user(
    payload: UserCreate,
    current_user: dict = Depends(require_admin),
):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == payload.username).first()
        if existing is not None:
            raise HTTPException(status_code=400, detail="Username already exists.")

        user = User(
            username=payload.username,
            password_hash=hash_password(payload.password),
            role=payload.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "message": f"User '{user.username}' created successfully.",
            "id": user.id,
            "username": user.username,
            "role": user.role,
        }
    finally:
        db.close()


@app.post("/users/change-password")
def change_password(
    payload: PasswordChange,
    current_user: dict = Depends(require_project_access),
):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == current_user["username"]).first()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found.")

        if not verify_password(payload.old_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")

        user.password_hash = hash_password(payload.new_password)
        db.commit()
        return {"message": "Password updated successfully."}
    finally:
        db.close()
    