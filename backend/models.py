from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship

from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    progress = Column(Float, default=0)
    planned_progress = Column(Float, default=0)
    budget = Column(Float, default=0)
    budget_used = Column(Float, default=0)
    status = Column(String, nullable=False)
    start_date = Column(String, default="")
    end_date = Column(String, default="")

    milestones = relationship(
        "Milestone",
        back_populates="project",
        cascade="all, delete-orphan"
    )


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    due_date = Column(String, nullable=False)
    status = Column(String, nullable=False)
    

    project = relationship(
        "Project",
        back_populates="milestones"
    )
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="officer")