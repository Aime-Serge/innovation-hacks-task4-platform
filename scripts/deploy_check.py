"""make deploy-check (TC-454, TC-455): the committed deployment files against the pack.

Checks render.yaml, the Dockerfile, the Vercel settings and headers, the environment tables
against Settings, and that the Task 4 migrations only add things. Returns a list of problems;
an empty list means every check passed. Run from the repository root.
"""

import re
import sys
from pathlib import Path
from typing import Any

import yaml

SECRETS = {"DATABASE_URL", "JWT_SECRET", "LLM_API_KEY", "CORS_ALLOWED_ORIGINS", "LLM_MODEL"}
REQUIRED_VALUES = {
    "APP_ENV": "production",
    "STORAGE_BACKEND": "sql",
    "DOCS_ENABLED": "false",
    "LLM_PROVIDER": "gemini",
}
HEADERS = ("X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy")


def known_env_names(root: Path) -> set[str]:
    """Every environment name the API's Settings reads, including its aliases."""
    sys.path.insert(0, str(root / "backend"))
    from app.core.config import Settings  # noqa: PLC0415 - needs the path set above

    names: set[str] = set()
    for field, info in Settings.model_fields.items():
        names.add(field.upper())
        alias = info.validation_alias
        choices = getattr(alias, "choices", None)
        names.update(str(c).upper() for c in (choices or ([alias] if alias else [])))
    return names


def check_render(root: Path) -> list[str]:
    problems: list[str] = []
    path = root / "render.yaml"
    if not path.exists():
        return ["render.yaml is missing at the repository root"]
    text = path.read_text()
    spec: dict[str, Any] = yaml.safe_load(text)
    services = [s for s in spec.get("services", []) if s.get("type") == "web"]
    if len(services) != 1:
        return ["render.yaml must define exactly one web service"]
    web = services[0]
    if web.get("runtime") != "docker" or web.get("dockerfilePath") != "./backend/Dockerfile":
        problems.append("the API service must build ./backend/Dockerfile with runtime docker")
    if web.get("healthCheckPath") != "/healthz":
        problems.append("the health check path must be /healthz")
    if not any(d.get("name") for d in spec.get("databases", [])):
        problems.append("render.yaml must define the PostgreSQL database")
    if str(spec["databases"][0].get("postgresMajorVersion", "")) != "16":
        problems.append("the database must be PostgreSQL 16")
    env = {e["key"]: e for e in web.get("envVars", [])}
    for key, want in REQUIRED_VALUES.items():
        if str(env.get(key, {}).get("value")) != want:
            problems.append(f"{key} must be {want!r} in render.yaml")
    for key in SECRETS:
        entry = env.get(key)
        if entry is None or entry.get("sync") is not False or "value" in entry:
            problems.append(f"{key} must be present with `sync: false` and no value")
    if "MIGRATION_DATABASE_URL" in text:
        problems.append("MIGRATION_DATABASE_URL must never appear in render.yaml (FR-439)")
    if re.search(r"postgres(ql)?(\+\w+)?://\S+:\S+@", text):
        problems.append("render.yaml contains a connection string with a password")
    unknown = sorted(k for k in env if k.upper() not in known_env_names(root))
    if unknown:
        problems.append(f"render.yaml sets variables Settings does not read: {unknown}")
    return problems


def check_dockerfile(root: Path) -> list[str]:
    text = (root / "backend" / "Dockerfile").read_text()
    problems: list[str] = []
    if "${PORT}" not in text:
        problems.append("the Dockerfile must bind to $PORT")
    if "--workers 1" not in text:
        problems.append("the Dockerfile must run one worker (ADR-415)")
    if not re.search(r"^USER \d+", text, re.M):
        problems.append("the Dockerfile must run as a non-root user")
    return problems


def check_frontend(root: Path) -> list[str]:
    problems: list[str] = []
    web = root / "frontend"
    vercel = web / "vercel.json"
    if not vercel.exists() or yaml.safe_load(vercel.read_text()).get("framework") != "nextjs":
        problems.append("frontend/vercel.json must exist and name the nextjs framework")
    route = (web / "src/app/api/bff/[...path]/route.ts").read_text()
    match = re.search(r"maxDuration\s*=\s*(\d+)", route)
    if match is None or int(match.group(1)) < 26:
        problems.append("the BFF route needs maxDuration of at least 26 s (AI budget is 25 s)")
    config = (web / "next.config.ts").read_text()
    for header in HEADERS + ("Strict-Transport-Security",):
        if header not in config:
            problems.append(f"next.config.ts must set {header}")
    proxy = (web / "src/proxy.ts").read_text()
    for directive in ("connect-src 'self'", "frame-ancestors 'none'"):
        if directive not in proxy:
            problems.append(f"the Content-Security-Policy must include {directive}")
    example = (web / ".env.example").read_text()
    for name in ("API_BASE_URL", "SITE_URL", "BFF_TIMEOUT_MS"):
        if name not in example:
            problems.append(f"frontend/.env.example must list {name}")
    public = set(re.findall(r"NEXT_PUBLIC_[A-Z_]+", "".join(p.read_text() for p in (web / "src").rglob("*.ts*"))))
    stray = sorted(public - {"NEXT_PUBLIC_DATA_SOURCE", "NEXT_PUBLIC_SCENARIO_SWITCHER"})
    if stray:
        problems.append(f"unexpected NEXT_PUBLIC_ variables (never a secret or the API address): {stray}")
    return problems


def check_migrations(root: Path) -> list[str]:
    """Each Task 4 migration only adds, so the previous release keeps working (NFR-408)."""
    problems: list[str] = []
    for name in ("0005_refresh_tokens", "0006_ai_requests", "0007_visibility_index"):
        text = (root / "backend/migrations/versions" / f"{name}.py").read_text()
        upgrade = text.split("def downgrade")[0]
        for bad in ("drop_table", "drop_column", "drop_index", "alter_column", "rename_table"):
            if bad in upgrade:
                problems.append(f"{name} upgrade() uses {bad}: migrations must only add")
        if "def downgrade" not in text:
            problems.append(f"{name} has no downgrade")
    return problems


def check(root: Path) -> list[str]:
    return check_render(root) + check_dockerfile(root) + check_frontend(root) + check_migrations(root)


if __name__ == "__main__":
    found = check(Path(__file__).resolve().parents[1])
    for problem in found:
        print(f"FAIL {problem}")
    print("deploy-check: " + ("all checks passed" if not found else f"{len(found)} problem(s)"))
    sys.exit(1 if found else 0)
