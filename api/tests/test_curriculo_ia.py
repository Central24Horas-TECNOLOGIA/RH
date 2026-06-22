from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from rh_api.services.curriculo_extractor import _remover_dados_desnecessarios
from rh_api.services.ia_curriculo_service import (
    IaCurriculoError,
    IaCurriculoService,
    ProviderResult,
)
from rh_api.services.ia_schema_validator import (
    IaSchemaValidationError,
    validar_resultado_ia,
)


def _valid_result(**overrides):
    payload = {
        "nota_aderencia": 78,
        "parecer": "ADERENTE_COM_RESSALVAS",
        "resumo": "Experiência compatível, com pontos a validar.",
        "pontos_fortes": ["Atendimento ao cliente"],
        "pontos_atencao": ["Ferramenta não informada"],
        "riscos": [],
        "justificativa": "Há evidências profissionais no currículo.",
        "perguntas_sugeridas_entrevista": ["Qual foi o volume de atendimentos?"],
    }
    payload.update(overrides)
    return payload


def test_schema_valida_e_ignora_campos_extras():
    validado, bruto = validar_resultado_ia(
        {**_valid_result(), "campo_extra": "preservado apenas no bruto"}
    )

    assert validado["nota_aderencia"] == 78
    assert "campo_extra" not in validado
    assert bruto["campo_extra"] == "preservado apenas no bruto"


@pytest.mark.parametrize(
    "payload",
    [
        "{json inválido",
        _valid_result(nota_aderencia=101),
        _valid_result(parecer="APROVADO"),
    ],
)
def test_schema_rejeita_resposta_invalida(payload):
    with pytest.raises(IaSchemaValidationError):
        validar_resultado_ia(payload)


class _FakeProvider:
    def __init__(self):
        self.calls = 0

    def analisar(self, *, system_prompt: str, user_prompt: str):
        self.calls += 1
        assert "Não aprove" in system_prompt
        assert "TEXTO DO CURRÍCULO" in user_prompt
        return ProviderResult(
            content=json.dumps(_valid_result(), ensure_ascii=False),
            raw_result={},
            tokens_entrada=100,
            tokens_saida=50,
        )


def test_servico_nao_chama_provider_quando_ia_desativada():
    provider = _FakeProvider()
    settings = SimpleNamespace(ai_enabled=False, ai_available=False)

    with pytest.raises(IaCurriculoError):
        IaCurriculoService(settings, provider=provider).analisar(
            texto_curriculo="Experiência profissional",
            contexto_vaga={"vaga": "Atendimento"},
        )

    assert provider.calls == 0


def test_servico_valida_retorno_do_provider():
    provider = _FakeProvider()
    settings = SimpleNamespace(ai_enabled=True, ai_available=True)

    result = IaCurriculoService(settings, provider=provider).analisar(
        texto_curriculo="Experiência profissional",
        contexto_vaga={"vaga": "Atendimento"},
    )

    assert result.resultado["parecer"] == "ADERENTE_COM_RESSALVAS"
    assert result.tokens_entrada == 100
    assert provider.calls == 1


def test_extrator_remove_contato_e_linha_sensivel():
    texto = _remover_dados_desnecessarios(
        "Idade: 35 anos\n"
        "Email: pessoa@example.com\n"
        "Telefone: (11) 99999-9999\n"
        "Experiência profissional em atendimento ao cliente.\n"
    )

    assert "Idade" not in texto
    assert "pessoa@example.com" not in texto
    assert "99999-9999" not in texto
    assert "Experiência profissional" in texto
