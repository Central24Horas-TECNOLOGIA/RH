from __future__ import annotations

import base64
import json
import logging
import math
from datetime import datetime

from fastapi import HTTPException, UploadFile, status

from ..services.cv import (
    CvTextExtractionError,
    extract_candidate_name,
    extract_education_strength,
    extract_email,
    extract_experience_strength,
    extract_keywords,
    extract_phone,
    extract_text_from_uploaded_file,
    extract_whatsapp,
    is_valid_email,
    is_valid_phone,
    normalize_cv_text,
    score_cv_for_role,
    serialize_cv_problems,
)
from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from ..services.process_flow import map_cv_classification_to_status
from .bootstrap import (
    ensure_cv_pre_analises_table,
    ensure_pipeline_columns,
    ensure_process_reference_columns,
    get_next_id_registro,
    get_process_row,
    resolve_process_row_for_related_record,
)

logger = logging.getLogger(__name__)


class CvAnalysisRepositoryMixin:
    def list_cv_pre_analyses(self, id_processo: str, page: int = 1, page_size: int = 5) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_cv_pre_analises_table(cursor)
            ensure_process_reference_columns(cursor)
            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")
            page_safe = max(1, int(page or 1))
            page_size_safe = max(1, min(int(page_size or 5), 50))

            cursor.execute(
                """
                SELECT
                    id_pre_analise,
                    id_processo,
                    id_processo_ref,
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
                """,
                (processo.get("id_processo"),),
            )
            items = rows_to_dicts(cursor, cursor.fetchall())
            items = self._attach_process_context(cursor, items, timestamp_fields=["criado_em"])
            items = [
                item
                for item in items
                if normalize_text(item.get("id_processo_ref"))
                == normalize_text(processo.get("id_processo_ref"))
            ]
            items.sort(key=lambda item: int(item.get("id_pre_analise") or 0), reverse=True)
            total_items = len(items)
            offset = (page_safe - 1) * page_size_safe
            items = items[offset : offset + page_size_safe]
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
            ensure_process_reference_columns(cursor)

            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

            content = await arquivo.read()
            try:
                texto_extraido = extract_text_from_uploaded_file(
                    arquivo.filename,
                    content,
                    arquivo.content_type or "",
                )
            except CvTextExtractionError as exc:
                logger.warning(
                    "Falha ao extrair texto do CV: arquivo=%s mime=%s detalhe=%s",
                    arquivo.filename,
                    arquivo.content_type or "",
                    exc.technical_message,
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=exc.user_message,
                ) from exc
            texto_normalizado = normalize_cv_text(texto_extraido)
            if not texto_normalizado:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Arquivo vazio ou corrompido.",
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
                    SELECT id_processo_ref
                    FROM cv_pre_analises
                    WHERE id_processo = ? AND email = ?
                    """,
                    (processo.get("id_processo"), email),
                )
                rows = rows_to_dicts(cursor, cursor.fetchall())
                ja_existe = any(
                    normalize_text(item.get("id_processo_ref")) == normalize_text(processo.get("id_processo_ref"))
                    for item in rows
                )
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
                    id_processo_ref,
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """,
                (
                    processo.get("id_processo"),
                    processo.get("id_processo_ref", ""),
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

            if avaliacao["classificacao"] == "Qualificado":
                status_candidato = map_cv_classification_to_status(avaliacao["classificacao"])
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
                        f"CV-{id_pre_analise}",
                        nome_candidato,
                        processo.get("vaga") or "",
                        status_candidato,
                        str(avaliacao["score"]).replace(".", ","),
                        datetime.now().isoformat(),
                        "Pre-analise de CV",
                        "Prova",
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
            ensure_process_reference_columns(cursor)
            cursor.execute(
                """
                SELECT id_processo, id_processo_ref, nome_candidato, email, telefone, whatsapp, criado_em
                FROM cv_pre_analises
                WHERE id_pre_analise = ?
                """,
                (id_pre_analise,),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pre-analise nao encontrada.")
            row = rows[0]

            processo = resolve_process_row_for_related_record(
                cursor,
                id_processo=row.get("id_processo"),
                id_processo_ref=row.get("id_processo_ref", ""),
                timestamp_values=[row.get("criado_em")],
            )
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado para a pre-analise.")
            novo_nome = normalize_text(data.get("nome_candidato"))
            if not novo_nome:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o nome do candidato.")

            novo_email = normalize_text(data.get("email")) or normalize_text(row.get("email"))
            if novo_email and not is_valid_email(novo_email):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um e-mail valido.")

            novo_telefone = normalize_text(data.get("telefone")) or normalize_text(row.get("telefone"))
            novo_whatsapp = normalize_text(data.get("whatsapp")) or normalize_text(row.get("whatsapp"))
            if novo_telefone and not is_valid_phone(novo_telefone):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um telefone valido.")
            if novo_whatsapp and not is_valid_phone(novo_whatsapp):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um WhatsApp valido.")

            if novo_email:
                cursor.execute(
                    """
                    SELECT id_processo_ref
                    FROM cv_pre_analises
                    WHERE id_processo = ? AND email = ? AND id_pre_analise <> ?
                    """,
                    (processo.get("id_processo"), novo_email, id_pre_analise),
                )
                existing_rows = rows_to_dicts(cursor, cursor.fetchall())
                duplicado = any(
                    normalize_text(item.get("id_processo_ref")) == normalize_text(processo.get("id_processo_ref"))
                    for item in existing_rows
                )
                if duplicado:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ja existe outra pre-analise com este e-mail neste processo.")

            cursor.execute(
                """
                UPDATE cv_pre_analises
                SET nome_candidato = ?, email = ?, telefone = ?, whatsapp = ?
                WHERE id_pre_analise = ?
                """,
                (
                    novo_nome,
                    novo_email,
                    novo_telefone,
                    novo_whatsapp,
                    id_pre_analise,
                ),
            )
            id_teste = f"CV-{id_pre_analise}"
            self._upsert_candidate_profile(
                cursor,
                id_teste=id_teste,
                nome_candidato=novo_nome,
                email=novo_email,
                telefone=novo_telefone,
                whatsapp=novo_whatsapp,
            )
            self._sync_candidate_identity_copies(
                cursor,
                id_teste=id_teste,
                nome_candidato=novo_nome,
                email=novo_email,
                telefone=novo_telefone,
                whatsapp=novo_whatsapp,
            )
            conn.commit()
            return {
                "success": True,
                "candidato": {
                    "id_teste": id_teste,
                    "nome_candidato": novo_nome,
                    "email": novo_email,
                    "telefone": novo_telefone,
                    "whatsapp": novo_whatsapp,
                },
            }
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
            ensure_process_reference_columns(cursor)

            cursor.execute(
                """
                SELECT
                    id_pre_analise,
                    id_processo,
                    id_processo_ref,
                    nome_candidato,
                    email,
                    score_final,
                    classificacao,
                    ja_adicionado_ao_processo,
                    criado_em
                FROM cv_pre_analises
                WHERE id_pre_analise = ?
                """,
                (id_pre_analise,),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pre-analise nao encontrada.")
            row = rows[0]
            if int(row.get("ja_adicionado_ao_processo") or 0) == 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este CV ja foi adicionado ao processo.")

            processo = resolve_process_row_for_related_record(
                cursor,
                id_processo=row.get("id_processo"),
                id_processo_ref=row.get("id_processo_ref", ""),
                timestamp_values=[row.get("criado_em")],
            )
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

            status_candidato = map_cv_classification_to_status(row.get("classificacao"))
            if status_candidato != "Qualificado":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Somente candidatos qualificados podem seguir da pre-analise para o processo seletivo.",
                )
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
                    f"CV-{row.get('id_pre_analise')}",
                    row.get("nome_candidato"),
                    processo.get("vaga") or "",
                    status_candidato,
                    str(row.get("score_final") or "").replace(".", ","),
                    datetime.now().isoformat(),
                    "Pre-analise de CV",
                    "Prova" if status_candidato == "Qualificado" else "Triagem",
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
                id_teste=f"CV-{row.get('id_pre_analise')}",
                nome_candidato=row.get("nome_candidato"),
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()
