from __future__ import annotations

"""Motor de pontuacao do Fit Cultural aprofundado.

O RH cadastra valores da empresa (ex.: "Colaboração"), cada um com uma ou
mais frases associadas. O candidato indica o nivel de concordancia com cada
frase em uma escala Likert de 1 a 5 (1 = discordo totalmente, 5 = concordo
totalmente).

Formula de pontuacao adotada (decisao de produto, documentada aqui):
    - score por valor = media das notas de concordancia das frases daquele
      valor, normalizada para percentual: ((media - 1) / 4) * 100.
      Isso mapeia a escala 1-5 para 0%-100% (nota 1 = 0%, nota 5 = 100%).
    - score geral = media simples dos scores percentuais de cada valor.
"""


def _percentual_da_nota(nota: float) -> float:
    nota = max(1.0, min(5.0, float(nota)))
    return round((nota - 1) / 4 * 100, 1)


def calcular_score_fit_cultural(
    respostas: list[dict],
    frases_por_id: dict[int, dict],
) -> dict:
    """Calcula o score de aderencia por valor e o score geral.

    `respostas`: lista de {"frase_id": int, "nota_concordancia": int}
    `frases_por_id`: mapa id_frase -> {"valor_id": int, "valor_nome": str, ...}
    """
    notas_por_valor: dict[int, list[float]] = {}
    nomes_por_valor: dict[int, str] = {}

    for resposta in respostas or []:
        frase_id = resposta.get("frase_id")
        nota = resposta.get("nota_concordancia")
        frase = frases_por_id.get(frase_id)
        if not frase or nota is None:
            continue
        try:
            nota_float = float(nota)
        except (TypeError, ValueError):
            continue
        valor_id = frase.get("valor_id")
        if valor_id is None:
            continue
        notas_por_valor.setdefault(valor_id, []).append(nota_float)
        nomes_por_valor.setdefault(valor_id, frase.get("valor_nome") or "")

    resultado_por_valor = []
    for valor_id, notas in notas_por_valor.items():
        media_nota = sum(notas) / len(notas)
        resultado_por_valor.append(
            {
                "valor_id": valor_id,
                "valor_nome": nomes_por_valor.get(valor_id, ""),
                "media_nota": round(media_nota, 2),
                "percentual_aderencia": _percentual_da_nota(media_nota),
                "respostas_consideradas": len(notas),
            }
        )
    resultado_por_valor.sort(key=lambda item: item["valor_nome"])

    score_geral = (
        round(sum(item["percentual_aderencia"] for item in resultado_por_valor) / len(resultado_por_valor), 1)
        if resultado_por_valor
        else 0.0
    )

    return {
        "por_valor": resultado_por_valor,
        "score_geral": score_geral,
        "total_respostas": sum(len(v) for v in notas_por_valor.values()),
    }
