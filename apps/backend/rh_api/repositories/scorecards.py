from __future__ import annotations

from fastapi import HTTPException, status

from ..services.helpers import normalize_text, rows_to_dicts
from .bootstrap import ensure_scorecards_table

# Criterios padrao do scorecard (v1). Fixos por enquanto: o RH pode pedir que
# fiquem configuraveis por vaga/processo em uma proxima iteracao, mas isso
# exigiria uma tela de administracao de criterios que nao entrou no escopo
# desta v1 (documentado no relatorio final da tarefa).
SCORECARD_CRITERIOS_PADRAO = [
    "Comunicação",
    "Fit técnico",
    "Experiência relevante",
]

NOTA_MINIMA = 1
NOTA_MAXIMA = 5


class ScorecardRepositoryMixin:
    def _get_candidate_process_row(self, cursor, id_registro: int) -> dict | None:
        cursor.execute(
            """
            SELECT id_registro, nome_candidato, status_candidato, etapa_pipeline
            FROM candidatos_processos
            WHERE id_registro = ?
            """,
            (int(id_registro or 0),),
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        return rows[0] if rows else None

    def list_candidate_scorecards(self, id_registro: int) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_scorecards_table(cursor)

            candidato = self._get_candidate_process_row(cursor, id_registro)
            if not candidato:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Candidato do processo não encontrado.",
                )

            cursor.execute(
                """
                SELECT
                    id,
                    candidato_processo_id,
                    etapa_avaliada,
                    criterio,
                    nota,
                    comentario,
                    avaliado_por,
                    avaliado_em
                FROM scorecards_avaliacao
                WHERE candidato_processo_id = ?
                ORDER BY avaliado_em DESC, id DESC
                """,
                (int(id_registro or 0),),
            )
            return rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

    def save_candidate_scorecard(
        self,
        id_registro: int,
        data: dict,
        *,
        avaliado_por: str = "",
    ) -> dict:
        etapa_avaliada = normalize_text(data.get("etapa_avaliada"))
        criterios = data.get("criterios") or []

        if not criterios:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe ao menos um critério avaliado.",
            )

        notas_normalizadas = []
        for item in criterios:
            criterio = normalize_text(item.get("criterio"))
            nota = item.get("nota")
            if not criterio:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Informe o critério avaliado.",
                )
            try:
                nota_int = int(nota)
            except (TypeError, ValueError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Nota inválida para o critério '{criterio}'.",
                )
            if nota_int < NOTA_MINIMA or nota_int > NOTA_MAXIMA:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"A nota do critério '{criterio}' deve estar entre "
                        f"{NOTA_MINIMA} e {NOTA_MAXIMA}."
                    ),
                )
            notas_normalizadas.append(
                {
                    "criterio": criterio,
                    "nota": nota_int,
                    "comentario": normalize_text(item.get("comentario")),
                }
            )

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_scorecards_table(cursor)

            candidato = self._get_candidate_process_row(cursor, id_registro)
            if not candidato:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Candidato do processo não encontrado.",
                )

            # Registrar/editar o scorecard de uma etapa substitui o conjunto de
            # notas anterior para essa mesma etapa (evita duplicar critérios
            # quando o RH reabre a avaliação para corrigir uma nota).
            cursor.execute(
                """
                DELETE FROM scorecards_avaliacao
                WHERE candidato_processo_id = ?
                  AND ISNULL(etapa_avaliada, '') = ?
                """,
                (int(id_registro or 0), etapa_avaliada),
            )

            for item in notas_normalizadas:
                cursor.execute(
                    """
                    INSERT INTO scorecards_avaliacao
                    (
                        candidato_processo_id,
                        etapa_avaliada,
                        criterio,
                        nota,
                        comentario,
                        avaliado_por,
                        avaliado_em
                    )
                    VALUES (?, ?, ?, ?, ?, ?, GETDATE())
                    """,
                    (
                        int(id_registro or 0),
                        etapa_avaliada,
                        item["criterio"],
                        item["nota"],
                        item["comentario"],
                        normalize_text(avaliado_por),
                    ),
                )

            conn.commit()
        finally:
            conn.close()

        return {
            "success": True,
            "id_registro": int(id_registro or 0),
            "etapa_avaliada": etapa_avaliada,
            "criterios": notas_normalizadas,
        }
