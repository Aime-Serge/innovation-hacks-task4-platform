from fastapi import FastAPI

from app.config import get_settings
from app.exceptions import register_exception_handlers
from app.routers import projects, tasks, users

settings = get_settings()

app = FastAPI(
    title="Users, Projects & Tasks API",
    description="Task 2 — Innovation Hacks Full Stack Development Internship",
    version="0.1.0",
)

register_exception_handlers(app)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(tasks.router)


@app.get("/health", tags=["health"], summary="Service health check")
def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env}
