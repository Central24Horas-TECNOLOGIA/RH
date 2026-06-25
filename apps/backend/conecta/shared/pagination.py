from dataclasses import dataclass


@dataclass(frozen=True)
class Page:
    number: int = 1
    size: int = 20

    @property
    def offset(self) -> int:
        return (max(1, self.number) - 1) * max(1, self.size)
