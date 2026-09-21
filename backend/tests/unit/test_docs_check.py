"""TC-466: the documentation check passes on the real files and catches each omission it guards."""

import importlib.util
import shutil
from pathlib import Path
from types import ModuleType

import pytest

REPO = Path(__file__).resolve().parents[3]


def load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("docs_check", REPO / "scripts/docs_check.py")
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CHECK = load()


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    for rel in ("README.md", "Makefile", "DEMO_SCRIPT.md", "backend/docs/openapi.json"):
        (tmp_path / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(REPO / rel, tmp_path / rel)
    shutil.copytree(REPO / "docs", tmp_path / "docs", ignore=shutil.ignore_patterns("standards"))
    (tmp_path / "backend/docs/adr").mkdir(parents=True)
    for adr in (REPO / "backend/docs/adr").glob("ADR-4*.md"):
        shutil.copy(adr, tmp_path / "backend/docs/adr" / adr.name)
    return tmp_path


def test_tc466_the_committed_documentation_passes() -> None:
    assert CHECK.check(REPO) == []


def edit(root: Path, rel: str, old: str, new: str) -> None:
    """Replace every occurrence: a word that appears many times must be gone entirely."""
    path = root / rel
    text = path.read_text()
    assert old in text, (rel, old)
    path.write_text(text.replace(old, new))


CASES = [
    (
        "a missing README section",
        "README.md",
        "## Known limitations",
        "## Something else",
        "no section named 'Known limitations'",
    ),
    (
        "an undocumented variable",
        "README.md",
        "`LLM_MODEL`",
        "`LLM_MODELX`",
        "does not document LLM_MODEL",
    ),
    (
        "a gate target nobody mentions",
        "README.md",
        "`make security-full`",
        "`make security`",
        "never mentions `make security-full`",
    ),
    (
        "a runbook with no UNVERIFIED marker",
        "docs/deploy-runbook.md",
        "UNVERIFIED",
        "checked",
        "must mark unchecked platform facts",
    ),
    (
        "an evaluation with neither record nor status",
        "docs/ai-evaluation.md",
        "not yet run",
        "done",
        "neither a dated record nor",
    ),
    (
        "a key in the demo script",
        "DEMO_SCRIPT.md",
        "No secret may be visible",
        "Key " + "AIza" + "SyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q" + " ok",
        "DEMO_SCRIPT.md contains something shaped like a key",
    ),
    (
        "a supersession that was never logged",
        "docs/supersession-log.md",
        "S7",
        "S-seven",
        "does not record S7",
    ),
]


@pytest.mark.parametrize(
    ("label", "rel", "old", "new", "expected"), CASES, ids=[c[0] for c in CASES]
)
def test_tc466_each_omission_is_caught(
    tree: Path, label: str, rel: str, old: str, new: str, expected: str
) -> None:
    edit(tree, rel, old, new)
    assert any(expected in p for p in CHECK.check(tree)), (label, CHECK.check(tree))


def test_tc466_a_deleted_adr_file_is_caught(tree: Path) -> None:
    next((tree / "docs/adr").glob("ADR-405-*.md")).unlink()
    assert any("ADR-405 has no file" in p for p in CHECK.check(tree))


def test_tc466_an_invented_figure_beside_not_yet_run_is_caught(tree: Path) -> None:
    edit(
        tree,
        "docs/ai-evaluation.md",
        "| Latency p50 / p95 | not yet run",
        "| Latency p50 / p95 | 91% not yet run",
    )
    assert any("shows a figure" in p for p in CHECK.check(tree))
