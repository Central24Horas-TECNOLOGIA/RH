from __future__ import annotations

from .common import BaseSchema


class OneDriveFolderCreateRequest(BaseSchema):
    caminho: str = ""
    nome_pasta: str
