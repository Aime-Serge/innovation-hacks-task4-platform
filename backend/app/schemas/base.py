"""Shared schema base: camelCase, unknown fields rejected, strings trimmed (FR-225, TH-205)."""

from datetime import date, datetime
from typing import Annotated, ClassVar, Self
from urllib.parse import urlparse

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    GetJsonSchemaHandler,
    StringConstraints,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import CoreSchema

# Text that PostgreSQL can store (Task 3): no NUL character, which the database refuses and which
# would otherwise be a 500 (a fuzzer found it). The character classes are spelled out, and the regex
# engine is Python's, because the schema is read by ECMA engines and Rust's `\s` differs.
# WS is exactly what `str.strip()` removes. A lone surrogate cannot be stored either; `ApiModel`
# refuses it in code, since no schema pattern can say so portably.
BAD = r"\x00"
WS = r"\t\n\x0b\x0c\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000"
CLEAN = rf"^[^{BAD}]*$"
NOT_BLANK = rf"^[^{BAD}]*[^{WS}{BAD}][^{BAD}]*$"
Name = Annotated[str, StringConstraints(min_length=1, max_length=80, pattern=NOT_BLANK)]
Title = Annotated[str, StringConstraints(min_length=1, max_length=120, pattern=NOT_BLANK)]
SearchText = Annotated[str, StringConstraints(max_length=100, pattern=CLEAN)]
Text = Annotated[str, StringConstraints(pattern=CLEAN)]


def _https_only(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Must be an https URL.")
    return value


# The host is ASCII in the pattern so the schema never promises a URL the parser would refuse.
_HTTPS_PATTERN = (
    r"^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?"
    rf"([/?#][^ \t\r\n{BAD}]*)?$"
)
HttpsUrl = Annotated[
    str, StringConstraints(max_length=2048, pattern=_HTTPS_PATTERN), AfterValidator(_https_only)
]

# Whitespace is spelled out as a character class: `\\s` means different things to the Rust regex
# engine and to the ECMA engines that read the schema; a fuzzer found addresses they disagree on.
# A pragmatic address check, stated identically in the schema and the validator (ADR-222): the
# stricter library check also refuses reserved domains such as `.test` that the schema allows.
EMAIL_PATTERN = rf"^[^@ \t\r\n{BAD}]+@[^@ \t\r\n{BAD}]+\.[^@ \t\r\n{BAD}]+$"
Email = Annotated[str, StringConstraints(max_length=254, pattern=EMAIL_PATTERN, to_lower=True)]


def _iso_string(value: object) -> object:
    """Dates arrive as `YYYY-MM-DD` strings only; pydantic would also accept a Unix timestamp."""
    if not isinstance(value, str):
        raise ValueError("Must be an ISO 8601 date string (YYYY-MM-DD).")
    return value


IsoDate = Annotated[date, BeforeValidator(_iso_string)]


class ApiModel(BaseModel):
    @field_validator("*", mode="after")
    @classmethod
    def _storable_text(cls, value: object) -> object:
        if isinstance(value, str):
            try:
                value.encode("utf-8")
            except UnicodeEncodeError:
                raise ValueError("Must not contain an unpaired surrogate character.") from None
        return value

    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_alias=True,
        validate_by_name=False,
        extra="forbid",
        str_strip_whitespace=True,
        regex_engine="python-re",
    )


class OutModel(ApiModel):
    """Responses are built from Python field names, so both spellings are accepted here.

    Requests stay strict: `ApiModel` accepts only the camelCase alias.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_alias=True,
        validate_by_name=True,
        extra="forbid",
        str_strip_whitespace=False,
    )


class PatchModel(ApiModel):
    """A partial update: at least one field, and only nullable fields may be null."""

    nullable: ClassVar[frozenset[str]] = frozenset()

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        """Document the truth: at least one field, and null only where it is allowed."""
        schema = handler.resolve_ref_schema(handler(core_schema))
        schema["minProperties"] = 1
        for name, info in cls.model_fields.items():
            prop = schema.get("properties", {}).get(info.alias or name)
            if prop is None or name in cls.nullable or "anyOf" not in prop:
                continue
            options = [o for o in prop["anyOf"] if o != {"type": "null"}]
            prop.pop("anyOf")
            prop.update(options[0] if len(options) == 1 else {"anyOf": options})
        return schema

    @model_validator(mode="after")
    def _check_fields(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to change.")
        for name in self.model_fields_set:
            if getattr(self, name) is None and name not in self.nullable:
                raise ValueError(f"{name} may not be null.")
        return self


class TimestampedOut(OutModel):
    created_at: datetime = Field(description="UTC, ISO 8601, ends in Z.")
    updated_at: datetime = Field(description="UTC, ISO 8601, ends in Z.")
