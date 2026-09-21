"""TC-394 (NFR-325): the API contract is the Task 2 contract, apart from ADR-327's text patterns."""

import json
import re
from pathlib import Path
from typing import Any

from scripts.openapi_diff import compare

ROOT = Path(__file__).resolve().parents[2]
ALLOWED = re.compile(r"/(pattern|anyOf|parameters)$")  # ADR-327: patterns, and the `q` parameter


def differences(old: Any, new: Any, path: str = "") -> list[str]:
    found: list[str] = []
    if isinstance(old, dict) and isinstance(new, dict):
        for key in old.keys() | new.keys():
            if key not in old:
                found.append(f"+ {path}/{key}")
            elif key not in new:
                found.append(f"- {path}/{key}")
            else:
                found += differences(old[key], new[key], f"{path}/{key}")
    elif old != new:
        found.append(f"~ {path}")
    return found


def test_tc394_the_contract_has_no_breaking_change_against_the_task_2_baseline() -> None:
    baseline = json.loads((ROOT / "docs/openapi.baseline.json").read_text())
    current = json.loads((ROOT / "docs/openapi.json").read_text())
    assert compare(baseline, current) == []


def test_tc394_only_the_documented_pattern_differences_exist() -> None:
    baseline = json.loads((ROOT / "docs/openapi.baseline.json").read_text())
    current = json.loads((ROOT / "docs/openapi.json").read_text())
    unexplained = [
        d for d in differences(baseline, current) if not (d[0] in "+~" and ALLOWED.search(d))
    ]
    assert unexplained == []
    assert baseline["paths"].keys() == current["paths"].keys()
