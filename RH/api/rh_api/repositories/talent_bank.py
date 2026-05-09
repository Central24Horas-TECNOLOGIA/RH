from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from ..services.process_flow import (
    CANDIDATE_STATUS_ANALYSIS,
    CANDIDATE_STATUS_APPROVED,
    CANDIDATE_STATUS_ELIMINATED,
    CANDIDATE_STATUS_TALENT_BANK,
    CANDIDATE_STATUS_WITHDREW,
    build_process_closed_message,
    canonicalize_candidate_status,
    is_process_closed,
)
from .bootstrap import (
    ensure_pipeline_columns,
    ensure_process_reference_columns,
    get_process_row,
    insert_candidate_process_record,
)


class TalentBankRepositoryMixin:
    def list_talent_bank(self, search: str = "", skill: str = "", tag: str = "") -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
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

    def add_candidate_to_talent_bank(self, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
            ensure_process_reference_columns(cursor)

            id_teste = normalize_text(data.get("id_teste"))
            nome_candidato = normalize_text(data.get("nome_candidato"))
            if not id_teste:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID da prova não informado.")
            if not nome_candidato:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome do candidato não informado.")

            id_processo = normalize_text(data.get("id_processo"))
            id_processo_ref = normalize_text(data.get("id_processo_ref"))
            pontuacao_final = data.get("pontuacao_final", "")
            data_movimentacao = normalize_text(data.get("data_movimentacao")) or datetime.now().isoformat()
            origem = normalize_text(data.get("origem")) or "Processo Unico"
            vaga = normalize_text(data.get("vaga")) or origem or "Processo Unico"
            email = normalize_text(data.get("email"))
            telefone = normalize_text(data.get("telefone"))
            whatsapp = normalize_text(data.get("whatsapp"))

            id_banco_existente = self._find_talent_bank_duplicate_id(
                cursor,
                id_teste=id_teste,
                email=email,
                telefone=telefone,
                whatsapp=whatsapp,
            )

            if id_banco_existente:
                cursor.execute(
                    """
                    UPDATE banco_talentos
                    SET
                        id_processo = ?,
                        id_processo_ref = ?,
                        id_teste = ?,
                        nome_candidato = ?,
                        vaga = ?,
                        pontuacao_final = ?,
                        data_movimentacao = ?,
                        origem = ?
                    WHERE id_banco = ?
                    """,
                    (
                        id_processo,
                        id_processo_ref,
                        id_teste,
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao,
                        origem,
                        id_banco_existente,
                    ),
                )
                id_banco = id_banco_existente
            else:
                cursor.execute(
                    """
                    INSERT INTO banco_talentos
                    (
                        id_processo,
                        id_processo_ref,
                        id_teste,
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao,
                        origem
                    )
                    OUTPUT INSERTED.id_banco
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        id_processo,
                        id_processo_ref,
                        id_teste,
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao,
                        origem,
                    ),
                )
                inserted_row = cursor.fetchone()
                id_banco = int(inserted_row[0])

            self._upsert_candidate_profile(
                cursor,
                id_teste=id_teste,
                nome_candidato=nome_candidato,
                email=email or None,
                telefone=telefone or None,
                whatsapp=whatsapp or None,
                cidade=normalize_text(data.get("cidade")) or None,
                bairro=normalize_text(data.get("bairro")) or None,
            )
            if id_processo or id_processo_ref:
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
                    WHERE id_teste = ?
                      AND (? = '' OR id_processo = ?)
                      AND (? = '' OR id_processo_ref = ?)
                    """,
                    (
                        id_teste,
                        id_processo,
                        id_processo,
                        id_processo_ref,
                        id_processo_ref,
                    ),
                )
                process_rows = rows_to_dicts(cursor, cursor.fetchall())
                for process_row in process_rows:
                    if canonicalize_candidate_status(process_row.get("status_candidato")) == CANDIDATE_STATUS_TALENT_BANK:
                        continue
                    self._apply_candidate_status_update(
                        cursor,
                        current_row=process_row,
                        new_status=CANDIDATE_STATUS_TALENT_BANK,
                        new_stage="Reprovado",
                        data_movimentacao=data_movimentacao,
                    )
            conn.commit()
            return {"success": True, "id_banco": id_banco}
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
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato do Banco de Talentos não encontrado.")
            row = rows[0]

            id_processo = normalize_text(data.get("id_processo"))
            if not id_processo:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Processo de destino não informado.")
            processo = get_process_row(cursor, data.get("id_processo_ref") or id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo de destino não encontrado.")
            if is_process_closed(processo.get("status")):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=build_process_closed_message("utilizar o candidato do Banco de Talentos", id_processo),
                )

            data_movimentacao = datetime.now().isoformat()
            origem = "Banco de Talentos"
            vaga = normalize_text(processo.get("vaga")) or row.get("vaga")
            id_teste = normalize_text(row.get("id_teste"))
            cursor.execute(
                """
                SELECT id_registro, status_candidato
                FROM candidatos_processos
                WHERE id_teste = ?
                """,
                (id_teste,),
            )
            for linked_candidate in rows_to_dicts(cursor, cursor.fetchall()):
                linked_status = canonicalize_candidate_status(
                    linked_candidate.get("status_candidato"),
                )
                if linked_status != CANDIDATE_STATUS_TALENT_BANK:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Este candidato já está vinculado a um processo seletivo.",
                    )
            profile = self._get_candidate_profile_map(cursor).get(id_teste, {})
            profile_email = normalize_compare_text(profile.get("email"))
            profile_phones = {
                normalize_text(profile.get("telefone")),
                normalize_text(profile.get("whatsapp")),
            }
            profile_phones.discard("")
            cursor.execute(
                """
                SELECT
                    cp.id_registro,
                    cp.id_processo,
                    cp.id_processo_ref,
                    cp.id_teste,
                    cp.nome_candidato,
                    cp.status_candidato,
                    meta.email,
                    meta.telefone,
                    meta.whatsapp
                FROM candidatos_processos cp
                LEFT JOIN candidatos_metadata meta
                    ON meta.id_teste = cp.id_teste
                WHERE cp.id_processo = ?
                  AND cp.id_processo_ref = ?
                """,
                (
                    processo.get("id_processo"),
                    processo.get("id_processo_ref", ""),
                ),
            )
            existing_rows = rows_to_dicts(cursor, cursor.fetchall())
            terminal_statuses = {
                CANDIDATE_STATUS_APPROVED,
                CANDIDATE_STATUS_ELIMINATED,
                CANDIDATE_STATUS_TALENT_BANK,
                CANDIDATE_STATUS_WITHDREW,
            }
            for existing in existing_rows:
                same_candidate = normalize_text(existing.get("id_teste")) == id_teste
                same_email = profile_email and normalize_compare_text(existing.get("email")) == profile_email
                same_phone = bool(profile_phones) and normalize_text(existing.get("telefone")) in profile_phones
                same_whatsapp = bool(profile_phones) and normalize_text(existing.get("whatsapp")) in profile_phones
                if not (same_candidate or same_email or same_phone or same_whatsapp):
                    continue

                existing_status = canonicalize_candidate_status(existing.get("status_candidato"))
                if existing_status == CANDIDATE_STATUS_APPROVED:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Este candidato já foi aprovado neste processo destino.",
                    )
                if existing_status not in terminal_statuses:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Este candidato já está ativo no processo destino.",
                    )

            id_registro = insert_candidate_process_record(
                cursor,
                processo,
                {
                    "id_teste": id_teste,
                    "nome_candidato": row.get("nome_candidato"),
                    "vaga": vaga,
                    "status_candidato": CANDIDATE_STATUS_ANALYSIS,
                    "pontuacao_final": row.get("pontuacao_final"),
                    "data_prova": data_movimentacao,
                    "origem": origem,
                    "etapa_pipeline": "Triagem",
                    "data_atualizacao_pipeline": datetime.now(),
                },
            )

            self._upsert_candidate_profile(
                cursor,
                id_teste=id_teste,
                nome_candidato=row.get("nome_candidato"),
            )
            cursor.execute("DELETE FROM banco_talentos WHERE id_banco = ?", (id_banco,))
            conn.commit()
            return {
                "success": True,
                "id_registro": id_registro,
                "status_candidato": CANDIDATE_STATUS_ANALYSIS,
                "message": "Candidato vinculado ao processo destino em análise.",
            }
        finally:
            conn.close()
