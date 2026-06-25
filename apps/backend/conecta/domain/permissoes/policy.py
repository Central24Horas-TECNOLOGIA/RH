from __future__ import annotations

from dataclasses import dataclass
from typing import AbstractSet


@dataclass(frozen=True)
class AuthorizationPolicy:
    """Política pura usada pelo adapter FastAPI e por testes de domínio."""

    permissions: AbstractSet[str]

    def allows(self, *required: str, require_all: bool = False) -> bool:
        expected = tuple(item for item in required if item)
        if not expected:
            return True
        checker = all if require_all else any
        return checker(item in self.permissions for item in expected)
