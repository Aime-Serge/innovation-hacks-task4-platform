"""make docs-check (FR-443, TC-466): the documentation the pack requires exists and is right.

Returns a list of problems; an empty list means every check passed. Run from the repository root.
"""

import re
import sys
from pathlib import Path

README_SECTIONS = (
    "Architecture",
    "Run it locally",
    "Environment variables",
    "Deploying",
    "API and AI design and limits",
    "Demo script",
    "Known limitations",
)
GATE_TARGETS = (
    "test-auth",
    "test-ai",
    "test-web",
    "e2e-local",
    "security-full",
    "deploy-check",
    "docs-check",
    "smoke",
    "e2e-live",
    "ai-eval",
)
# Names the pack's two environment tables list; the README must mention every one.
ENV_NAMES = [
    "APP_ENV",
    "STORAGE_BACKEND",
    "DATABASE_URL",
    "JWT_SECRET",
    "ACCESS_TOKEN_TTL_S",
    "REFRESH_TOKEN_TTL_S",
    "CORS_ALLOWED_ORIGINS",
    "REGISTRATION_ENABLED",
    "DOCS_ENABLED",
    "AI_ENABLED",
    "LLM_PROVIDER",
    "LLM_API_KEY",
    "LLM_MODEL",
    "LLM_TIMEOUT_S",
    "LLM_MAX_OUTPUT_TOKENS",
    "AI_DAILY_LIMIT_PER_USER",
    "AI_PER_MINUTE_LIMIT",
    "AI_GLOBAL_DAILY_LIMIT",
    "API_BASE_URL",
    "SITE_URL",
    "BFF_TIMEOUT_MS",
]
KEY_SHAPES = re.compile(
    r"AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{20,}|postgres(?:ql)?(?:\+\w+)?://[^\s:@/]+:(?![<$])[^\s@<]+@"
)


def need(path: Path, problems: list[str]) -> str:
    if not path.exists():
        problems.append(f"missing {path}")
        return ""
    return path.read_text()


def check_readme(root: Path, problems: list[str]) -> str:
    readme = need(root / "README.md", problems)
    headings = {m.group(1).strip() for m in re.finditer(r"^#{1,3} (.+)$", readme, re.M)}
    problems += [
        f"README.md has no section named {x!r}" for x in README_SECTIONS if x not in headings
    ]
    problems += [
        f"README.md does not document {n}"
        for n in ENV_NAMES
        if not re.search(rf"`{re.escape(n)}\b", readme)
    ]
    makefile = need(root / "Makefile", problems)
    mentioned = readme + need(root / "docs/deploy-runbook.md", problems)
    for target in GATE_TARGETS:
        if not re.search(rf"^{re.escape(target)}:", makefile, re.M):
            problems.append(f"Makefile has no target {target}")
        if f"make {target}" not in mentioned:
            problems.append(f"the README or runbook never mentions `make {target}`")
    return readme


def check_adrs(root: Path, readme: str, problems: list[str]) -> None:
    adr_dir = root / "docs/adr"
    index = need(adr_dir / "README.md", problems)
    for number in range(401, 418):
        if not list(adr_dir.glob(f"ADR-{number}-*.md")):
            problems.append(f"ADR-{number} has no file (each pack decision needs one)")
        elif f"ADR-{number}" not in index:
            problems.append(f"ADR-{number} is not in the ADR index")
    known = {p.name[4:7] for d in (adr_dir, root / "backend/docs/adr") for p in d.glob("ADR-*.md")}
    text = readme + "".join(p.read_text() for p in (root / "docs").glob("*.md"))
    for cited in sorted(set(re.findall(r"ADR-(4\d\d)", text))):
        if cited not in known:
            problems.append(f"ADR-{cited} is cited but has no file")


def check_records(root: Path, problems: list[str]) -> None:
    log = need(root / "docs/supersession-log.md", problems)
    problems += [
        f"docs/supersession-log.md does not record {m}"
        for m in ("S1", "S2", "S6", "S7")
        if m not in log
    ]
    evaluation = need(root / "docs/ai-evaluation.md", problems)
    block = evaluation.partition("<!-- RESULTS START -->")[2].partition("<!-- RESULTS END -->")[0]
    pending = "not yet run" in block
    recorded = re.search(r"Date \| \d{4}-\d{2}-\d{2}", block) and re.search(
        r"validity \| [\d.]+%", block
    )
    if not (pending or recorded):
        problems.append("docs/ai-evaluation.md has neither a dated record nor 'not yet run'")
    if pending and re.search(r"\d+(\.\d+)? ?%", block.replace("98%", "")):
        problems.append("docs/ai-evaluation.md shows a figure while still saying 'not yet run'")
    if "UNVERIFIED" not in need(root / "docs/deploy-runbook.md", problems):
        problems.append("docs/deploy-runbook.md must mark unchecked platform facts UNVERIFIED")
    need(root / "docs/blockers.md", problems)
    need(root / "backend/docs/openapi.json", problems)


def check_secrets(root: Path, problems: list[str]) -> None:
    for path in ("README.md", "DEMO_SCRIPT.md", "docs/deploy-runbook.md", "docs/linkedin-post.md"):
        if KEY_SHAPES.search(need(root / path, problems)):
            problems.append(f"{path} contains something shaped like a key or a connection string")


def check(root: Path) -> list[str]:
    problems: list[str] = []
    check_adrs(root, check_readme(root, problems), problems)
    check_records(root, problems)
    check_secrets(root, problems)
    return problems


if __name__ == "__main__":
    found = check(Path(__file__).resolve().parents[1])
    for problem in found:
        print(f"FAIL {problem}")
    print("docs-check: " + ("all checks passed" if not found else f"{len(found)} problem(s)"))
    sys.exit(1 if found else 0)
