"""TC-454, TC-455: the deployment check passes on the real files and catches each mistake it guards.

A check that cannot fail proves nothing, so each case corrupts a copy of the committed files in one
specific way and expects that exact problem to be reported.
"""

import importlib.util
import shutil
from pathlib import Path
from types import ModuleType

import pytest

REPO = Path(__file__).resolve().parents[3]


def load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("deploy_check", REPO / "scripts/deploy_check.py")
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CHECK = load()
NAMES = CHECK.known_env_names(REPO)


@pytest.fixture
def tree(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A copy of just the files the check reads."""
    for rel in (
        "render.yaml",
        "backend/Dockerfile",
        "frontend/vercel.json",
        "frontend/.env.example",
        "frontend/next.config.ts",
        "frontend/src/proxy.ts",
        "frontend/src/app/api/bff/[...path]/route.ts",
    ):
        (tmp_path / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(REPO / rel, tmp_path / rel)
    shutil.copytree(REPO / "frontend/src", tmp_path / "frontend/src", dirs_exist_ok=True)
    shutil.copytree(REPO / "backend/migrations/versions", tmp_path / "backend/migrations/versions")
    monkeypatch.setattr(CHECK, "known_env_names", lambda _root: NAMES)
    return tmp_path


def test_tc454_the_committed_files_pass() -> None:
    assert CHECK.check(REPO) == []


def edit(root: Path, rel: str, old: str, new: str) -> None:
    path = root / rel
    text = path.read_text()
    assert old in text, (rel, old)
    path.write_text(text.replace(old, new, 1))


CASES = [
    (
        "a migration URL on the platform",
        "render.yaml",
        "      - key: JWT_SECRET",
        "      - key: MIGRATION_DATABASE_URL\n        sync: false\n      - key: JWT_SECRET",
        "MIGRATION_DATABASE_URL must never appear",
    ),
    (
        "the fake provider in production",
        "render.yaml",
        "        value: gemini",
        "        value: fake",
        "LLM_PROVIDER must be 'gemini'",
    ),
    (
        "a secret stored in the file",
        "render.yaml",
        "      - key: JWT_SECRET\n        sync: false",
        "      - key: JWT_SECRET\n        value: hunter2",
        "JWT_SECRET must be present with `sync: false`",
    ),
    (
        "Swagger UI on in production",
        "render.yaml",
        'value: "false"',
        'value: "true"',
        "DOCS_ENABLED must be 'false'",
    ),
    (
        "a variable Settings never reads",
        "render.yaml",
        "      - key: JWT_SECRET",
        "      - key: SOME_TYPO_VAR\n        value: x\n      - key: JWT_SECRET",
        "does not read",
    ),
    (
        "a password in a connection string",
        "render.yaml",
        "    plan: starter",
        "    plan: starter # " + "postgresql://user:" + "pass" + "@host/db",
        "connection string with a password",
    ),
    ("no $PORT binding", "backend/Dockerfile", "${PORT}", "8000", "must bind to $PORT"),
    (
        "too short an AI function duration",
        "frontend/src/app/api/bff/[...path]/route.ts",
        "maxDuration = 30",
        "maxDuration = 10",
        "maxDuration of at least 26",
    ),
    (
        "a CSP without connect-src",
        "frontend/src/proxy.ts",
        "\"connect-src 'self'\"",
        "\"img-src 'self'\"",
        "connect-src 'self'",
    ),
    (
        "a secret exposed to the browser",
        "frontend/src/proxy.ts",
        "export function proxy",
        "const leak = process.env.NEXT_PUBLIC_API_KEY;\nexport function proxy",
        "unexpected NEXT_PUBLIC_",
    ),
    (
        "a migration that drops something",
        "backend/migrations/versions/0006_ai_requests.py",
        "def upgrade() -> None:\n",
        "def upgrade() -> None:\n    op.drop_table('x')\n",
        "must only add",
    ),
]


@pytest.mark.parametrize(
    ("label", "rel", "old", "new", "expected"), CASES, ids=[c[0] for c in CASES]
)
def test_tc454_each_mistake_is_caught(
    tree: Path, label: str, rel: str, old: str, new: str, expected: str
) -> None:
    edit(tree, rel, old, new)
    assert any(expected in problem for problem in CHECK.check(tree)), (label, CHECK.check(tree))
