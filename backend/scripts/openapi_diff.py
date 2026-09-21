"""Fail on a breaking change to /api/v1 against a base ref (NFR-221, TC-284).

Breaking: a removed path or method, a removed response status, a removed response
property, a newly required request property or parameter, a narrowed enum.
Additive changes pass. The base is `git show <ref>:docs/openapi.json`; when the base
has no spec (the first release) there is nothing to break.
"""

import json
import os
import subprocess
import sys
from typing import Any

Spec = dict[str, Any]
JSON = "application/json"


def load_base(ref: str) -> Spec | None:
    result = subprocess.run(
        ["git", "show", f"{ref}:docs/openapi.json"],
        capture_output=True,
        text=True,
        check=False,
    )
    return json.loads(result.stdout) if result.returncode == 0 else None


def _resolve(spec: Spec, schema: Spec) -> Spec:
    ref = schema.get("$ref")
    if not isinstance(ref, str):
        return schema
    node: Any = spec
    for part in ref.removeprefix("#/").split("/"):
        node = node[part]
    return dict(node)


def _props(spec: Spec, schema: Spec) -> tuple[dict[str, Any], set[str]]:
    resolved = _resolve(spec, schema)
    return dict(resolved.get("properties", {})), set(resolved.get("required", []))


def compare_schema(
    base: Spec, new: Spec, old_schema: Spec, new_schema: Spec, where: str, request: bool
) -> list[str]:
    problems: list[str] = []
    old_props, old_required = _props(base, old_schema)
    new_props, new_required = _props(new, new_schema)
    for name in old_props:
        if not request and name not in new_props:
            problems.append(f"{where}: response property '{name}' was removed")
    if request:
        for name in new_required - old_required:
            problems.append(f"{where}: request property '{name}' became required")
    old_enum = set(_resolve(base, old_schema).get("enum", []))
    new_enum = set(_resolve(new, new_schema).get("enum", []))
    if old_enum and new_enum and (old_enum - new_enum) and not request:
        problems.append(f"{where}: enum values removed: {sorted(old_enum - new_enum)}")
    return problems


def _json_schema(container: Spec, *keys: str) -> Spec | None:
    node: Any = container
    for key in keys:
        node = node.get(key, {})
    return node or None


def compare(base: Spec, new: Spec) -> list[str]:
    problems: list[str] = []
    for path, methods in base["paths"].items():
        for method, operation in methods.items():
            label = f"{method.upper()} {path}"
            new_operation = new["paths"].get(path, {}).get(method)
            if new_operation is None:
                problems.append(f"{label}: removed")
                continue
            for status in operation.get("responses", {}):
                if status not in new_operation.get("responses", {}):
                    problems.append(f"{label}: response {status} was removed")
            old_names = {p["name"] for p in operation.get("parameters", [])}
            for param in new_operation.get("parameters", []):
                if param.get("required") and param["name"] not in old_names:
                    problems.append(f"{label}: parameter '{param['name']}' became required")
            old_body = _json_schema(operation, "requestBody", "content", JSON, "schema")
            new_body = _json_schema(new_operation, "requestBody", "content", JSON, "schema")
            if old_body and new_body:
                problems += compare_schema(base, new, old_body, new_body, f"{label} request", True)
            old_ok = _json_schema(operation, "responses", "200", "content", JSON, "schema")
            new_ok = _json_schema(new_operation, "responses", "200", "content", JSON, "schema")
            if old_ok and new_ok:
                problems += compare_schema(base, new, old_ok, new_ok, f"{label} response", False)
    return problems


def main() -> int:
    ref = os.environ.get("OPENAPI_BASE_REF", "origin/main")
    base = load_base(ref)
    if base is None or not base.get("paths"):
        print(f"No baseline spec at {ref}; nothing to compare (first release).")
        return 0
    with open("docs/openapi.json") as handle:
        new: Spec = json.load(handle)
    problems = compare(base, new)
    if problems:
        print("Breaking changes to the API contract:", *problems, sep="\n  ", file=sys.stderr)
        return 1
    print(f"No breaking changes against {ref}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
