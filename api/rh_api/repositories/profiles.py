from __future__ import annotations

from fastapi import HTTPException, status

from ..services.helpers import normalize_string_list, normalize_text


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

            self._upsert_candidate_profile(
                cursor,
                id_teste=safe_id_teste,
                nome_candidato=data.get("nome_candidato") or candidate_row[0],
                habilidades=normalize_string_list(data.get("habilidades", [])),
                tags=normalize_string_list(data.get("tags", [])),
                observacao_rh=data.get("observacao_rh", ""),
            )
            conn.commit()
            self.logger.info("Perfil RH atualizado para o candidato %s.", safe_id_teste)
            return {"success": True}
        finally:
            conn.close()
