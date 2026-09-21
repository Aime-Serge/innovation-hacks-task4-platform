"""Export or verify docs/openapi.json (ADR-211, NFR-221).

python scripts/export_openapi.py          write the file
python scripts/export_openapi.py --check  fail when the file differs from the app
"""

import json
import sys
from pathlib import Path
from typing import Any

from pydantic import SecretStr

from app.core.config import Settings
from app.main import create_app

SPEC_PATH = Path("docs/openapi.json")


def generate() -> dict[str, Any]:
    """Build the spec from a throwaway app: a fixed secret, docs on, nothing read from .env."""
    settings = Settings(
        _env_file=None,
        secret_key=SecretStr("export-only-secret-not-used-at-runtime-0123456789"),
        docs_enabled=True,
        app_env="test",
    )
    spec: dict[str, Any] = create_app(settings).openapi()
    return spec


def render(spec: dict[str, Any]) -> str:
    return json.dumps(spec, indent=2, sort_keys=True) + "\n"


def main() -> int:
    text = render(generate())
    if "--check" in sys.argv:
        if not SPEC_PATH.exists() or SPEC_PATH.read_text() != text:
            print("docs/openapi.json is out of date. Run: make export-spec", file=sys.stderr)
            return 1
        print("openapi.json matches the app.")
        return 0
    SPEC_PATH.write_text(text)
    print(f"Wrote {SPEC_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
