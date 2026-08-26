from __future__ import annotations

"""Motor de pontuacao do teste DISC proprio (Conecta Provas).

Formato: cada bloco tem 4 frases, uma para cada dimensao (D/I/S/C). O
candidato escolhe, dentro do bloco, a frase "mais" parecida e a frase
"menos" parecida com o seu comportamento (formato classico ipsativo do
DISC de Marston - dominio publico).

Formula de pontuacao adotada (documentada aqui por ser uma decisao de
produto sem spec exata):
    - frase escolhida como "mais": +1 ponto na dimensao dela.
    - frase escolhida como "menos": -1 ponto na dimensao dela.
    - as outras duas frases do bloco (nem mais, nem menos): 0 ponto.
Os pontos brutos por dimensao sao somados ao longo de todos os blocos
respondidos. O perfil final e apresentado tanto em pontuacao bruta quanto
em percentual (pontos positivos normalizados sobre o total de pontos
positivos possiveis), para facilitar a leitura do grafico D-I-S-C.

Camada de interpretacao "Call Center": a empresa e um Call Center, entao o
resultado nao e um DISC genérico de mercado - alem do perfil D-I-S-C bruto,
calculamos um "indicador de aderencia ao perfil Call Center", usando um
perfil-alvo simples e documentado abaixo. Isso vale para QUALQUER vaga, nao
apenas atendimento, conforme decisao do RH.
"""

DIMENSOES = ("D", "I", "S", "C")

# Perfil-alvo Call Center (decisao de produto, documentada): pesos relativos
# por dimensao, refletindo o que a empresa considera desejavel em qualquer
# posicao dentro de uma operacao de Call Center - comunicacao clara e
# orientacao a atendimento (I), resiliencia a rotina/repeticao e paciencia
# (S), e conformidade a scripts/processos (C) tem peso maior; dominancia (D)
# tem peso menor pois times operacionais de call center dependem menos de
# perfis muito impositivos no dia a dia (ainda que D permaneca relevante
# para posicoes de lideranca, o alvo aqui e o perfil de entrada mais comum).
PERFIL_ALVO_CALL_CENTER = {"D": 0.15, "I": 0.30, "S": 0.30, "C": 0.25}


def calcular_perfil_disc(respostas: list[dict], frases_por_id: dict[int, dict]) -> dict:
    """Calcula o perfil D-I-S-C bruto a partir das respostas de um candidato.

    `respostas`: lista de {"frase_mais_id": int, "frase_menos_id": int, ...}
    `frases_por_id`: mapa id_frase -> {"dimensao": "D"/"I"/"S"/"C", ...}
    """
    pontos = {dim: 0 for dim in DIMENSOES}
    blocos_respondidos = 0
    for resposta in respostas or []:
        mais_id = resposta.get("frase_mais_id")
        menos_id = resposta.get("frase_menos_id")
        frase_mais = frases_por_id.get(mais_id)
        frase_menos = frases_por_id.get(menos_id)
        if not frase_mais or not frase_menos:
            continue
        if mais_id == menos_id:
            continue
        pontos[frase_mais["dimensao"]] = pontos.get(frase_mais["dimensao"], 0) + 1
        pontos[frase_menos["dimensao"]] = pontos.get(frase_menos["dimensao"], 0) - 1
        blocos_respondidos += 1

    positivos_totais = sum(v for v in pontos.values() if v > 0) or 1
    percentuais = {
        dim: round(max(pontos.get(dim, 0), 0) / positivos_totais * 100, 1) for dim in DIMENSOES
    }

    return {
        "pontos_brutos": pontos,
        "percentuais": percentuais,
        "blocos_respondidos": blocos_respondidos,
        "dimensao_dominante": max(pontos, key=lambda dim: pontos.get(dim, 0)) if blocos_respondidos else None,
    }


def calcular_aderencia_call_center(percentuais: dict[str, float]) -> dict:
    """Calcula um indicador de apoio (nao eliminatorio) de aderencia ao perfil
    Call Center, comparando o perfil percentual do candidato ao perfil-alvo.

    Metodo: distancia absoluta media entre o percentual do candidato e o
    peso-alvo (também em escala percentual) em cada dimensao, convertida em
    um percentual de aderencia (100% = perfil identico ao alvo).
    """
    alvo_percentual = {dim: PERFIL_ALVO_CALL_CENTER[dim] * 100 for dim in DIMENSOES}
    diffs = [abs(percentuais.get(dim, 0) - alvo_percentual[dim]) for dim in DIMENSOES]
    distancia_media = sum(diffs) / len(diffs)
    # distancia_media varia de 0 a 100; aderencia = 100 - distancia_media, limitada a [0, 100]
    aderencia = max(0.0, min(100.0, 100 - distancia_media))

    if aderencia >= 75:
        faixa = "Alta aderência"
    elif aderencia >= 50:
        faixa = "Aderência moderada"
    else:
        faixa = "Aderência baixa"

    return {
        "percentual_aderencia": round(aderencia, 1),
        "faixa": faixa,
        "perfil_alvo": alvo_percentual,
        "observacao": (
            "Indicador de apoio para o contexto de Call Center - não é eliminatório "
            "e deve ser interpretado em conjunto com as demais etapas do processo."
        ),
    }
