"""Endpoint-coverage gate (TC-293): every operation needs a success and a failure test.

Operations come from the app's own OpenAPI spec; hits are recorded by an httpx hook.
"""

import re
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

HITS: set[tuple[str, str, int]] = set()


def _templates(spec: dict[str, Any]) -> list[tuple[str, re.Pattern[str]]]:
    return [
        (template, re.compile("^" + re.sub(r"\{[^}/]+\}", "[^/]+", template) + "$"))
        for template in spec["paths"]
    ]


def recorder(spec: dict[str, Any]) -> Callable[[httpx.Response], Awaitable[None]]:
    templates = _templates(spec)

    async def hook(response: httpx.Response) -> None:
        request = response.request
        for template, pattern in templates:
            if pattern.match(request.url.path):
                HITS.add((request.method, template, response.status_code))
                break

    return hook


def gaps(spec: dict[str, Any]) -> tuple[int, list[str]]:
    """Return (operations checked, human readable gaps)."""
    missing: list[str] = []
    checked = 0
    for template, methods in spec["paths"].items():
        for method in methods:
            checked += 1
            statuses = {code for m, p, code in HITS if m == method.upper() and p == template}
            label = f"{method.upper()} {template}"
            if not any(code < 400 for code in statuses):
                missing.append(f"{label}: no success test")
            if template not in ("/", "/healthz") and not any(code >= 400 for code in statuses):
                missing.append(f"{label}: no failure test")
    return checked, missing
