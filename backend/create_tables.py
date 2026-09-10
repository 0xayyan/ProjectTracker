from database import Base, engine
from models import Project, Milestone, User

Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")