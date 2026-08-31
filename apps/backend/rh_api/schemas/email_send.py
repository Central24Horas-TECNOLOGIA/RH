from __future__ import annotations

from pydantic import Field

from .common import BaseSchema


class EmailSendRequest(BaseSchema):
    destinatarios: list[str] = Field(min_length=1, max_length=50)
    copia: list[str] = Field(default_factory=list, max_length=20)
    id_modelo: int | None = None
    assunto: str = ""
    corpo_html: str = ""
    variaveis: dict = {}
    anexos_onedrive: list[str] = Field(default_factory=list, max_length=10)
