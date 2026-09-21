"""Distinguishes "field omitted" from "field set to null" in partial updates (PATCH)."""

from typing import Final


class _Unset:
    __slots__ = ()

    def __repr__(self) -> str:
        return "UNSET"

    def __bool__(self) -> bool:
        return False


UNSET: Final = _Unset()
Unset = _Unset
