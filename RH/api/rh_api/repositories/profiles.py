from __future__ import annotations

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_string_list, normalize_text, rows_to_dicts
from ..services.cv import is_valid_email, is_valid_phone
from ..services.process_flow import (
    CANDIDATE_STATUS_APPROVED,
    CANDIDATE_STATUS_ELIMINATED,
    build_approved_candidate_locked_message,
    canonicalize_candidate_status,
)


class CandidateProfileRepositoryMixin:
    def update_standalone_candidate_status(self, id_teste: str, data: dict) -> dict:
        safe_id_teste = normalize_text(id_teste)
        if not safe_id_teste:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Identificador do candidato nao informado.")

        requested_status = canonicalize_candidate_status(data.get("status_candidato"))
        if requested_status not in {CANDIDATE_STATUS_APPROVED, CANDIDATE_STATUS_ELIMINATED}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status avulso permitido apenas para aprovacao ou eliminacao.",
            )

        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT status_candidato
                FROM candidatos_processos
                WHERE id_teste = ?
                ORDER BY id_registro DESC
                """,
                (safe_id_teste,),
            )
            process_rows = rows_to_dicts(cursor, cursor.fetchall())
            if any(
                canonicalize_candidate_status(row.get("status_candidato")) == CANDIDATE_STATUS_APPROVED
                for row in process_rows
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=build_approved_candidate_locked_message(),
                )

            cursor.execute(
                """
                SELECT TOP 1 id_teste, status
                FROM historico_provas
                WHERE id_teste = ?
                ORDER BY data_iso DESC
                """,
                (safe_id_teste,),
            )
            history_row = cursor.fetchone()
            if not history_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato nao encontrado para atualizar o status.")

            current_status = canonicalize_candidate_status(history_row[1])
            if normalize_compare_text(current_status) == normalize_compare_text(CANDIDATE_STATUS_APPROVED):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=build_approved_candidate_locked_message(),
                )

            cursor.execute(
                """
                UPDATE historico_provas
                SET status = ?
                WHERE id_teste = ?
                """,
                (requested_status, safe_id_teste),
            )
            cursor.execute(
                """
                UPDATE entrevistas_agendadas
                SET status_entrevista = ?, atualizado_em = GETDATE()
                WHERE id_teste = ? AND ISNULL(id_teste, '') <> ''
                """,
                (requested_status, safe_id_teste),
            )
            conn.commit()
            self.logger.info("Status avulso do candidato %s atualizado para '%s'.", safe_id_teste, requested_status)
            return {"success": True, "status_candidato": requested_status}
        finally:
            conn.close()

    def upsert_candidate_profile(self, id_teste: str, data: dict) -> dict:
        safe_id_teste = normalize_text(id_teste)
        if not safe_id_teste:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Identificador do candidato nao informado.")

        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT TOP 1 nome_candidato
                FROM (
                    SELECT nome_candidato FROM candidatos_processos WHERE id_teste = ?
                    UNION ALL
                    SELECT nome_candidato FROM banco_talentos WHERE id_teste = ?
                    UNION ALL
                    SELECT nome_candidato FROM historico_provas WHERE id_teste = ?
                ) origem
                """,
                (safe_id_teste, safe_id_teste, safe_id_teste),
            )
            candidate_row = cursor.fetchone()
            if not candidate_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato nao encontrado para atualizar o perfil.")

            safe_name = normalize_text(data.get("nome_candidato")) or normalize_text(candidate_row[0])
            if not safe_name:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o nome do candidato.")

            safe_email = normalize_text(data.get("email"))
            if safe_email and not is_valid_email(safe_email):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um e-mail valido.")

            safe_phone = normalize_text(data.get("telefone"))
            safe_whatsapp = normalize_text(data.get("whatsapp"))
            if safe_phone and not is_valid_phone(safe_phone):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um telefone valido.")
            if safe_whatsapp and not is_valid_phone(safe_whatsapp):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um WhatsApp valido.")

            safe_skills = normalize_string_list(data.get("habilidades", []))
            safe_tags = normalize_string_list(data.get("tags", []))

            self._upsert_candidate_profile(
                cursor,
                id_teste=safe_id_teste,
                nome_candidato=safe_name,
                habilidades=safe_skills or None,
                tags=safe_tags or None,
                observacao_rh=data.get("observacao_rh") if normalize_text(data.get("observacao_rh")) else None,
                email=safe_email or None,
                telefone=safe_phone or None,
                whatsapp=safe_whatsapp or None,
                cidade=data.get("cidade") if normalize_text(data.get("cidade")) else None,
                bairro=data.get("bairro") if normalize_text(data.get("bairro")) else None,
            )
            self._sync_candidate_identity_copies(
                cursor,
                id_teste=safe_id_teste,
                nome_candidato=safe_name,
                email=safe_email or None,
                telefone=safe_phone or None,
                whatsapp=safe_whatsapp or None,
            )
            conn.commit()
            cursor.execute(
                """
                SELECT
                    nome_candidato,
                    habilidades_json,
                    tags_json,
                    observacao_rh,
                    email,
                    telefone,
                    whatsapp,
                    cidade,
                    bairro
                FROM candidatos_metadata
                WHERE id_teste = ?
                """,
                (safe_id_teste,),
            )
            updated = cursor.fetchone()
            self.logger.info("Perfil RH atualizado para o candidato %s.", safe_id_teste)
            return {
                "success": True,
                "candidato": self._serialize_candidate_profile(
                    {
                        "nome_candidato": updated[0] if updated else safe_name,
                        "habilidades_json": updated[1] if updated else "[]",
                        "tags_json": updated[2] if updated else "[]",
                        "observacao_rh": updated[3] if updated else data.get("observacao_rh", ""),
                        "email": updated[4] if updated else safe_email,
                        "telefone": updated[5] if updated else safe_phone,
                        "whatsapp": updated[6] if updated else safe_whatsapp,
                        "cidade": updated[7] if updated else data.get("cidade", ""),
                        "bairro": updated[8] if updated else data.get("bairro", ""),
                    }
                ),
            }
        finally:
            conn.close()
