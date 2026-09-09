from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.exceptions import register_exception_handlers
from app.routers import ai, auth, projects, tasks, users

settings = get_settings()

app = FastAPI(
    title="AI-Powered Project & Task Management Platform API",
    description="Task 4 (capstone) — Innovation Hacks Full Stack Development Internship",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(ai.router)


@app.get("/health", tags=["health"], summary="Service health check")
def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env}
