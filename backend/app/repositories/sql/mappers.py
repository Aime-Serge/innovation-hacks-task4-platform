"""ORM rows to domain objects and back. Rows never leave this package (NFR-319)."""

from typing import Any
from uuid import UUID

from sqlalchemy import Row

from app.domain.enums import (
    ActivityType,
    Discipline,
    EmploymentStatus,
    Priority,
    ProjectStatus,
    Role,
    Seniority,
    TaskStatus,
    Theme,
)
from app.domain.models import Activity, Profile, Project, Task, User

NO_HASH = ""  # a user loaded by anything but the login lookup carries no hash (NFR-318)


def user_from(row: Row[Any], password_hash: str = NO_HASH) -> User:
    return User(
        id=row.id,
        name=row.name,
        email=row.email,
        password_hash=password_hash,
        role=Role(row.role),
        avatar_url=row.avatar_url,
        theme=Theme(row.theme),
        created_at=row.created_at,
        updated_at=row.updated_at,
        given_name=row.given_name,
        family_name=row.family_name,
    )


def user_values(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "password_hash": user.password_hash,
        "role": user.role.value,
        "avatar_url": user.avatar_url,
        "theme": user.theme.value,
        "given_name": user.given_name,
        "family_name": user.family_name,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


def profile_from(row: Row[Any], skills: tuple[str, ...] = ()) -> Profile:
    return Profile(
        user_id=row.user_id,
        discipline=Discipline(row.discipline),
        seniority=Seniority(row.seniority),
        employment_status=EmploymentStatus(row.employment_status),
        company_name=row.company_name,
        job_title=row.job_title,
        country_code=row.country_code,
        city=row.city,
        time_zone=row.time_zone,
        headline=row.headline,
        about=row.about,
        github_url=row.github_url,
        linkedin_url=row.linkedin_url,
        website_url=row.website_url,
        show_professional_details=row.show_professional_details,
        terms_version=row.terms_version,
        terms_accepted_at=row.terms_accepted_at,
        age_confirmed_at=row.age_confirmed_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
        skills=skills,
    )


def profile_values(profile: Profile) -> dict[str, Any]:
    return {
        "user_id": profile.user_id,
        "discipline": profile.discipline.value,
        "seniority": profile.seniority.value,
        "employment_status": profile.employment_status.value,
        "company_name": profile.company_name,
        "job_title": profile.job_title,
        "country_code": profile.country_code,
        "city": profile.city,
        "time_zone": profile.time_zone,
        "headline": profile.headline,
        "about": profile.about,
        "github_url": profile.github_url,
        "linkedin_url": profile.linkedin_url,
        "website_url": profile.website_url,
        "show_professional_details": profile.show_professional_details,
        "terms_version": profile.terms_version,
        "terms_accepted_at": profile.terms_accepted_at,
        "age_confirmed_at": profile.age_confirmed_at,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


def project_from(row: Row[Any]) -> Project:
    return Project(
        id=row.id,
        name=row.name,
        description=row.description,
        status=ProjectStatus(row.status),
        due_date=row.due_date,
        owner_id=row.owner_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def project_values(project: Project) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status.value,
        "due_date": project.due_date,
        "owner_id": project.owner_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


def task_from(row: Row[Any]) -> Task:
    return Task(
        id=row.id,
        project_id=row.project_id,
        title=row.title,
        description=row.description,
        status=TaskStatus(row.status),
        priority=Priority(row.priority),
        due_date=row.due_date,
        assignee_id=row.assignee_id,
        completed_at=row.completed_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def task_values(task: Task) -> dict[str, Any]:
    return {
        "id": task.id,
        "project_id": task.project_id,
        "title": task.title,
        "description": task.description,
        "status": task.status.value,
        "priority": task.priority.value,
        "due_date": task.due_date,
        "assignee_id": task.assignee_id,
        "completed_at": task.completed_at,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


def activity_from(row: Row[Any]) -> Activity:
    return Activity(
        id=row.id,
        actor_id=row.actor_id,
        project_id=row.project_id,
        task_id=row.task_id,
        type=ActivityType(row.type),
        at=row.at,
    )


def activity_values(activity: Activity) -> dict[str, Any]:
    return {
        "id": activity.id,
        "actor_id": activity.actor_id,
        "project_id": activity.project_id,
        "task_id": activity.task_id,
        "type": activity.type.value,
        "at": activity.at,
    }


def ids(rows: list[Row[Any]]) -> list[UUID]:
    return [row.id for row in rows]
