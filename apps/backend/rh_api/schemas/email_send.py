from __future__ import annotations

from .common import BaseSchema


class EmailSendRequest(BaseSchema):
    destinatarios: list[str]
    copia: list[str] = []
    id_modelo: int | None = None
    assunto: str = ""
    corpo_html: str = ""
    variaveis: dict = {}
    anexos_onedrive: list[str] = []
