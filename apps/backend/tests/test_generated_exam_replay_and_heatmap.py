from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.repositories.generated_exams import GeneratedExamRepositoryMixin


class FakeCursor:
    """Cursor mínimo que despacha por trecho da query. ensure_* e a busca da
    prova (get_exam_replay) são substituídas via patch, então este fake só
    precisa responder às queries que os métodos novos emitem diretamente."""

    def __init__(self, metrics=None, sessions=None, answers=None, heatmap_rows=None, trilhas_rows=None):
        self._metrics = metrics or []
        self._sessions = sessions or []
        self._answers = answers or []
        self._heatmap_rows = heatmap_rows or []
        self._trilhas_rows = trilhas_rows or []
        self.description = []
        self._pending: list[tuple] = []
        self.executed: list[str] = []

    def execute(self, query: str, params=()):
        self.executed.append(query)
        if "FROM dbo.analise_metricas_respostas" in query and "SELECT DISTINCT" not in query:
            self.description = [
                (col,) for col in (
                    "questao_indice", "questao_id", "etapa_chave", "primeiro_acesso_em",
                    "ultima_alteracao_em", "tempo_ativo_segundos", "quantidade_alteracoes",
                )
            ]
            self._pending = list(self._metrics)
            return
        if "FROM dbo.analise_sessoes_etapas" in query:
            self.description = [
                (col,) for col in (
                    "etapa_chave", "iniciada_em", "finalizada_em", "status_etapa", "tempo_ativo_segundos",
                )
            ]
            self._pending = list(self._sessions)
            return
        if "FROM dbo.respostas_provas" in query and "GROUP BY" not in query:
            self.description = [
                (col,) for col in (
                    "id_resposta", "id_prova", "id_teste", "questao_indice", "questao_id",
                    "texto_questao_snapshot", "alternativas_snapshot", "resposta_json",
                    "resposta_correta", "categoria", "peso", "correta", "nota",
                    "respondida_em", "atualizado_em",
                )
            ]
            self._pending = list(self._answers)
            return
        if "GROUP BY r.questao_id" in query:
            self.description = [
                (col,) for col in (
                    "questao_id", "categoria", "texto_questao_snapshot", "trilha",
                    "total_respostas", "total_corretas",
                )
            ]
            self._pending = list(self._heatmap_rows)
            return
        if "SELECT DISTINCT trilha" in query:
            self.description = []
            self._pending = list(self._trilhas_rows)
            return
        self.description = []
        self._pending = []

    def fetchall(self):
        return self._pending

    def fetchone(self):
        return self._pending[0] if self._pending else None

    def columns(self, table: str = "", schema: str | None = None):
        return []


class FakeConnection:
    def __init__(self, cursor: FakeCursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor

    def commit(self):
        pass

    def close(self):
        pass


class FakeRepository(GeneratedExamRepositoryMixin):
    def __init__(self, cursor: FakeCursor):
        self._connection = FakeConnection(cursor)

    def _connect(self):
        return self._connection


@patch("rh_api.repositories.generated_exams.ensure_exam_analytics_tables")
@patch("rh_api.repositories.generated_exams.ensure_conecta_exams_tables")
def test_get_exam_replay_orders_events_chronologically(_mock_ensure_conecta, _mock_ensure_analytics):
    cursor = FakeCursor(
        metrics=[
            (0, "q-1", "word", "2026-08-20T10:00:00", "2026-08-20T10:02:00", 90.0, 2),
        ],
        sessions=[
            ("word", "2026-08-20T10:00:00", "2026-08-20T10:05:00", "Concluida", 180.0),
        ],
        answers=[
            (1, 10, "T1", 0, "q-1", "Escreva um comunicado", "[]", '{"text":"..."}', '""', "word", 10.0, 1, 10.0, "2026-08-20T10:02:00", "2026-08-20T10:02:00"),
        ],
    )
    repository = FakeRepository(cursor)
    with patch.object(FakeRepository, "_get_exam_row_with_result", return_value={"id_prova": 10}):
        result = repository.get_exam_replay(10)

    assert result["success"] is True
    tipos = [evento["tipo"] for evento in result["eventos"]]
    assert tipos == ["etapa_iniciada", "questao_vista", "questao_respondida", "etapa_finalizada"]
    assert "correta" in result["eventos"][2]["titulo"]
    assert result["resumo"]["questoes_visitadas"] == 1
    assert result["resumo"]["total_questoes"] == 1


@patch("rh_api.repositories.generated_exams.ensure_exam_analytics_tables")
@patch("rh_api.repositories.generated_exams.ensure_conecta_exams_tables")
def test_get_exam_replay_labels_incorrect_and_unevaluated_answers(_mock_ensure_conecta, _mock_ensure_analytics):
    cursor = FakeCursor(
        metrics=[
            (0, "q-1", "word", "2026-08-20T10:00:00", "2026-08-20T10:02:00", 90.0, 1),
            (1, "q-2", "word", "2026-08-20T10:02:00", "2026-08-20T10:04:00", 60.0, 1),
        ],
        sessions=[],
        answers=[
            (1, 10, "T1", 0, "q-1", "Questao 1", "[]", "0", "0", "word", 10.0, 0, 0.0, "2026-08-20T10:02:00", "2026-08-20T10:02:00"),
            (2, 10, "T1", 1, "q-2", "Questao 2 (redacao)", "[]", None, None, "word", 10.0, None, None, "2026-08-20T10:04:00", "2026-08-20T10:04:00"),
        ],
    )
    repository = FakeRepository(cursor)
    with patch.object(FakeRepository, "_get_exam_row_with_result", return_value={"id_prova": 10}):
        result = repository.get_exam_replay(10)

    titulos = [evento["titulo"] for evento in result["eventos"] if evento["tipo"] == "questao_respondida"]
    assert any("incorreta" in titulo for titulo in titulos)
    assert any("não avaliada objetivamente" in titulo for titulo in titulos)


def test_get_question_heatmap_computes_accuracy_rate_per_question():
    cursor = FakeCursor(
        heatmap_rows=[
            ("q-1", "word", "Comunicado interno", "Atendimento", 4, 3),
            ("q-2", "excel", "Fórmula SOMASE", "Atendimento", 5, 1),
        ],
        trilhas_rows=[("Atendimento",), ("Técnico",)],
    )
    repository = FakeRepository(cursor)

    result = repository.get_question_heatmap(trilha="Atendimento")

    assert result["success"] is True
    assert len(result["itens"]) == 2
    # Ordenado do menor para o maior acerto — a questão mais dificil vem primeiro.
    assert result["itens"][0]["questao_id"] == "q-2"
    assert result["itens"][0]["taxa_acerto"] == 0.2
    assert result["itens"][1]["taxa_acerto"] == 0.75
    assert result["trilhas_disponiveis"] == ["Atendimento", "Técnico"]
    filtro_queries = [q for q in cursor.executed if "GROUP BY r.questao_id" in q]
    assert len(filtro_queries) == 1
    assert "AND p.trilha = ?" in filtro_queries[0]
