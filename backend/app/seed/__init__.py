"""Seed data (FR-234, FR-321). Dates are relative to today, so overdue and upcoming items exist.

Profiles: `default`, `empty`, `large` (as in Task 2) and `xl` (performance tests). A fixed random
seed makes every run identical. With the SQL backend `python -m app.seed` fills the database.
With the memory backend only the server can, so it seeds itself at startup when SEED_PROFILE is
set. Neither ever runs when APP_ENV=production.
"""

import random
import secrets
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING
from uuid import UUID

from app.domain.enums import (
    ActivityType,
    Priority,
    ProjectStatus,
    Role,
    TaskStatus,
    Theme,
)
from app.domain.models import Activity, Project, Task, User

if TYPE_CHECKING:
    from app.container import Container

PEOPLE = [
    ("Aime Serge UKOBIZABA", "aime.serge@example.com", Role.DEVELOPER),
    ("Amara Diallo", "amara.diallo@example.com", Role.LEAD),
    ("Kwame Mensah", "kwame.mensah@example.com", Role.DEVELOPER),
    ("Sofia Alvarez", "sofia.alvarez@example.com", Role.DEVELOPER),
]
PROJECT_NAMES = [
    "Atlas API Gateway",
    "Beacon Notifications",
    "Cairn Design System",
    "Delta Data Pipeline",
    "Ember Mobile App",
    "Flint Auth Service",
    "Grove Analytics",
    "Harbor Billing",
]
VERBS = ["Add", "Fix", "Refactor", "Document", "Test", "Profile", "Review", "Migrate"]
NOUNS = [
    "rate limit config",
    "retry queue",
    "load balancer",
    "audit log",
    "build cache",
    "email templates",
    "search index",
    "session store",
]


@dataclass(frozen=True)
class SeedResult:
    users: int
    projects: int
    tasks: int
    activity: int
    password: str | None


@dataclass(frozen=True)
class Shape:
    extra_users: int
    projects: int
    tasks: int
    activity: int


SHAPES = {
    "empty": Shape(0, 0, 0, 0),
    "default": Shape(0, 8, 60, 40),
    "large": Shape(0, 40, 500, 40),
    "xl": Shape(196, 1000, 20000, 60000),  # 4 named + 196 = 200 users
}


def _pick_status(rng: random.Random) -> TaskStatus:
    return rng.choices(list(TaskStatus), weights=[3, 3, 2, 3])[0]


async def seed(container: "Container", profile: str, password: str) -> SeedResult:
    """Build the whole dataset in memory, then load it in one transaction with bulk inserts."""
    if container.settings.is_production:
        raise RuntimeError("Seeding is refused when APP_ENV=production.")
    shape = SHAPES[profile]
    # Deterministic demo data, not a security use of random.
    rng = random.Random(42)  # noqa: S311  # nosec B311
    now, today = container.clock.now(), container.clock.today()
    hashed = await container.hasher.hash(password)
    users = _users(container, hashed, shape.extra_users, now)
    projects = _projects(container, users, shape.projects, today, rng)
    tasks = _tasks(container, users, projects, shape.tasks, today, rng)
    activity = _activity(container, users, tasks, shape.activity, rng)
    async with container.uow() as uow:
        await uow.users.add_many(users)
        await uow.projects.add_many(projects)
        await uow.tasks.add_many(tasks)
        await uow.activity.add_many(activity)
        await uow.commit()
    return SeedResult(len(users), len(projects), len(tasks), len(activity), password)


def _users(container: "Container", hashed: str, extra: int, now: datetime) -> list[User]:
    people = list(PEOPLE) + [
        (f"Team Member {n}", f"member{n}@example.com", Role.LEAD if n % 50 == 0 else Role.DEVELOPER)
        for n in range(1, extra + 1)
    ]
    return [
        User(container.ids.new_id(), name, email, hashed, role, None, Theme.SYSTEM, now, now)
        for name, email, role in people
    ]


def _projects(
    container: "Container", users: list[User], count: int, today: date, rng: random.Random
) -> list[Project]:
    now = container.clock.now()
    projects: list[Project] = []
    for index in range(count):
        status = ProjectStatus.ACTIVE
        if index == 6 % count:
            status = ProjectStatus.COMPLETED
        elif index == 5 % count:
            status = ProjectStatus.ON_HOLD
        elif index % 5 == 4:
            status = ProjectStatus.PLANNED
        base = PROJECT_NAMES[index % len(PROJECT_NAMES)]
        name = base if index < len(PROJECT_NAMES) else f"{base} {index // len(PROJECT_NAMES) + 1}"
        projects.append(
            Project(
                container.ids.new_id(),
                name,
                f"{base} keeps the team's work in one place.",
                status,
                today + timedelta(days=rng.randint(-10, 60)),
                users[index % len(users)].id,
                now,
                now,
            )
        )
    return projects


def _tasks(
    container: "Container",
    users: list[User],
    projects: list[Project],
    count: int,
    today: date,
    rng: random.Random,
) -> list[Task]:
    now = container.clock.now()
    # The last project stays empty (a "no tasks yet" case) when there are enough projects.
    fillable = projects[:-1] if len(projects) > 1 else projects
    tasks: list[Task] = []
    for index in range(count):
        project = fillable[index % len(fillable)]
        status = _pick_status(rng)
        due = today + timedelta(days=rng.randint(-8, 14)) if rng.random() < 0.9 else None
        label = f"{project.name.split()[0]} {index // len(fillable) + 1}"
        title = f"{rng.choice(VERBS)} {rng.choice(NOUNS)} ({label})"
        tasks.append(
            Task(
                id=container.ids.new_id(),
                project_id=project.id,
                title=title,
                description=f"Work item {index + 1} for {project.name}.",
                status=status,
                priority=rng.choice(list(Priority)),
                due_date=due,
                assignee_id=rng.choice(users).id if rng.random() < 0.85 else None,
                completed_at=now if status is TaskStatus.DONE else None,
                created_at=now,
                updated_at=now,
            )
        )
    return tasks


def _activity(
    container: "Container", users: list[User], tasks: list[Task], count: int, rng: random.Random
) -> list[Activity]:
    now = container.clock.now()
    kinds = list(ActivityType)
    if not tasks:
        return []
    return [
        Activity(
            container.ids.new_id(),
            rng.choice(users).id,
            tasks[index % len(tasks)].project_id,
            tasks[index % len(tasks)].id,
            rng.choice(kinds),
            now - timedelta(minutes=index * 37),
        )
        for index in range(count)
    ]


async def apply_seed_profile(container: "Container") -> SeedResult | None:
    """Called at startup: SEED_PROFILE loads the dataset (never in production)."""
    profile = container.settings.seed_profile
    if profile == "none":
        return None
    if container.settings.is_production:
        raise SystemExit("SEED_PROFILE cannot be used when APP_ENV=production.")
    if container.database is not None:
        async with container.uow() as uow:
            existing = await uow.users.count_leads()
        if existing:
            return None  # a persistent database is seeded once; restarts must not duplicate it
    given = container.settings.seed_password
    password = given.get_secret_value() if given else secrets.token_urlsafe(16)
    result = await seed(container, profile, password)
    if given is None:
        print(f"Seeded accounts use this one-time password: {password}")
    return result


__all__ = ["UUID", "SeedResult", "apply_seed_profile", "seed"]
