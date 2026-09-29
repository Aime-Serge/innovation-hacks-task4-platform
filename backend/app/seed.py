"""Seed script — populates the database with realistic sample data so
Frontend/QA can develop against real data without manual setup.

Usage:
    python -m app.seed
"""

from app.db.models import ProjectModel, TaskModel, UserModel
from app.db.session import session_scope
from app.models.task import TaskStatus
from app.security import hash_password

SEED_USERS = [
    {"name": "Ada Lovelace", "email": "ada@example.com", "password": "supersecret1"},
    {"name": "Grace Hopper", "email": "grace@example.com", "password": "supersecret2"},
    {"name": "Alan Turing", "email": "alan@example.com", "password": "supersecret3"},
]

SEED_PROJECTS = [
    {"owner_email": "ada@example.com", "name": "Analytical Engine", "description": "Mechanical general-purpose computer design."},
    {"owner_email": "ada@example.com", "name": "Note G", "description": "First published algorithm intended for a machine."},
    {"owner_email": "grace@example.com", "name": "COBOL Compiler", "description": "Early compiler translating English-like syntax to machine code."},
    {"owner_email": "alan@example.com", "name": "Bombe", "description": "Electromechanical device for breaking Enigma-enciphered messages."},
]

SEED_TASKS = [
    {"project_name": "Analytical Engine", "title": "Design the mill", "status": TaskStatus.done},
    {"project_name": "Analytical Engine", "title": "Design the store", "status": TaskStatus.in_progress},
    {"project_name": "Analytical Engine", "title": "Punch card input spec", "status": TaskStatus.todo},
    {"project_name": "Note G", "title": "Draft Bernoulli number algorithm", "status": TaskStatus.done},
    {"project_name": "Note G", "title": "Write up notes for translation", "status": TaskStatus.todo},
    {"project_name": "COBOL Compiler", "title": "Define verb grammar", "status": TaskStatus.in_progress},
    {"project_name": "COBOL Compiler", "title": "Write lexer", "status": TaskStatus.todo},
    {"project_name": "COBOL Compiler", "title": "Write parser", "status": TaskStatus.todo},
    {"project_name": "Bombe", "title": "Model rotor wiring", "status": TaskStatus.done},
    {"project_name": "Bombe", "title": "Build stop mechanism", "status": TaskStatus.in_progress},
]


def seed() -> None:
    with session_scope() as session:
        if session.query(UserModel).first() is not None:
            print("Database already has data — skipping seed. Nothing changed.")
            return

        users_by_email: dict[str, UserModel] = {}
        for spec in SEED_USERS:
            user = UserModel(
                name=spec["name"],
                email=spec["email"],
                password_hash=hash_password(spec["password"]),
            )
            session.add(user)
            users_by_email[spec["email"]] = user
        session.flush()

        projects_by_name: dict[str, ProjectModel] = {}
        for spec in SEED_PROJECTS:
            project = ProjectModel(
                name=spec["name"],
                description=spec["description"],
                owner_id=users_by_email[spec["owner_email"]].id,
            )
            session.add(project)
            projects_by_name[spec["name"]] = project
        session.flush()

        for spec in SEED_TASKS:
            task = TaskModel(
                title=spec["title"],
                project_id=projects_by_name[spec["project_name"]].id,
                status=spec["status"],
            )
            session.add(task)

    print(
        f"Seeded {len(SEED_USERS)} users, {len(SEED_PROJECTS)} projects, "
        f"{len(SEED_TASKS)} tasks."
    )


if __name__ == "__main__":
    seed()
