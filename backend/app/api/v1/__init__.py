from fastapi import APIRouter

from app.api.v1 import activity, ai, auth, dashboard, projects, tasks, users

api_router = APIRouter(prefix="/api/v1")
for module in (auth, users, projects, tasks, activity, dashboard, ai):
    api_router.include_router(module.router)
