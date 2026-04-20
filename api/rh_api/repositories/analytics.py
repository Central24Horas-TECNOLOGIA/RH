from __future__ import annotations

import logging

from fastapi import HTTPException, status

from ..services.analytics import build_analysis_from_payload
from ..services.helpers import normalize_compare_text, normalize_text, parse_float_br, rows_to_dicts
from .bootstrap import ensure_process_reference_columns, get_process_row


logger = logging.getLogger(__name__)


class AnalyticsRepositoryMixin:
    def get_candidate_analytics(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_reference_columns(cursor)
            process_map = self._get_process_map(cursor)
            process_candidate_map = self._get_process_candidate_map(cursor)
            answer_files_map = self._get_answer_files_map(cursor)

            cursor.execute(
                """
                SELECT
                    id_teste,
                    id_processo,
                    nome_candidato,
                    vaga,
                    nivel,
                    trilha,
                    data_iso,
                    data_exibicao,
                    pontuacao_final,
                    status,
                    tempo_minutos,
                    arquivo_gabarito,
                    etapas_json,
                    id_processo_ref
                FROM historico_provas
                """
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            result = []
            for row in rows:
                id_processo = normalize_text(row.get("id_processo"))
                id_processo_ref = normalize_text(row.get("id_processo_ref"))
                id_teste = normalize_text(row.get("id_teste"))
                if not id_processo or id_processo.upper() == "PROCESSO_UNICO":
                    continue

                try:
                    process_row = (
                        process_map.get(id_processo_ref)
                        or process_map.get(id_processo)
                        or get_process_row(cursor, id_processo_ref or id_processo)
                        or {}
                    )
                    analysis = build_analysis_from_payload(
                        row,
                        process_row,
                        process_candidate_map.get(id_teste, {}),
                        answer_files_map.get(id_teste, {}),
                    )
                    status_candidato = normalize_text(analysis.get("status_candidato"))

                    result.append(
                        {
                            "id_teste": analysis.get("id_teste", ""),
                            "id_processo": analysis.get("id_processo", ""),
                            "nome_candidato": analysis.get("nome_candidato", ""),
                            "vaga": analysis.get("vaga", ""),
                            "nota_final": round(parse_float_br(analysis.get("nota_final", 0)), 1),
                            "afinidade_percentual": round(float(analysis.get("afinidade_percentual", 0) or 0), 1),
                            "recomendacao": analysis.get("recomendacao", ""),
                            "parecer_final": analysis.get("parecer_final", ""),
                            "status_candidato": status_candidato,
                        }
                    )
                except Exception as row_error:
                    logger.warning("Falha ao analisar a prova %s: %s", id_teste, row_error)
                    continue

            return result
        finally:
            conn.close()

    def get_candidate_analytics_detail(self, id_teste: str) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_reference_columns(cursor)
            process_map = self._get_process_map(cursor)
            process_candidate_map = self._get_process_candidate_map(cursor)
            answer_files_map = self._get_answer_files_map(cursor)

            cursor.execute(
                """
                SELECT
                    id_teste,
                    id_processo,
                    nome_candidato,
                    vaga,
                    nivel,
                    trilha,
                    data_iso,
                    data_exibicao,
                    pontuacao_final,
                    status,
                    tempo_minutos,
                    arquivo_gabarito,
                    etapas_json,
                    id_processo_ref
                FROM historico_provas
                WHERE id_teste = ?
                """,
                (id_teste,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prova nao encontrada.")

            history_row = rows_to_dicts(cursor, [row])[0]
            process_ref = normalize_text(history_row.get("id_processo_ref"))
            process_id = normalize_text(history_row.get("id_processo"))
            return build_analysis_from_payload(
                history_row,
                process_map.get(process_ref)
                or process_map.get(process_id)
                or get_process_row(cursor, process_ref or process_id)
                or {},
                process_candidate_map.get(id_teste, {}),
                answer_files_map.get(id_teste, {}),
            )
        finally:
            conn.close()
