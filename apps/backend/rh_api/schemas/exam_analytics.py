from __future__ import annotations

from pydantic import Field

from .common import BaseSchema


class AnalyticalWeightItem(BaseSchema):
    categoria_chave: str = Field(min_length=1, max_length=120)
    peso: float = Field(ge=0, le=1)
    obrigatoria: bool = True


class AnalyticalWeightsRequest(BaseSchema):
    weights: list[AnalyticalWeightItem] = Field(min_length=1, max_length=100)


class IdealProfileItem(BaseSchema):
    categoria_chave: str = Field(min_length=1, max_length=120)
    valor_ideal: float = Field(ge=0, le=100)
    peso_distancia: float | None = Field(default=None, ge=0, le=1)


class IdealProfileRequest(BaseSchema):
    ideal_profile: list[IdealProfileItem] = Field(default_factory=list, max_length=100)


class AnalyticalCategoryMappingItem(BaseSchema):
    origem_tipo: str = Field(default="Etapa", pattern="^Etapa$")
    origem_chave: str = Field(min_length=1, max_length=180)
    categoria_chave: str = Field(min_length=1, max_length=120)


class AnalyticalCategoryMappingsRequest(BaseSchema):
    mappings: list[AnalyticalCategoryMappingItem] = Field(min_length=1, max_length=200)
