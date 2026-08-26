from __future__ import annotations

"""Camada de feedback qualitativo automatico (aditiva).

Objetivo: quando um candidato erra uma questao com gabarito fechado, o
sistema hoje so mostra certo/errado. Esta camada acrescenta um retorno
textual simples por questao errada, alem de um resumo automatico por
categoria/dificuldade - sem alterar nenhuma pontuacao ja calculada.

Esta funcao e propositalmente pura (nao acessa banco): ela recebe a lista
de respostas ja persistidas/computadas (com "correta", "categoria",
"texto_questao_snapshot" etc, como retornado por
GeneratedExamRepositoryMixin._get_exam_answers) e o snapshot das questoes
(quando disponivel, para extrair "dificuldade"/"feedbackErro" opcionais que
o banco de questoes tenha registrado), e devolve apenas texto explicativo
adicional. Nada aqui é gravado no banco nem influencia a nota.
"""


def _default_feedback(texto_questao: str) -> str:
    texto = (texto_questao or "").strip()
    resumo = texto[:80] + ("..." if len(texto) > 80 else "")
    if resumo:
        return f"Resposta incorreta — reveja o tópico: {resumo}"
    return "Resposta incorreta — reveja o conteúdo desta questão."


def build_qualitative_feedback(respostas: list[dict], questoes: list[dict] | None = None) -> dict:
    """Gera feedback qualitativo por questao errada + resumo por categoria/dificuldade.

    `respostas`: lista de respostas já corrigidas (com chaves "correta",
        "categoria", "questao_id"/"questao_indice", "texto_questao_snapshot").
    `questoes`: snapshot opcional das questões da prova (para localizar um
        "feedbackErro" e "dificuldade" cadastrados na questão, quando
        existirem — campos opcionais, aditivos).
    """
    questoes = questoes or []
    questoes_by_index = {index: q for index, q in enumerate(questoes) if isinstance(q, dict)}

    itens_com_feedback = []
    contagem_categoria: dict[str, dict[str, int]] = {}
    contagem_dificuldade: dict[str, dict[str, int]] = {}

    for resposta in respostas or []:
        categoria = (resposta.get("categoria") or "Geral").strip() or "Geral"
        indice = resposta.get("questao_indice")
        questao_snapshot = questoes_by_index.get(indice, {}) if indice is not None else {}
        dificuldade = questao_snapshot.get("dificuldade") or resposta.get("dificuldade") or "não classificada"
        correta = bool(resposta.get("correta"))

        contagem_categoria.setdefault(categoria, {"acertos": 0, "total": 0})
        contagem_categoria[categoria]["total"] += 1
        if correta:
            contagem_categoria[categoria]["acertos"] += 1

        contagem_dificuldade.setdefault(dificuldade, {"acertos": 0, "total": 0})
        contagem_dificuldade[dificuldade]["total"] += 1
        if correta:
            contagem_dificuldade[dificuldade]["acertos"] += 1

        if not correta and resposta.get("correta") is not None:
            feedback_customizado = questao_snapshot.get("feedbackErro") or questao_snapshot.get("feedback_erro")
            texto_questao = resposta.get("texto_questao_snapshot") or questao_snapshot.get("title") or ""
            itens_com_feedback.append(
                {
                    "questao_indice": indice,
                    "questao_id": resposta.get("questao_id"),
                    "categoria": categoria,
                    "dificuldade": dificuldade,
                    "feedback_qualitativo": feedback_customizado or _default_feedback(texto_questao),
                }
            )

    pontos_fortes = []
    pontos_atencao = []
    for categoria, valores in contagem_categoria.items():
        total = valores["total"]
        if not total:
            continue
        proporcao = valores["acertos"] / total
        resumo = f"{categoria} ({valores['acertos']}/{total})"
        if proporcao >= 0.75:
            pontos_fortes.append(resumo)
        elif proporcao <= 0.5:
            pontos_atencao.append(resumo)

    resumo_texto_partes = []
    if pontos_fortes:
        resumo_texto_partes.append("Pontos fortes: " + "; ".join(pontos_fortes) + ".")
    if pontos_atencao:
        resumo_texto_partes.append("Pontos de atenção: " + "; ".join(pontos_atencao) + ".")
    if not resumo_texto_partes:
        resumo_texto_partes.append("Sem dados suficientes para gerar um resumo qualitativo por categoria.")

    return {
        "questoes_erradas": itens_com_feedback,
        "resumo_por_categoria": contagem_categoria,
        "resumo_por_dificuldade": contagem_dificuldade,
        "resumo_textual": " ".join(resumo_texto_partes),
    }
