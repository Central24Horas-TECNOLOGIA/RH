from __future__ import annotations

import math
from pathlib import Path

from rh_api.schemas.generated_exams import PublicExamAnswersRequest
from rh_api.services.exam_analytics import (
    answer_key_version,
    comparison_signature,
    dense_ranks_desc,
    derive_categories,
    execution_indicator,
    percentile_midrank,
    profile_adherence,
    sanitized_excel_details,
    text_metrics,
    weighted_analytical_score,
    z_scores,
)


def test_percentile_midrank_preserves_ties_and_single_candidate_is_unavailable():
    assert percentile_midrank([70]) == [None]
    assert percentile_midrank([10, 20, 20, 40]) == [0.0, 50.0, 50.0, 100.0]
    assert percentile_midrank([50, 50]) == [50.0, 50.0]


def test_z_score_and_dense_rank_do_not_invent_tiebreakers():
    assert z_scores([10, 10]) == [None, None]
    assert dense_ranks_desc([90, 90, 75, None, 60]) == [1, 1, 2, None, 3]


def test_analytical_score_requires_complete_percentiles_and_valid_weights():
    score, reason = weighted_analytical_score(
        {"objetiva": 80, "excel": 60},
        {"objetiva": 0.6, "excel": 0.4},
    )
    assert score == 72.0
    assert reason == ""

    score, reason = weighted_analytical_score(
        {"objetiva": 80, "excel": None},
        {"objetiva": 0.6, "excel": 0.4},
    )
    assert score is None
    assert "excel" in reason

    score, reason = weighted_analytical_score({"objetiva": 80}, {"objetiva": 0.8})
    assert score is None
    assert "100%" in reason


def test_profile_adherence_matches_weighted_euclidean_contract():
    adherence, reason = profile_adherence(
        {"a": 80, "b": 40},
        {"a": 100, "b": 50},
        {"a": 0.75, "b": 0.25},
    )
    expected_distance = math.sqrt(0.75 * 0.2**2 + 0.25 * 0.1**2)
    assert adherence == round(100 * (1 - expected_distance), 3)
    assert reason == ""

    adherence, reason = profile_adherence({"a": 80}, {}, {"a": 1})
    assert adherence is None
    assert "nao configurado" in reason.lower()

    adherence, reason = profile_adherence({"a": 80}, {"a": 90}, {"a": 0})
    assert adherence is None
    assert "pesos" in reason.lower()


def test_execution_indicator_is_suppressed_for_incomplete_or_interrupted_stage():
    assert execution_indicator(80, 20, complete=True, interrupted=False) == "Desempenho alto com execucao mais rapida"
    assert execution_indicator(80, 20, complete=False, interrupted=False) is None
    assert execution_indicator(80, 20, complete=True, interrupted=True) is None


def test_text_and_excel_details_never_return_raw_answer_or_file_content():
    metrics = text_metrics({"content": "<p>Uma frase clara. Outra frase.</p>"})
    assert metrics["word_count"] == 5
    assert "content" not in metrics
    assert metrics["spelling_status"] == "Indisponivel"
    assert text_metrics({"contentBase64": "arquivo"})["available"] is False

    details = sanitized_excel_details(
        {
            "contentBase64": "segredo",
            "validation": {
                "taskDetails": [
                    {"id": "soma", "label": "Somar valores", "done": True, "formula": "=SUM(A1:A2)", "value": "segredo"}
                ]
            },
        }
    )
    serialized = str(details)
    assert "segredo" not in serialized
    assert details[0]["details"]["formulaDetected"] is True

    explainable = sanitized_excel_details(
        {"validation": {"taskDetails": [{"id": "media", "done": True, "expectedValue": 10, "actualValue": 10, "formula": "=AVERAGE(A1:A2)", "tolerance": 0.01}]}}
    )[0]
    assert explainable["expectedValue"] == 10
    assert explainable["foundValue"] == 10
    assert explainable["foundFormula"] == "=AVERAGE(A1:A2)"
    assert explainable["tolerance"] == 0.01


def test_comparison_signature_is_deterministic_and_changes_with_assessment_contract():
    questions = [{"id": "q1", "type": "multiple", "stageKey": "a", "points": 10}]
    signature = comparison_signature(questions, [{"key": "a", "weight": 100}], {"version": 1})
    assert signature == comparison_signature(questions, [{"key": "a", "weight": 100}], {"version": 1})
    assert signature != comparison_signature(questions, [{"key": "a", "weight": 50}], {"version": 1})


def test_answer_key_version_uses_explicit_contract_or_marks_legacy():
    assert answer_key_version([], {}) == "legado"
    assert answer_key_version([], {"gabaritoVersion": "v3"}) == "v3"
    assert answer_key_version([{"answerVersion": "q2"}, {"gabaritoVersion": "q1"}], {}) == "q1|q2"


def test_public_telemetry_schema_ignores_clipboard_content():
    payload = PublicExamAnswersRequest.model_validate(
        {
            "token": "token",
            "telemetria": [
                {
                    "questao_indice": 0,
                    "evento_colagem": True,
                    "clipboard_content": "nao deve entrar no modelo",
                }
            ],
        }
    )
    dumped = payload.model_dump()
    assert dumped["telemetria"][0]["evento_colagem"] is True
    assert "clipboard_content" not in dumped["telemetria"][0]


def test_category_derivation_preserves_incomplete_and_interrupted_official_states():
    categories = derive_categories(
        {
            "resumo_etapas": [
                {"key": "excel", "label": "Excel", "percent": 80, "rawScore": 8, "rawMax": 10, "questionCount": 2, "pendings": 1, "weight": 50},
                {"key": "redacao", "label": "Redação", "percent": 0, "rawScore": 0, "rawMax": 10, "questionCount": 1, "pendings": 0, "weight": 50, "interrupted": True},
            ]
        }
    )
    assert categories[0]["complete"] is False
    assert categories[0]["completion_status"] == "Aguardando correcao"
    assert categories[1]["interrupted"] is True
    assert categories[1]["completion_status"] == "Interrompida"


def test_sql_server_migration_is_additive_idempotent_and_contains_operational_contract():
    migration = (Path(__file__).parents[3] / "infra/sql/migrations/V005__exam_analytical_results.sql").read_text(encoding="utf-8")
    upper = migration.upper()
    assert "DROP TABLE" not in upper
    assert "DROP COLUMN" not in upper
    assert "OBJECT_ID" in upper
    assert "COL_LENGTH" in upper
    assert "DATETIME2" in upper
    assert "ISJSON" in upper
    for table in (
        "analise_jobs_provas",
        "resultados_analiticos_categorias",
        "resultados_analiticos_processos",
        "mapeamentos_categorias_analiticas",
        "historico_resultados_analiticos",
        "historico_correcoes_manuais_provas",
    ):
        assert f"dbo.{table}" in migration
