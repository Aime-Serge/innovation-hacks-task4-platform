"""TC-394 (NFR-325): the API contract is the Task 2 contract, apart from ADR-327's text patterns."""

import json
import re
from pathlib import Path
from typing import Any

from scripts.openapi_diff import compare, unsuperseded

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
    assert unsuperseded(compare(baseline, current)) == []  # S-A is the one permitted break


# S7 relaxes "unchanged" to "additive": additions are free, and only these two changes to an
# existing schema are permitted: S4 (the login response gains fields) and S2 (email may be null).
# The minimal-profile pack adds S-A (registration payload) and S-B (user object fields), logged in
# docs/supersession-log.md.
PERMITTED = {
    "~ /components/schemas/TokenOut/required",
    "- /components/schemas/UserOut/properties/email/type",
    "~ /components/schemas/UserOut/required",  # S-B: the user object gains givenName, ... profile
    "~ /paths//api/v1/users/post/description",  # S-A
    "~ /components/schemas/UserCreate/required",  # S-A
    "- /components/schemas/UserCreate/properties/name",  # S-A: replaced by given and family names
    "~ /components/schemas/UserCreate/properties/password/description",  # S-A
}


def test_tc394_only_additions_and_the_permitted_supersessions_differ() -> None:
    baseline = json.loads((ROOT / "docs/openapi.baseline.json").read_text())
    current = json.loads((ROOT / "docs/openapi.json").read_text())
    unexplained = [
        d
        for d in differences(baseline, current)
        if not (d.startswith("+") or d in PERMITTED or (d[0] in "+~" and ALLOWED.search(d)))
    ]
    assert unexplained == []
    assert set(baseline["paths"]) <= set(current["paths"])  # nothing was removed
