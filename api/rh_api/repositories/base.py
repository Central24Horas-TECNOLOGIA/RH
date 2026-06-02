from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime

import pyodbc
from fastapi import HTTPException, status

from ..config import Settings
from ..db import get_connection
from ..services.helpers import (
    normalize_compare_text,
    normalize_string_list,
    normalize_text,
    rows_to_dicts,
    safe_json_loads,
)
from ..services.pipeline import infer_pipeline_stage
from ..services.process_flow import (
    CANDIDATE_STATUS_APPROVED,
    CANDIDATE_STATUS_ELIMINATED,
    CANDIDATE_STATUS_TALENT_BANK,
    CANDIDATE_STATUS_WITHDREW,
    INTERVIEW_OPERATIONAL_STATUSES,
    build_approved_candidate_locked_message,
    build_candidate_status_action_label,
    build_process_closed_message,
    build_terminal_candidate_locked_message,
    canonicalize_candidate_status,
    get_candidate_visible_status,
    is_process_closed,
    is_terminal_candidate_status,
)
from .bootstrap import (
    build_process_where_clause,
    describe_database_error,
    ensure_candidate_metadata_table,
    ensure_candidate_metadata_columns,
    ensure_candidate_attachments_table,
    ensure_candidate_movements_table,
    ensure_process_reference_columns,
    get_gabaritos_payload_column,
    is_deadlock_error,
    resolve_process_row_for_related_record,
    sort_process_rows,
)


class BaseRepository:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.logger = logging.getLogger(self.__class__.__name__)

    def _connect(self):
        return get_connection(self.settings)

    def _run_with_deadlock_retry(
        self,
        action: str,
        operation,
        *,
        retries: int = 1,
        base_delay_seconds: float = 0.2,
        final_message: str | None = None,
    ):
        total_attempts = max(1, retries + 1)

        for attempt in range(1, total_attempts + 1):
            try:
                return operation()
            except pyodbc.Error as exc:
                if not is_deadlock_error(exc):
                    raise

                if attempt >= total_attempts:
                    self.logger.error(
                        "Deadlock persistente ao %s apos %s tentativa(s): %s",
                        action,
                        attempt,
                        describe_database_error(exc),
                    )
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail=final_message
                        or "O banco de dados ficou temporariamente indisponivel por conflito de concorrencia. Tente novamente em instantes.",
                    ) from exc

                wait_seconds = base_delay_seconds * attempt
                self.logger.warning(
                    "Deadlock ao %s. Tentativa %s/%s em %.2fs. Detalhes: %s",
                    action,
                    attempt,
                    total_attempts,
                    wait_seconds,
                    describe_database_error(exc),
                )
                time.sleep(wait_seconds)

    def _serialize_candidate_profile(self, row: dict | None = None) -> dict:
        safe_row = row or {}
        return {
            "nome_candidato": normalize_text(safe_row.get("nome_candidato")),
            "habilidades": normalize_string_list(safe_json_loads(safe_row.get("habilidades_json"), [])),
            "tags": normalize_string_list(safe_json_loads(safe_row.get("tags_json"), [])),
            "observacao_rh": normalize_text(safe_row.get("observacao_rh")),
            "classificacao_indicacao": normalize_text(safe_row.get("classificacao_indicacao")),
            "justificativa_indicacao": normalize_text(safe_row.get("justificativa_indicacao")),
            "email": normalize_text(safe_row.get("email")),
            "telefone": normalize_text(safe_row.get("telefone")),
            "whatsapp": normalize_text(safe_row.get("whatsapp")),
            "cidade": normalize_text(safe_row.get("cidade")),
            "bairro": normalize_text(safe_row.get("bairro")),
        }

    def _get_candidate_profile_map(self, cursor) -> dict[str, dict]:
        ensure_candidate_metadata_table(cursor)
        ensure_candidate_metadata_columns(cursor)
        cursor.execute(
            """
            SELECT
                id_teste,
                nome_candidato,
                habilidades_json,
                tags_json,
                observacao_rh,
                classificacao_indicacao,
                justificativa_indicacao,
                email,
                telefone,
                whatsapp,
                cidade,
                bairro
            FROM candidatos_metadata
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        result = {}
        for row in rows:
            id_teste = normalize_text(row.get("id_teste"))
            if not id_teste:
                continue
            result[id_teste] = self._serialize_candidate_profile(row)
        return result

    def _get_candidate_cv_map(self, cursor) -> dict[str, dict]:
        ensure_candidate_attachments_table(cursor)
        cursor.execute(
            """
            WITH anexos_ordenados AS (
                SELECT
                    id_teste,
                    nome_arquivo_original,
                    nome_arquivo_armazenado,
                    tipo_arquivo,
                    caminho_arquivo,
                    tamanho_bytes,
                    criado_em,
                    ROW_NUMBER() OVER (
                        PARTITION BY id_teste
                        ORDER BY criado_em DESC, id_anexo DESC
                    ) AS ordem
                FROM candidatos_anexos
            )
            SELECT
                id_teste,
                nome_arquivo_original,
                nome_arquivo_armazenado,
                tipo_arquivo,
                caminho_arquivo,
                tamanho_bytes,
                criado_em
            FROM anexos_ordenados
            WHERE ordem = 1
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        return {
            normalize_text(item.get("id_teste")): item
            for item in rows
            if normalize_text(item.get("id_teste"))
        }

    def _get_pre_analysis_cv_map(self, cursor) -> dict[str, dict]:
        cursor.execute(
            """
            SELECT
                id_pre_analise,
                nome_arquivo,
                mime_type,
                arquivo_original_base64
            FROM cv_pre_analises
            WHERE ISNULL(arquivo_original_base64, '') <> ''
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        result = {}
        for item in rows:
            id_pre_analise = item.get("id_pre_analise")
            if id_pre_analise is None:
                continue
            result[f"CV-{id_pre_analise}"] = {
                "nome_arquivo_original": normalize_text(item.get("nome_arquivo")),
                "tipo_arquivo": normalize_text(item.get("mime_type")) or "application/octet-stream",
                "caminho_arquivo": "__cv_pre_analise_base64__",
                "arquivo_original_base64": normalize_text(item.get("arquivo_original_base64")),
            }
        return result

    def _get_history_result_map(self, cursor) -> dict[str, list[dict]]:
        cursor.execute(
            """
            SELECT
                id_teste,
                id_processo,
                id_processo_ref,
                pontuacao_final,
                data_iso,
                status,
                etapas_json
            FROM historico_provas
            WHERE ISNULL(id_teste, '') <> ''
            ORDER BY data_iso DESC
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        result: dict[str, list[dict]] = {}
        for row in rows:
            id_teste = normalize_text(row.get("id_teste"))
            if not id_teste:
                continue
            result.setdefault(id_teste, []).append(row)
        return result

    def _select_history_result_for_candidate(self, candidate: dict, history_rows: list[dict]) -> dict:
        if not history_rows:
            return {}

        candidate_ref = normalize_text(candidate.get("id_processo_ref"))
        candidate_process = normalize_text(candidate.get("id_processo"))

        for row in history_rows:
            row_ref = normalize_text(row.get("id_processo_ref"))
            row_process = normalize_text(row.get("id_processo"))
            if candidate_ref and row_ref and row_ref == candidate_ref:
                return row
            if candidate_ref and row_process and candidate_ref.split("@@", 1)[0] == row_process:
                return row
            if candidate_process and row_process and row_process == candidate_process:
                return row

        return history_rows[0]

    def _format_candidate_origin(self, candidate: dict | None) -> str:
        raw_origin = normalize_text((candidate or {}).get("origem"))
        origin = normalize_compare_text(raw_origin)
        if not origin:
            return "Processo Unico"
        if "pagina" in origin and ("candidatura" in origin or "inscricao" in origin):
            return "Pagina de inscricao"
        if "pre analise" in origin or "pre-analise" in origin or "analise direta" in origin:
            return "Analise direta do CV"
        if "banco" in origin and "talento" in origin:
            return "Banco de Talentos"
        if "processo unico" in origin or "processo_unico" in origin or "avulso" in origin:
            return "Processo Unico"
        if "recebimento" in origin and "email" in origin:
            return "Recebimento de e-mail"
        if origin == "prova":
            return "Processo Unico"
        return raw_origin

    def _get_cv_contact_map(self, cursor) -> dict[str, dict]:
        cursor.execute(
            """
            SELECT id_pre_analise, nome_candidato, email, telefone, whatsapp
            FROM cv_pre_analises
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        result = {}
        for row in rows:
            id_pre_analise = row.get("id_pre_analise")
            if id_pre_analise is None:
                continue
            result[f"CV-{id_pre_analise}"] = {
                "email": normalize_text(row.get("email")),
                "telefone": normalize_text(row.get("telefone")),
                "whatsapp": normalize_text(row.get("whatsapp")),
                "nome_candidato": normalize_text(row.get("nome_candidato")),
            }
        return result

    def _get_latest_interview_map(self, cursor) -> dict[str, dict]:
        ensure_process_reference_columns(cursor)
        cursor.execute(
            """
            WITH entrevistas_ordenadas AS (
                SELECT
                    id_teste,
                    id_registro,
                    id_entrevista,
                    id_processo,
                    id_processo_ref,
                    data_entrevista,
                    status_entrevista,
                    link_agendamento,
                    observacoes_rh,
                    mensagem_base,
                    ROW_NUMBER() OVER (
                        PARTITION BY id_teste
                        ORDER BY data_entrevista DESC, id_entrevista DESC
                    ) AS ordem
                FROM entrevistas_agendadas
                WHERE ISNULL(id_teste, '') <> ''
            )
            SELECT
                id_teste,
                id_registro,
                id_entrevista,
                id_processo,
                id_processo_ref,
                data_entrevista,
                status_entrevista,
                link_agendamento,
                observacoes_rh,
                mensagem_base
            FROM entrevistas_ordenadas
            WHERE ordem = 1
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        return {
            normalize_text(item.get("id_teste")): item
            for item in rows
            if normalize_text(item.get("id_teste"))
        }

    def _attach_process_context(self, cursor, rows: list[dict], *, timestamp_fields: list[str]) -> list[dict]:
        for item in rows:
            process_row = resolve_process_row_for_related_record(
                cursor,
                id_processo=item.get("id_processo"),
                id_processo_ref=item.get("id_processo_ref", ""),
                timestamp_values=[item.get(field_name) for field_name in timestamp_fields],
            )

            if process_row:
                item["id_processo_ref"] = normalize_text(item.get("id_processo_ref")) or normalize_text(
                    process_row.get("id_processo_ref"),
                )
                item["status_processo"] = normalize_text(process_row.get("status"))
                item["link_agendamento_processo"] = normalize_text(process_row.get("link_agendamento"))
            else:
                item["id_processo_ref"] = normalize_text(item.get("id_processo_ref"))
                item["status_processo"] = normalize_text(item.get("status_processo"))
                item["link_agendamento_processo"] = normalize_text(item.get("link_agendamento_processo"))

        return rows

    def _enrich_candidate_records(self, cursor, candidates: list[dict]) -> list[dict]:
        profile_map = self._get_candidate_profile_map(cursor)
        interview_map = self._get_latest_interview_map(cursor)
        cv_contact_map = self._get_cv_contact_map(cursor)
        cv_map = self._get_candidate_cv_map(cursor)
        pre_analysis_cv_map = self._get_pre_analysis_cv_map(cursor)
        history_result_map = self._get_history_result_map(cursor)

        for candidate in candidates:
            id_teste = normalize_text(candidate.get("id_teste"))
            profile = profile_map.get(id_teste, {})
            latest_interview = interview_map.get(id_teste, {})
            contato_cv = cv_contact_map.get(id_teste, {})
            cv_attachment = cv_map.get(id_teste, {}) or pre_analysis_cv_map.get(id_teste, {})
            history_result = self._select_history_result_for_candidate(
                candidate,
                history_result_map.get(id_teste, []),
            )
            raw_candidate_status = normalize_text(candidate.get("status_candidato"))
            raw_interview_status = normalize_text(latest_interview.get("status_entrevista"))
            candidate_status = canonicalize_candidate_status(raw_candidate_status)
            interview_status = (
                canonicalize_candidate_status(raw_interview_status)
                if raw_interview_status
                else ""
            )

            candidate["tags"] = profile.get("tags", [])
            candidate["habilidades"] = profile.get("habilidades", [])
            candidate["observacao_rh"] = profile.get("observacao_rh", "")
            candidate["classificacao_indicacao"] = profile.get("classificacao_indicacao", "")
            candidate["justificativa_indicacao"] = profile.get("justificativa_indicacao", "")
            candidate["nome_candidato"] = (
                profile.get("nome_candidato", "")
                or normalize_text(candidate.get("nome_candidato"))
                or contato_cv.get("nome_candidato", "")
            )
            candidate["status_candidato"] = candidate_status
            candidate["status_entrevista"] = interview_status
            candidate["status_fluxo"] = get_candidate_visible_status(candidate_status, interview_status)
            candidate["data_entrevista"] = latest_interview.get("data_entrevista")
            candidate["link_entrevista"] = normalize_text(latest_interview.get("link_agendamento"))
            candidate["observacoes_entrevista"] = normalize_text(latest_interview.get("observacoes_rh"))
            candidate["mensagem_entrevista"] = normalize_text(latest_interview.get("mensagem_base"))
            candidate["id_entrevista"] = latest_interview.get("id_entrevista")
            candidate["email"] = (
                profile.get("email", "")
                or normalize_text(candidate.get("email"))
                or contato_cv.get("email", "")
            )
            candidate["telefone"] = (
                profile.get("telefone", "")
                or normalize_text(candidate.get("telefone"))
                or contato_cv.get("telefone", "")
            )
            candidate["whatsapp"] = (
                profile.get("whatsapp", "")
                or normalize_text(candidate.get("whatsapp"))
                or contato_cv.get("whatsapp", "")
            )
            candidate["cidade"] = profile.get("cidade", "") or normalize_text(candidate.get("cidade"))
            candidate["bairro"] = profile.get("bairro", "") or normalize_text(candidate.get("bairro"))
            candidate["cv_disponivel"] = bool(normalize_text(cv_attachment.get("caminho_arquivo")))
            candidate["cv_nome_arquivo"] = normalize_text(cv_attachment.get("nome_arquivo_original"))
            candidate["cv_tipo_arquivo"] = normalize_text(cv_attachment.get("tipo_arquivo"))
            candidate["cv_tamanho_bytes"] = cv_attachment.get("tamanho_bytes")
            history_score = normalize_text(history_result.get("pontuacao_final"))
            if history_score and not normalize_text(candidate.get("pontuacao_final")):
                candidate["pontuacao_final"] = history_score

            origin_normalized = normalize_compare_text(candidate.get("origem"))
            has_history_score = bool(history_score)
            has_process_score = bool(normalize_text(candidate.get("pontuacao_final")))
            id_is_cv = id_teste.upper().startswith("CV-")
            has_real_proof = has_history_score or (
                has_process_score
                and not id_is_cv
                and "pre analise" not in origin_normalized
                and "pre-analise" not in origin_normalized
            )
            candidate["nota_prova"] = history_score or normalize_text(candidate.get("pontuacao_final"))
            candidate["prova_disponivel"] = bool(has_real_proof)
            candidate["id_teste_prova"] = id_teste if has_real_proof else ""
            candidate["data_prova_realizada"] = history_result.get("data_iso") or candidate.get("data_prova")
            candidate["status_prova"] = normalize_text(history_result.get("status"))
            candidate["etapas_prova_json"] = normalize_text(history_result.get("etapas_json"))
            candidate["origem_rotulo"] = self._format_candidate_origin(candidate)

        return candidates

    def _upsert_candidate_profile(
        self,
        cursor,
        *,
        id_teste: str,
        nome_candidato: str = "",
        habilidades: list[str] | None = None,
        tags: list[str] | None = None,
        observacao_rh: str | None = None,
        classificacao_indicacao: str | None = None,
        justificativa_indicacao: str | None = None,
        email: str | None = None,
        telefone: str | None = None,
        whatsapp: str | None = None,
        cidade: str | None = None,
        bairro: str | None = None,
    ) -> None:
        safe_id_teste = normalize_text(id_teste)
        if not safe_id_teste:
            return

        ensure_candidate_metadata_table(cursor)
        ensure_candidate_metadata_columns(cursor)
        cursor.execute(
            """
            SELECT
                nome_candidato,
                habilidades_json,
                tags_json,
                observacao_rh,
                classificacao_indicacao,
                justificativa_indicacao,
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
        existing = cursor.fetchone()

        existing_profile = (
            self._serialize_candidate_profile(
                {
                    "nome_candidato": existing[0],
                    "habilidades_json": existing[1],
                    "tags_json": existing[2],
                    "observacao_rh": existing[3],
                    "classificacao_indicacao": existing[4],
                    "justificativa_indicacao": existing[5],
                    "email": existing[6],
                    "telefone": existing[7],
                    "whatsapp": existing[8],
                    "cidade": existing[9],
                    "bairro": existing[10],
                }
            )
            if existing
            else {
                "nome_candidato": "",
                "habilidades": [],
                "tags": [],
                "observacao_rh": "",
                "classificacao_indicacao": "",
                "justificativa_indicacao": "",
                "email": "",
                "telefone": "",
                "whatsapp": "",
                "cidade": "",
                "bairro": "",
            }
        )

        merged_name = normalize_text(nome_candidato) or existing_profile.get("nome_candidato", "")
        merged_skills = normalize_string_list(habilidades if habilidades is not None else existing_profile.get("habilidades", []))
        merged_tags = normalize_string_list(tags if tags is not None else existing_profile.get("tags", []))
        merged_observation = (
            normalize_text(observacao_rh)
            if observacao_rh is not None
            else existing_profile.get("observacao_rh", "")
        )
        merged_recommendation = (
            normalize_text(classificacao_indicacao)
            if classificacao_indicacao is not None
            else existing_profile.get("classificacao_indicacao", "")
        )
        merged_justification = (
            normalize_text(justificativa_indicacao)
            if justificativa_indicacao is not None
            else existing_profile.get("justificativa_indicacao", "")
        )
        merged_email = normalize_text(email) if email is not None else existing_profile.get("email", "")
        merged_phone = normalize_text(telefone) if telefone is not None else existing_profile.get("telefone", "")
        merged_whatsapp = normalize_text(whatsapp) if whatsapp is not None else existing_profile.get("whatsapp", "")
        merged_city = normalize_text(cidade) if cidade is not None else existing_profile.get("cidade", "")
        merged_neighborhood = normalize_text(bairro) if bairro is not None else existing_profile.get("bairro", "")

        if existing:
            cursor.execute(
                """
                UPDATE candidatos_metadata
                SET
                    nome_candidato = ?,
                    habilidades_json = ?,
                    tags_json = ?,
                    observacao_rh = ?,
                    classificacao_indicacao = ?,
                    justificativa_indicacao = ?,
                    email = ?,
                    telefone = ?,
                    whatsapp = ?,
                    cidade = ?,
                    bairro = ?,
                    atualizado_em = GETDATE()
                WHERE id_teste = ?
                """,
                (
                    merged_name,
                    json.dumps(merged_skills, ensure_ascii=False),
                    json.dumps(merged_tags, ensure_ascii=False),
                    merged_observation,
                    merged_recommendation,
                    merged_justification,
                    merged_email,
                    merged_phone,
                    merged_whatsapp,
                    merged_city,
                    merged_neighborhood,
                    safe_id_teste,
                ),
            )
        else:
            cursor.execute(
                """
                INSERT INTO candidatos_metadata
                (
                    id_teste,
                    nome_candidato,
                    habilidades_json,
                    tags_json,
                    observacao_rh,
                    classificacao_indicacao,
                    justificativa_indicacao,
                    email,
                    telefone,
                    whatsapp,
                    cidade,
                    bairro
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    safe_id_teste,
                    merged_name,
                    json.dumps(merged_skills, ensure_ascii=False),
                    json.dumps(merged_tags, ensure_ascii=False),
                    merged_observation,
                    merged_recommendation,
                    merged_justification,
                    merged_email,
                    merged_phone,
                    merged_whatsapp,
                    merged_city,
                    merged_neighborhood,
                ),
            )

    def _sync_candidate_identity_copies(
        self,
        cursor,
        *,
        id_teste: str,
        nome_candidato: str = "",
        email: str | None = None,
        telefone: str | None = None,
        whatsapp: str | None = None,
    ) -> None:
        safe_id_teste = normalize_text(id_teste)
        safe_name = normalize_text(nome_candidato)
        if not safe_id_teste:
            return

        if safe_name:
            for table_name in (
                "candidatos_processos",
                "banco_talentos",
                "entrevistas_agendadas",
                "historico_provas",
            ):
                cursor.execute(
                    f"""
                    IF OBJECT_ID('dbo.{table_name}', 'U') IS NOT NULL
                    BEGIN
                        UPDATE dbo.{table_name}
                        SET nome_candidato = ?
                        WHERE id_teste = ?
                    END
                    """,
                    (safe_name, safe_id_teste),
                )

        if safe_id_teste.startswith("CV-"):
            id_pre_analise = safe_id_teste[3:]
            if id_pre_analise.isdigit():
                update_fields = []
                params = []
                if safe_name:
                    update_fields.append("nome_candidato = ?")
                    params.append(safe_name)
                if email is not None:
                    update_fields.append("email = ?")
                    params.append(normalize_text(email))
                if telefone is not None:
                    update_fields.append("telefone = ?")
                    params.append(normalize_text(telefone))
                if whatsapp is not None:
                    update_fields.append("whatsapp = ?")
                    params.append(normalize_text(whatsapp))

                if update_fields:
                    params.append(int(id_pre_analise))
                    cursor.execute(
                        f"""
                        IF OBJECT_ID('dbo.cv_pre_analises', 'U') IS NOT NULL
                        BEGIN
                            UPDATE dbo.cv_pre_analises
                            SET {", ".join(update_fields)}
                            WHERE id_pre_analise = ?
                        END
                        """,
                        tuple(params),
                    )

    def _hydrate_pipeline_fields(self, cursor, candidates: list[dict]) -> list[dict]:
        mutated = False
        now = datetime.now()

        for candidate in candidates:
            inferred_stage = infer_pipeline_stage(
                candidate.get("status_candidato"),
                candidate.get("origem"),
                candidate.get("etapa_pipeline"),
            )
            current_stage = normalize_text(candidate.get("etapa_pipeline"))
            if current_stage != inferred_stage:
                cursor.execute(
                    """
                    UPDATE candidatos_processos
                    SET etapa_pipeline = ?, data_atualizacao_pipeline = ?
                    WHERE id_registro = ?
                    """,
                    (inferred_stage, now, candidate.get("id_registro")),
                )
                candidate["etapa_pipeline"] = inferred_stage
                candidate["data_atualizacao_pipeline"] = now.isoformat()
                mutated = True
            else:
                candidate["etapa_pipeline"] = inferred_stage

        if mutated:
            cursor.connection.commit()

        return candidates

    def _get_process_map(self, cursor) -> dict[str, dict]:
        ensure_process_reference_columns(cursor)
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
                link_agendamento
            FROM processos_seletivos
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        result = {}
        for item in sort_process_rows(rows):
            process_id = normalize_text(item.get("id_processo"))
            process_ref = normalize_text(item.get("id_processo_ref"))
            if process_ref:
                result[process_ref] = item
            if process_id and process_id not in result:
                result[process_id] = item
        return result

    def _get_process_candidate_map(self, cursor) -> dict[str, dict]:
        ensure_process_reference_columns(cursor)
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
                data_atualizacao_pipeline,
                aprovado_em,
                eliminado_em,
                motivo_eliminacao,
                etapa_eliminacao
            FROM candidatos_processos
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        rows = self._hydrate_pipeline_fields(cursor, rows)
        rows = self._enrich_candidate_records(cursor, rows)
        rows = self._attach_process_context(
            cursor,
            rows,
            timestamp_fields=["data_prova", "data_atualizacao_pipeline", "aprovado_em", "eliminado_em"],
        )

        result = {}
        for item in rows:
            id_teste = normalize_text(item.get("id_teste"))
            if id_teste:
                result[id_teste] = item
        return result

    def _find_talent_bank_duplicate_id(
        self,
        cursor,
        *,
        id_teste: str = "",
        email: str = "",
        telefone: str = "",
        whatsapp: str = "",
    ) -> int | None:
        safe_id_teste = normalize_text(id_teste)
        safe_email = normalize_compare_text(email)

        def only_digits(value: str) -> str:
            digits = re.sub(r"\D", "", normalize_text(value))
            if digits.startswith("55") and len(digits) in (12, 13):
                return digits[2:]
            return digits

        safe_phones = {
            only_digits(item)
            for item in (telefone, whatsapp)
            if only_digits(item)
        }

        ensure_candidate_metadata_table(cursor)
        cursor.execute(
            """
            SELECT
                banco.id_banco,
                banco.id_teste,
                meta.email,
                meta.telefone,
                meta.whatsapp
            FROM banco_talentos banco
            LEFT JOIN candidatos_metadata meta
                ON meta.id_teste = banco.id_teste
            """
        )
        for row in rows_to_dicts(cursor, cursor.fetchall()):
            id_banco = int(row.get("id_banco") or 0)
            if not id_banco:
                continue
            if safe_id_teste and normalize_text(row.get("id_teste")) == safe_id_teste:
                return id_banco

            row_email = normalize_compare_text(row.get("email"))
            if safe_email and row_email == safe_email:
                return id_banco

            row_phones = {
                only_digits(row.get("telefone")),
                only_digits(row.get("whatsapp")),
            }
            row_phones.discard("")
            if safe_phones and row_phones.intersection(safe_phones):
                return id_banco

        return None

    def _get_answer_files_map(self, cursor) -> dict[str, dict]:
        payload_column = get_gabaritos_payload_column(cursor)
        cursor.execute(f"SELECT record_id, {payload_column} FROM gabaritos")
        rows = cursor.fetchall()
        result = {}
        for row in rows:
            record_id = normalize_text(row[0])
            if record_id:
                result[record_id] = safe_json_loads(row[1], {})
        return result

    def _record_candidate_movement(
        self,
        cursor,
        *,
        id_teste: str = "",
        id_registro: int | None = None,
        id_processo: str = "",
        id_processo_ref: str = "",
        nome_candidato: str = "",
        vaga: str = "",
        origem_inicial: str = "",
        tipo_movimentacao: str = "",
        status_anterior: str = "",
        status_novo: str = "",
        observacao: str = "",
        usuario_responsavel: str = "",
        processo_destino: str = "",
    ) -> None:
        ensure_candidate_movements_table(cursor)
        cursor.execute(
            """
            INSERT INTO candidatos_movimentacoes
            (
                id_teste,
                id_registro,
                id_processo,
                id_processo_ref,
                nome_candidato,
                vaga,
                origem_inicial,
                tipo_movimentacao,
                status_anterior,
                status_novo,
                observacao,
                usuario_responsavel,
                processo_destino,
                criado_em
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
            """,
            (
                normalize_text(id_teste),
                int(id_registro or 0) or None,
                normalize_text(id_processo),
                normalize_text(id_processo_ref),
                normalize_text(nome_candidato),
                normalize_text(vaga),
                normalize_text(origem_inicial),
                normalize_text(tipo_movimentacao),
                normalize_text(status_anterior),
                normalize_text(status_novo),
                normalize_text(observacao),
                normalize_text(usuario_responsavel),
                normalize_text(processo_destino),
            ),
        )

    def _get_candidate_movements_map(self, cursor) -> dict[str, list[dict]]:
        ensure_candidate_movements_table(cursor)
        cursor.execute(
            """
            SELECT
                id_teste,
                id_registro,
                id_processo,
                id_processo_ref,
                nome_candidato,
                vaga,
                origem_inicial,
                tipo_movimentacao,
                status_anterior,
                status_novo,
                observacao,
                usuario_responsavel,
                processo_destino,
                criado_em
            FROM candidatos_movimentacoes
            ORDER BY criado_em DESC, id_movimentacao DESC
            """
        )
        result: dict[str, list[dict]] = {}
        for row in rows_to_dicts(cursor, cursor.fetchall()):
            id_teste = normalize_text(row.get("id_teste"))
            if not id_teste:
                continue
            result.setdefault(id_teste, []).append(row)
        return result

    def _summarize_candidate_movements(
        self,
        item: dict,
        movements: list[dict] | None = None,
    ) -> dict:
        safe_movements = movements or []
        ordered = list(reversed(safe_movements))
        descriptions = []
        first = ordered[0] if ordered else {}
        last = ordered[-1] if ordered else {}

        for movement in ordered:
            movement_type = normalize_text(movement.get("tipo_movimentacao")) or "Movimentacao"
            old_status = normalize_text(movement.get("status_anterior"))
            new_status = normalize_text(movement.get("status_novo"))
            detail = movement_type
            if old_status or new_status:
                detail = f"{detail}: {old_status or '-'} -> {new_status or '-'}"
            if normalize_text(movement.get("processo_destino")):
                detail = f"{detail} ({movement.get('processo_destino')})"
            descriptions.append(detail)

        if not descriptions:
            origem = self._format_candidate_origin(item)
            descriptions.append(f"Candidato criado por {origem}")
            if normalize_text(item.get("nota_prova") or item.get("pontuacao_final")) and item.get("prova_disponivel"):
                descriptions.append("Prova realizada")
            status_atual = canonicalize_candidate_status(item.get("status_candidato"))
            if status_atual == CANDIDATE_STATUS_APPROVED:
                descriptions.append("Candidato aprovado")
            elif status_atual == CANDIDATE_STATUS_ELIMINATED:
                descriptions.append("Candidato eliminado")
            elif status_atual == CANDIDATE_STATUS_TALENT_BANK:
                descriptions.append("Candidato enviado para Banco de Talentos")

        return {
            "origem_inicial": normalize_text(first.get("origem_inicial")) or self._format_candidate_origin(item),
            "movimentacoes": " | ".join(descriptions),
            "data_movimentacao": last.get("criado_em") if last else item.get("data_atualizacao_pipeline") or item.get("data_prova"),
            "status_anterior": normalize_text(last.get("status_anterior")) if last else "",
            "status_novo": normalize_text(last.get("status_novo")) if last else canonicalize_candidate_status(item.get("status_candidato")),
            "usuario_responsavel": normalize_text(last.get("usuario_responsavel")) if last else "",
            "observacao_motivo": normalize_text(last.get("observacao")) if last else "",
            "processo_destino": normalize_text(last.get("processo_destino")) if last else "",
        }

    def _apply_candidate_status_update(
        self,
        cursor,
        *,
        current_row,
        new_status: str,
        new_stage: str,
        data_movimentacao: str | None = None,
        approval_payload: dict | None = None,
    ) -> None:
        id_registro = int(current_row.get("id_registro") or 0)
        id_processo = normalize_text(current_row.get("id_processo"))
        id_processo_ref = normalize_text(current_row.get("id_processo_ref"))
        id_teste = normalize_text(current_row.get("id_teste"))
        nome_candidato = normalize_text(current_row.get("nome_candidato"))
        vaga = normalize_text(current_row.get("vaga"))
        old_status = canonicalize_candidate_status(current_row.get("status_candidato"))
        pontuacao_final = current_row.get("pontuacao_final")
        origem = normalize_text(current_row.get("origem"))
        resolved_new_status = canonicalize_candidate_status(new_status)
        old_status_normalized = normalize_compare_text(old_status)
        new_status_normalized = normalize_compare_text(resolved_new_status)
        payload = approval_payload or {}
        motivo_eliminacao = normalize_text(payload.get("motivo_eliminacao"))
        etapa_eliminacao = normalize_text(payload.get("etapa_eliminacao"))

        if is_terminal_candidate_status(old_status):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=build_terminal_candidate_locked_message(old_status),
            )

        if not id_processo:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Processo do candidato nao encontrado.")

        processo = resolve_process_row_for_related_record(
            cursor,
            id_processo=id_processo,
            id_processo_ref=id_processo_ref,
            timestamp_values=[
                current_row.get("data_prova"),
                current_row.get("data_atualizacao_pipeline"),
                data_movimentacao,
            ],
        )
        if not processo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo seletivo nao encontrado.")
        if is_process_closed(processo.get("status")):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=build_process_closed_message(
                    build_candidate_status_action_label(resolved_new_status),
                    processo.get("id_processo"),
                ),
            )

        data_pipeline = (
            datetime.fromisoformat(str(data_movimentacao).replace("Z", "+00:00"))
            if data_movimentacao
            else datetime.now()
        )

        cursor.execute(
            """
            UPDATE candidatos_processos
            SET
                status_candidato = ?,
                etapa_pipeline = ?,
                data_atualizacao_pipeline = ?,
                id_processo_ref = ?,
                eliminado_em = CASE WHEN ? = ? THEN ISNULL(eliminado_em, GETDATE()) ELSE eliminado_em END,
                motivo_eliminacao = CASE WHEN ? = ? THEN ? ELSE motivo_eliminacao END,
                etapa_eliminacao = CASE WHEN ? = ? THEN ? ELSE etapa_eliminacao END,
                banco_talentos_em = CASE WHEN ? = ? THEN ISNULL(banco_talentos_em, GETDATE()) ELSE banco_talentos_em END
            WHERE id_registro = ?
            """,
            (
                resolved_new_status,
                new_stage,
                data_pipeline,
                processo.get("id_processo_ref", ""),
                new_status_normalized,
                normalize_compare_text(CANDIDATE_STATUS_ELIMINATED),
                new_status_normalized,
                normalize_compare_text(CANDIDATE_STATUS_ELIMINATED),
                motivo_eliminacao,
                new_status_normalized,
                normalize_compare_text(CANDIDATE_STATUS_ELIMINATED),
                etapa_eliminacao,
                new_status_normalized,
                normalize_compare_text(CANDIDATE_STATUS_TALENT_BANK),
                id_registro,
            ),
        )

        if old_status_normalized != new_status_normalized:
            self._record_candidate_movement(
                cursor,
                id_teste=id_teste,
                id_registro=id_registro,
                id_processo=id_processo,
                id_processo_ref=processo.get("id_processo_ref", ""),
                nome_candidato=nome_candidato,
                vaga=vaga,
                origem_inicial=origem,
                tipo_movimentacao=(
                    "Candidato aprovado"
                    if new_status_normalized == normalize_compare_text(CANDIDATE_STATUS_APPROVED)
                    else "Candidato eliminado"
                    if new_status_normalized == normalize_compare_text(CANDIDATE_STATUS_ELIMINATED)
                    else "Candidato enviado para Banco de Talentos"
                    if new_status_normalized == normalize_compare_text(CANDIDATE_STATUS_TALENT_BANK)
                    else "Status atualizado"
                ),
                status_anterior=old_status,
                status_novo=resolved_new_status,
                observacao=(
                    motivo_eliminacao + (f" | {etapa_eliminacao}" if etapa_eliminacao else "")
                    if new_status_normalized == normalize_compare_text(CANDIDATE_STATUS_ELIMINATED)
                    else normalize_text(payload.get("mensagem_aprovacao"))
                ),
            )

        if new_status_normalized == normalize_compare_text(CANDIDATE_STATUS_APPROVED):
            documentos = [
                normalize_text(item)
                for item in (payload.get("documentos_aprovacao") or [])
                if normalize_text(item)
            ]
            cursor.execute(
                """
                UPDATE candidatos_processos
                SET
                    mensagem_aprovacao = ?,
                    data_comparecimento_aprovacao = ?,
                    documentos_aprovacao_json = ?,
                    anexo_aprovacao_nome = ?,
                    anexo_aprovacao_tipo = ?,
                    anexo_aprovacao_tamanho = ?,
                    anexo_aprovacao_base64 = ?,
                    aprovado_em = ISNULL(aprovado_em, GETDATE())
                WHERE id_registro = ?
                """,
                (
                    normalize_text(payload.get("mensagem_aprovacao")),
                    normalize_text(payload.get("data_comparecimento_aprovacao")),
                    json.dumps(documentos, ensure_ascii=False),
                    normalize_text(payload.get("anexo_aprovacao_nome")),
                    normalize_text(payload.get("anexo_aprovacao_tipo")),
                    int(payload.get("anexo_aprovacao_tamanho") or 0),
                    normalize_text(payload.get("anexo_aprovacao_base64")),
                    id_registro,
                ),
            )

        quantidade_vagas = int(processo.get("quantidade_vagas") or 0)
        vagas_preenchidas = int(processo.get("vagas_preenchidas") or 0)
        status_processo = normalize_text(processo.get("status"))

        if old_status_normalized != normalize_compare_text(CANDIDATE_STATUS_APPROVED) and new_status_normalized == normalize_compare_text(CANDIDATE_STATUS_APPROVED):
            vagas_preenchidas += 1
        elif old_status_normalized == normalize_compare_text(CANDIDATE_STATUS_APPROVED) and new_status_normalized != normalize_compare_text(CANDIDATE_STATUS_APPROVED):
            vagas_preenchidas = max(0, vagas_preenchidas - 1)

        where_clause, params = build_process_where_clause(processo)
        cursor.execute(
            f"""
            UPDATE processos_seletivos
            SET vagas_preenchidas = ?
            WHERE {where_clause}
            """,
            (vagas_preenchidas, *params),
        )

        if status_processo != "Encerrado" and quantidade_vagas > 0 and vagas_preenchidas >= quantidade_vagas:
            cursor.execute(
                f"""
                UPDATE processos_seletivos
                SET status = ?
                WHERE {where_clause}
                """,
                ("Encerrado", *params),
            )

        interview_synced_statuses = {
            normalize_compare_text(status_item)
            for status_item in INTERVIEW_OPERATIONAL_STATUSES
        } | {
            normalize_compare_text(CANDIDATE_STATUS_APPROVED),
            normalize_compare_text(CANDIDATE_STATUS_ELIMINATED),
            normalize_compare_text(CANDIDATE_STATUS_TALENT_BANK),
            normalize_compare_text(CANDIDATE_STATUS_WITHDREW),
        }
        if id_teste and new_status_normalized in interview_synced_statuses:
            cursor.execute(
                """
                UPDATE entrevistas_agendadas
                SET
                    status_entrevista = ?,
                    id_processo_ref = ?,
                    atualizado_em = GETDATE()
                WHERE (id_registro = ? AND ? > 0) OR (id_teste = ? AND ISNULL(id_teste, '') <> '')
                """,
                (
                    resolved_new_status,
                    processo.get("id_processo_ref", ""),
                    id_registro,
                    id_registro,
                    id_teste,
                ),
            )

        if new_status_normalized != normalize_compare_text(CANDIDATE_STATUS_TALENT_BANK):
            cursor.execute(
                """
                DELETE FROM banco_talentos
                WHERE id_teste = ?
                """,
                (id_teste,),
            )

        if new_status_normalized == normalize_compare_text(CANDIDATE_STATUS_TALENT_BANK):
            profile_map = self._get_candidate_profile_map(cursor)
            profile = profile_map.get(id_teste, {})
            id_banco_existente = self._find_talent_bank_duplicate_id(
                cursor,
                id_teste=id_teste,
                email=profile.get("email", ""),
                telefone=profile.get("telefone", ""),
                whatsapp=profile.get("whatsapp", ""),
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
                        processo.get("id_processo_ref", ""),
                        id_teste,
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao or datetime.now().isoformat(),
                        origem or "Prova",
                        id_banco_existente,
                    ),
                )
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
                        processo.get("id_processo_ref", ""),
                        id_teste,
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao or datetime.now().isoformat(),
                        origem or "Prova",
                    ),
                )
                cursor.fetchone()
