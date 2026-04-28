from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from ..services.process_flow import (
    CANDIDATE_STATUS_ANALYSIS,
    CANDIDATE_STATUS_APPROVED,
    build_process_closed_message,
    canonicalize_candidate_status,
    is_process_closed,
)
from .bootstrap import (
    ensure_pipeline_columns,
    ensure_process_reference_columns,
    get_next_id_registro,
    get_process_row,
)


class TalentBankRepositoryMixin:
    def list_talent_bank(self, search: str = "", skill: str = "", tag: str = "") -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_reference_columns(cursor)
            profile_map = self._get_candidate_profile_map(cursor)
            interview_map = self._get_latest_interview_map(cursor)
            cv_map = self._get_candidate_cv_map(cursor)
            cursor.execute(
                """
                SELECT
                    id_banco,
                    id_processo,
                    id_processo_ref,
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
            rows = self._attach_process_context(
                cursor,
                rows,
                timestamp_fields=["data_movimentacao"],
            )
            result = []
            search_term = normalize_compare_text(search)
            skill_term = normalize_compare_text(skill)
            tag_term = normalize_compare_text(tag)

            for item in rows:
                id_teste = normalize_text(item.get("id_teste"))
                profile = profile_map.get(id_teste, {})
                latest_interview = interview_map.get(id_teste, {})
                cv_attachment = cv_map.get(id_teste, {})
                item["tags"] = profile.get("tags", [])
                item["habilidades"] = profile.get("habilidades", [])
                item["observacao_rh"] = profile.get("observacao_rh", "")
                item["email"] = profile.get("email", "")
                item["telefone"] = profile.get("telefone", "")
                item["whatsapp"] = profile.get("whatsapp", "")
                item["cidade"] = profile.get("cidade", "")
                item["bairro"] = profile.get("bairro", "")
                item["cv_disponivel"] = bool(normalize_text(cv_attachment.get("caminho_arquivo")))
                item["cv_nome_arquivo"] = normalize_text(cv_attachment.get("nome_arquivo_original"))
                item["cv_tipo_arquivo"] = normalize_text(cv_attachment.get("tipo_arquivo"))
                item["status_entrevista"] = (
                    canonicalize_candidate_status(latest_interview.get("status_entrevista"))
                    if normalize_text(latest_interview.get("status_entrevista"))
                    else ""
                )
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
            ensure_process_reference_columns(cursor)
            cursor.execute(
                """
                SELECT
                    id_processo,
                    id_processo_ref,
                    id_teste,
                    nome_candidato,
                    vaga,
                    pontuacao_final,
                    origem,
                    data_movimentacao
                FROM banco_talentos
                WHERE id_banco = ?
                """,
                (id_banco,),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato do banco de talentos nao encontrado.")
            row = rows[0]

            id_processo = normalize_text(data.get("id_processo"))
            if not id_processo:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Processo de destino nao informado.")
            processo = get_process_row(cursor, data.get("id_processo_ref") or id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo de destino nao encontrado.")
            if is_process_closed(processo.get("status")):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=build_process_closed_message("utilizar o candidato do banco de talentos", id_processo),
                )

            data_movimentacao = normalize_text(row.get("data_movimentacao")) or datetime.now().isoformat()
            origem = row.get("origem") or "Banco de talentos"
            vaga = normalize_text(processo.get("vaga")) or row.get("vaga")
            id_teste = normalize_text(row.get("id_teste"))

            cursor.execute(
                """
                SELECT
                    id_registro,
                    id_processo,
                    id_processo_ref,
                    id_teste,
                    nome_candidato,
                    vaga,
                    status_candidato,
                    pontuacao_final,
                    data_prova,
                    origem,
                    etapa_pipeline,
                    data_atualizacao_pipeline
                FROM candidatos_processos
                WHERE id_processo = ? AND id_teste = ?
                ORDER BY id_registro DESC
                """,
                (processo.get("id_processo"), id_teste),
            )
            existing_rows = rows_to_dicts(cursor, cursor.fetchall())
            existing = existing_rows[0] if existing_rows else None

            if existing:
                cursor.execute(
                    """
                    UPDATE candidatos_processos
                    SET
                        id_processo_ref = ?,
                        nome_candidato = ?,
                        vaga = ?,
                        pontuacao_final = ?,
                        data_prova = ?,
                        origem = ?
                    WHERE id_registro = ?
                    """,
                    (
                        processo.get("id_processo_ref", ""),
                        row.get("nome_candidato"),
                        vaga,
                        row.get("pontuacao_final"),
                        data_movimentacao,
                        origem,
                        int(existing.get("id_registro") or 0),
                    ),
                )
                if (
                    canonicalize_candidate_status(existing.get("status_candidato")) != CANDIDATE_STATUS_APPROVED
                    or normalize_text(existing.get("etapa_pipeline")) != "Aprovado"
                    or normalize_text(existing.get("id_processo_ref")) != normalize_text(processo.get("id_processo_ref"))
                ):
                    self._apply_candidate_status_update(
                        cursor,
                        current_row={
                            **existing,
                            "id_processo": processo.get("id_processo"),
                            "id_processo_ref": processo.get("id_processo_ref", ""),
                            "id_teste": id_teste,
                            "nome_candidato": row.get("nome_candidato"),
                            "vaga": vaga,
                            "pontuacao_final": row.get("pontuacao_final"),
                            "data_prova": data_movimentacao,
                            "origem": origem,
                        },
                        new_status=CANDIDATE_STATUS_APPROVED,
                        new_stage="Aprovado",
                        data_movimentacao=data_movimentacao,
                    )
            else:
                id_registro = get_next_id_registro(cursor)
                cursor.execute(
                    """
                    INSERT INTO candidatos_processos
                    (
                        id_registro,
                        id_processo,
                        id_processo_ref,
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
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        id_registro,
                        processo.get("id_processo"),
                        processo.get("id_processo_ref", ""),
                        id_teste,
                        row.get("nome_candidato"),
                        vaga,
                        CANDIDATE_STATUS_APPROVED,
                        row.get("pontuacao_final"),
                        data_movimentacao,
                        origem,
                        "Aprovado",
                        datetime.now(),
                    ),
                )
                self._apply_candidate_status_update(
                    cursor,
                    current_row={
                        "id_registro": id_registro,
                        "id_processo": processo.get("id_processo"),
                        "id_processo_ref": processo.get("id_processo_ref", ""),
                        "id_teste": id_teste,
                        "nome_candidato": row.get("nome_candidato"),
                        "vaga": vaga,
                        "status_candidato": CANDIDATE_STATUS_ANALYSIS,
                        "pontuacao_final": row.get("pontuacao_final"),
                        "data_prova": data_movimentacao,
                        "origem": origem,
                        "etapa_pipeline": "Triagem",
                        "data_atualizacao_pipeline": data_movimentacao,
                    },
                    new_status=CANDIDATE_STATUS_APPROVED,
                    new_stage="Aprovado",
                    data_movimentacao=data_movimentacao,
                )

            self._upsert_candidate_profile(
                cursor,
                id_teste=id_teste,
                nome_candidato=row.get("nome_candidato"),
            )
            cursor.execute("DELETE FROM banco_talentos WHERE id_banco = ?", (id_banco,))
            conn.commit()
            return {"success": True}
        finally:
            conn.close()
