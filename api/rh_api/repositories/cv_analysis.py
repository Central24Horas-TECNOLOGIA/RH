from __future__ import annotations

import base64
import json
import math
from datetime import datetime

from fastapi import HTTPException, UploadFile, status

from ..services.cv import (
    extract_candidate_name,
    extract_education_strength,
    extract_email,
    extract_experience_strength,
    extract_keywords,
    extract_phone,
    extract_text_from_uploaded_file,
    extract_whatsapp,
    normalize_cv_text,
    score_cv_for_role,
    serialize_cv_problems,
)
from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from .bootstrap import ensure_cv_pre_analises_table, ensure_pipeline_columns, get_next_id_registro, get_process_row


class CvAnalysisRepositoryMixin:
    def list_cv_pre_analyses(self, id_processo: str, page: int = 1, page_size: int = 5) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM cv_pre_analises WHERE id_processo = ?", (id_processo,))
            total_items = int(cursor.fetchone()[0] or 0)
            page_safe = max(1, int(page or 1))
            page_size_safe = max(1, min(int(page_size or 5), 50))
            offset = (page_safe - 1) * page_size_safe

            cursor.execute(
                """
                SELECT
                    id_pre_analise,
                    id_processo,
                    nome_candidato,
                    email,
                    telefone,
                    whatsapp,
                    palavras_chave,
                    score_final,
                    classificacao,
                    classificacao_slug,
                    problemas,
                    texto_extraido,
                    nome_arquivo,
                    mime_type,
                    arquivo_original_base64,
                    ja_adicionado_ao_processo,
                    criado_em
                FROM cv_pre_analises
                WHERE id_processo = ?
                ORDER BY id_pre_analise DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """,
                (id_processo, offset, page_size_safe),
            )
            items = rows_to_dicts(cursor, cursor.fetchall())
            total_pages = max(1, math.ceil(total_items / page_size_safe))
            return {
                "items": items,
                "page": page_safe,
                "page_size": page_size_safe,
                "total_items": total_items,
                "total_pages": total_pages,
            }
        finally:
            conn.close()

    async def create_cv_pre_analysis(
        self,
        id_processo: str,
        arquivo: UploadFile,
        guardar_cv_original: str = "0",
    ) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_cv_pre_analises_table(cursor)
            ensure_pipeline_columns(cursor)

            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

            content = await arquivo.read()
            texto_extraido = extract_text_from_uploaded_file(arquivo.filename, content)
            texto_normalizado = normalize_cv_text(texto_extraido)
            if not texto_normalizado:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nao foi possivel extrair texto do CV. Para PDF, verifique se o arquivo possui texto selecionavel. Para DOCX, confirme se a biblioteca python-docx esta instalada.",
                )

            nome_candidato = extract_candidate_name(texto_normalizado)
            email = extract_email(texto_normalizado)
            telefone = extract_phone(texto_normalizado)
            whatsapp = extract_whatsapp(texto_normalizado)
            palavras = extract_keywords(texto_normalizado)
            telefone_base = whatsapp or telefone

            if email:
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM cv_pre_analises
                    WHERE id_processo = ? AND email = ?
                    """,
                    (id_processo, email),
                )
                ja_existe = int(cursor.fetchone()[0] or 0)
                if ja_existe:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ja existe uma pre-analise com este e-mail neste processo.")

            education_strength = extract_education_strength(texto_normalizado)
            experience_strength = extract_experience_strength(texto_normalizado)
            avaliacao = score_cv_for_role(
                processo.get("vaga"),
                palavras,
                bool(email),
                bool(telefone_base),
                len(texto_normalizado),
                nome_candidato,
                email,
                telefone_base,
                education_strength,
                experience_strength,
            )

            arquivo_original_base64 = None
            if normalize_compare_text(guardar_cv_original) in {"1", "true"}:
                arquivo_original_base64 = base64.b64encode(content).decode("utf-8")

            cursor.execute(
                """
                INSERT INTO cv_pre_analises
                (
                    id_processo,
                    nome_candidato,
                    email,
                    telefone,
                    whatsapp,
                    palavras_chave,
                    score_final,
                    classificacao,
                    classificacao_slug,
                    problemas,
                    texto_extraido,
                    nome_arquivo,
                    mime_type,
                    arquivo_original_base64,
                    ja_adicionado_ao_processo
                )
                OUTPUT INSERTED.id_pre_analise
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """,
                (
                    id_processo,
                    nome_candidato,
                    email,
                    telefone,
                    whatsapp,
                    json.dumps(avaliacao["keywords_validas"], ensure_ascii=False),
                    avaliacao["score"],
                    avaliacao["classificacao"],
                    avaliacao["slug"],
                    serialize_cv_problems(avaliacao),
                    texto_normalizado,
                    arquivo.filename,
                    arquivo.content_type or "application/octet-stream",
                    arquivo_original_base64,
                ),
            )
            id_pre_analise = int(cursor.fetchone()[0])

            if avaliacao["classificacao"] in ("Bom candidato", "Otimo candidato"):
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
                        f"CV-{id_pre_analise}",
                        nome_candidato,
                        processo.get("vaga") or "",
                        "Em analise",
                        str(avaliacao["score"]).replace(".", ","),
                        datetime.now().isoformat(),
                        "Pre-analise de CV",
                        "Triagem",
                        datetime.now(),
                    ),
                )
                cursor.execute(
                    """
                    UPDATE cv_pre_analises
                    SET ja_adicionado_ao_processo = 1
                    WHERE id_pre_analise = ?
                    """,
                    (id_pre_analise,),
                )
                self._upsert_candidate_profile(
                    cursor,
                    id_teste=f"CV-{id_pre_analise}",
                    nome_candidato=nome_candidato,
                )

            conn.commit()
            return {"success": True, "id_pre_analise": id_pre_analise}
        finally:
            conn.close()

    def update_cv_pre_analysis(self, id_pre_analise: int, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_cv_pre_analises_table(cursor)
            cursor.execute(
                """
                SELECT id_processo, email
                FROM cv_pre_analises
                WHERE id_pre_analise = ?
                """,
                (id_pre_analise,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pre-analise nao encontrada.")

            id_processo = normalize_text(row[0])
            novo_email = normalize_text(data.get("email"))
            if novo_email:
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM cv_pre_analises
                    WHERE id_processo = ? AND email = ? AND id_pre_analise <> ?
                    """,
                    (id_processo, novo_email, id_pre_analise),
                )
                duplicado = int(cursor.fetchone()[0] or 0)
                if duplicado:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ja existe outra pre-analise com este e-mail neste processo.")

            cursor.execute(
                """
                UPDATE cv_pre_analises
                SET nome_candidato = ?, email = ?, telefone = ?, whatsapp = ?
                WHERE id_pre_analise = ?
                """,
                (
                    data.get("nome_candidato", ""),
                    novo_email,
                    data.get("telefone", ""),
                    data.get("whatsapp", ""),
                    id_pre_analise,
                ),
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def delete_cv_pre_analysis(self, id_pre_analise: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_cv_pre_analises_table(cursor)
            cursor.execute("DELETE FROM cv_pre_analises WHERE id_pre_analise = ?", (id_pre_analise,))
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def add_cv_pre_analysis_to_process(self, id_pre_analise: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_cv_pre_analises_table(cursor)
            ensure_pipeline_columns(cursor)

            cursor.execute(
                """
                SELECT
                    id_pre_analise,
                    id_processo,
                    nome_candidato,
                    email,
                    score_final,
                    classificacao,
                    ja_adicionado_ao_processo
                FROM cv_pre_analises
                WHERE id_pre_analise = ?
                """,
                (id_pre_analise,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pre-analise nao encontrada.")
            if int(row[6] or 0) == 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este CV ja foi adicionado ao processo.")

            processo = get_process_row(cursor, row[1])
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

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
                    row[1],
                    f"CV-{row[0]}",
                    row[2],
                    processo.get("vaga") or "",
                    "Em analise",
                    str(row[4] or "").replace(".", ","),
                    datetime.now().isoformat(),
                    "Pre-analise de CV",
                    "Triagem",
                    datetime.now(),
                ),
            )
            cursor.execute(
                """
                UPDATE cv_pre_analises
                SET ja_adicionado_ao_processo = 1
                WHERE id_pre_analise = ?
                """,
                (id_pre_analise,),
            )
            self._upsert_candidate_profile(
                cursor,
                id_teste=f"CV-{row[0]}",
                nome_candidato=row[2],
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()
