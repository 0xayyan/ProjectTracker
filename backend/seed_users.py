from database import SessionLocal
from models import User
from auth import hash_password


users = [
    {
        "username": "admin",
        "password": "Admin@123",
        "role": "admin"
    },
    {
        "username": "officer",
        "password": "Officer@123",
        "role": "officer"
    }
]


db = SessionLocal()

try:

    for user_data in users:

        existing_user = db.query(User).filter(
            User.username == user_data["username"]
        ).first()

        if existing_user:
            continue

        user = User(
            username=user_data["username"],
            password_hash=hash_password(
                user_data["password"]
            ),
            role=user_data["role"]
        )

        db.add(user)

    db.commit()

    print("Users seeded successfully!")

finally:
    db.close()