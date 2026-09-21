"""TC-270 to TC-272, TC-308: environment contract, secret scan and layer boundaries."""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

from app.core.config import Settings

ROOT = Path(__file__).resolve().parents[2]

SECRET_PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "aws key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "github token": re.compile(r"gh[pousr]_[A-Za-z0-9]{36,}"),
    "slack token": re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"),
    "jwt": re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
}


def tracked_files() -> list[Path]:
    git = shutil.which("git")
    assert git, "git is required to list tracked files"
    out = subprocess.run(  # noqa: S603
        [git, "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout.split("\n")
    return [ROOT / name for name in out if name and (ROOT / name).is_file()]


def test_tc270_every_setting_is_documented_in_env_example() -> None:
    documented = {
        line.split("=", 1)[0].strip().lstrip("#").strip().lower()
        for line in (ROOT / ".env.example").read_text().splitlines()
        if "=" in line
    }
    assert set(Settings.model_fields) <= documented, set(Settings.model_fields) - documented


def test_tc270_env_example_holds_no_real_secret() -> None:
    values = {
        line.split("=", 1)[0].strip(): line.split("=", 1)[1].strip()
        for line in (ROOT / ".env.example").read_text().splitlines()
        if "=" in line and not line.startswith("#")
    }
    assert values.get("SECRET_KEY", "") in ("", "change-me") or "change" in values["SECRET_KEY"]
    assert not values.get("SEED_PASSWORD")


def test_tc271_no_secret_shaped_string_is_tracked() -> None:
    hits: list[str] = []
    for path in tracked_files():
        if path.suffix in {".pdf", ".lock"} or path.name == "uv.lock":
            continue
        text = path.read_text(errors="ignore")
        for label, pattern in SECRET_PATTERNS.items():
            for match in pattern.finditer(text):
                hits.append(f"{path.relative_to(ROOT)}: {label}: {match.group()[:12]}...")
    # The Postman placeholder and test fixtures are not credentials; a JWT literal would be.
    assert hits == []


def test_tc271_dotenv_is_not_tracked() -> None:
    names = {p.name for p in tracked_files()}
    assert ".env" not in names


def test_tc272_no_default_credentials_in_application_code() -> None:
    for path in (ROOT / "app").rglob("*.py"):
        text = path.read_text()
        assert "password123" not in text, path
        assert not re.search(r"SECRET_KEY\s*=\s*['\"]", text), path


def test_tc308_layer_contracts_hold() -> None:
    lint_imports = shutil.which("lint-imports", path=str(Path(".venv/bin").resolve()))
    if lint_imports is None:
        pytest.fail("lint-imports is not installed in the project environment")
    result = subprocess.run(  # noqa: S603
        [lint_imports], cwd=ROOT, capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_tc308_a_forbidden_import_would_be_caught(tmp_path: Path) -> None:
    """The contract is real: a service that imports FastAPI is reported and fails the run."""
    package = tmp_path / "probe"
    (package / "services").mkdir(parents=True)
    (package / "__init__.py").write_text("")
    (package / "services" / "__init__.py").write_text("")
    (package / "services" / "bad.py").write_text("import fastapi\n")
    config = tmp_path / "probe.toml"
    config.write_text(
        "[tool.importlinter]\nroot_package = 'probe'\ninclude_external_packages = true\n"
        "[[tool.importlinter.contracts]]\nname = 'no fastapi in services'\ntype = 'forbidden'\n"
        "source_modules = ['probe.services']\nforbidden_modules = ['fastapi']\n"
    )
    lint_imports = str(Path(".venv/bin/lint-imports").resolve())
    result = subprocess.run(  # noqa: S603
        [lint_imports, "--config", str(config)],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        env={"PYTHONPATH": str(tmp_path), "PATH": "/usr/bin:/bin"},
        check=False,
    )
    assert result.returncode != 0, result.stdout
    assert "BROKEN" in result.stdout
