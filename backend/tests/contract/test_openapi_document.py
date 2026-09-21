"""TC-280 to TC-284, TC-311: the OpenAPI document is valid, complete, current and additive."""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from openapi_spec_validator import validate

from app.api.docs import CATALOGUE
from scripts.export_openapi import SPEC_PATH, generate, render
from scripts.openapi_diff import compare

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = {"/", "/api/v1/auth/login", "/api/v1/users", "/healthz", "/readyz"}
HEALTH = {"/", "/healthz", "/readyz"}
METHODS = {"get", "post", "patch", "delete"}


@pytest.fixture(scope="module")
def spec() -> dict[str, Any]:
    return generate()


def operations(spec: dict[str, Any]) -> list[tuple[str, str, dict[str, Any]]]:
    return [(m, p, o) for p, ms in spec["paths"].items() for m, o in ms.items() if m in METHODS]


def test_tc280_spec_is_valid_openapi_3(spec: dict[str, Any]) -> None:
    validate(spec)
    assert spec["openapi"].startswith("3.")


def test_tc281_every_operation_is_documented(spec: dict[str, Any]) -> None:
    for method, path, op in operations(spec):
        where = f"{method.upper()} {path}"
        assert op.get("summary"), f"{where}: summary"
        assert len(op.get("description", "")) > 20, f"{where}: description"
        assert op.get("tags"), f"{where}: tag"
        assert op.get("operationId"), f"{where}: operationId"
        if path not in HEALTH:
            assert "500" in op["responses"], f"{where}: 500"
        if path not in PUBLIC:
            assert "401" in op["responses"], f"{where}: 401"
        if "{" in path:
            assert "404" in op["responses"] or path.startswith("/api/v1/users"), where
            assert "422" in op["responses"], f"{where}: 422 for a malformed id"
        for status, response in op["responses"].items():
            assert response.get("description"), f"{where} {status}: description"
            if status.startswith(("4", "5")):
                examples = response["content"]["application/json"].get("examples")
                assert examples, f"{where} {status}: error examples"
                for item in examples.values():
                    assert "error" in item["value"], f"{where} {status}: envelope"


def test_tc281_errors_in_the_catalogue_have_the_documented_status(spec: dict[str, Any]) -> None:
    for _method, path, op in operations(spec):
        for status, response in op["responses"].items():
            if not status.startswith(("4", "5")):
                continue
            for item in response["content"]["application/json"]["examples"].values():
                code = item["value"]["error"]["code"]
                assert code in CATALOGUE, f"{path}: {code} missing from the catalogue"
                assert CATALOGUE[code][0] == int(status), f"{path}: {code} under {status}"


def test_tc281_request_and_success_bodies_carry_examples(spec: dict[str, Any]) -> None:
    schemas = spec["components"]["schemas"]
    for name in ("UserCreate", "ProjectCreate", "TaskCreate", "StatusChange", "LoginRequest"):
        props = schemas[name]["properties"]
        assert any("examples" in p or "example" in p for p in props.values()), name


def test_tc282_committed_spec_matches_the_app() -> None:
    assert (ROOT / SPEC_PATH).read_text() == render(generate())


def test_tc282_export_check_command_passes() -> None:
    result = subprocess.run(
        [sys.executable, "scripts/export_openapi.py", "--check"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        env={"PYTHONPATH": str(ROOT), "PATH": "/usr/bin:/bin"},
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_tc284_removing_an_operation_or_response_field_is_breaking(spec: dict[str, Any]) -> None:
    broken = json.loads(json.dumps(spec))
    del broken["paths"]["/api/v1/tasks"]["get"]
    assert any("removed" in p for p in compare(spec, broken))
    trimmed = json.loads(json.dumps(spec))
    ref = trimmed["paths"]["/api/v1/auth/login"]["post"]["responses"]["200"]["content"]
    schema_name = ref["application/json"]["schema"]["$ref"].rsplit("/", 1)[1]
    del trimmed["components"]["schemas"][schema_name]["properties"]["accessToken"]
    assert any("accessToken" in p for p in compare(spec, trimmed))


def test_tc284_additive_changes_are_not_breaking(spec: dict[str, Any]) -> None:
    grown = json.loads(json.dumps(spec))
    grown["paths"]["/api/v1/extra"] = {"get": {"responses": {"200": {"description": "ok"}}}}
    assert compare(spec, grown) == []
    assert compare(spec, spec) == []


def test_tc311_every_path_is_versioned_plural_and_camel_case(spec: dict[str, Any]) -> None:
    for path in spec["paths"]:
        if path.startswith("/api/"):
            assert path.startswith("/api/v1/"), path
            assert "_" not in path, path
    for name, schema in spec["components"]["schemas"].items():
        for prop in schema.get("properties", {}):
            assert "_" not in prop, f"{name}.{prop} is not camelCase"
