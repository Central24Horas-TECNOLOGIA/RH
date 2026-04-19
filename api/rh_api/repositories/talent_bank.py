from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from .bootstrap import ensure_pipeline_columns, get_next_id_registro


class TalentBankRepositoryMixin:
    def list_talent_bank(self, search: str = "", skill: str = "", tag: str = "") -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            profile_map = self._get_candidate_profile_map(cursor)
            interview_map = self._get_latest_interview_map(cursor)
            cursor.execute(
                """
                SELECT
                    id_banco,
                    id_processo,
                    id_teste,
                    nome_candidato,
                    vaga,
                    pontuacao_final,
                    data_movimentacao,
                    origem
                FROM banco_talentos
                """
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            result = []
            search_term = normalize_compare_text(search)
            skill_term = normalize_compare_text(skill)
            tag_term = normalize_compare_text(tag)

            for item in rows:
                id_teste = normalize_text(item.get("id_teste"))
                profile = profile_map.get(id_teste, {})
                latest_interview = interview_map.get(id_teste, {})
                item["tags"] = profile.get("tags", [])
                item["habilidades"] = profile.get("habilidades", [])
                item["observacao_rh"] = profile.get("observacao_rh", "")
                item["status_entrevista"] = normalize_text(latest_interview.get("status_entrevista"))
                item["data_entrevista"] = latest_interview.get("data_entrevista")
                item["link_entrevista"] = normalize_text(latest_interview.get("link_agendamento"))

                item_search_text = " ".join(
                    [
                        normalize_text(item.get("nome_candidato")),
                        normalize_text(item.get("vaga")),
                        normalize_text(item.get("id_processo")),
                        " ".join(item.get("habilidades", [])),
                        " ".join(item.get("tags", [])),
                    ]
                )
                if search_term and search_term not in normalize_compare_text(item_search_text):
                    continue
                if skill_term and all(skill_term not in normalize_compare_text(skill_item) for skill_item in item.get("habilidades", [])):
                    continue
                if tag_term and all(tag_term not in normalize_compare_text(tag_item) for tag_item in item.get("tags", [])):
                    continue

                result.append(item)

            return result
        finally:
            conn.close()

    def delete_talent_bank_candidate(self, id_banco: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM banco_talentos WHERE id_banco = ?", (id_banco,))
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def use_talent_bank_candidate(self, id_banco: int, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
            cursor.execute(
                """
                SELECT
                    id_teste,
                    nome_candidato,
                    vaga,
                    pontuacao_final,
                    origem
                FROM banco_talentos
                WHERE id_banco = ?
                """,
                (id_banco,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato do banco de talentos nao encontrado.")

            id_processo = normalize_text(data.get("id_processo"))
            if not id_processo:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Processo de destino nao informado.")

            id_registro = get_next_id_registro(cursor)
            cursor.execute(
                """
                INSERT INTO candidatos_processos
                (
                    id_registro,
                    id_processo,
                    id_teste,
                    nome_candidato,
                    vaga,
                    status_candidato,
                    pontuacao_final,
                    data_prova,
                    origem,
                    etapa_pipeline,
                    data_atualizacao_pipeline
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    id_registro,
                    id_processo,
                    row[0],
                    row[1],
                    row[2],
                    "Em analise",
                    row[3],
                    "",
                    row[4] or "Banco de talentos",
                    "Triagem",
                    datetime.now(),
                ),
            )
            self._upsert_candidate_profile(
                cursor,
                id_teste=row[0],
                nome_candidato=row[1],
            )
            cursor.execute("DELETE FROM banco_talentos WHERE id_banco = ?", (id_banco,))
            conn.commit()
            return {"success": True}
        finally:
            conn.close()
