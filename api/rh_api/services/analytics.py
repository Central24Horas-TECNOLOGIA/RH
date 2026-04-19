from __future__ import annotations

import re

from .helpers import normalize_compare_text, normalize_text, parse_float_br, safe_json_loads


STAGE_IMPORTANCE_BY_ROLE = {
    "Jovem Aprendiz": {
        "word_basic": 7.0,
        "excel_basic": 5.0,
        "general_knowledge": 6.0,
        "logic": 6.0,
    },
    "Operador": {
        "word_basic": 6.0,
        "customer_service": 7.5,
        "logic": 6.5,
        "general_knowledge": 5.5,
    },
    "Estagiario": {
        "word_basic": 6.5,
        "excel_intermediate": 6.5,
        "logic": 6.5,
        "technical_support": 6.0,
    },
    "Supervisor": {
        "word_intermediate": 7.0,
        "excel_operational": 7.0,
        "logic": 7.0,
        "customer_service": 7.0,
    },
    "Control Desk": {
        "word_intermediate": 6.5,
        "excel_quality": 7.5,
        "logic": 7.0,
        "adm": 7.0,
    },
    "Planejamento": {
        "word_intermediate": 6.0,
        "excel_planning": 8.0,
        "logic": 7.5,
        "adm": 7.0,
    },
    "TI": {
        "word_advanced": 6.0,
        "technical_support": 7.0,
        "logic": 7.5,
        "excel_advanced": 8.0,
    },
    "Analista": {
        "word_advanced": 7.0,
        "excel_advanced": 8.0,
        "logic": 7.5,
        "technical_support": 7.5,
        "adm": 6.5,
    },
    "Outros": {
        "word_intermediate": 6.5,
        "excel_intermediate": 6.5,
        "logic": 6.5,
        "general_knowledge": 6.0,
    },
}

STAGE_LABEL_FALLBACK = {
    "word_basic": "Word Basico",
    "word_intermediate": "Word Intermediario",
    "word_advanced": "Word Avancado",
    "excel_basic": "Excel Basico",
    "excel_intermediate": "Excel Intermediario",
    "excel_advanced": "Excel Avancado",
    "excel_operational": "Excel Operacional",
    "excel_planning": "Excel Planejamento",
    "excel_quality": "Excel Qualidade",
    "logic": "Logica",
    "technical_support": "Conhecimentos Tecnicos",
    "customer_service": "Atendimento",
    "general_knowledge": "Conhecimentos Gerais",
    "adm": "Administrativo",
    "rh": "RH",
}


def clean_analysis_text(text):
    raw = normalize_text(text)
    if not raw:
        return ""

    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    ignored_prefixes = (
        "candidato:",
        "perfil:",
        "nivel:",
        "nota final:",
        "data:",
        "observacoes do rh:",
        "questao ",
        "etapa:",
        "titulo:",
        "enunciado:",
        "gabarito / criterio:",
        "pontuacao obtida:",
        "=== gabarito completo ===",
    )
    ignored_exact = {
        "sem resposta.",
        "arquivo nao enviado.",
        "nenhuma observacao registrada.",
    }

    useful_lines = []
    for line in lines:
        lower = normalize_compare_text(line)
        if lower in ignored_exact:
            continue

        if lower.startswith(ignored_prefixes):
            if lower.startswith("resposta do candidato:"):
                content = line.split(":", 1)[1].strip() if ":" in line else ""
                if normalize_compare_text(content) not in ignored_exact:
                    useful_lines.append(content)
            continue

        useful_lines.append(line)

    return "\n".join(useful_lines).strip()


def extract_analysis_text(payload, history_row):
    safe_payload = payload if isinstance(payload, dict) else {}
    text_candidates = [
        safe_payload.get("textContent"),
        safe_payload.get("texto"),
        safe_payload.get("analysisText"),
        safe_payload.get("content"),
        history_row.get("arquivo_gabarito"),
    ]

    for candidate_text in text_candidates:
        cleaned = clean_analysis_text(candidate_text)
        if cleaned:
            return cleaned

    stage_summary = safe_payload.get("stageSummary")
    if not isinstance(stage_summary, list):
        stage_summary = safe_json_loads(history_row.get("etapas_json"), [])

    fallback_lines = []
    for stage in stage_summary or []:
        if not isinstance(stage, dict):
            continue

        label = normalize_text(stage.get("label") or stage.get("key") or "Etapa")
        raw_score = parse_float_br(stage.get("rawScore"))
        raw_max = parse_float_br(stage.get("rawMax"))
        if raw_max > 0:
            fallback_lines.append(f"{label} com desempenho de {raw_score} em {raw_max} pontos.")

    return "\n".join(fallback_lines).strip()


def score_text_quality(text):
    clean = clean_analysis_text(text)
    if not clean:
        return {"length_score": 0.0, "clarity_score": 0.0, "keyword_score": 0.0, "overall": 0.0}

    words = re.findall(r"\b[\wÀ-ÿ\-]+\b", clean.lower())
    word_count = len(words)
    if word_count == 0:
        return {"length_score": 0.0, "clarity_score": 0.0, "keyword_score": 0.0, "overall": 0.0}

    unique_ratio = len(set(words)) / max(word_count, 1)
    sentence_count = max(1, len(re.findall(r"[.!?]+", clean)))
    avg_sentence_len = word_count / sentence_count

    length_score = 10.0 if word_count >= 80 else min((word_count / 80.0) * 10.0, 10.0)
    clarity_base = unique_ratio * 10.0
    structure_bonus = 0.0
    if sentence_count >= 2:
        structure_bonus += 1.0
    if 6 <= avg_sentence_len <= 30:
        structure_bonus += 1.0
    if any(p in clean for p in [".", ";", ":", "!", "?"]):
        structure_bonus += 0.5

    clarity_score = min(clarity_base + structure_bonus, 10.0)
    common_business_terms = [
        "processo",
        "analise",
        "solucao",
        "cliente",
        "indicador",
        "resultado",
        "atendimento",
        "suporte",
        "planilha",
        "dados",
        "controle",
        "qualidade",
        "prazo",
        "demanda",
        "problema",
        "excel",
        "word",
        "formula",
        "procv",
        "relatorio",
        "atividade",
        "tabela",
        "coluna",
        "linha",
        "arquivo",
        "sistema",
        "monitoramento",
        "chamado",
        "operacao",
    ]

    term_hits = sum(1 for term in common_business_terms if term in normalize_compare_text(clean))
    keyword_score = min((term_hits / 4.0) * 10.0, 10.0)
    if keyword_score == 0 and word_count >= 12:
        keyword_score = 4.0

    overall = round((length_score * 0.30) + (clarity_score * 0.40) + (keyword_score * 0.30), 2)
    return {
        "length_score": round(length_score, 2),
        "clarity_score": round(clarity_score, 2),
        "keyword_score": round(keyword_score, 2),
        "overall": overall,
    }


def build_stage_expectation(role):
    role_safe = normalize_text(role)
    if normalize_compare_text(role_safe) == "estagiario":
        role_safe = "Estagiario"
    return STAGE_IMPORTANCE_BY_ROLE.get(role_safe, {})


def build_analysis_from_payload(history_row, process_row, process_candidate_row, payload):
    safe_payload = payload if isinstance(payload, dict) else {}
    raw_stage_summary = safe_payload.get("stageSummary")
    if not isinstance(raw_stage_summary, list):
        raw_stage_summary = safe_json_loads(history_row.get("etapas_json"), [])

    stage_summary = raw_stage_summary if isinstance(raw_stage_summary, list) else []
    candidate = safe_payload.get("candidate") if isinstance(safe_payload.get("candidate"), dict) else {}

    weighted_final_score = parse_float_br(safe_payload.get("weightedFinalScore"))
    if weighted_final_score <= 0:
        weighted_final_score = parse_float_br(history_row.get("pontuacao_final"))

    role = normalize_text(candidate.get("role") or history_row.get("vaga"))
    if normalize_compare_text(role) == "estagiario":
        role = "Estagiario"

    expectation = build_stage_expectation(role)
    normalized_stages = []
    deficits = []
    strengths = []

    for stage in stage_summary:
        if not isinstance(stage, dict):
            continue

        stage_key = normalize_text(stage.get("key"))
        stage_label = normalize_text(stage.get("label")) or STAGE_LABEL_FALLBACK.get(stage_key, stage_key or "Etapa")
        raw_score = parse_float_br(stage.get("rawScore"))
        raw_max = parse_float_br(stage.get("rawMax"))
        obtained = round((raw_score / raw_max) * 10, 2) if raw_max else 0.0
        expected = parse_float_br(expectation.get(stage_key, 6.0))
        gap = round(obtained - expected, 2)

        item = {
            "key": stage_key,
            "label": stage_label,
            "obtained": obtained,
            "expected": expected,
            "gap": gap,
            "weight": parse_float_br(stage.get("weight")),
            "question_count": int(parse_float_br(stage.get("questionCount"))),
        }
        normalized_stages.append(item)

        if obtained <= 4:
            deficits.append(f"{stage_label} abaixo do esperado para a vaga.")
        elif 5 <= obtained <= 7:
            strengths.append(f"{stage_label} na media do esperado para a vaga.")
        elif 7 < obtained <= 8:
            strengths.append(f"{stage_label} com bom resultado para a vaga.")
        elif obtained >= 9:
            strengths.append(f"{stage_label} com resultado desejado para a vaga.")

    text_content = extract_analysis_text(safe_payload, history_row)
    text_quality = score_text_quality(text_content)
    process_name = normalize_text(history_row.get("id_processo"))
    process_status = normalize_text(process_candidate_row.get("status_candidato")) or "Em analise"
    cutoff_enabled = int(parse_float_br(process_row.get("usa_nota_corte"))) if process_row else 0
    cutoff_value = None
    if process_row and process_row.get("nota_corte") not in (None, ""):
        cutoff_value = parse_float_br(process_row.get("nota_corte"))

    weighted_fit_sum = 0.0
    total_weight = 0.0
    highest_weight_stage = None

    for item in normalized_stages:
        obtained = float(item.get("obtained") or 0)
        expected = float(item.get("expected") or 0)
        weight = float(item.get("expected") or 0)

        if highest_weight_stage is None or weight > float(highest_weight_stage.get("expected") or 0):
            highest_weight_stage = item

        if expected <= 0:
            continue

        stage_fit = (obtained / expected) * 100.0
        stage_fit = max(0.0, min(stage_fit, 100.0))
        weighted_fit_sum += stage_fit * weight
        total_weight += weight

    affinity = round((weighted_fit_sum / total_weight), 1) if total_weight > 0 else 0.0
    affinity = max(0.0, min(affinity, 100.0))
    zerou_etapa_mais_critica = bool(highest_weight_stage and float(highest_weight_stage.get("obtained") or 0) == 0.0)

    recommendation = "Baixa aderencia"
    if affinity > 75:
        recommendation = "Forte aderencia"
    elif affinity > 60:
        recommendation = "Boa aderencia"

    final_consideration = "Apto a vaga"
    if zerou_etapa_mais_critica or affinity <= 60:
        final_consideration = "Inapto a vaga"
    if cutoff_enabled and cutoff_value is not None and weighted_final_score < cutoff_value:
        final_consideration = "Eliminado pela nota de corte"

    remarks = []
    remarks.extend(strengths[:3])
    remarks.extend(deficits[:3])
    if not remarks:
        remarks.append("Desempenho equilibrado, sem desvios criticos relevantes.")

    return {
        "id_teste": history_row.get("id_teste"),
        "id_processo": process_name,
        "nome_candidato": history_row.get("nome_candidato"),
        "vaga": role,
        "nota_final": round(float(weighted_final_score or 0), 1),
        "afinidade_percentual": affinity,
        "recomendacao": recommendation,
        "parecer_final": final_consideration,
        "status_candidato": process_status,
        "nota_corte_ativa": bool(cutoff_enabled),
        "nota_corte_valor": cutoff_value,
        "analise_texto": text_quality,
        "grafico": normalized_stages,
        "ressalvas": remarks,
        "etapa_critica": highest_weight_stage.get("label") if highest_weight_stage else "",
        "zerou_etapa_critica": zerou_etapa_mais_critica,
    }
