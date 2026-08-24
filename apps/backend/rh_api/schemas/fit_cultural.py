from __future__ import annotations

from pydantic import field_validator

from .common import BaseSchema


class ValorEmpresaFraseInput(BaseSchema):
    frase: str = ""
    ordem: int = 0

    @field_validator("frase")
    @classmethod
    def validate_frase(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o texto da frase.")
        return safe_value


class ValorEmpresaCreateRequest(BaseSchema):
    nome: str = ""
    descricao: str = ""
    ativo: bool = True
    frases: list[ValorEmpresaFraseInput] = []

    @field_validator("nome")
    @classmethod
    def validate_nome(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o nome do valor da empresa.")
        return safe_value

    @field_validator("frases")
    @classmethod
    def validate_frases(cls, value: list[ValorEmpresaFraseInput]) -> list[ValorEmpresaFraseInput]:
        if not value:
            raise ValueError("Cadastre pelo menos uma frase associada ao valor.")
        return value


class ValorEmpresaUpdateRequest(ValorEmpresaCreateRequest):
    pass


class FitCulturalRespostaInput(BaseSchema):
    frase_id: int
    nota_concordancia: int

    @field_validator("nota_concordancia")
    @classmethod
    def validate_nota(cls, value: int) -> int:
        if value < 1 or value > 5:
            raise ValueError("A nota de concordância deve estar entre 1 e 5.")
        return value


class FitCulturalResponderRequest(BaseSchema):
    candidato_processo_id: int
    respostas: list[FitCulturalRespostaInput] = []

    @field_validator("respostas")
    @classmethod
    def validate_respostas(cls, value: list[FitCulturalRespostaInput]) -> list[FitCulturalRespostaInput]:
        if not value:
            raise ValueError("Informe ao menos uma resposta.")
        return value
