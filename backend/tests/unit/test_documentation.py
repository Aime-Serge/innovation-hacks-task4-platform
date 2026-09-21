"""TC-283: the README documents what the API really has, and its links are not dead."""

import re
from pathlib import Path

from app.api.docs import CATALOGUE
from app.core.config import Settings
from scripts.export_openapi import generate

ROOT = Path(__file__).resolve().parents[2]
README = (ROOT / "README.md").read_text()


def test_tc283_readme_lists_every_setting() -> None:
    for name in Settings.model_fields:
        assert f"`{name.upper()}`" in README, f"{name.upper()} is not in the README table"


def test_tc283_readme_lists_every_operation() -> None:
    for path, methods in generate()["paths"].items():
        for method in methods:
            assert f"| {method.upper()} | `{path}` |" in README, f"{method.upper()} {path}"


def test_tc283_readme_lists_every_error_code() -> None:
    for code in CATALOGUE:
        assert f"`{code}`" in README, code


def test_tc283_readme_has_the_three_setup_commands() -> None:
    assert "uv sync --frozen" in README
    assert "SECRET_KEY" in README
    assert "uvicorn app.main:create_app --factory" in README


def test_tc283_relative_links_resolve() -> None:
    for doc in (ROOT / "README.md", *(ROOT / "docs").glob("*.md")):
        for target in re.findall(r"\]\((?!https?://|#|mailto:)([^)#\s]+)", doc.read_text()):
            assert (doc.parent / target).exists(), f"{doc.name} links to missing {target}"


def test_tc283_every_adr_referenced_exists() -> None:
    cited = set(re.findall(r"ADR-(\d{3})", README + (ROOT / "docs/pack-readback.md").read_text()))
    have = {p.name[4:7] for p in (ROOT / "docs/adr").glob("ADR-*.md")}
    own = {n for n in cited if int(n) >= 212}
    assert own <= have, own - have
