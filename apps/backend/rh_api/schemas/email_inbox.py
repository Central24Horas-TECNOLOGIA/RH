from __future__ import annotations

import re

from pydantic import Field, field_validator

from .common import BaseSchema


class ExperienciaProfissionalItem(BaseSchema):
    empresa: str = Field(default="", max_length=180)
    cargo: str = Field(default="", max_length=180)
    periodo: str = Field(default="", max_length=120)
    descricao: str = Field(default="", max_length=2000)


class FormacaoAcademicaItem(BaseSchema):
    instituicao: str = Field(default="", max_length=180)
    curso: str = Field(default="", max_length=180)
    nivel: str = Field(default="", max_length=120)
    periodo: str = Field(default="", max_length=120)
    status: str = Field(default="", max_length=60)


class ManualCandidateCreateRequest(BaseSchema):
    nome: str = Field(default="")
    email: str = Field(default="", max_length=180)
    telefone: str = Field(default="", max_length=50)
    cidade: str = Field(default="", max_length=120)
    bairro: str = Field(default="", max_length=120)
    endereco: str = Field(default="", max_length=255)
    data_nascimento: str = Field(default="", max_length=10)
    vaga_pretendida: str = Field(default="", max_length=180)
    experiencia_ativa: bool = False
    experiencias: list[ExperienciaProfissionalItem] = []
    formacao_ativa: bool = False
    formacao: list[FormacaoAcademicaItem] = []

    @field_validator("nome")
    @classmethod
    def validate_nome(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o nome do candidato.")
        return safe_value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if safe_value and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", safe_value):
            raise ValueError("Informe um e-mail válido.")
        return safe_value

    @field_validator("telefone")
    @classmethod
    def validate_telefone(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        digits = re.sub(r"\D", "", safe_value)
        if safe_value and len(digits) not in (10, 11, 12, 13):
            raise ValueError("Informe um telefone válido.")
        return safe_value

    @field_validator("experiencias")
    @classmethod
    def validate_experiencias(cls, value: list) -> list:
        if len(value) > 20:
            raise ValueError("Limite de 20 experiências por currículo.")
        return value

    @field_validator("formacao")
    @classmethod
    def validate_formacao(cls, value: list) -> list:
        if len(value) > 20:
            raise ValueError("Limite de 20 formações por currículo.")
        return value
