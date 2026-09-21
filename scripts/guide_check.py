"""make guide-check (pack section 8, GAP-10, GAP-11): the guide compliance matrix is honest and complete.

Checks, from the repository root (run it with `uv run` from backend/ so Settings can be imported):
  1. docs/guide-compliance.md has 49 rows G-01..G-49 with a valid status, and every backticked
     evidence path exists; every TC-### id cited appears in a test file (GAP-10).
  2. README.md has the sections the guide (section 08) and the pack require.
  3. .env.example lists MIN_AGE and TERMS_VERSION, and every name in it is either a Settings variable
     or a compose-only infrastructure variable.
  4. gitleaks is clean (files and history) through the docker image `make security-full` uses.
     Skip only with --no-gitleaks (for machines without docker); the skip is printed.

Returns a list of problems; an empty list means every check passed.
"""

import re
import subprocess
import sys
from pathlib import Path

STATUSES = {"Pass", "Partial", "Fail", "Manual step"}
README_SECTIONS = (
    "Features",
    "Technology stack",
    "Architecture",
    "Run it locally",
    "Environment variables",
    "Screenshots",
    "Demo",
    "Task submissions",
    "Known limitations",
)
REQUIRED_ENV = ("MIN_AGE", "TERMS_VERSION")
# Variables of docker compose and the platform blueprints that Settings does not read.
COMPOSE_ONLY = {
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "APP_DB_PASSWORD",
    "MIGRATOR_DB_PASSWORD",
    "READONLY_DB_PASSWORD",
    "FAKE_LLM_SCENARIO",
    "SITE_URL",
    "API_BASE_URL",
}
TEST_DIRS = ("backend/tests", "frontend/tests")


def matrix_rows(text: str) -> list[list[str]]:
    rows = []
    for line in text.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split(" | ")]
        if re.fullmatch(r"G-\d\d", cells[0]) and len(cells) >= 6:
            rows.append(cells)
    return rows


def test_text(root: Path) -> str:
    chunks = []
    for d in TEST_DIRS:
        for p in (root / d).rglob("*"):
            if p.suffix in {".py", ".ts", ".tsx"} and "node_modules" not in p.parts and p.is_file():
                chunks.append(p.read_text(errors="ignore"))
    return "\n".join(chunks)


def tc_ids(evidence: str) -> list[str]:
    ids = re.findall(r"TC-(\d+)", evidence)
    for a, b in re.findall(r"TC-(\d+) to TC-(\d+)", evidence):
        ids += [str(n).zfill(len(a)) for n in range(int(a), int(b) + 1)]
    return sorted(set(ids))


def check_matrix(root: Path) -> list[str]:
    path = root / "docs/guide-compliance.md"
    if not path.exists():
        return ["docs/guide-compliance.md is missing"]
    rows = matrix_rows(path.read_text())
    problems = []
    seen = {r[0] for r in rows}
    problems += [f"guide-compliance.md has no row G-{n:02d}" for n in range(1, 50) if f"G-{n:02d}" not in seen]
    tests = test_text(root)
    for cells in rows:
        gid, status, evidence = cells[0], cells[3], cells[4]
        if status not in STATUSES:
            problems.append(f"{gid}: status {status!r} is not one of {sorted(STATUSES)}")
        paths = re.findall(r"`([^`]+)`", evidence)
        if not paths:
            problems.append(f"{gid}: no evidence path")
        for p in paths:
            if not (root / p).exists():
                problems.append(f"{gid}: evidence path does not exist: {p}")
        for n in tc_ids(evidence):
            pattern = rf"(?i)tc[-_]?0*{int(n)}(?!\d)"
            if not re.search(pattern, tests):
                problems.append(f"{gid}: TC-{n} appears in no test file")
    return problems


def check_readme(root: Path) -> list[str]:
    path = root / "README.md"
    if not path.exists():
        return ["README.md is missing"]
    headings = {m.group(1).strip() for m in re.finditer(r"^#{1,3} (.+)$", path.read_text(), re.M)}
    return [f"README.md has no section named {s!r}" for s in README_SECTIONS if s not in headings]


def settings_names(root: Path) -> set[str]:
    sys.path.insert(0, str(root / "backend"))
    from app.core.config import Settings  # needs the backend environment: run through uv

    names: set[str] = set()
    for field, info in Settings.model_fields.items():
        names.add(field.upper())
        alias = info.validation_alias
        choices = getattr(alias, "choices", None)
        names.update(str(c).upper() for c in (choices or ([alias] if alias else [])))
    return names


def check_env(root: Path) -> list[str]:
    path = root / ".env.example"
    if not path.exists():
        return [".env.example is missing"]
    listed = set(re.findall(r"^#?\s*([A-Z][A-Z0-9_]+)=", path.read_text(), re.M))
    problems = [f".env.example does not list {n}" for n in REQUIRED_ENV if n not in listed]
    try:
        known = settings_names(root)
    except Exception as exc:  # noqa: BLE001 - any import failure is reported, not hidden
        return problems + [f"could not import Settings ({exc!r}); run through `make guide-check`"]
    problems += [
        f"{n} is in .env.example but is neither a Settings variable nor a compose variable"
        for n in sorted(listed - known - COMPOSE_ONLY)
    ]
    problems += [f"{n} is not a Settings variable yet (the backend must read it)" for n in REQUIRED_ENV if n not in known]
    return problems


def check_gitleaks(root: Path) -> list[str]:
    cmd = [
        "docker", "run", "--rm", "-v", f"{root}:/repo", "zricethezav/gitleaks:latest",
        "detect", "--source", "/repo", "--no-banner", "--redact",
    ]
    try:
        done = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return [f"gitleaks could not run through docker: {exc}"]
    if done.returncode != 0:
        return ["gitleaks reported findings or failed:\n" + (done.stdout + done.stderr)[-1500:]]
    return []


def check(root: Path, gitleaks: bool = True) -> list[str]:
    problems = check_matrix(root) + check_readme(root) + check_env(root)
    if gitleaks:
        problems += check_gitleaks(root)
    else:
        print("gitleaks skipped (--no-gitleaks)")
    return problems


if __name__ == "__main__":
    found = check(Path(__file__).resolve().parent.parent, gitleaks="--no-gitleaks" not in sys.argv)
    for problem in found:
        print("PROBLEM:", problem)
    print("guide-check:", "FAILED" if found else "passed")
    sys.exit(1 if found else 0)
