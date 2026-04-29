from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, status

from ..services.cv import is_valid_email, is_valid_phone
from ..services.helpers import normalize_text, rows_to_dicts
from ..services.process_flow import CANDIDATE_STATUS_ANALYSIS, is_process_closed
from ..services.public_candidacy import (
    PUBLIC_APPLICATION_CLOSED_MESSAGE,
    PUBLIC_APPLICATION_DUPLICATE_MESSAGE,
    PUBLIC_APPLICATION_ORIGIN,
    PUBLIC_APPLICATION_SUCCESS_MESSAGE,
    build_public_application_url,
    build_public_process_slug,
    generate_public_token,
    resolve_public_process_description,
    resolve_public_process_requirements,
    resolve_public_process_responsibilities,
    resolve_public_frontend_base_url,
    validate_public_cv_upload,
)
from .bootstrap import (
    build_process_where_clause,
    decorate_process_row,
    ensure_candidate_attachments_table,
    ensure_pipeline_columns,
    ensure_process_columns,
    ensure_process_reference_columns,
    get_next_id_registro,
    get_process_row,
)


class PublicCandidacyRepositoryMixin:
    def _get_public_process_by_slug(self, cursor, slug: str) -> dict | None:
        cursor.execute(
            """
            SELECT
                id_processo,
                vaga,
                quantidade_vagas,
                vagas_preenchidas,
                data_encerramento,
                operacao,
                trilha,
                usa_nota_corte,
                nota_corte,
                status,
                data_criacao,
                link_agendamento,
                link_publico_slug,
                link_publico_token,
                link_publico_ativo,
                link_publico_criado_em,
                link_publico_desativado_em,
                descricao_publica,
                requisitos_publicos,
                responsabilidades_publicas,
                observacoes_publicas_vaga
            FROM processos_seletivos
            WHERE link_publico_slug = ?
            ORDER BY data_criacao DESC
            """,
            (normalize_text(slug),),
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        return decorate_process_row(rows[0]) if rows else None

    @staticmethod
    def _is_public_link_active(processo: dict | None) -> bool:
        safe_process = processo or {}
        return bool(safe_process.get("link_publico_ativo")) and not is_process_closed(safe_process.get("status"))

    def _build_public_process_payload(self, processo: dict) -> dict:
        return {
            "slug": normalize_text(processo.get("link_publico_slug")),
            "vaga": normalize_text(processo.get("vaga")),
            "descricao_publica": resolve_public_process_description(processo),
            "requisitos_publicos": resolve_public_process_requirements(processo),
            "responsabilidades_publicas": resolve_public_process_responsibilities(processo),
            "observacoes_publicas_vaga": normalize_text(processo.get("observacoes_publicas_vaga")),
            "disponivel": self._is_public_link_active(processo),
            "status": "Ativa" if self._is_public_link_active(processo) else "Inativa",
            "mensagem": ""
            if self._is_public_link_active(processo)
            else PUBLIC_APPLICATION_CLOSED_MESSAGE,
        }

    def _generate_unique_public_slug(self, cursor, vaga: str, process_ref: str) -> tuple[str, str]:
        safe_process_ref = normalize_text(process_ref)

        for _ in range(12):
            token = generate_public_token(8)
            slug = build_public_process_slug(vaga, token)
            cursor.execute(
                """
                SELECT id_processo, data_criacao
                FROM processos_seletivos
                WHERE link_publico_slug = ? OR link_publico_token = ?
                """,
                (slug, token),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                return slug, token

            collision = False
            for row in rows:
                current_ref = f"{normalize_text(row.get('id_processo'))}@@{normalize_text(row.get('data_criacao'))}"
                if safe_process_ref and current_ref == safe_process_ref:
                    continue
                collision = True
                break

            if not collision:
                return slug, token

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nao foi possivel gerar um link publico unico para este processo.",
        )

    def _get_storage_root(self) -> Path:
        root = Path(self.settings.public_cv_upload_dir).expanduser()
        root.mkdir(parents=True, exist_ok=True)
        return root.resolve()

    def _delete_stored_file(self, file_path: str) -> None:
        safe_path = normalize_text(file_path)
        if not safe_path:
            return

        try:
            target = Path(safe_path).resolve()
            root = self._get_storage_root()
            if root not in target.parents and target != root:
                return
            if target.exists():
                target.unlink()
        except Exception:
            return

    def _replace_candidate_attachment(
        self,
        cursor,
        *,
        id_teste: str,
        processo: dict,
        upload,
    ) -> None:
        ensure_candidate_attachments_table(cursor)
        process_ref = normalize_text(processo.get("id_processo_ref"))
        process_id = normalize_text(processo.get("id_processo"))

        cursor.execute(
            """
            SELECT caminho_arquivo
            FROM candidatos_anexos
            WHERE id_teste = ? AND id_processo = ? AND id_processo_ref = ?
            """,
            (id_teste, process_id, process_ref),
        )
        old_rows = rows_to_dicts(cursor, cursor.fetchall())

        storage_root = self._get_storage_root()
        stored_path = storage_root / upload.stored_filename
        stored_path.write_bytes(upload.content_bytes)

        cursor.execute(
            """
            DELETE FROM candidatos_anexos
            WHERE id_teste = ? AND id_processo = ? AND id_processo_ref = ?
            """,
            (id_teste, process_id, process_ref),
        )
        cursor.execute(
            """
            INSERT INTO candidatos_anexos
            (
                id_teste,
                id_processo,
                id_processo_ref,
                nome_arquivo_original,
                nome_arquivo_armazenado,
                tipo_arquivo,
                caminho_arquivo,
                tamanho_bytes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                id_teste,
                process_id,
                process_ref,
                upload.original_filename,
                upload.stored_filename,
                upload.mime_type,
                str(stored_path),
                upload.size_bytes,
            ),
        )

        for row in old_rows:
            self._delete_stored_file(row.get("caminho_arquivo"))

    def _find_existing_public_application(self, cursor, *, processo: dict, email: str) -> dict | None:
        ensure_process_reference_columns(cursor)
        cursor.execute(
            """
            SELECT TOP 1
                cp.id_registro,
                cp.id_processo,
                cp.id_processo_ref,
                cp.id_teste,
                cp.nome_candidato,
                cp.vaga,
                cp.status_candidato,
                cp.data_prova,
                cp.origem
            FROM candidatos_processos cp
            INNER JOIN candidatos_metadata meta
                ON meta.id_teste = cp.id_teste
            WHERE cp.id_processo = ?
              AND LOWER(LTRIM(RTRIM(ISNULL(meta.email, '')))) = LOWER(?)
            ORDER BY
                CASE
                    WHEN cp.id_processo_ref = ? THEN 0
                    ELSE 1
                END,
                cp.id_registro DESC
            """,
            (
                normalize_text(processo.get("id_processo")),
                normalize_text(email),
                normalize_text(processo.get("id_processo_ref")),
            ),
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        return rows[0] if rows else None

    def generate_public_application_link(
        self,
        id_processo: str,
        *,
        referrer_url: str = "",
        origin_url: str = "",
    ) -> dict:
        def operation() -> dict:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                ensure_process_columns(cursor)
                ensure_process_reference_columns(cursor)

                processo = get_process_row(cursor, id_processo)
                if not processo:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")
                if is_process_closed(processo.get("status")):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="O processo seletivo esta encerrado e nao permite gerar pagina publica de candidatura.",
                    )

                current_slug = normalize_text(processo.get("link_publico_slug"))
                current_token = normalize_text(processo.get("link_publico_token"))
                if self._is_public_link_active(processo) and current_slug and current_token:
                    slug = current_slug
                    token = current_token
                    created_at = processo.get("link_publico_criado_em") or datetime.now()
                else:
                    slug, token = self._generate_unique_public_slug(
                        cursor,
                        processo.get("vaga", ""),
                        processo.get("id_processo_ref", ""),
                    )
                    created_at = datetime.now()

                where_clause, params = build_process_where_clause(processo)
                cursor.execute(
                    f"""
                    UPDATE processos_seletivos
                    SET
                        link_publico_slug = ?,
                        link_publico_token = ?,
                        link_publico_ativo = ?,
                        link_publico_criado_em = ?,
                        link_publico_desativado_em = NULL
                    WHERE {where_clause}
                    """,
                    (slug, token, 1, created_at, *params),
                )
                conn.commit()

                base_url = resolve_public_frontend_base_url(
                    self.settings.public_frontend_base_url,
                    referrer_url=referrer_url,
                    origin_url=origin_url,
                )
                return {
                    "success": True,
                    "status": "Ativa",
                    "slug": slug,
                    "url": build_public_application_url(base_url, slug),
                }
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            f"gerar link publico do processo {id_processo}",
            operation,
            retries=1,
        )

    def deactivate_public_application_link(self, id_processo: str) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

            where_clause, params = build_process_where_clause(processo)
            cursor.execute(
                f"""
                UPDATE processos_seletivos
                SET
                    link_publico_ativo = 0,
                    link_publico_desativado_em = ?
                WHERE {where_clause}
                """,
                (datetime.now(), *params),
            )
            conn.commit()
            return {"success": True, "status": "Inativa"}
        finally:
            conn.close()

    def get_public_application(self, slug: str) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            processo = self._get_public_process_by_slug(cursor, slug)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga publica nao encontrada.")
            return self._build_public_process_payload(processo)
        finally:
            conn.close()

    async def submit_public_application(
        self,
        slug: str,
        *,
        nome_completo: str,
        email: str,
        telefone: str,
        area_interesse: str = "",
        resumo_profissional: str = "",
        cidade: str,
        bairro: str,
        lgpd_aceito: str,
        curriculo,
    ) -> dict:
        safe_name = normalize_text(nome_completo)
        safe_email = normalize_text(email)
        safe_phone = normalize_text(telefone)
        safe_summary = normalize_text(resumo_profissional)
        safe_city = normalize_text(cidade)
        safe_neighborhood = normalize_text(bairro)
        accepted_lgpd = normalize_text(lgpd_aceito).lower() in {"1", "true", "on", "sim", "yes"}

        if not all([safe_name, safe_email, safe_phone, safe_city, safe_neighborhood]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Preencha todos os campos obrigatorios da candidatura.",
            )
        if not accepted_lgpd:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E obrigatorio aceitar o termo de uso de dados (LGPD).",
            )
        if not is_valid_email(safe_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe um e-mail valido para concluir a candidatura.",
            )
        if not is_valid_phone(safe_phone):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe um telefone ou WhatsApp valido para concluir a candidatura.",
            )
        if curriculo is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Anexe o curriculo antes de enviar a candidatura.",
            )

        upload_bytes = await curriculo.read()
        validated_upload = validate_public_cv_upload(
            curriculo.filename or "curriculo",
            getattr(curriculo, "content_type", ""),
            upload_bytes,
        )

        def operation() -> dict:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                ensure_process_columns(cursor)
                ensure_pipeline_columns(cursor)
                ensure_process_reference_columns(cursor)

                processo = self._get_public_process_by_slug(cursor, slug)
                if not processo:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga publica nao encontrada.")
                if not self._is_public_link_active(processo):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=PUBLIC_APPLICATION_CLOSED_MESSAGE,
                    )

                existing = self._find_existing_public_application(
                    cursor,
                    processo=processo,
                    email=safe_email,
                )

                if existing:
                    # Escolha deliberada: atualizamos os dados e o CV do mesmo registro
                    # quando a candidatura ja existe para evitar duplicidades sem quebrar o fluxo atual.
                    cursor.execute(
                        """
                        UPDATE candidatos_processos
                        SET
                            nome_candidato = ?,
                            vaga = ?,
                            origem = ?,
                            id_processo_ref = ?
                        WHERE id_registro = ?
                        """,
                        (
                            safe_name,
                            normalize_text(processo.get("vaga")),
                            PUBLIC_APPLICATION_ORIGIN,
                            normalize_text(processo.get("id_processo_ref")),
                            int(existing.get("id_registro") or 0),
                        ),
                    )
                    self._upsert_candidate_profile(
                        cursor,
                        id_teste=existing.get("id_teste", ""),
                        nome_candidato=safe_name,
                        email=safe_email,
                        telefone=safe_phone,
                        whatsapp=safe_phone,
                        observacao_rh=safe_summary,
                        cidade=safe_city,
                        bairro=safe_neighborhood,
                    )
                    self._replace_candidate_attachment(
                        cursor,
                        id_teste=existing.get("id_teste", ""),
                        processo=processo,
                        upload=validated_upload,
                    )
                    conn.commit()
                    return {
                        "success": True,
                        "duplicate": True,
                        "message": PUBLIC_APPLICATION_DUPLICATE_MESSAGE,
                        "id_registro": int(existing.get("id_registro") or 0),
                        "id_teste": normalize_text(existing.get("id_teste")),
                    }

                id_teste = datetime.now().strftime("PUB-%Y%m%d-%H%M%S%f")
                id_registro = get_next_id_registro(cursor)
                now_iso = datetime.now().isoformat()
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
                        normalize_text(processo.get("id_processo")),
                        normalize_text(processo.get("id_processo_ref")),
                        id_teste,
                        safe_name,
                        normalize_text(processo.get("vaga")),
                        CANDIDATE_STATUS_ANALYSIS,
                        "",
                        now_iso,
                        PUBLIC_APPLICATION_ORIGIN,
                        "Triagem",
                        datetime.now(),
                    ),
                )
                self._upsert_candidate_profile(
                    cursor,
                    id_teste=id_teste,
                    nome_candidato=safe_name,
                    email=safe_email,
                    telefone=safe_phone,
                    whatsapp=safe_phone,
                    observacao_rh=safe_summary,
                    cidade=safe_city,
                    bairro=safe_neighborhood,
                )
                self._replace_candidate_attachment(
                    cursor,
                    id_teste=id_teste,
                    processo=processo,
                    upload=validated_upload,
                )
                conn.commit()
                return {
                    "success": True,
                    "duplicate": False,
                    "message": PUBLIC_APPLICATION_SUCCESS_MESSAGE,
                    "id_registro": id_registro,
                    "id_teste": id_teste,
                }
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            f"registrar candidatura publica para o slug {slug}",
            operation,
            retries=1,
        )

    def get_candidate_cv_asset(self, id_teste: str) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_candidate_attachments_table(cursor)
            cursor.execute(
                """
                SELECT TOP 1
                    nome_arquivo_original,
                    nome_arquivo_armazenado,
                    tipo_arquivo,
                    caminho_arquivo,
                    tamanho_bytes
                FROM candidatos_anexos
                WHERE id_teste = ?
                ORDER BY criado_em DESC, id_anexo DESC
                """,
                (normalize_text(id_teste),),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curriculo do candidato nao encontrado.")

            row = rows[0]
            file_path = Path(normalize_text(row.get("caminho_arquivo")))
            if not file_path.exists():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="O arquivo do curriculo nao esta mais disponivel no servidor.",
                )

            return {
                "path": str(file_path),
                "filename": normalize_text(row.get("nome_arquivo_original"))
                or normalize_text(row.get("nome_arquivo_armazenado"))
                or "curriculo",
                "media_type": normalize_text(row.get("tipo_arquivo")) or "application/octet-stream",
                "size_bytes": row.get("tamanho_bytes"),
            }
        finally:
            conn.close()
