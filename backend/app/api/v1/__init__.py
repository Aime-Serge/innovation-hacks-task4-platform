from fastapi import APIRouter

from app.api.v1 import activity, auth, dashboard, projects, tasks, users

api_router = APIRouter(prefix="/api/v1")
for module in (auth, users, projects, tasks, activity, dashboard):
    api_router.include_router(module.router)
