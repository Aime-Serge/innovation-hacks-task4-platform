"""The welcome page at `/`: a documented, public, static HTML route (ADR-225)."""

import hashlib
from base64 import b64encode
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.api.deps import ContainerDep

router = APIRouter(tags=["Health"])

WEB = Path(__file__).resolve().parent.parent / "web"
STYLE = (WEB / "landing.css").read_text()
PAGE = (WEB / "landing.html").read_text()
STYLE_HASH = "sha256-" + b64encode(hashlib.sha256(STYLE.encode()).digest()).decode()
# The page has no script. Its one inline stylesheet is allowed by hash, nothing else is.
LANDING_CSP = (
    f"default-src 'none'; style-src '{STYLE_HASH}'; base-uri 'none'; "
    "form-action 'none'; frame-ancestors 'none'"
)
DOCS_LINKS = (
    '<a class="btn primary" href="/docs">Open the interactive docs</a>'
    '<a class="btn" href="/openapi.json">OpenAPI document</a>'
)
DOCS_OFF = '<span class="tag">Interactive docs are off in this environment</span>'


def render(docs_enabled: bool) -> str:
    return PAGE.replace("__STYLE__", STYLE).replace(
        "__DOCS__", DOCS_LINKS if docs_enabled else DOCS_OFF
    )


@router.get(
    "/",
    response_class=HTMLResponse,
    summary="Welcome page",
    description=(
        "A short HTML page that says what this service is and links to the docs and the "
        "health checks. No token needed."
    ),
    responses={200: {"description": "The welcome page.", "content": {"text/html": {}}}},
)
async def welcome(container: ContainerDep) -> HTMLResponse:
    return HTMLResponse(
        render(container.settings.docs_on),
        headers={"Content-Security-Policy": LANDING_CSP, "Cache-Control": "public, max-age=300"},
    )
