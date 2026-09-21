from typing import Annotated, Any, ClassVar, Literal

from fastapi import Query
from pydantic import Field, field_validator

from app.schemas.base import ApiModel, OutModel


class ErrorDetailOut(OutModel):
    field: str
    message: str


class ErrorBody(OutModel):
    code: str = Field(examples=["VALIDATION_ERROR"])
    message: str = Field(examples=["One or more fields are invalid."])
    details: list[ErrorDetailOut] | None = None
    request_id: str = Field(examples=["8f0c2e4a-3b1d-4f6e-9a57-2d7c1e9b5a10"])


class ErrorResponse(OutModel):
    error: ErrorBody


class PageOut[T](OutModel):
    items: list[T]
    page: int = Field(ge=1, examples=[1])
    page_size: int = Field(ge=1, le=100, examples=[20])
    total: int = Field(ge=0, examples=[134])


def sort_param(*fields: str) -> Any:
    """The `sort` query parameter, with the allowed fields stated in the schema."""
    return Field(
        default=None,
        pattern="^-?(" + "|".join(fields) + ")$",
        description="`field` ascending or `-field` descending. One of: " + ", ".join(fields) + ".",
    )


class ListQuery(ApiModel):
    """The common list contract (FR-229): page, pageSize, sort."""

    sort_fields: ClassVar[tuple[str, ...]] = ("createdAt",)
    default_sort: ClassVar[str] = "createdAt"

    page: int = Field(default=1, ge=1, le=1_000_000, description="Page number, from 1.")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page, at most 100.")
    sort: str | None = Field(default=None, description="`field` ascending or `-field` descending.")

    @field_validator("sort")
    @classmethod
    def _known_sort(cls, value: str | None) -> str | None:
        if value is not None and value.lstrip("-") not in cls.sort_fields:
            raise ValueError(f"Must be one of: {', '.join(cls.sort_fields)} (prefix - to reverse).")
        return value

    @property
    def sort_field(self) -> str:
        return (self.sort or self.default_sort).lstrip("-")

    @property
    def descending(self) -> bool:
        return (self.sort or "").startswith("-")


ListParams = Annotated[ListQuery, Query()]
Bool = Literal[True, False]
