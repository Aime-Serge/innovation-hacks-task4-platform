# ADR-220: `warn_required_dynamic_aliases` is off for the pydantic mypy plugin

**Status:** Accepted.

Request models use an alias generator (`to_camel`), which the plugin flags on every required field ("required dynamic aliases disallowed"). The aliases are the point of the design and are verified by tests and by the OpenAPI document (every property is camelCase, TC-311). The plugin's other checks stay on, `strict` stays on, and no `# type: ignore` was used to get around it. The setting and this reason are commented in `pyproject.toml`.
