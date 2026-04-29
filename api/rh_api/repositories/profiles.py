from __future__ import annotations

from fastapi import HTTPException, status

from ..services.helpers import normalize_string_list, normalize_text
from ..services.cv import is_valid_email, is_valid_phone


class CandidateProfileRepositoryMixin:
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

            self._upsert_candidate_profile(
                cursor,
                id_teste=safe_id_teste,
                nome_candidato=safe_name,
                habilidades=normalize_string_list(data.get("habilidades", [])),
                tags=normalize_string_list(data.get("tags", [])),
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
