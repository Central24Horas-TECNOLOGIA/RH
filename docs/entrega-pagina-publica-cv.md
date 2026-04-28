# Entrega - Pagina publica de candidatura

## Arquivos alterados/criados
- api\rh_api\config.py
- api\rh_api\main.py
- api\rh_api\repositories\base.py
- api\rh_api\repositories\bootstrap.py
- api\rh_api\repositories\db_repository.py
- api\rh_api\repositories\processes.py
- api\rh_api\repositories\public_candidacy.py
- api\rh_api\repositories\talent_bank.py
- api\rh_api\routers\processes.py
- api\rh_api\routers\public_candidacy.py
- api\rh_api\services\public_candidacy.py
- api\tests\test_public_candidacy.py
- Front\estilos\screens.css
- Front\fonte\app\aplicacao-raiz.js
- Front\fonte\app\controlador-aplicacao.js
- Front\fonte\features\candidatos\index.js
- Front\fonte\features\gestao\index.js
- Front\fonte\features\pipeline\index.js
- Front\fonte\features\processos\index.js
- Front\fonte\features\public-candidacy\index.js
- Front\fonte\rotas.js
- Front\fonte\services\api\core.js
- Front\fonte\services\api\processes.js
- Front\fonte\services\api\public-candidacy.js
- Front\fonte\servico-api.js
- Front\fonte\shared\browser-utils.js

## api\rh_api\config.py

`$lang
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


DEFAULT_DEV_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:8080",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://localhost:5500",
    "http://localhost:8080",
    "null",
]


def _load_dotenv() -> None:
    api_dir = Path(__file__).resolve().parents[1]
    project_root = api_dir.parent
    candidates = [api_dir / ".env", project_root / ".env"]

    for dotenv_path in candidates:
        if not dotenv_path.exists():
            continue

        for line in dotenv_path.read_text(encoding="utf-8").splitlines():
            item = line.strip()
            if not item or item.startswith("#") or "=" not in item:
                continue

            key, raw_value = item.split("=", 1)
            key = key.strip()
            value = raw_value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def _split_csv(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _read_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    return default


@dataclass(frozen=True)
class Settings:
    app_env: str
    sql_server: str
    sql_database: str
    sql_driver: str
    sql_connection_string: str | None
    sql_username: str
    sql_password: str
    sql_trusted_connection: bool
    sql_encrypt: str
    sql_trust_server_certificate: bool
    sql_timeout_seconds: int
    auth_user: str
    auth_password: str
    auth_token_secret: str
    auth_token_ttl_minutes: int
    cors_allow_origins: list[str]
    cors_allow_origin_regex: str | None
    log_level: str
    public_frontend_base_url: str
    public_cv_upload_dir: str

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() != "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_dotenv()
    project_root = Path(__file__).resolve().parents[2]

    app_env = os.getenv("RH_APP_ENV", "development").strip() or "development"
    dev_mode = app_env.lower() != "production"
    cors_allow_origins = _split_csv(os.getenv("RH_CORS_ALLOW_ORIGINS"))

    if not cors_allow_origins and dev_mode:
        cors_allow_origins = list(DEFAULT_DEV_ORIGINS)

    cors_allow_origin_regex = os.getenv("RH_CORS_ALLOW_ORIGIN_REGEX", "").strip() or None
    if dev_mode and not cors_allow_origin_regex:
        cors_allow_origin_regex = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

    return Settings(
        app_env=app_env,
        sql_server=os.getenv("RH_SQL_SERVER", r"PAULO_TI\SQLEXPRESS").strip(),
        sql_database=os.getenv("RH_SQL_DATABASE", "RH_Provas").strip(),
        sql_driver=os.getenv("RH_SQL_DRIVER", "ODBC Driver 17 for SQL Server").strip(),
        sql_connection_string=os.getenv("RH_SQL_CONNECTION_STRING", "").strip() or None,
        sql_username=os.getenv("RH_SQL_USERNAME", "").strip(),
        sql_password=os.getenv("RH_SQL_PASSWORD", ""),
        sql_trusted_connection=_read_bool_env("RH_SQL_TRUSTED_CONNECTION", True),
        sql_encrypt=os.getenv("RH_SQL_ENCRYPT", "no").strip() or "no",
        sql_trust_server_certificate=_read_bool_env("RH_SQL_TRUST_SERVER_CERTIFICATE", True),
        sql_timeout_seconds=max(1, int(os.getenv("RH_SQL_TIMEOUT_SECONDS", "5"))),
        auth_user=os.getenv("RH_AUTH_USER", "").strip(),
        auth_password=os.getenv("RH_AUTH_PASSWORD", "").strip(),
        auth_token_secret=os.getenv("RH_AUTH_TOKEN_SECRET", "").strip()
        or secrets.token_urlsafe(32),
        auth_token_ttl_minutes=int(os.getenv("RH_AUTH_TOKEN_TTL_MINUTES", "480")),
        cors_allow_origins=cors_allow_origins,
        cors_allow_origin_regex=cors_allow_origin_regex,
        log_level=os.getenv("RH_LOG_LEVEL", "INFO").strip() or "INFO",
        public_frontend_base_url=os.getenv("RH_PUBLIC_FRONTEND_BASE_URL", "").strip(),
        public_cv_upload_dir=os.getenv(
            "RH_PUBLIC_CV_UPLOAD_DIR",
            str(project_root / "data" / "private" / "public-cvs"),
        ).strip(),
    )

```

## api\rh_api\main.py

`$lang
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import pyodbc
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .logging_config import configure_logging
from .repositories import (
    bootstrap_runtime_schema,
    describe_database_error,
    is_deadlock_error,
)
from .routers.analytics import router as analytics_router
from .routers.auth import router as auth_router
from .routers.history import router as history_router
from .routers.interviews import router as interviews_router
from .routers.pipeline import router as pipeline_router
from .routers.processes import router as processes_router
from .routers.public_candidacy import router as public_candidacy_router
from .routers.system import router as system_router


configure_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        try:
            bootstrap_runtime_schema(settings)
        except pyodbc.Error as exc:
            logger.exception(
                "Falha ao preparar o schema complementar do RH na inicializacao: %s",
                describe_database_error(exc),
            )
        except Exception as exc:
            logger.exception(
                "Falha ao preparar o schema complementar do RH na inicializacao: %s",
                exc,
            )
        yield

    app = FastAPI(title="Conecta C24h API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_origin_regex=settings.cors_allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(HTTPException)
    async def handle_http_exception(_: Request, exc: HTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "Falha ao processar a requisicao."
        logger.warning("Falha HTTP %s: %s", exc.status_code, message)
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "message": message},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_exception(_: Request, exc: RequestValidationError):
        errors = exc.errors()
        first_error = errors[0] if errors else {}
        loc = ".".join(str(item) for item in first_error.get("loc", []) if item not in {"body", "query", "path"})
        message = first_error.get("msg") or "Dados invalidos."
        if loc:
            message = f"{loc}: {message}"

        logger.warning("Falha de validacao na API: %s", errors)
        return JSONResponse(
            status_code=422,
            content={"success": False, "message": message, "details": errors},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(_: Request, exc: Exception):
        logger.exception("Erro nao tratado na API: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Erro interno do servidor."},
        )

    @app.exception_handler(pyodbc.Error)
    async def handle_database_exception(_: Request, exc: pyodbc.Error):
        detailed_message = describe_database_error(exc)
        if is_deadlock_error(exc):
            logger.warning(
                "Deadlock nao tratado interceptado pela API: %s",
                detailed_message,
            )
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "message": "O banco de dados ficou temporariamente indisponivel por conflito de concorrencia. Tente novamente em instantes.",
                },
            )

        logger.exception(
            "Erro de banco de dados nao tratado: %s",
            detailed_message,
        )
        message = "Falha ao acessar o banco de dados."
        if settings.is_development and detailed_message:
            message = f"{message} {detailed_message}"
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": message},
        )

    app.include_router(system_router)
    app.include_router(auth_router)
    app.include_router(history_router)
    app.include_router(processes_router)
    app.include_router(public_candidacy_router)
    app.include_router(interviews_router)
    app.include_router(analytics_router)
    app.include_router(pipeline_router)

    logger.info(
        "Aplicacao inicializada no ambiente '%s' com banco '%s/%s'.",
        settings.app_env,
        settings.sql_server,
        settings.sql_database,
    )
    return app


app = create_app()

```

## api\rh_api\repositories\base.py

`$lang
from __future__ import annotations

import json
import logging
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
    CANDIDATE_STATUS_ATTENDED,
    CANDIDATE_STATUS_CONFIRMED,
    CANDIDATE_STATUS_ELIMINATED,
    CANDIDATE_STATUS_MISSED,
    CANDIDATE_STATUS_SCHEDULED,
    CANDIDATE_STATUS_TALENT_BANK,
    build_candidate_status_action_label,
    build_process_closed_message,
    canonicalize_candidate_status,
    get_candidate_visible_status,
    is_process_closed,
)
from .bootstrap import (
    build_process_where_clause,
    describe_database_error,
    ensure_candidate_metadata_table,
    ensure_candidate_metadata_columns,
    ensure_candidate_attachments_table,
    ensure_process_reference_columns,
    get_gabaritos_payload_column,
    get_next_id_banco,
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

        for candidate in candidates:
            id_teste = normalize_text(candidate.get("id_teste"))
            profile = profile_map.get(id_teste, {})
            latest_interview = interview_map.get(id_teste, {})
            contato_cv = cv_contact_map.get(id_teste, {})
            cv_attachment = cv_map.get(id_teste, {})
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
            candidate["status_candidato"] = candidate_status
            candidate["status_entrevista"] = interview_status
            candidate["status_fluxo"] = get_candidate_visible_status(candidate_status, interview_status)
            candidate["data_entrevista"] = latest_interview.get("data_entrevista")
            candidate["link_entrevista"] = normalize_text(latest_interview.get("link_agendamento"))
            candidate["observacoes_entrevista"] = normalize_text(latest_interview.get("observacoes_rh"))
            candidate["mensagem_entrevista"] = normalize_text(latest_interview.get("mensagem_base"))
            candidate["id_entrevista"] = latest_interview.get("id_entrevista")
            candidate["email"] = (
                normalize_text(candidate.get("email"))
                or profile.get("email", "")
                or contato_cv.get("email", "")
            )
            candidate["telefone"] = (
                normalize_text(candidate.get("telefone"))
                or profile.get("telefone", "")
                or contato_cv.get("telefone", "")
            )
            candidate["whatsapp"] = (
                normalize_text(candidate.get("whatsapp"))
                or profile.get("whatsapp", "")
                or contato_cv.get("whatsapp", "")
            )
            candidate["cidade"] = normalize_text(candidate.get("cidade")) or profile.get("cidade", "")
            candidate["bairro"] = normalize_text(candidate.get("bairro")) or profile.get("bairro", "")
            candidate["cv_disponivel"] = bool(normalize_text(cv_attachment.get("caminho_arquivo")))
            candidate["cv_nome_arquivo"] = normalize_text(cv_attachment.get("nome_arquivo_original"))
            candidate["cv_tipo_arquivo"] = normalize_text(cv_attachment.get("tipo_arquivo"))
            candidate["cv_tamanho_bytes"] = cv_attachment.get("tamanho_bytes")

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
                    "email": existing[4],
                    "telefone": existing[5],
                    "whatsapp": existing[6],
                    "cidade": existing[7],
                    "bairro": existing[8],
                }
            )
            if existing
            else {
                "nome_candidato": "",
                "habilidades": [],
                "tags": [],
                "observacao_rh": "",
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
                    email,
                    telefone,
                    whatsapp,
                    cidade,
                    bairro
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    safe_id_teste,
                    merged_name,
                    json.dumps(merged_skills, ensure_ascii=False),
                    json.dumps(merged_tags, ensure_ascii=False),
                    merged_observation,
                    merged_email,
                    merged_phone,
                    merged_whatsapp,
                    merged_city,
                    merged_neighborhood,
                ),
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
                data_atualizacao_pipeline
            FROM candidatos_processos
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        rows = self._hydrate_pipeline_fields(cursor, rows)
        rows = self._enrich_candidate_records(cursor, rows)
        rows = self._attach_process_context(
            cursor,
            rows,
            timestamp_fields=["data_prova", "data_atualizacao_pipeline"],
        )

        result = {}
        for item in rows:
            id_teste = normalize_text(item.get("id_teste"))
            if id_teste:
                result[id_teste] = item
        return result

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

    def _apply_candidate_status_update(
        self,
        cursor,
        *,
        current_row,
        new_status: str,
        new_stage: str,
        data_movimentacao: str | None = None,
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
            SET status_candidato = ?, etapa_pipeline = ?, data_atualizacao_pipeline = ?, id_processo_ref = ?
            WHERE id_registro = ?
            """,
            (
                resolved_new_status,
                new_stage,
                data_pipeline,
                processo.get("id_processo_ref", ""),
                id_registro,
            ),
        )

        quantidade_vagas = int(processo.get("quantidade_vagas") or 0)
        vagas_preenchidas = int(processo.get("vagas_preenchidas") or 0)
        status_processo = normalize_text(processo.get("status"))

        old_status_normalized = normalize_compare_text(old_status)
        new_status_normalized = normalize_compare_text(resolved_new_status)

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
            normalize_compare_text(CANDIDATE_STATUS_SCHEDULED),
            normalize_compare_text(CANDIDATE_STATUS_CONFIRMED),
            normalize_compare_text(CANDIDATE_STATUS_ATTENDED),
            normalize_compare_text(CANDIDATE_STATUS_MISSED),
            normalize_compare_text(CANDIDATE_STATUS_APPROVED),
            normalize_compare_text(CANDIDATE_STATUS_ELIMINATED),
            normalize_compare_text(CANDIDATE_STATUS_TALENT_BANK),
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
            cursor.execute(
                """
                SELECT id_banco
                FROM banco_talentos
                WHERE id_teste = ?
                """,
                (id_teste,),
            )
            talent_row = cursor.fetchone()

            if talent_row:
                cursor.execute(
                    """
                    UPDATE banco_talentos
                    SET
                        id_processo = ?,
                        id_processo_ref = ?,
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
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao or datetime.now().isoformat(),
                        origem or "Prova",
                        int(talent_row[0]),
                    ),
                )
            else:
                id_banco = get_next_id_banco(cursor)
                cursor.execute(
                    """
                    INSERT INTO banco_talentos
                    (
                        id_banco,
                        id_processo,
                        id_processo_ref,
                        id_teste,
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao,
                        origem
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        id_banco,
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

```

## api\rh_api\repositories\bootstrap.py

`$lang
from __future__ import annotations

import logging
import re
import threading
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status

from ..config import Settings
from ..db import get_connection
from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts


logger = logging.getLogger(__name__)
_SCHEMA_BOOTSTRAP_LOCK = threading.Lock()
_SCHEMA_BOOTSTRAPPED = False
_SQL_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
PROCESS_REF_SEPARATOR = "@@"
LOCAL_TIMEZONE = ZoneInfo("America/Sao_Paulo")


def ensure_cv_pre_analises_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.cv_pre_analises', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.cv_pre_analises (
                id_pre_analise INT IDENTITY(1,1) PRIMARY KEY,
                id_processo NVARCHAR(60) NOT NULL,
                nome_candidato NVARCHAR(255) NULL,
                email NVARCHAR(255) NULL,
                telefone NVARCHAR(50) NULL,
                whatsapp NVARCHAR(50) NULL,
                palavras_chave NVARCHAR(MAX) NULL,
                score_final DECIMAL(5,2) NULL,
                classificacao NVARCHAR(50) NULL,
                classificacao_slug NVARCHAR(50) NULL,
                problemas NVARCHAR(MAX) NULL,
                texto_extraido NVARCHAR(MAX) NULL,
                nome_arquivo NVARCHAR(255) NULL,
                mime_type NVARCHAR(120) NULL,
                arquivo_original_base64 NVARCHAR(MAX) NULL,
                ja_adicionado_ao_processo BIT NOT NULL DEFAULT 0,
                criado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )


def ensure_pipeline_columns(cursor) -> None:
    cursor.execute(
        """
        IF COL_LENGTH('dbo.candidatos_processos', 'etapa_pipeline') IS NULL
        BEGIN
            ALTER TABLE dbo.candidatos_processos
            ADD etapa_pipeline NVARCHAR(30) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.candidatos_processos', 'data_atualizacao_pipeline') IS NULL
        BEGIN
            ALTER TABLE dbo.candidatos_processos
            ADD data_atualizacao_pipeline DATETIME NULL
        END
        """
    )


def ensure_process_columns(cursor) -> None:
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_agendamento') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_agendamento NVARCHAR(MAX) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_slug') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_slug NVARCHAR(255) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_token') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_token NVARCHAR(120) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_ativo') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_ativo BIT NOT NULL CONSTRAINT DF_processos_link_publico_ativo DEFAULT 0
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_criado_em') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_criado_em DATETIME NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_desativado_em') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_desativado_em DATETIME NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'descricao_publica') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD descricao_publica NVARCHAR(MAX) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'requisitos_publicos') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD requisitos_publicos NVARCHAR(MAX) NULL
        END
        """
    )


def ensure_candidate_metadata_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.candidatos_metadata', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.candidatos_metadata (
                id_teste NVARCHAR(120) NOT NULL PRIMARY KEY,
                nome_candidato NVARCHAR(255) NULL,
                habilidades_json NVARCHAR(MAX) NULL,
                tags_json NVARCHAR(MAX) NULL,
                observacao_rh NVARCHAR(MAX) NULL,
                email NVARCHAR(255) NULL,
                telefone NVARCHAR(50) NULL,
                whatsapp NVARCHAR(50) NULL,
                cidade NVARCHAR(120) NULL,
                bairro NVARCHAR(120) NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )


def ensure_candidate_metadata_columns(cursor) -> None:
    for column_name, sql_type in (
        ("email", "NVARCHAR(255)"),
        ("telefone", "NVARCHAR(50)"),
        ("whatsapp", "NVARCHAR(50)"),
        ("cidade", "NVARCHAR(120)"),
        ("bairro", "NVARCHAR(120)"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.candidatos_metadata', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.candidatos_metadata
                ADD {column_name} {sql_type} NULL
            END
            """
        )


def ensure_candidate_attachments_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.candidatos_anexos', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.candidatos_anexos (
                id_anexo INT IDENTITY(1,1) PRIMARY KEY,
                id_teste NVARCHAR(120) NOT NULL,
                id_processo NVARCHAR(60) NOT NULL,
                id_processo_ref NVARCHAR(255) NULL,
                nome_arquivo_original NVARCHAR(255) NULL,
                nome_arquivo_armazenado NVARCHAR(255) NOT NULL,
                tipo_arquivo NVARCHAR(120) NULL,
                caminho_arquivo NVARCHAR(500) NOT NULL,
                tamanho_bytes BIGINT NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )


def ensure_interviews_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.entrevistas_agendadas', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.entrevistas_agendadas (
                id_entrevista INT IDENTITY(1,1) PRIMARY KEY,
                id_processo NVARCHAR(60) NOT NULL,
                id_registro INT NULL,
                id_teste NVARCHAR(120) NULL,
                nome_candidato NVARCHAR(255) NOT NULL,
                vaga NVARCHAR(255) NULL,
                data_entrevista DATETIME NOT NULL,
                status_entrevista NVARCHAR(30) NOT NULL DEFAULT 'Agendado',
                link_agendamento NVARCHAR(MAX) NULL,
                observacoes_rh NVARCHAR(MAX) NULL,
                mensagem_base NVARCHAR(MAX) NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )


def _ensure_process_reference_column(cursor, table_name: str) -> None:
    safe_table = normalize_text(table_name)
    if not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_table):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nao foi possivel preparar a coluna de referencia de processo.",
        )

    cursor.execute(
        f"""
        IF COL_LENGTH('dbo.{safe_table}', 'id_processo_ref') IS NULL
        BEGIN
            ALTER TABLE dbo.{safe_table}
            ADD id_processo_ref NVARCHAR(255) NULL
        END
        """
    )


def ensure_process_reference_columns(cursor) -> None:
    for table_name in (
        "historico_provas",
        "candidatos_processos",
        "entrevistas_agendadas",
        "cv_pre_analises",
        "banco_talentos",
    ):
        _ensure_process_reference_column(cursor, table_name)


def _get_column_type(cursor, table_name: str, column_name: str) -> str:
    safe_table = normalize_text(table_name)
    safe_column = normalize_text(column_name)

    for column in cursor.columns(table=safe_table, schema="dbo"):
        if normalize_compare_text(column.column_name) == normalize_compare_text(safe_column):
            return normalize_compare_text(column.type_name)

    return ""


def _ensure_nullable_decimal_column(cursor, table_name: str, column_name: str, *, precision: int, scale: int) -> None:
    safe_table = normalize_text(table_name)
    safe_column = normalize_text(column_name)

    if not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_table) or not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_column):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nao foi possivel ajustar a tipagem numerica da tabela.",
        )

    current_type = _get_column_type(cursor, safe_table, safe_column)
    if current_type in {"decimal", "numeric", "float", "real"}:
        return

    if current_type not in {"int", "bigint", "smallint", "tinyint"}:
        return

    cursor.execute(
        f"""
        ALTER TABLE dbo.{safe_table}
        ALTER COLUMN {safe_column} DECIMAL({precision},{scale}) NULL
        """
    )


def ensure_decimal_process_columns(cursor) -> None:
    _ensure_nullable_decimal_column(
        cursor,
        "processos_seletivos",
        "nota_corte",
        precision=5,
        scale=1,
    )
    _ensure_nullable_decimal_column(
        cursor,
        "historico_provas",
        "pontuacao_final",
        precision=5,
        scale=1,
    )


def describe_database_error(error: Exception) -> str:
    parts = []

    for item in getattr(error, "args", ()):
        text = normalize_text(item)
        if text:
            parts.append(text)

    return " ".join(parts)


def is_deadlock_error(error: Exception) -> bool:
    safe_error = normalize_compare_text(describe_database_error(error))
    return "1205" in safe_error or "deadlock" in safe_error or "40001" in safe_error


def bootstrap_runtime_schema(settings: Settings, *, force: bool = False) -> bool:
    global _SCHEMA_BOOTSTRAPPED

    if _SCHEMA_BOOTSTRAPPED and not force:
        return False

    with _SCHEMA_BOOTSTRAP_LOCK:
        if _SCHEMA_BOOTSTRAPPED and not force:
            return False

        conn = get_connection(settings, autocommit=True)
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            ensure_pipeline_columns(cursor)
            ensure_candidate_metadata_table(cursor)
            ensure_candidate_metadata_columns(cursor)
            ensure_candidate_attachments_table(cursor)
            ensure_cv_pre_analises_table(cursor)
            ensure_interviews_table(cursor)
            ensure_process_reference_columns(cursor)
            ensure_decimal_process_columns(cursor)
        finally:
            conn.close()

        _SCHEMA_BOOTSTRAPPED = True
        logger.info("Bootstrap de schema complementar do RH concluido com sucesso.")
        return True


def get_next_id_registro(cursor) -> int:
    return get_next_numeric_id(cursor, "candidatos_processos", "id_registro")


def get_next_numeric_id(cursor, table_name: str, column_name: str) -> int:
    safe_table = normalize_text(table_name)
    safe_column = normalize_text(column_name)

    if not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_table) or not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_column):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nao foi possivel gerar o proximo identificador numerico solicitado.",
        )

    cursor.execute(f"SELECT ISNULL(MAX({safe_column}), 0) + 1 FROM {safe_table}")
    row = cursor.fetchone()
    return int(row[0] or 1)


def get_next_id_banco(cursor) -> int:
    return get_next_numeric_id(cursor, "banco_talentos", "id_banco")


def get_gabaritos_payload_column(cursor) -> str:
    columns = [col.column_name for col in cursor.columns(table="gabaritos", schema="dbo")]
    for name in ("payload_json", "playlaod_json"):
        if name in columns:
            return name

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Coluna de payload nao encontrada na tabela dbo.gabaritos. Colunas disponiveis: {columns}",
    )


def build_process_reference(id_processo: str | None, data_criacao: str | None) -> str:
    safe_process_id = normalize_text(id_processo)
    safe_created_at = normalize_text(data_criacao)

    if not safe_process_id:
        return ""
    if not safe_created_at:
        return safe_process_id

    return f"{safe_process_id}{PROCESS_REF_SEPARATOR}{safe_created_at}"


def split_process_reference(value: str | None) -> tuple[str, str]:
    safe_value = normalize_text(value)
    if not safe_value:
        return "", ""

    if PROCESS_REF_SEPARATOR not in safe_value:
        return safe_value, ""

    process_id, created_at = safe_value.split(PROCESS_REF_SEPARATOR, 1)
    return normalize_text(process_id), normalize_text(created_at)


def parse_process_datetime(value) -> datetime | None:
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        dt_value = value
    else:
        safe_value = normalize_text(value)
        if not safe_value:
            return None

        normalized = safe_value
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"

        try:
            dt_value = datetime.fromisoformat(normalized)
        except ValueError:
            for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    dt_value = datetime.strptime(safe_value, fmt)
                    break
                except ValueError:
                    dt_value = None
            if dt_value is None:
                return None

    if dt_value.tzinfo is None:
        dt_value = dt_value.replace(tzinfo=LOCAL_TIMEZONE)

    return dt_value.astimezone(timezone.utc)


def decorate_process_row(row: dict | None) -> dict | None:
    if not row:
        return row

    decorated = dict(row)
    decorated["id_processo_ref"] = build_process_reference(
        decorated.get("id_processo"),
        decorated.get("data_criacao"),
    )
    return decorated


def sort_process_rows(rows: list[dict]) -> list[dict]:
    fallback = datetime.min.replace(tzinfo=timezone.utc)
    decorated = [decorate_process_row(row) for row in rows]
    return sorted(
        decorated,
        key=lambda item: (
            parse_process_datetime(item.get("data_criacao")) or fallback,
            normalize_text(item.get("id_processo")),
        ),
    )


def _select_process_row_from_rows(
    rows: list[dict],
    *,
    process_ref: str = "",
    timestamp_values: list | tuple | None = None,
) -> dict | None:
    if not rows:
        return None

    sorted_rows = sort_process_rows(rows)
    _, reference_created_at = split_process_reference(process_ref)

    if reference_created_at:
        for row in sorted_rows:
            if normalize_text(row.get("data_criacao")) == reference_created_at:
                return row

    timestamps = timestamp_values or []
    effective_timestamp = None
    for value in timestamps:
        effective_timestamp = parse_process_datetime(value)
        if effective_timestamp is not None:
            break

    if effective_timestamp is None or len(sorted_rows) == 1:
        return sorted_rows[-1]

    first_start = parse_process_datetime(sorted_rows[0].get("data_criacao"))
    if first_start is not None and effective_timestamp < first_start:
        return sorted_rows[0]

    for index, row in enumerate(sorted_rows):
        row_start = parse_process_datetime(row.get("data_criacao"))
        next_start = (
            parse_process_datetime(sorted_rows[index + 1].get("data_criacao"))
            if index + 1 < len(sorted_rows)
            else None
        )
        if row_start is None:
            continue
        if effective_timestamp >= row_start and (next_start is None or effective_timestamp < next_start):
            return row

    return sorted_rows[-1]


def _select_process_query() -> str:
    return """
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
            requisitos_publicos
        FROM processos_seletivos
    """


def get_process_rows(cursor, id_processo_or_ref: str | None = None) -> list[dict]:
    safe_process_id, _ = split_process_reference(id_processo_or_ref)
    query = _select_process_query()
    params = []

    if safe_process_id:
        query += " WHERE id_processo = ?"
        params.append(safe_process_id)

    query += " ORDER BY data_criacao ASC, id_processo ASC"
    cursor.execute(query, tuple(params))
    return sort_process_rows(rows_to_dicts(cursor, cursor.fetchall()))


def get_process_row(cursor, id_processo_or_ref: str):
    safe_process_id, safe_created_at = split_process_reference(id_processo_or_ref)
    if not safe_process_id:
        return None

    rows = get_process_rows(cursor, safe_process_id)
    if not rows:
        return None

    if safe_created_at:
        for row in rows:
            if normalize_text(row.get("data_criacao")) == safe_created_at:
                return row

    return rows[-1]


def resolve_process_row_for_related_record(
    cursor,
    *,
    id_processo: str,
    id_processo_ref: str = "",
    timestamp_values: list | tuple | None = None,
):
    safe_process_id = normalize_text(id_processo)
    if not safe_process_id:
        return None

    rows = get_process_rows(cursor, safe_process_id)
    return _select_process_row_from_rows(
        rows,
        process_ref=id_processo_ref,
        timestamp_values=timestamp_values,
    )


def build_process_where_clause(process_row_or_ref) -> tuple[str, tuple]:
    if isinstance(process_row_or_ref, dict):
        safe_process_id = normalize_text(process_row_or_ref.get("id_processo"))
        safe_created_at = normalize_text(process_row_or_ref.get("data_criacao"))
    else:
        safe_process_id, safe_created_at = split_process_reference(process_row_or_ref)

    if not safe_process_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador do processo nao informado.",
        )

    if safe_created_at:
        return "id_processo = ? AND data_criacao = ?", (safe_process_id, safe_created_at)

    return "id_processo = ?", (safe_process_id,)


def generate_unique_process_id(cursor, requested_process_id: str) -> str:
    base_process_id = normalize_text(requested_process_id)
    if not base_process_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador base do processo nao informado.",
        )

    cursor.execute(
        """
        SELECT id_processo
        FROM processos_seletivos
        WHERE id_processo = ? OR id_processo LIKE ?
        """,
        (base_process_id, f"{base_process_id}-%"),
    )
    existing_ids = {
        normalize_text(row[0])
        for row in cursor.fetchall()
        if normalize_text(row[0])
    }

    if base_process_id not in existing_ids:
        return base_process_id

    suffix = 2
    while True:
        candidate = f"{base_process_id}-{suffix:02d}"
        if candidate not in existing_ids:
            return candidate
        suffix += 1


def process_auto_close_if_full(cursor, process_row_or_ref) -> None:
    where_clause, params = build_process_where_clause(process_row_or_ref)
    cursor.execute(
        f"""
        SELECT quantidade_vagas, vagas_preenchidas, status
        FROM processos_seletivos
        WHERE {where_clause}
        """,
        params,
    )
    row = cursor.fetchone()
    if not row:
        return

    quantidade_vagas = int(row[0] or 0)
    vagas_preenchidas = int(row[1] or 0)
    status_processo = normalize_text(row[2])

    if status_processo != "Encerrado" and quantidade_vagas > 0 and vagas_preenchidas >= quantidade_vagas:
        cursor.execute(
            f"""
            UPDATE processos_seletivos
            SET
                status = ?,
                link_publico_ativo = 0,
                link_publico_desativado_em = GETDATE()
            WHERE {where_clause}
            """,
            ("Encerrado", *params),
        )

```

## api\rh_api\repositories\db_repository.py

`$lang
from __future__ import annotations

from .analytics import AnalyticsRepositoryMixin
from .base import BaseRepository
from .bootstrap import (
    bootstrap_runtime_schema,
    describe_database_error,
    is_deadlock_error,
)
from .cv_analysis import CvAnalysisRepositoryMixin
from .history import HistoryRepositoryMixin
from .interviews import InterviewRepositoryMixin
from .pipeline import PipelineRepositoryMixin
from .processes import ProcessRepositoryMixin
from .profiles import CandidateProfileRepositoryMixin
from .public_candidacy import PublicCandidacyRepositoryMixin
from .talent_bank import TalentBankRepositoryMixin


class DatabaseRepository(
    HistoryRepositoryMixin,
    ProcessRepositoryMixin,
    TalentBankRepositoryMixin,
    CandidateProfileRepositoryMixin,
    CvAnalysisRepositoryMixin,
    AnalyticsRepositoryMixin,
    PipelineRepositoryMixin,
    InterviewRepositoryMixin,
    PublicCandidacyRepositoryMixin,
    BaseRepository,
):
    """Fachada de compatibilidade que agrega os repositorios por dominio."""


__all__ = [
    "DatabaseRepository",
    "bootstrap_runtime_schema",
    "describe_database_error",
    "is_deadlock_error",
]

```

## api\rh_api\repositories\processes.py

`$lang
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from ..services.pipeline import infer_pipeline_stage, map_pipeline_stage_to_status, normalize_pipeline_stage
from ..services.process_flow import (
    CANDIDATE_STATUS_ANALYSIS,
    CANDIDATE_STATUS_APPROVED,
    CANDIDATE_STATUS_ATTENDED,
    CANDIDATE_STATUS_CONFIRMED,
    CANDIDATE_STATUS_ELIMINATED,
    CANDIDATE_STATUS_MISSED,
    CANDIDATE_STATUS_QUALIFIED,
    CANDIDATE_STATUS_SCHEDULED,
    CANDIDATE_STATUS_TALENT_BANK,
    canonicalize_candidate_status,
    get_candidate_visible_status,
    normalize_process_status,
)
from .bootstrap import (
    build_process_where_clause,
    ensure_pipeline_columns,
    ensure_process_columns,
    ensure_process_reference_columns,
    generate_unique_process_id,
    get_next_id_registro,
    get_process_row,
    get_process_rows,
    process_auto_close_if_full,
    resolve_process_row_for_related_record,
)


logger = logging.getLogger(__name__)


class ProcessRepositoryMixin:
    @staticmethod
    def _preserve_existing_process_status(current_status: str, requested_status: str) -> str:
        current = canonicalize_candidate_status(current_status)
        requested = canonicalize_candidate_status(requested_status)

        if requested in {
            CANDIDATE_STATUS_APPROVED,
            CANDIDATE_STATUS_ELIMINATED,
            CANDIDATE_STATUS_TALENT_BANK,
        }:
            return requested

        if current in {
            CANDIDATE_STATUS_SCHEDULED,
            CANDIDATE_STATUS_CONFIRMED,
            CANDIDATE_STATUS_ATTENDED,
            CANDIDATE_STATUS_MISSED,
            CANDIDATE_STATUS_APPROVED,
            CANDIDATE_STATUS_ELIMINATED,
            CANDIDATE_STATUS_TALENT_BANK,
        } and requested in {
            CANDIDATE_STATUS_ANALYSIS,
            CANDIDATE_STATUS_QUALIFIED,
        }:
            return current

        return requested

    def list_processes(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            ensure_process_reference_columns(cursor)
            return get_process_rows(cursor)
        finally:
            conn.close()

    def create_process(self, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            ensure_process_reference_columns(cursor)
            resolved_process_id = generate_unique_process_id(
                cursor,
                data.get("id_processo", ""),
            )
            created_at = normalize_text(data.get("data_criacao")) or datetime.now().isoformat()
            cursor.execute(
                """
                INSERT INTO processos_seletivos
                (
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
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_process_id,
                    data.get("vaga", ""),
                    int(data.get("quantidade_vagas", 0) or 0),
                    int(data.get("vagas_preenchidas", 0) or 0),
                    data.get("data_encerramento", ""),
                    data.get("operacao", ""),
                    data.get("trilha", ""),
                    int(data.get("usa_nota_corte", 0) or 0),
                    data.get("nota_corte", None),
                    normalize_process_status(data.get("status", "Aberto")),
                    created_at,
                    data.get("link_agendamento", ""),
                ),
            )
            conn.commit()
            logger.info("Processo '%s' criado.", resolved_process_id)
            return {
                "success": True,
                "id_processo": resolved_process_id,
            }
        finally:
            conn.close()

    def update_process(self, id_processo: str, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            ensure_process_reference_columns(cursor)
            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")
            where_clause, params = build_process_where_clause(processo)
            cursor.execute(
                f"""
                UPDATE processos_seletivos
                SET
                    quantidade_vagas = ?,
                    data_encerramento = ?,
                    operacao = ?,
                    trilha = ?,
                    usa_nota_corte = ?,
                    nota_corte = ?,
                    status = ?,
                    link_agendamento = ?
                WHERE {where_clause}
                """,
                (
                    int(data.get("quantidade_vagas", 0) or 0),
                    data.get("data_encerramento", ""),
                    data.get("operacao", ""),
                    data.get("trilha", ""),
                    int(data.get("usa_nota_corte", 0) or 0),
                    data.get("nota_corte", None),
                    normalize_process_status(data.get("status", "Aberto")),
                    data.get("link_agendamento", ""),
                    *params,
                ),
            )
            if normalize_process_status(data.get("status", "Aberto")) == "Encerrado":
                cursor.execute(
                    f"""
                    UPDATE processos_seletivos
                    SET
                        link_publico_ativo = 0,
                        link_publico_desativado_em = GETDATE()
                    WHERE {where_clause}
                    """,
                    *params,
                )
            process_auto_close_if_full(cursor, processo)
            conn.commit()
            logger.info("Processo '%s' atualizado.", processo.get("id_processo_ref") or processo.get("id_processo"))
            return {"success": True}
        finally:
            conn.close()

    def close_process(self, id_processo: str) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_reference_columns(cursor)
            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")
            where_clause, params = build_process_where_clause(processo)
            cursor.execute(
                f"""
                UPDATE processos_seletivos
                SET
                    status = ?,
                    link_publico_ativo = 0,
                    link_publico_desativado_em = GETDATE()
                WHERE {where_clause}
                """,
                ("Encerrado", *params),
            )
            conn.commit()
            logger.info(
                "Processo '%s' encerrado manualmente.",
                processo.get("id_processo_ref") or processo.get("id_processo"),
            )
            return {"success": True}
        finally:
            conn.close()

    def list_process_candidates(self, id_processo: str | None = None) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
            ensure_process_reference_columns(cursor)
            query = """
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
            """
            params = []
            if normalize_text(id_processo):
                query += " WHERE id_processo = ?"
                params.append(normalize_text(id_processo).split("@@", 1)[0])
            query += " ORDER BY id_registro DESC"

            cursor.execute(query, tuple(params))
            rows = rows_to_dicts(cursor, cursor.fetchall())
            rows = self._hydrate_pipeline_fields(cursor, rows)
            rows = self._enrich_candidate_records(cursor, rows)
            rows = self._attach_process_context(
                cursor,
                rows,
                timestamp_fields=["data_prova", "data_atualizacao_pipeline"],
            )

            if normalize_text(id_processo):
                filtro_ref = normalize_text(id_processo)
                rows = [
                    item
                    for item in rows
                    if normalize_text(item.get("id_processo_ref")) == filtro_ref
                ]

            return rows
        finally:
            conn.close()

    def create_process_candidate(self, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
            ensure_process_reference_columns(cursor)

            processo = get_process_row(
                cursor,
                data.get("id_processo_ref") or data.get("id_processo", ""),
            )
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

            requested_stage = data.get("etapa_pipeline")
            stage = (
                normalize_pipeline_stage(requested_stage)
                if requested_stage
                else infer_pipeline_stage(data.get("status_candidato"), data.get("origem"))
            )
            requested_status = (
                canonicalize_candidate_status(data.get("status_candidato"))
                if normalize_text(data.get("status_candidato"))
                else map_pipeline_stage_to_status(stage)
            )
            id_teste = normalize_text(data.get("id_teste"))
            effective_data_prova = normalize_text(data.get("data_prova")) or datetime.now().isoformat()
            effective_origin = normalize_text(data.get("origem")) or "Prova"
            effective_vaga = normalize_text(data.get("vaga")) or normalize_text(processo.get("vaga"))

            current = None
            provided_id_registro = int(data.get("id_registro") or 0)
            if provided_id_registro > 0:
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
                    WHERE id_registro = ?
                    """,
                    (provided_id_registro,),
                )
                current_rows = rows_to_dicts(cursor, cursor.fetchall())
                current = current_rows[0] if current_rows else None

            if not current and id_teste:
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
                    (processo.get("id_processo", ""), id_teste),
                )
                current_rows = rows_to_dicts(cursor, cursor.fetchall())
                current = current_rows[0] if current_rows else None

            if current:
                effective_status = self._preserve_existing_process_status(
                    current.get("status_candidato"),
                    requested_status,
                )
                effective_stage = (
                    normalize_pipeline_stage(requested_stage)
                    if requested_stage and effective_status == requested_status
                    else infer_pipeline_stage(
                        effective_status,
                        effective_origin or current.get("origem"),
                        current_stage=current.get("etapa_pipeline"),
                    )
                )

                cursor.execute(
                    """
                    UPDATE candidatos_processos
                    SET
                        id_processo = ?,
                        id_processo_ref = ?,
                        id_teste = ?,
                        nome_candidato = ?,
                        vaga = ?,
                        pontuacao_final = ?,
                        data_prova = ?,
                        origem = ?
                    WHERE id_registro = ?
                    """,
                    (
                        processo.get("id_processo", ""),
                        processo.get("id_processo_ref", ""),
                        id_teste or normalize_text(current.get("id_teste")),
                        data.get("nome_candidato", "") or normalize_text(current.get("nome_candidato")),
                        effective_vaga or normalize_text(current.get("vaga")),
                        data.get("pontuacao_final", current.get("pontuacao_final")),
                        effective_data_prova,
                        effective_origin or normalize_text(current.get("origem")),
                        int(current.get("id_registro")),
                    ),
                )

                if (
                    canonicalize_candidate_status(current.get("status_candidato")) != effective_status
                    or normalize_text(current.get("etapa_pipeline")) != effective_stage
                    or normalize_text(current.get("id_processo_ref")) != normalize_text(processo.get("id_processo_ref"))
                ):
                    self._apply_candidate_status_update(
                        cursor,
                        current_row={
                            **current,
                            "id_processo": processo.get("id_processo", ""),
                            "id_processo_ref": processo.get("id_processo_ref", ""),
                            "id_teste": id_teste or normalize_text(current.get("id_teste")),
                            "nome_candidato": data.get("nome_candidato", "") or normalize_text(current.get("nome_candidato")),
                            "vaga": effective_vaga or normalize_text(current.get("vaga")),
                            "pontuacao_final": data.get("pontuacao_final", current.get("pontuacao_final")),
                            "data_prova": effective_data_prova,
                            "origem": effective_origin or normalize_text(current.get("origem")),
                        },
                        new_status=effective_status,
                        new_stage=effective_stage,
                        data_movimentacao=effective_data_prova,
                    )

                self._upsert_candidate_profile(
                    cursor,
                    id_teste=id_teste or current.get("id_teste", ""),
                    nome_candidato=data.get("nome_candidato", ""),
                )
                conn.commit()
                logger.info(
                    "Candidato '%s' atualizado no processo '%s'.",
                    data.get("nome_candidato", ""),
                    processo.get("id_processo_ref") or processo.get("id_processo", ""),
                )
                return {"success": True, "id_registro": int(current.get("id_registro") or 0)}

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
                    processo.get("id_processo", ""),
                    processo.get("id_processo_ref", ""),
                    id_teste,
                    data.get("nome_candidato", ""),
                    effective_vaga,
                    requested_status,
                    data.get("pontuacao_final", ""),
                    effective_data_prova,
                    effective_origin,
                    stage,
                    datetime.now(),
                ),
            )
            self._upsert_candidate_profile(
                cursor,
                id_teste=id_teste,
                nome_candidato=data.get("nome_candidato", ""),
            )

            if requested_status != CANDIDATE_STATUS_ANALYSIS or stage != "Triagem":
                self._apply_candidate_status_update(
                    cursor,
                    current_row={
                        "id_registro": id_registro,
                        "id_processo": processo.get("id_processo", ""),
                        "id_processo_ref": processo.get("id_processo_ref", ""),
                        "id_teste": id_teste,
                        "nome_candidato": data.get("nome_candidato", ""),
                        "vaga": effective_vaga,
                        "status_candidato": CANDIDATE_STATUS_ANALYSIS,
                        "pontuacao_final": data.get("pontuacao_final", ""),
                        "data_prova": effective_data_prova,
                        "origem": effective_origin,
                        "etapa_pipeline": "Triagem",
                        "data_atualizacao_pipeline": effective_data_prova,
                    },
                    new_status=requested_status,
                    new_stage=stage,
                    data_movimentacao=effective_data_prova,
                )

            conn.commit()
            logger.info(
                "Candidato '%s' vinculado ao processo '%s'.",
                data.get("nome_candidato", ""),
                processo.get("id_processo_ref") or processo.get("id_processo", ""),
            )
            return {"success": True, "id_registro": id_registro}
        finally:
            conn.close()

    def update_process_candidate_status(self, id_registro: int, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
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
                    data_atualizacao_pipeline
                FROM candidatos_processos
                WHERE id_registro = ?
                """,
                (id_registro,),
            )
            current_rows = rows_to_dicts(cursor, cursor.fetchall())
            if not current_rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato do processo nao encontrado.")
            current = current_rows[0]

            requested_status = normalize_text(data.get("status_candidato"))
            current_stage = current.get("etapa_pipeline")
            new_stage = (
                normalize_pipeline_stage(data.get("etapa_pipeline"))
                if data.get("etapa_pipeline")
                else infer_pipeline_stage(requested_status, current.get("origem"), current_stage=current_stage)
            )
            new_status = (
                canonicalize_candidate_status(requested_status)
                if requested_status
                else map_pipeline_stage_to_status(new_stage, current.get("status_candidato"))
            )

            self._apply_candidate_status_update(
                cursor,
                current_row=current,
                new_status=new_status,
                new_stage=new_stage,
                data_movimentacao=data.get("data_movimentacao"),
            )

            conn.commit()
            logger.info("Status do candidato %s atualizado para '%s'.", id_registro, new_status)
            return {"success": True}
        finally:
            conn.close()

    def get_process_details(self, id_processo: str) -> dict:
        def operation() -> dict:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                ensure_pipeline_columns(cursor)
                ensure_process_reference_columns(cursor)

                processo = get_process_row(cursor, id_processo)
                if not processo:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

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
                    WHERE id_processo = ?
                    ORDER BY id_registro DESC
                    """,
                    (processo.get("id_processo"),),
                )
                candidatos = rows_to_dicts(cursor, cursor.fetchall())
                candidatos = self._hydrate_pipeline_fields(cursor, candidatos)
                candidatos = self._enrich_candidate_records(cursor, candidatos)
                candidatos = self._attach_process_context(
                    cursor,
                    candidatos,
                    timestamp_fields=["data_prova", "data_atualizacao_pipeline"],
                )
                candidatos = [
                    item
                    for item in candidatos
                    if normalize_text(item.get("id_processo_ref"))
                    == normalize_text(processo.get("id_processo_ref"))
                ]

                status_fluxo = [
                    get_candidate_visible_status(
                        item.get("status_candidato"),
                        item.get("status_entrevista"),
                    )
                    for item in candidatos
                ]

                resumo = {
                    "total": len(candidatos),
                    "analise": sum(1 for status_item in status_fluxo if status_item == CANDIDATE_STATUS_ANALYSIS),
                    "qualificados": sum(1 for status_item in status_fluxo if status_item == CANDIDATE_STATUS_QUALIFIED),
                    "entrevistas": sum(
                        1
                        for status_item in status_fluxo
                        if status_item in {
                            CANDIDATE_STATUS_SCHEDULED,
                            CANDIDATE_STATUS_CONFIRMED,
                            CANDIDATE_STATUS_ATTENDED,
                            CANDIDATE_STATUS_MISSED,
                        }
                    ),
                    "aprovados": sum(1 for status_item in status_fluxo if status_item == CANDIDATE_STATUS_APPROVED),
                    "eliminados": sum(1 for status_item in status_fluxo if status_item == CANDIDATE_STATUS_ELIMINATED),
                    "banco": sum(1 for status_item in status_fluxo if status_item == CANDIDATE_STATUS_TALENT_BANK),
                }

                return {"processo": processo, "resumo": resumo, "candidatos": candidatos}
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            f"carregar detalhes do processo {id_processo}",
            operation,
            retries=1,
            final_message="Nao foi possivel carregar os detalhes do processo agora por conta de concorrencia no banco. Tente novamente em instantes.",
        )

```

## api\rh_api\repositories\public_candidacy.py

`$lang
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
                requisitos_publicos
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
        cidade: str,
        bairro: str,
        lgpd_aceito: str,
        curriculo,
    ) -> dict:
        safe_name = normalize_text(nome_completo)
        safe_email = normalize_text(email)
        safe_phone = normalize_text(telefone)
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

```

## api\rh_api\repositories\talent_bank.py

`$lang
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

```

## api\rh_api\routers\processes.py

`$lang
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse

from ..dependencies import get_current_user, get_repository
from ..repositories import DatabaseRepository
from ..schemas.processes import (
    CandidateProfileUpdateRequest,
    CvPreAnalysisUpdateRequest,
    ProcessCandidateCreateRequest,
    ProcessCandidateStatusUpdateRequest,
    ProcessCreateRequest,
    ProcessUpdateRequest,
    TalentBankUseRequest,
)


router = APIRouter(tags=["processes"], dependencies=[Depends(get_current_user)])


@router.get("/processes")
def get_processes(repository: DatabaseRepository = Depends(get_repository)):
    return repository.list_processes()


@router.post("/processes")
def create_process(
    payload: ProcessCreateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.create_process(payload.model_dump())


@router.put("/processes/{id_processo}")
def update_process(
    id_processo: str,
    payload: ProcessUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.update_process(id_processo, payload.model_dump())


@router.post("/processes/{id_processo}/close")
def close_process(
    id_processo: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.close_process(id_processo)


@router.get("/process-candidates")
def get_process_candidates(repository: DatabaseRepository = Depends(get_repository)):
    return repository.list_process_candidates()


@router.post("/process-candidates")
def create_process_candidate(
    payload: ProcessCandidateCreateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.create_process_candidate(payload.model_dump())


@router.put("/process-candidates/{id_registro}/status")
def update_process_candidate_status(
    id_registro: int,
    payload: ProcessCandidateStatusUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.update_process_candidate_status(id_registro, payload.model_dump())


@router.get("/talent-bank")
def get_talent_bank(
    search: str = Query(default=""),
    skill: str = Query(default=""),
    tag: str = Query(default=""),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_talent_bank(search=search, skill=skill, tag=tag)


@router.delete("/talent-bank/{id_banco}")
def delete_talent_bank_candidate(
    id_banco: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.delete_talent_bank_candidate(id_banco)


@router.post("/talent-bank/{id_banco}/use")
def use_talent_bank_candidate(
    id_banco: int,
    payload: TalentBankUseRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.use_talent_bank_candidate(id_banco, payload.model_dump())


@router.put("/candidate-profiles/{id_teste}")
def update_candidate_profile(
    id_teste: str,
    payload: CandidateProfileUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.upsert_candidate_profile(id_teste, payload.model_dump())


@router.get("/processes/{id_processo}/details")
def get_process_details(
    id_processo: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.get_process_details(id_processo)


@router.post("/processos/{id_processo}/gerar-link-candidatura")
def generate_public_application_link(
    id_processo: str,
    request: Request,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.generate_public_application_link(
        id_processo,
        referrer_url=request.headers.get("referer", ""),
        origin_url=request.headers.get("origin", ""),
    )


@router.patch("/processos/{id_processo}/link-candidatura/desativar")
def deactivate_public_application_link(
    id_processo: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.deactivate_public_application_link(id_processo)


@router.get("/candidate-profiles/{id_teste}/cv")
def download_candidate_cv(
    id_teste: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    asset = repository.get_candidate_cv_asset(id_teste)
    return FileResponse(
        asset["path"],
        media_type=asset["media_type"],
        filename=asset["filename"],
    )


@router.get("/processes/{id_processo}/cv-pre-analyses")
def list_cv_pre_analyses(
    id_processo: str,
    page: int = 1,
    page_size: int = 5,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_cv_pre_analyses(id_processo, page, page_size)


@router.post("/processes/{id_processo}/cv-pre-analyses")
async def create_cv_pre_analysis(
    id_processo: str,
    arquivo: UploadFile = File(...),
    guardar_cv_original: str = Form("0"),
    repository: DatabaseRepository = Depends(get_repository),
):
    return await repository.create_cv_pre_analysis(id_processo, arquivo, guardar_cv_original)


@router.put("/cv-pre-analyses/{id_pre_analise}")
def update_cv_pre_analysis(
    id_pre_analise: int,
    payload: CvPreAnalysisUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.update_cv_pre_analysis(id_pre_analise, payload.model_dump())


@router.delete("/cv-pre-analyses/{id_pre_analise}")
def delete_cv_pre_analysis(
    id_pre_analise: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.delete_cv_pre_analysis(id_pre_analise)


@router.post("/cv-pre-analyses/{id_pre_analise}/add-to-process")
def add_cv_pre_analysis_to_process(
    id_pre_analise: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.add_cv_pre_analysis_to_process(id_pre_analise)

```

## api\rh_api\routers\public_candidacy.py

`$lang
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from ..dependencies import get_repository
from ..repositories import DatabaseRepository


router = APIRouter(tags=["public-candidacy"])


@router.get("/public/candidatura/{slug}")
def get_public_application(
    slug: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.get_public_application(slug)


@router.post("/public/candidatura/{slug}/enviar")
async def submit_public_application(
    slug: str,
    nome_completo: str = Form(...),
    email: str = Form(...),
    telefone: str = Form(...),
    cidade: str = Form(...),
    bairro: str = Form(...),
    lgpd_aceito: str = Form(...),
    curriculo: UploadFile = File(...),
    repository: DatabaseRepository = Depends(get_repository),
):
    return await repository.submit_public_application(
        slug,
        nome_completo=nome_completo,
        email=email,
        telefone=telefone,
        cidade=cidade,
        bairro=bairro,
        lgpd_aceito=lgpd_aceito,
        curriculo=curriculo,
    )

```

## api\rh_api\services\public_candidacy.py

`$lang
from __future__ import annotations

import secrets
import unicodedata
import zipfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

from fastapi import HTTPException, status

from .helpers import normalize_text


PUBLIC_CANDIDACY_ROUTE = "candidatar"
PUBLIC_CV_MAX_BYTES = 5 * 1024 * 1024
PUBLIC_APPLICATION_ORIGIN = "Pagina de candidatura"
PUBLIC_APPLICATION_SUCCESS_MESSAGE = (
    "Candidatura enviada com sucesso. Recebemos suas informacoes e seu curriculo. "
    "O RH analisara seu perfil e podera entrar em contato pelo telefone ou e-mail informado."
)
PUBLIC_APPLICATION_DUPLICATE_MESSAGE = "Voce ja possui candidatura registrada para esta vaga."
PUBLIC_APPLICATION_CLOSED_MESSAGE = "Esta vaga esta encerrada e nao aceita novas candidaturas."

_ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
_PDF_MAGIC = b"%PDF"
_DOC_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_GENERIC_CONTENT_TYPES = {"application/octet-stream", "binary/octet-stream"}
_ALLOWED_CONTENT_TYPES = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword", "application/doc"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
    },
}
_MIME_BY_EXTENSION = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@dataclass(frozen=True)
class ValidatedPublicCvUpload:
    original_filename: str
    stored_filename: str
    extension: str
    mime_type: str
    size_bytes: int
    content_bytes: bytes


def slugify_public_text(value: str, *, fallback: str = "vaga", max_length: int = 48) -> str:
    normalized = unicodedata.normalize("NFD", normalize_text(value))
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    sanitized = []
    last_was_dash = False

    for char in without_marks.lower():
        if char.isalnum():
            sanitized.append(char)
            last_was_dash = False
            continue

        if sanitized and not last_was_dash:
            sanitized.append("-")
            last_was_dash = True

    slug = "".join(sanitized).strip("-")
    if not slug:
        slug = fallback
    if len(slug) > max_length:
        slug = slug[:max_length].rstrip("-")
    return slug or fallback


def generate_public_token(length: int = 8) -> str:
    token = secrets.token_urlsafe(length).lower()
    return "".join(char for char in token if char.isalnum())[: max(6, length)]


def build_public_process_slug(vaga: str, token: str) -> str:
    return f"{slugify_public_text(vaga)}-{normalize_text(token).lower()}"


def resolve_public_frontend_base_url(
    configured_base_url: str = "",
    *,
    referrer_url: str = "",
    origin_url: str = "",
) -> str:
    candidate = normalize_text(configured_base_url) or normalize_text(referrer_url) or normalize_text(origin_url)
    if not candidate:
        return "http://127.0.0.1:5500/Front/index.html"

    parts = urlsplit(candidate)
    path = parts.path or ""

    if not path or path == "/":
        path = "/Front/index.html"

    return urlunsplit((parts.scheme or "http", parts.netloc, path, parts.query, ""))


def build_public_application_url(base_url: str, slug: str) -> str:
    safe_slug = normalize_text(slug)
    if not safe_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slug publico da vaga nao informado.",
        )

    base = resolve_public_frontend_base_url(base_url)
    return f"{base}#/{PUBLIC_CANDIDACY_ROUTE}/{quote(safe_slug)}"


def resolve_public_process_description(processo: dict | None) -> str:
    safe_process = processo or {}
    descricao_publica = normalize_text(safe_process.get("descricao_publica"))
    if descricao_publica:
        return descricao_publica

    vaga = normalize_text(safe_process.get("vaga")) or "Vaga"
    operacao = normalize_text(safe_process.get("operacao"))
    trilha = normalize_text(safe_process.get("trilha"))

    partes = [f"Processo seletivo aberto para {vaga}."]
    if operacao:
        partes.append(f"Operacao: {operacao}.")
    if trilha:
        partes.append(f"Trilha: {trilha}.")
    partes.append("Preencha seus dados e envie o curriculo para avaliacao do RH.")
    return " ".join(partes)


def resolve_public_process_requirements(processo: dict | None) -> str:
    safe_process = processo or {}
    requisitos_publicos = normalize_text(safe_process.get("requisitos_publicos"))
    if requisitos_publicos:
        return requisitos_publicos

    vaga = normalize_text(safe_process.get("vaga"))
    if vaga:
        return f"Requisitos especificos desta vaga podem ser detalhados pelo RH durante as proximas etapas para {vaga}."
    return ""


def validate_public_cv_upload(
    filename: str,
    content_type: str,
    content_bytes: bytes,
) -> ValidatedPublicCvUpload:
    safe_name = normalize_text(filename)
    extension = Path(safe_name).suffix.lower()
    if extension not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envie um curriculo em PDF, DOC ou DOCX.",
        )

    safe_content = content_bytes or b""
    if not safe_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo do curriculo esta vazio.",
        )

    if len(safe_content) > PUBLIC_CV_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O curriculo excede o limite de 5 MB permitido.",
        )

    normalized_content_type = normalize_text(content_type).lower()
    allowed_content_types = _ALLOWED_CONTENT_TYPES.get(extension, set())
    if (
        normalized_content_type
        and normalized_content_type not in allowed_content_types
        and normalized_content_type not in _GENERIC_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O tipo do arquivo enviado nao corresponde a um curriculo valido.",
        )

    if extension == ".pdf":
        if not safe_content.startswith(_PDF_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O PDF enviado esta invalido ou corrompido.",
            )
    elif extension == ".doc":
        if not safe_content.startswith(_DOC_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo DOC enviado esta invalido ou corrompido.",
            )
    elif extension == ".docx":
        if not safe_content.startswith(b"PK"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo DOCX enviado esta invalido ou corrompido.",
            )
        try:
            with zipfile.ZipFile(BytesIO(safe_content)) as zip_file:
                if "word/document.xml" not in zip_file.namelist():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="O arquivo DOCX enviado nao possui a estrutura esperada.",
                    )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo DOCX enviado esta invalido ou corrompido.",
            ) from exc

    stored_filename = f"{slugify_public_text(Path(safe_name).stem, fallback='curriculo', max_length=28)}-{secrets.token_hex(10)}{extension}"
    return ValidatedPublicCvUpload(
        original_filename=safe_name,
        stored_filename=stored_filename,
        extension=extension,
        mime_type=_MIME_BY_EXTENSION[extension],
        size_bytes=len(safe_content),
        content_bytes=safe_content,
    )

```

## api\tests\test_public_candidacy.py

`$lang
from __future__ import annotations

import asyncio
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
from starlette.datastructures import UploadFile
from starlette.requests import Request

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.repositories.public_candidacy import PublicCandidacyRepositoryMixin
from rh_api.routers.processes import generate_public_application_link
from rh_api.routers.public_candidacy import get_public_application, submit_public_application
from rh_api.services.public_candidacy import (
    PUBLIC_APPLICATION_CLOSED_MESSAGE,
    build_public_application_url,
    resolve_public_frontend_base_url,
    validate_public_cv_upload,
)


class DummyPublicRepository(PublicCandidacyRepositoryMixin):
    def __init__(self):
        self.settings = SimpleNamespace(
            public_frontend_base_url="http://127.0.0.1:5500/Front/index.html",
            public_cv_upload_dir=str(API_DIR / "tmp-public-cv-tests"),
        )


class FakePublicRouterRepository:
    def __init__(self):
        self.generate_calls: list[dict] = []
        self.submit_calls: list[dict] = []

    def generate_public_application_link(self, id_processo: str, *, referrer_url: str = "", origin_url: str = ""):
        self.generate_calls.append(
            {
                "id_processo": id_processo,
                "referrer_url": referrer_url,
                "origin_url": origin_url,
            }
        )
        return {
            "success": True,
            "status": "Ativa",
            "slug": "vaga-operador-k7d92a9p",
            "url": "http://127.0.0.1:5500/Front/index.html#/candidatar/vaga-operador-k7d92a9p",
        }

    def get_public_application(self, slug: str):
        return {
            "slug": slug,
            "vaga": "Operador",
            "descricao_publica": "Descricao publica da vaga.",
            "requisitos_publicos": "Experiencia com atendimento.",
            "disponivel": True,
            "status": "Ativa",
            "mensagem": "",
        }

    async def submit_public_application(self, slug: str, **payload):
        self.submit_calls.append({"slug": slug, **payload})
        return {
            "success": True,
            "duplicate": False,
            "message": "ok",
        }


class PublicCandidacyTests(unittest.TestCase):
    def test_build_public_application_url_preserves_front_index_path(self):
        base_url = resolve_public_frontend_base_url(
            "",
            referrer_url="http://127.0.0.1:5500/Front/index.html#/detalhes-processo",
        )

        self.assertEqual(base_url, "http://127.0.0.1:5500/Front/index.html")
        self.assertEqual(
            build_public_application_url(base_url, "vaga-operador-k7d92a9p"),
            "http://127.0.0.1:5500/Front/index.html#/candidatar/vaga-operador-k7d92a9p",
        )

    def test_validate_public_cv_upload_accepts_pdf_and_sanitizes_storage_name(self):
        upload = validate_public_cv_upload(
            "Curriculo Ana Souza.pdf",
            "application/pdf",
            b"%PDF-1.7\nconteudo",
        )

        self.assertEqual(upload.extension, ".pdf")
        self.assertEqual(upload.mime_type, "application/pdf")
        self.assertNotEqual(upload.original_filename, upload.stored_filename)
        self.assertTrue(upload.stored_filename.endswith(".pdf"))

    def test_validate_public_cv_upload_rejects_invalid_extension(self):
        with self.assertRaises(HTTPException) as context:
            validate_public_cv_upload(
                "curriculo.png",
                "image/png",
                b"\x89PNG\r\n\x1a\n",
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("PDF, DOC ou DOCX", context.exception.detail)

    def test_validate_public_cv_upload_rejects_invalid_docx_structure(self):
        with self.assertRaises(HTTPException) as context:
            validate_public_cv_upload(
                "curriculo.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                b"PK\x03\x04arquivo-invalido",
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("DOCX", context.exception.detail)

    def test_public_process_payload_marks_closed_or_inactive_link(self):
        repository = DummyPublicRepository()
        payload = repository._build_public_process_payload(
            {
                "vaga": "Operador",
                "status": "Encerrado",
                "link_publico_ativo": 1,
                "descricao_publica": "",
                "requisitos_publicos": "",
                "link_publico_slug": "vaga-operador-k7d92a9p",
            }
        )

        self.assertFalse(payload["disponivel"])
        self.assertEqual(payload["status"], "Inativa")
        self.assertEqual(payload["mensagem"], PUBLIC_APPLICATION_CLOSED_MESSAGE)

    def test_generate_public_link_router_forwards_request_headers(self):
        repository = FakePublicRouterRepository()
        request = Request(
            {
                "type": "http",
                "method": "POST",
                "headers": [
                    (b"origin", b"http://127.0.0.1:5500"),
                    (b"referer", b"http://127.0.0.1:5500/Front/index.html#/detalhes-processo"),
                ],
            }
        )

        payload = generate_public_application_link(
            "PROC.OPR.001@@2026-04-27T10:00:00",
            request=request,
            repository=repository,
        )

        self.assertTrue(payload["success"])
        self.assertEqual(repository.generate_calls[0]["origin_url"], "http://127.0.0.1:5500")
        self.assertIn("detalhes-processo", repository.generate_calls[0]["referrer_url"])

    def test_public_submit_router_forwards_form_and_file_to_repository(self):
        repository = FakePublicRouterRepository()
        upload = UploadFile(
            file=io.BytesIO(b"%PDF-1.7\nconteudo"),
            filename="curriculo.pdf",
            headers={"content-type": "application/pdf"},
        )

        response = asyncio.run(
            submit_public_application(
                "vaga-operador-k7d92a9p",
                nome_completo="Ana Souza",
                email="ana@teste.com",
                telefone="21999999999",
                cidade="Rio de Janeiro",
                bairro="Centro",
                lgpd_aceito="1",
                curriculo=upload,
                repository=repository,
            )
        )

        self.assertTrue(response["success"])
        self.assertEqual(repository.submit_calls[0]["slug"], "vaga-operador-k7d92a9p")
        self.assertEqual(repository.submit_calls[0]["nome_completo"], "Ana Souza")
        self.assertEqual(repository.submit_calls[0]["curriculo"].filename, "curriculo.pdf")

    def test_public_get_router_returns_repository_payload(self):
        repository = FakePublicRouterRepository()

        payload = get_public_application(
            "vaga-operador-k7d92a9p",
            repository=repository,
        )

        self.assertEqual(payload["slug"], "vaga-operador-k7d92a9p")
        self.assertTrue(payload["disponivel"])


if __name__ == "__main__":
    unittest.main()

```

## Front\estilos\screens.css

`$lang
.rh-login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(340px, 0.78fr);
  gap: var(--space-5);
  padding: var(--space-5);
}

.rh-login-hero {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  padding: clamp(1.6rem, 3.4vw, 3rem);
  color: #fff;
  background:
    linear-gradient(145deg, rgba(18, 42, 79, 0.95), rgba(21, 61, 138, 0.92)),
    url('./Fundo-azul.png') center/cover;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.rh-login-hero-badge {
  align-self: flex-start;
  margin-bottom: auto;
  padding: 0.45rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rh-login-hero-title {
  max-width: 12ch;
  margin: 0 0 0.8rem;
  font-size: clamp(2rem, 4.2vw, 3.6rem);
  line-height: 1;
  font-weight: 700;
}

.rh-login-hero-text {
  max-width: 58ch;
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.55;
}

.rh-login-hero-points {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
}

.rh-login-hero-points span {
  padding: 0.42rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.82rem;
}

.rh-login-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1.2rem, 2.5vw, 2rem);
}

.rh-login-panel-modern {
  gap: 0.35rem;
}

.rh-login-brand-block {
  display: flex;
}

.rh-login-brand-block-centered {
  justify-content: center;
}

.rh-login-brand-image {
  width: 160px;
  margin: 0 auto 1.25rem;
}

.rh-login-copy-block {
  margin-bottom: 1.2rem;
  text-align: center;
}

.rh-login-welcome-title {
  margin: 0 0 0.4rem;
  font-size: 1.45rem;
  font-weight: 700;
}

.rh-login-welcome-text,
.rh-login-footer-meta {
  color: var(--color-text-soft);
}

.rh-login-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.rh-login-label {
  font-size: 0.84rem;
  font-weight: 700;
}

.rh-login-link-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 0.88rem;
}

.rh-login-input-wrap {
  position: relative;
}

.rh-login-input-modern,
.rh-flow-input {
  min-height: 46px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: #fff;
  padding: 0.72rem 0.9rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.rh-login-input-modern:disabled,
.rh-flow-input:disabled {
  background: #eef3f8;
  color: var(--color-text-muted);
}

.rh-login-input-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
}

.rh-login-input {
  padding-left: 2.7rem;
}

.rh-login-btn,
.rh-login-btn-modern {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    font-weight: 700;
    color: white;
}

.rh-login-help-row {
  display: flex;
  justify-content: center;
  margin-top: 0.75rem;
}

.rh-login-footer-meta {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
  font-size: 0.78rem;
}

.rh-public-application-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(320px, 0.82fr) minmax(0, 1.18fr);
  gap: var(--space-5);
  padding: var(--space-5);
  background:
    radial-gradient(circle at top right, rgba(21, 61, 138, 0.16), transparent 28%),
    linear-gradient(180deg, #f7f9fc 0%, var(--color-bg) 100%);
}

.rh-public-application-hero {
  border-radius: var(--radius-lg);
  padding: clamp(1.4rem, 3vw, 2.4rem);
  color: #fff;
  background:
    linear-gradient(145deg, rgba(18, 42, 79, 0.96), rgba(21, 61, 138, 0.94)),
    url('./Fundo-azul.png') center/cover;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.rh-public-application-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.rh-public-application-logo {
  width: 156px;
}

.rh-public-application-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.rh-public-application-title {
  margin: 0 0 0.8rem;
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1.02;
  font-weight: 700;
}

.rh-public-application-text {
  margin: 0;
  max-width: 52ch;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.6;
}

.rh-public-application-points {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.rh-public-application-points span {
  padding: 0.4rem 0.72rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.82rem;
}

.rh-public-application-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.rh-public-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.96);
  padding: clamp(1rem, 2vw, 1.35rem);
  box-shadow: var(--shadow-sm);
}

.rh-public-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.rh-public-card-title {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 700;
}

.rh-public-copy-stack {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.rh-public-copy-title {
  margin: 0 0 0.45rem;
  font-size: 0.95rem;
  font-weight: 700;
}

.rh-public-copy-text {
  margin: 0;
  color: var(--color-text-soft);
  line-height: 1.65;
}

.rh-public-copy-list {
  margin: 0;
  padding-left: 1.15rem;
  color: var(--color-text-soft);
  line-height: 1.65;
}

.rh-public-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rh-public-lgpd-check {
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-soft);
}

.rh-public-form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding-top: 0.9rem;
  border-top: 1px solid var(--color-border);
}

.rh-public-form-note {
  margin: 0;
  max-width: 52ch;
  color: var(--color-text-soft);
  font-size: 0.9rem;
  line-height: 1.55;
}

.rh-candidate-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: var(--space-4);
}

.rh-standalone-page {
  min-height: 100vh;
  display: grid;
  align-items: center;
  padding: clamp(1rem, 2vw, 1.5rem);
}


.rh-candidate-side-card,
.rh-candidate-main-card,
.rh-instruction-card,
.rh-result-note-card,
.rh-result-pending-card,
.rh-finish-info-card,
.rh-finish-access-card,
.rh-flow-preview {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.92);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
}

.rh-candidate-name-shell {
  position: relative;
}

.rh-candidate-name-shell .material-symbols-outlined {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-primary);
}

.rh-candidate-summary-card {
  margin-top: 1.1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.candidate-summary-list {
  margin: 0;
  padding-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.candidate-summary-list li {
  color: var(--color-text-soft);
}

.candidate-summary-list strong {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--color-text);
}

.rh-instruction-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.rh-candidate-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-top: var(--space-5);
}

.rh-candidate-disclaimer {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--color-text-soft);
}

.rh-flow-preview {
  display: flex;
  gap: 0.8rem;
}

.rh-flow-preview-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.exam-screen-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(0.9rem, 1.8vw, 1.25rem);
  background:
    radial-gradient(circle at top right, rgba(21, 61, 138, 0.12), transparent 28%),
    linear-gradient(180deg, #f7f9fc 0%, var(--color-bg) 100%);
}

.exam-screen-header,
.exam-question-card,
.rh-editor-card,
.exam-dynamic-area,
.exam-screen-footer {
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: var(--shadow-sm);
}

.exam-screen-header {
  padding: 1rem 1.1rem;
  border: 1px solid var(--color-border);
}

.exam-screen-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.exam-screen-brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.exam-screen-brand-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.exam-screen-logo {
    width: 63px;
    height: 56px;
    border-radius: 0px;
}

.exam-screen-caption {
  color: var(--color-text-muted);
  font-size: 0.88rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.exam-screen-candidate {
  margin-top: 0.2rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.exam-screen-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.exam-stage-badge {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.exam-timer-shell {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.95rem;
  border-radius: 999px;
  background: #0f2038;
  color: #fff;
  font-weight: 700;
}

.exam-progress-track {
  height: 10px;
  margin-top: 1rem;
  overflow: hidden;
  border-radius: 999px;
  background: #e3eaf5;
}

.exam-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-primary), #3f6dc0);
}

.exam-screen-content {
  display: grid;
  grid-template-columns: minmax(280px, 0.88fr) minmax(340px, 1.12fr);
  gap: clamp(0.9rem, 2vw, 1.35rem);
  align-items: stretch;
  margin-top: clamp(0.9rem, 2vw, 1.2rem);
  flex: 1;
}

.exam-question-card,
.exam-dynamic-area,
.exam-screen-footer {
  border: 1px solid var(--color-border);
  padding: clamp(1rem, 2vw, 1.25rem);
}

.exam-question-kicker {
  display: inline-flex;
  margin-bottom: 0.7rem;
  color: var(--color-primary);
  font-size: 0.84rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.exam-question-title {
  margin: 0 0 0.8rem;
  font-size: 1.6rem;
  font-weight: 700;
}

.exam-question-description {
  margin: 0;
  color: var(--color-text-soft);
  line-height: 1.7;
}

.rh-editor-toolbar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.rh-editor-toolbar-btn {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(17, 34, 59, 0.12);
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f8fbff;
  color: var(--color-text);
  transition:
    background 140ms ease,
    border-color 140ms ease,
    transform 140ms ease;
}

.rh-editor-toolbar-btn:hover {
  border-color: rgba(21, 61, 138, 0.3);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.rh-editor-toolbar-btn:active {
  transform: translateY(1px);
}

.rh-editor-toolbar-btn .material-symbols-outlined {
  font-size: 20px;
}

.rh-option-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.rh-option-card {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: #fff;
}

.rh-option-card.is-selected {
  border-color: rgba(21, 61, 138, 0.45);
  background: var(--color-primary-soft);
}

.rh-cutoff-toggle {
  position: relative;
  display: inline-flex;
  width: 58px;
  height: 32px;
}

.rh-cutoff-toggle input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.rh-cutoff-toggle-slider {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: #d7e1ef;
  box-shadow: inset 0 0 0 1px rgba(19, 34, 56, 0.08);
  transition: background 160ms ease;
}

.rh-cutoff-toggle-slider::after {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 6px 14px rgba(12, 31, 58, 0.18);
  transition: transform 160ms ease;
}

.rh-cutoff-toggle input:checked + .rh-cutoff-toggle-slider {
  background: linear-gradient(135deg, var(--color-primary) 0%, #2a63bf 100%);
}

.rh-cutoff-toggle input:checked + .rh-cutoff-toggle-slider::after {
  transform: translateX(26px);
}

.exam-option-letter {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--color-surface-strong);
  font-weight: 700;
}

.exam-option-text {
  color: var(--color-text-soft);
  line-height: 1.55;
}

.excel-card {
  padding: var(--space-5);
}

.excel-step {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-soft);
}

.excel-step h4 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 700;
}

.excel-upload-box {
  height: 100%;
  border: 2px dashed var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: #fbfcfe;
  padding: 1.25rem;
}

.exam-screen-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.9rem;
  margin-top: clamp(0.9rem, 1.8vw, 1.15rem);
}

.exam-screen-footer-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.exam-nav-btn {
  min-width: 150px;
  min-height: 46px;
}

.exam-nav-btn-primary {
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary) 0%, #275eb7 100%);
}

.exam-nav-btn-secondary {
  background: #eef3f9;
  color: var(--color-text);
}

.exam-nav-btn-danger {
  color: #fff;
  background: linear-gradient(135deg, var(--color-danger) 0%, #d85b6b 100%);
}

.rh-finish-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 2vw, 1.5rem);
}

.rh-finish-shell {
  width: min(980px, 100%);
  padding: clamp(1.5rem, 3vw, 2.5rem);
  text-align: center;
}

.rh-finish-badge {
  display: inline-flex;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  background: var(--color-success-soft);
  color: var(--color-success);
  font-weight: 700;
}

.rh-finish-icon-wrap {
  margin: 1.5rem auto 1rem;
}

.rh-finish-icon {
  width: 88px;
  height: 88px;
  border-radius: 28px;
  display: grid;
  place-items: center;
  margin: 0 auto;
  background: linear-gradient(135deg, var(--color-success) 0%, #2fa078 100%);
  color: #fff;
  font-weight: 700;
  font-size: 1.4rem;
}

.rh-finish-title {
  margin: 0;
  font-size: clamp(1.8rem, 3vw, 2.6rem);
}

.rh-finish-subtitle {
  max-width: 64ch;
  margin: 0.75rem auto 0;
  color: var(--color-text-soft);
  line-height: 1.7;
}

.rh-finish-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-6);
}

.rh-finish-info-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.94);
  padding: var(--space-5);
  text-align: left;
  box-shadow: var(--shadow-sm);
}

.rh-finish-info-card h3 {
  margin: 0 0 0.55rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.rh-finish-info-card p {
  margin: 0;
  color: var(--color-text-soft);
  line-height: 1.65;
}

.rh-finish-info-card-save,
.rh-finish-info-card.is-required {
  background: linear-gradient(180deg, #ffffff 0%, #f2f7ff 100%);
}

.rh-finish-info-card.is-soft {
  background: var(--color-surface-soft);
}

.rh-finish-info-icon {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  margin-bottom: 1rem;
}

.rh-finish-info-icon.is-blue {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.rh-finish-info-icon.is-gold {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.rh-finish-access-card {
  max-width: 520px;
  margin: var(--space-6) auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  padding: clamp(1.25rem, 2vw, 1.5rem);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 248, 255, 0.96) 100%);
  text-align: center;
}

.rh-finish-access-icon {
  width: 56px;
  height: 56px;
  margin: 0;
  border-radius: 20px;
  display: grid;
  place-items: center;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.rh-finish-access-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.rh-finish-access-text {
  max-width: 42ch;
  margin: 0;
  color: var(--color-text-soft);
  line-height: 1.6;
}

.rh-finish-access-btn {
  min-width: 180px;
  margin-top: 0.25rem;
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary) 0%, #2f67c0 100%);
  border-color: transparent;
}

.rh-finish-access-form {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.rh-finish-alert {
  max-width: 560px;
  margin-inline: auto;
  text-align: left;
}

.rh-pipeline-board-wrap {
  overflow-x: auto;
  padding-bottom: 0.35rem;
}

.rh-pipeline-board {
  display: grid;
  grid-template-columns: repeat(5, minmax(232px, 1fr));
  gap: var(--space-3);
  align-items: start;
  min-width: 1240px;
}

.rh-pipeline-column {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-sm);
  min-height: 390px;
  display: flex;
  flex-direction: column;
}

.rh-pipeline-column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0.9rem 0.8rem;
  border-bottom: 1px solid rgba(17, 34, 59, 0.08);
  font-weight: 700;
}

.rh-pipeline-column-body {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.85rem;
  min-height: 332px;
  max-height: 72vh;
  overflow-y: auto;
}

.rh-pipeline-card {
  border: 1px solid rgba(17, 34, 59, 0.08);
  border-radius: var(--radius-sm);
  background: #fff;
  padding: 0.8rem;
  box-shadow: 0 8px 20px rgba(17, 34, 59, 0.06);
  transition:
    box-shadow 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.rh-pipeline-card.is-focused {
  border-color: rgba(21, 61, 138, 0.45);
  box-shadow: 0 14px 28px rgba(21, 61, 138, 0.16);
}

.rh-pipeline-card.is-collapsed {
  padding-bottom: 0.7rem;
}

.rh-pipeline-card-top {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.rh-pipeline-card-headline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.rh-pipeline-card-headline strong {
  font-size: 0.96rem;
  line-height: 1.35;
}

.rh-pipeline-collapse-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(17, 34, 59, 0.1);
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f8fbff;
  color: var(--color-text-soft);
  flex-shrink: 0;
}

.rh-pipeline-collapse-btn .material-symbols-outlined {
  font-size: 18px;
}

.rh-pipeline-card-meta,
.rh-pipeline-card-details {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.55rem;
  color: var(--color-text-soft);
  font-size: 0.84rem;
}

.rh-pipeline-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.rh-pipeline-card-actions .btn:last-child {
  grid-column: 1 / -1;
}

.rh-pipeline-empty {
  padding: 0.95rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
  text-align: center;
}

.rh-result-screen {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: var(--space-5);
  min-height: 100vh;
  padding: var(--space-6);
}

.rh-result-sidebar,
.rh-result-content,
.rh-result-note-card,
.rh-result-pending-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: var(--shadow-sm);
}

.rh-result-sidebar {
  position: sticky;
  top: 1.5rem;
  height: fit-content;
  padding: var(--space-5);
}

.rh-result-sidebar-title {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.rh-result-sidebar-title strong {
  display: block;
}

.rh-result-sidebar-title span:last-child {
  color: var(--color-text-soft);
  font-size: 0.9rem;
}

.rh-result-nav {
  margin: var(--space-5) 0;
}

.rh-result-nav-btn {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-soft);
  padding: 0.85rem 1rem;
  text-align: left;
  font-weight: 700;
}

.rh-result-export-btn {
  width: 100%;
  color: #fff;
}

.rh-result-topnav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.rh-result-topnav-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.rh-result-topnav-links span {
  color: var(--color-primary);
  font-weight: 700;
}

.rh-result-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.rh-result-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.rh-result-subtitle {
  margin: 0.35rem 0 0;
  color: var(--color-text-soft);
}

.rh-result-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.95rem;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
}

.rh-result-summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.rh-result-candidate-card,
.rh-result-score-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-soft);
  padding: var(--space-5);
}

.rh-result-candidate-name {
  font-size: 1.5rem;
  font-weight: 700;
}

.rh-result-candidate-role {
  margin-top: 0.35rem;
  color: var(--color-text-soft);
}

.rh-result-candidate-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
}

.rh-result-score-label {
  color: var(--color-text-soft);
  font-weight: 700;
}

.rh-result-score-value {
  margin-top: 0.6rem;
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
}

.rh-result-body-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: var(--space-5);
}

.rh-result-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.rh-result-panel-head h3,
.rh-result-note-card h3,
.rh-result-pending-card h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.rh-stage-result-card strong {
  display: block;
  margin-top: 0.7rem;
}

.rh-stage-card-score,
.stage-card-score {
  margin-top: 0.75rem;
  font-size: 1.35rem;
  font-weight: 700;
}

.rh-result-side-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.rh-result-pending-list {
  color: var(--color-text-soft);
  line-height: 1.6;
}

.process-summary-value-text {
  word-break: break-word;
}

.rh-analysis-chart {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rh-analysis-chart-row {
  display: grid;
  grid-template-columns: minmax(160px, 220px) minmax(0, 1fr) 100px;
  gap: 1rem;
  align-items: center;
}

.rh-analysis-chart-bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rh-analysis-chart-bar-track {
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: #e6ecf6;
}

.rh-analysis-chart-bar {
  height: 100%;
  border-radius: inherit;
}

.rh-analysis-chart-bar.is-obtained {
  background: var(--color-primary);
}

.rh-analysis-chart-bar.is-expected {
  background: #e4a63c;
}

.rh-analysis-chart-label,
.rh-analysis-chart-value {
  font-size: 0.92rem;
  color: var(--color-text-soft);
}

.rh-detail-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  color: var(--color-text-soft);
}

@media (max-width: 1199.98px) {
  .rh-login-page,
  .rh-public-application-shell,
  .rh-result-screen,
  .rh-candidate-layout,
  .exam-screen-content,
  .rh-result-body-grid {
    grid-template-columns: 1fr;
  }

  .rh-result-sidebar {
    position: static;
  }
}

@media (max-width: 767.98px) {
  .rh-login-page,
  .rh-public-application-shell,
  .exam-screen-shell,
  .rh-result-screen {
    padding: 0.85rem;
  }

  .rh-login-page {
    gap: 1rem;
  }

  .rh-login-hero,
  .rh-public-application-hero,
  .rh-login-panel,
  .exam-screen-header,
  .exam-question-card,
  .exam-dynamic-area,
  .exam-screen-footer,
  .rh-result-sidebar,
  .rh-result-content,
  .rh-finish-shell {
    padding: 1rem;
  }

  .rh-login-hero-title {
    max-width: none;
  }

  .rh-public-card-header,
  .rh-public-form-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .rh-instruction-grid,
  .rh-finish-info-grid,
  .rh-result-summary-grid,
  .rh-analysis-chart-row,
  .rh-finish-access-form,
  .exam-screen-header-inner,
  .exam-screen-footer {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .rh-analysis-chart-row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .rh-result-topnav,
  .rh-result-header,
  .rh-result-panel-head {
    flex-direction: column;
    align-items: stretch;
  }
}


/* Ajustes de provas e instrucoes */
.rh-candidate-layout {
  align-items: stretch;
  max-width: 1240px;
  margin: 0 auto;
}

.rh-candidate-side-card,
.rh-candidate-main-card {
  min-height: min(82vh, 860px);
}

.rh-candidate-main-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.rh-instruction-grid {
  flex: 1;
  align-items: stretch;
}

.exam-screen-shell {
  width: min(1320px, 100%);
  margin: 0 auto;
}

.exam-question-card,
.exam-dynamic-area {
  min-height: 100%;
}

.exam-dynamic-area {
  display: flex;
  flex-direction: column;
  justify-content: stretch;
}

.rh-editor-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.rh-finish-shell {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: var(--shadow-md);
}

@media (max-width: 991px) {
  .rh-standalone-page {
    align-items: stretch;
  }

  .rh-candidate-side-card,
  .rh-candidate-main-card {
    min-height: auto;
  }
}

```

## Front\fonte\app\aplicacao-raiz.js

`$lang
import { html, useEffect } from '../infraestrutura-react.js';
import {
  navegarParaTela,
  usarTelaAtual,
  useControladorAplicacao,
} from './controlador-aplicacao.js';
import {
  TelaAnaliseCandidatos,
  TelaBancoTalentos,
  TelaCriarProcesso,
  TelaHistorico,
  TelaInicio,
  TelaLogin,
} from '../features/telas-gestao.js';
import {
  TelaDetalhesProcesso,
  TelaProcessos,
} from '../features/telas-processos.js';
import { TelaCandidatos } from '../features/candidatos/index.js';
import { TelaPipelineCandidatos } from '../features/tela-pipeline.js';
import { TelaEntrevistas } from '../features/tela-entrevistas.js';
import { TelaCandidaturaPublica } from '../features/public-candidacy/index.js';
import {
  TelaCandidato,
  TelaConfiguracao,
  TelaConclusao,
  TelaProva,
  TelaResultado,
} from '../features/telas-prova.js';

function resolverTelaProtegida(telaAtual, controlador) {
  const { estado, blueprint } = controlador;

  if (telaAtual === 'screen-public-candidacy') {
    return telaAtual;
  }

  if (!estado.autenticado) {
    return 'screen-login';
  }

  if (telaAtual === 'screen-login') {
    return 'screen-menu';
  }

  if (telaAtual === 'screen-candidate' && !blueprint) {
    return 'screen-config';
  }

  if (telaAtual === 'screen-exam' && !estado.questoes.length) {
    return estado.candidato.role ? 'screen-candidate' : 'screen-config';
  }

  if (
    (telaAtual === 'screen-thanks' || telaAtual === 'screen-result') &&
    !estado.provaFinalizada
  ) {
    if (estado.questoes.length) {
      return 'screen-exam';
    }
    return 'screen-menu';
  }

  return telaAtual;
}

export function Aplicacao() {
  const controlador = useControladorAplicacao();
  const telaAtual = usarTelaAtual(controlador.estado.autenticado);
  const telaResolvida = resolverTelaProtegida(telaAtual, controlador);

  useEffect(() => {
    if (telaResolvida !== telaAtual) {
      navegarParaTela(telaResolvida);
    }
  }, [telaAtual, telaResolvida]);

  if (telaResolvida === 'screen-public-candidacy') {
    return html`<${TelaCandidaturaPublica} />`;
  }

  if (controlador.estado.validandoSessao) {
    return html`
      <section class="active screen" id="screen-loading">
        <div class="container py-5">
          <div class="alert alert-secondary mb-0">
            Validando sessao do usuario...
          </div>
        </div>
      </section>
    `;
  }

  if (!controlador.estado.autenticado || telaResolvida === 'screen-login') {
    return html`<${TelaLogin} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-menu') {
    return html`<${TelaInicio} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-history') {
    return html`<${TelaHistorico} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-process-create') {
    return html`<${TelaCriarProcesso} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-processes') {
    return html`<${TelaProcessos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-candidates') {
    return html`<${TelaCandidatos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-candidate-pipeline') {
    return html`<${TelaPipelineCandidatos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-process-details') {
    return html`<${TelaDetalhesProcesso} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-interviews') {
    return html`<${TelaEntrevistas} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-talent-bank') {
    return html`<${TelaBancoTalentos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-analysis-candidates') {
    return html`<${TelaAnaliseCandidatos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-config') {
    return html`<${TelaConfiguracao} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-candidate') {
    return html`<${TelaCandidato} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-exam') {
    return html`<${TelaProva} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-thanks') {
    return html`<${TelaConclusao} controlador=${controlador} />`;
  }

  return html`<${TelaResultado} controlador=${controlador} />`;
}

```

## Front\fonte\app\controlador-aplicacao.js

`$lang
import { useEffect, useMemo, useState } from '../infraestrutura-react.js';
import { montarHashDaTela, obterTelaPorHash } from '../rotas.js';
import {
  baixarBlob,
  gerarIdResultado,
  sanitizarNomeArquivo,
} from '../utilitarios.js';
import {
  EVENTO_AUTENTICACAO_EXPIRADA,
  agendarEntrevista,
  adicionarPreAnaliseAoProcesso,
  atualizarEntrevista,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  analisarCvProcesso,
  baixarCvCandidato,
  criarCandidatoNoProcesso,
  criarCardPipeline,
  criarProcesso,
  desativarLinkPublicoCandidatura,
  encerrarSessaoApi,
  encerrarProcesso,
  excluirCardPipeline,
  excluirPreAnaliseCv,
  fazerLoginApi,
  gerarLinkPublicoCandidatura,
  invalidarCacheApi,
  lerAnalisesCandidatos,
  lerArquivosResposta,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerDetalheProcesso,
  lerEntrevistas,
  lerHistorico,
  lerHistoricoPaginado,
  lerPipelineCandidatos,
  lerSessaoAutenticacao,
  lerPreAnalisesCv,
  lerProcessos,
  moverCardPipeline,
  possuiSessaoAutenticada,
  removerBancoTalentos,
  salvarArquivoResposta,
  salvarHistorico,
  usarCandidatoDoBancoTalentos,
  verificarSessaoApi,
} from '../servico-api.js';
import { criarLogger } from '../logger.js';
import {
  montarProvaPorBlueprint,
  resolverBlueprintProva,
} from '../perguntas.js';
import {
  baixarPacoteDaProva,
  converterBase64ParaUint8Array,
  finalizarProva,
  montarResumoHistoricoDaProva,
  montarPayloadGabarito,
  montarResumoRegrasDoCandidato,
  validarEntregaObrigatoriaDaProva,
} from '../regras-prova.js';
import {
  CANDIDATE_STATUS_ANALYSIS,
  CANDIDATE_STATUS_ELIMINATED,
  CANDIDATE_STATUS_TALENT_BANK,
  canonicalizeCandidateStatus,
  getCandidateVisibleStatus,
} from '../shared/process-flow.js';
import { encontrarProcessoPorReferencia } from '../shared/process-reference.js';

const CHAVE_ESTADO = 'rh_react_state_v1';
export const TAMANHO_RECENTES = 6;
export const TAMANHO_HISTORICO = 10;
export const TAMANHO_ANALISE = 5;
export const TAMANHO_DETALHE_PROCESSO = 5;
const logger = criarLogger('controlador-aplicacao');

/**
 * @typedef {import('../types/models').ApplicationState} ApplicationState
 */

export function criarEstadoInicial() {
  const sessao = lerSessaoAutenticacao();
  const autenticado = Boolean(sessao.token);

  return {
    autenticado,
    validandoSessao: autenticado,
    usuarioAutenticado: sessao.usuario || '',
    barraLateralRecolhida: false,
    candidato: {
      id_processo: '',
      id_processo_ref: '',
      id_registro: '',
      id_entrevista: '',
      id_teste: '',
      role: '',
      level: '',
      track: '',
      time: 40,
      name: '',
    },
    processoSelecionado: '',
    questoes: [],
    indiceAtual: 0,
    respostas: [],
    timestampTermino: null,
    segundosRestantes: 0,
    provaFinalizada: false,
    resultados: [],
    totalScore: 0,
    totalMax: 0,
    notaFinalPonderada: 0,
    resumoEtapas: [],
    pendenciasManuais: [],
    idResultadoAtual: null,
    observacaoRh: '',
    statusFinalizacao: 'Finalizado',
    salvandoResultado: false,
    resultadoSalvo: false,
  };
}

export function hidratarEstado() {
  try {
    const bruto = sessionStorage.getItem(CHAVE_ESTADO);
    if (!bruto) {
      return criarEstadoInicial();
    }

    const salvo = JSON.parse(bruto);
    const estado = {
      ...criarEstadoInicial(),
      ...salvo,
      candidato: {
        ...criarEstadoInicial().candidato,
        ...(salvo?.candidato || {}),
      },
      autenticado: criarEstadoInicial().autenticado,
      validandoSessao: criarEstadoInicial().validandoSessao,
      usuarioAutenticado: criarEstadoInicial().usuarioAutenticado,
      salvandoResultado: false,
    };

    if (estado.timestampTermino) {
      estado.segundosRestantes = Math.max(
        0,
        Math.floor((Number(estado.timestampTermino) - Date.now()) / 1000),
      );
    }

    return estado;
  } catch (error) {
    logger.warn('Nao foi possivel restaurar o estado salvo.', error);
    return criarEstadoInicial();
  }
}

export function persistirEstado(estado) {
  try {
    const {
      autenticado: _autenticado,
      validandoSessao: _validandoSessao,
      usuarioAutenticado: _usuarioAutenticado,
      ...estadoPersistivel
    } = estado;

    sessionStorage.setItem(
      CHAVE_ESTADO,
      JSON.stringify({
        ...estadoPersistivel,
        salvandoResultado: false,
      }),
    );
  } catch (error) {
    logger.warn('Nao foi possivel persistir o estado da aplicacao.', error);
  }
}

export function limparEstadoPersistido() {
  try {
    sessionStorage.removeItem(CHAVE_ESTADO);
  } catch (error) {
    logger.warn('Nao foi possivel limpar o estado persistido.', error);
  }
}

export function navegarParaTela(tela) {
  window.location.hash = montarHashDaTela(tela);
}

export function usarTelaAtual(autenticado) {
  const [telaAtual, setTelaAtual] = useState(() =>
    obterTelaPorHash(window.location.hash),
  );

  useEffect(() => {
    if (!window.location.hash) {
      navegarParaTela(autenticado ? 'screen-menu' : 'screen-login');
    }
  }, [autenticado]);

  useEffect(() => {
    const handleHashChange = () =>
      setTelaAtual(obterTelaPorHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return telaAtual;
}

export function obterRegrasFormularioProcesso(vaga) {
  const vagaSegura = String(vaga || '').trim();

  if (vagaSegura === 'Operador' || vagaSegura === 'Supervisor') {
    return { exigeOperacao: true, exigeTrilha: false, trilhaFixa: '' };
  }

  if (vagaSegura === 'Control Desk') {
    return { exigeOperacao: false, exigeTrilha: false, trilhaFixa: '' };
  }

  if (vagaSegura === 'Estagiario' || vagaSegura === 'Estagiário') {
    return { exigeOperacao: false, exigeTrilha: true, trilhaFixa: '' };
  }

  if (vagaSegura === 'Analista' || vagaSegura === 'TI') {
    return { exigeOperacao: false, exigeTrilha: false, trilhaFixa: 'TI' };
  }

  if (vagaSegura === 'Jovem Aprendiz') {
    return { exigeOperacao: true, exigeTrilha: false, trilhaFixa: '' };
  }

  return { exigeOperacao: false, exigeTrilha: false, trilhaFixa: '' };
}

function obterAbreviacaoVaga(vaga) {
  const mapa = {
    'Jovem Aprendiz': 'JV.AP',
    Supervisor: 'SUP',
    Operador: 'OPR',
    Analista: 'ANL',
    Estagiario: 'ESTG',
    Estagiário: 'ESTG',
    Outros: 'OUT',
    'Control Desk': 'CTRL',
    Planejamento: 'PLAN',
    TI: 'TI',
  };

  return mapa[String(vaga || '').trim()] || 'OUT';
}

export function montarIdProcesso(vaga) {
  return `PROC.${obterAbreviacaoVaga(vaga)}`;
}

export function obterClasseSituacaoAtual(rotulo) {
  const normalizado = String(rotulo || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalizado.includes('APROVADO')) return 'is-finished';
  if (normalizado.includes('ELIMINADO')) return 'is-unsaved';
  return 'is-neutral';
}

export async function construirMapaStatusAtual() {
  const [candidatosProcesso, bancoTalentos] = await Promise.all([
    lerCandidatosProcessos().catch(() => []),
    lerBancoTalentos().catch(() => []),
  ]);

  const mapa = {};

  candidatosProcesso.forEach((candidato) => {
    const idTeste = String(candidato.id_teste || '').trim();
    if (!idTeste) return;

    const idProcesso = String(candidato.id_processo || '').trim();
    const idProcessoRef = String(
      candidato.id_processo_ref || candidato.id_processo || '',
    ).trim();
    const status = getCandidateVisibleStatus(candidato);
    mapa[idTeste] = {
      status,
      processId: idProcessoRef,
      label: idProcesso ? `${status} • ${idProcesso}` : status,
    };
  });

  bancoTalentos.forEach((candidato) => {
    const idTeste = String(candidato.id_teste || '').trim();
    if (!idTeste) return;

    const existente = mapa[idTeste];
    const statusExistente = canonicalizeCandidateStatus(existente?.status);

    if (
      !existente ||
      statusExistente === CANDIDATE_STATUS_ANALYSIS ||
      !statusExistente
    ) {
      const idProcesso = String(candidato.id_processo || '').trim();
      const idProcessoRef = String(
        candidato.id_processo_ref || candidato.id_processo || '',
      ).trim();
      mapa[idTeste] = {
        status: CANDIDATE_STATUS_TALENT_BANK,
        processId: idProcessoRef,
        label: idProcesso
          ? `${CANDIDATE_STATUS_TALENT_BANK} • ${idProcesso}`
          : CANDIDATE_STATUS_TALENT_BANK,
      };
    }
  });

  return mapa;
}

export function obterRotuloSituacaoAtual(linha, mapaStatus) {
  const idTeste = String(linha?.id_teste || '').trim();
  const idProcessoHistorico = String(linha?.id_processo || '').trim();
  const mapeado = mapaStatus?.[idTeste];

  if (mapeado?.label) return mapeado.label;
  if (idProcessoHistorico)
    return `${CANDIDATE_STATUS_ANALYSIS} • ${idProcessoHistorico}`;
  return 'Processo individual';
}

export function lerJsonSeguro(texto, fallback = null) {
  try {
    return JSON.parse(texto);
  } catch (error) {
    return fallback;
  }
}

export async function carregarDetalhesProva(idTeste) {
  const [historico, arquivos, mapaStatus] = await Promise.all([
    lerHistorico(),
    lerArquivosResposta().catch(() => ({})),
    construirMapaStatusAtual(),
  ]);

  const linha = (Array.isArray(historico) ? historico : []).find(
    (item) =>
      String(item.id_teste || '').trim() === String(idTeste || '').trim(),
  );

  if (!linha) {
    throw new Error('Prova nao encontrada.');
  }

  const arquivoSalvo = arquivos[idTeste];
  const payload = arquivoSalvo?.content
    ? lerJsonSeguro(arquivoSalvo.content, null)
    : null;
  const etapasHistorico = linha.etapas_json
    ? lerJsonSeguro(linha.etapas_json, [])
    : [];

  return {
    linha,
    payload,
    resumoEtapas: Array.isArray(payload?.stageSummary)
      ? payload.stageSummary
      : Array.isArray(etapasHistorico)
        ? etapasHistorico
        : [],
    situacaoAtual: obterRotuloSituacaoAtual(linha, mapaStatus),
  };
}

export async function baixarPacoteHistorico(
  idTeste,
  nomeCandidato = 'candidato',
) {
  if (!window.JSZip) {
    throw new Error('A biblioteca JSZip nao foi carregada.');
  }

  const arquivos = await lerArquivosResposta();
  const salvo = arquivos[idTeste];

  if (!salvo?.content) {
    throw new Error('Prova nao encontrada para este registro.');
  }

  const payload = lerJsonSeguro(salvo.content, null);
  const zip = new window.JSZip();
  const nomeBase = `${sanitizarNomeArquivo(nomeCandidato)}_${sanitizarNomeArquivo(idTeste)}`;
  zip.file(`gabarito_${nomeBase}.txt`, payload?.textContent || salvo.content);

  (payload?.uploadedFiles || []).forEach((arquivo) => {
    const bytes = converterBase64ParaUint8Array(arquivo.contentBase64);
    if (!bytes) return;

    zip.file(
      `excel_respondido_${sanitizarNomeArquivo(arquivo.filename || arquivo.taskId || 'anexo.xlsx')}`,
      bytes,
    );
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  baixarBlob(`prova_${nomeBase}.zip`, blob);
}

export function useControladorAplicacao() {
  const [estado, setEstado] = useState(() => hidratarEstado());
  const blueprint = useMemo(() => {
    if (!estado.candidato?.role || !estado.candidato?.level) {
      return null;
    }

    return resolverBlueprintProva(
      estado.candidato.role,
      estado.candidato.level,
      estado.candidato.track || '',
    );
  }, [estado.candidato]);

  useEffect(() => {
    persistirEstado(estado);
  }, [estado]);

  useEffect(() => {
    let ativo = true;

    const validarSessao = async () => {
      if (!possuiSessaoAutenticada()) {
        if (!ativo) return;

        setEstado((anterior) => ({
          ...anterior,
          autenticado: false,
          validandoSessao: false,
          usuarioAutenticado: '',
        }));
        return;
      }

      try {
        const sessao = await verificarSessaoApi();
        if (!ativo) return;

        setEstado((anterior) => ({
          ...anterior,
          autenticado: true,
          validandoSessao: false,
          usuarioAutenticado:
            sessao?.usuario || lerSessaoAutenticacao().usuario,
        }));
      } catch (error) {
        if (!ativo) return;

        limparEstadoPersistido();
        setEstado(criarEstadoInicial());
        navegarParaTela('screen-login');
      }
    };

    validarSessao();

    const aoExpirarSessao = () => {
      limparEstadoPersistido();
      setEstado(criarEstadoInicial());
      navegarParaTela('screen-login');
    };

    window.addEventListener(EVENTO_AUTENTICACAO_EXPIRADA, aoExpirarSessao);

    return () => {
      ativo = false;
      window.removeEventListener(EVENTO_AUTENTICACAO_EXPIRADA, aoExpirarSessao);
    };
  }, []);

  const telaAtual = usarTelaAtual(estado.autenticado);

  useEffect(() => {
    document.body.dataset.screen = telaAtual;
  }, [telaAtual]);

  useEffect(() => {
    if (
      !estado.timestampTermino ||
      estado.provaFinalizada ||
      !estado.questoes.length
    ) {
      return undefined;
    }

    const intervalo = window.setInterval(() => {
      setEstado((anterior) => {
        if (
          !anterior.timestampTermino ||
          anterior.provaFinalizada ||
          !anterior.questoes.length
        ) {
          return anterior;
        }

        const segundosRestantes = Math.max(
          0,
          Math.floor((Number(anterior.timestampTermino) - Date.now()) / 1000),
        );

        if (segundosRestantes <= 0) {
          const blueprintAtual = resolverBlueprintProva(
            anterior.candidato.role,
            anterior.candidato.level,
            anterior.candidato.track || '',
          );
          const resultadoFinal = finalizarProva({
            questoes: anterior.questoes,
            respostas: anterior.respostas,
            blueprint: blueprintAtual,
          });

          navegarParaTela('screen-thanks');

          return {
            ...anterior,
            segundosRestantes: 0,
            provaFinalizada: true,
            timestampTermino: null,
            statusFinalizacao: 'Encerrado automaticamente',
            resultados: resultadoFinal.resultados,
            totalScore: resultadoFinal.totalScore,
            totalMax: resultadoFinal.totalMax,
            notaFinalPonderada: resultadoFinal.notaFinalPonderada,
            resumoEtapas: resultadoFinal.resumoEtapas,
            pendenciasManuais: resultadoFinal.pendenciasManuais,
          };
        }

        return {
          ...anterior,
          segundosRestantes,
        };
      });
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, [estado.timestampTermino, estado.provaFinalizada, estado.questoes.length]);

  const atualizarEstado = (atualizador) => {
    setEstado((anterior) =>
      typeof atualizador === 'function' ? atualizador(anterior) : atualizador,
    );
  };

  const irParaTelaProtegida = (tela) => {
    if (!estado.autenticado && tela !== 'screen-login') {
      navegarParaTela('screen-login');
      return;
    }

    navegarParaTela(tela);
  };

  const irParaMenu = () => {
    if (!estado.autenticado) {
      navegarParaTela('screen-login');
      return;
    }

    navegarParaTela('screen-menu');
  };

  const alternarBarraLateral = () => {
    atualizarEstado((anterior) => ({
      ...anterior,
      barraLateralRecolhida: !anterior.barraLateralRecolhida,
    }));
  };

  const fazerLogin = async (usuario, senha) => {
    try {
      const sessao = await fazerLoginApi(usuario, senha);
      atualizarEstado((anterior) => ({
        ...anterior,
        autenticado: true,
        validandoSessao: false,
        usuarioAutenticado: sessao?.usuario || usuario,
      }));
      navegarParaTela('screen-menu');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        mensagem: error?.message || 'Usuario ou senha invalidos.',
      };
    }
  };

  const sair = () => {
    encerrarSessaoApi().catch(() => null);
    limparEstadoPersistido();
    setEstado((anterior) => ({
      ...criarEstadoInicial(),
      candidato: { ...criarEstadoInicial().candidato },
    }));
    navegarParaTela('screen-login');
  };

  const iniciarNovoFluxo = () => {
    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        id_processo: '',
        id_processo_ref: '',
        id_registro: '',
        id_entrevista: '',
        id_teste: '',
        role: '',
        level: '',
        track: '',
        time: 40,
        name: '',
      },
      processoSelecionado: '',
      questoes: [],
      indiceAtual: 0,
      respostas: [],
      timestampTermino: null,
      segundosRestantes: 0,
      provaFinalizada: false,
      resultados: [],
      totalScore: 0,
      totalMax: 0,
      notaFinalPonderada: 0,
      resumoEtapas: [],
      pendenciasManuais: [],
      idResultadoAtual: null,
      observacaoRh: '',
      statusFinalizacao: 'Finalizado',
      salvandoResultado: false,
      resultadoSalvo: false,
    }));

    navegarParaTela('screen-config');
  };

  const configurarFluxo = ({
    role,
    level,
    track,
    time,
    processId,
    scheduledCandidate = null,
  }) => {
    const resolvedProcessRef = processId === 'PROCESSO_UNICO' ? '' : processId;
    const resolvedProcessId = resolvedProcessRef
      ? String(resolvedProcessRef).split('@@', 1)[0]
      : '';

    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        id_processo: resolvedProcessId,
        id_processo_ref: resolvedProcessRef,
        id_registro: scheduledCandidate?.id_registro || '',
        id_entrevista: scheduledCandidate?.id_entrevista || '',
        id_teste: scheduledCandidate?.id_teste || '',
        role,
        level,
        time,
        track: track || 'automatico',
        name:
          scheduledCandidate?.nome_candidato || anterior.candidato.name || '',
      },
      processoSelecionado: resolvedProcessRef,
    }));

    navegarParaTela('screen-candidate');
  };

  const atualizarNomeCandidato = (name) => {
    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        name,
      },
    }));
  };

  const iniciarProva = (nomeCandidato) => {
    const nome = String(nomeCandidato || '').trim();
    if (!nome || !blueprint) {
      return {
        ok: false,
        mensagem: 'Informe o nome do candidato para iniciar a prova.',
      };
    }

    const questoes = montarProvaPorBlueprint(blueprint);
    const tempoMinutos = Number(estado.candidato.time || 40);
    const timestampTermino = Date.now() + tempoMinutos * 60 * 1000;

    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        name: nome,
      },
      questoes,
      respostas: new Array(questoes.length).fill(null),
      indiceAtual: 0,
      timestampTermino,
      segundosRestantes: tempoMinutos * 60,
      provaFinalizada: false,
      resultados: [],
      totalScore: 0,
      totalMax: 0,
      notaFinalPonderada: 0,
      resumoEtapas: [],
      pendenciasManuais: [],
      idResultadoAtual: null,
      observacaoRh: '',
      statusFinalizacao: 'Finalizado',
      resultadoSalvo: false,
    }));

    navegarParaTela('screen-exam');
    return { ok: true };
  };

  const atualizarResposta = (indice, resposta) => {
    atualizarEstado((anterior) => {
      const respostas = [...anterior.respostas];
      respostas[indice] = resposta;
      return {
        ...anterior,
        respostas,
      };
    });
  };

  const definirIndiceAtual = (indice) => {
    atualizarEstado((anterior) => ({
      ...anterior,
      indiceAtual: indice,
    }));
  };

  const encerrarProva = (statusFinalizacao = 'Finalizado') => {
    if (!blueprint) return;

    const validacaoFinalizacao = validarEntregaObrigatoriaDaProva({
      questoes: estado.questoes,
      respostas: estado.respostas,
    });
    if (!validacaoFinalizacao?.ok) {
      return validacaoFinalizacao;
    }

    const resultadoFinal = finalizarProva({
      questoes: estado.questoes,
      respostas: estado.respostas,
      blueprint,
    });

    atualizarEstado((anterior) => ({
      ...anterior,
      provaFinalizada: true,
      timestampTermino: null,
      segundosRestantes: 0,
      statusFinalizacao,
      resultados: resultadoFinal.resultados,
      totalScore: resultadoFinal.totalScore,
      totalMax: resultadoFinal.totalMax,
      notaFinalPonderada: resultadoFinal.notaFinalPonderada,
      resumoEtapas: resultadoFinal.resumoEtapas,
      pendenciasManuais: resultadoFinal.pendenciasManuais,
    }));

    navegarParaTela('screen-thanks');
    return { ok: true };
  };

  const atualizarObservacaoRh = (observacaoRh) => {
    atualizarEstado((anterior) => ({
      ...anterior,
      observacaoRh,
    }));
  };

  const salvarResultado = async () => {
    if (estado.salvandoResultado || estado.resultadoSalvo || !blueprint) {
      return null;
    }

    const validacaoFinalizacao = validarEntregaObrigatoriaDaProva({
      questoes: estado.questoes,
      respostas: estado.respostas,
    });
    if (!validacaoFinalizacao?.ok) {
      return validacaoFinalizacao;
    }

    atualizarEstado((anterior) => ({
      ...anterior,
      salvandoResultado: true,
    }));

    try {
      const idResultado =
        estado.idResultadoAtual ||
        estado.candidato.id_teste ||
        gerarIdResultado();
      const agora = new Date();
      const processoSelecionadoNormalizado =
        estado.processoSelecionado === 'PROCESSO_UNICO'
          ? ''
          : estado.processoSelecionado || '';

      const processoVinculado =
        estado.candidato.id_processo_ref ||
        processoSelecionadoNormalizado ||
        '';

      const processoVinculadoBaseBruto =
        estado.candidato.id_processo ||
        (processoVinculado ? String(processoVinculado).split('@@', 1)[0] : '');

      const processoVinculadoBase =
        processoVinculadoBaseBruto === 'PROCESSO_UNICO'
          ? ''
          : processoVinculadoBaseBruto;

      let statusInicialCandidato = CANDIDATE_STATUS_ANALYSIS;

      if (processoVinculado) {
        const processos = await lerProcessos();
        const processo =
          encontrarProcessoPorReferencia(processos, processoVinculado) ||
          processos.find(
            (item) =>
              String(item.id_processo || '').trim() ===
              String(processoVinculadoBase).trim(),
          );

        const usaNotaCorte = Number(processo?.usa_nota_corte || 0) === 1;
        const notaCorte = Number(processo?.nota_corte || 0);

        if (
          usaNotaCorte &&
          !Number.isNaN(notaCorte) &&
          Number(estado.notaFinalPonderada || 0) < notaCorte
        ) {
          statusInicialCandidato = CANDIDATE_STATUS_ELIMINATED;
        }
      }

      const payloadGabarito = montarPayloadGabarito({
        idResultado,
        candidato: estado.candidato,
        blueprint,
        resumoEtapas: estado.resumoEtapas,
        totalScore: estado.totalScore,
        totalMax: estado.totalMax,
        notaFinalPonderada: estado.notaFinalPonderada,
        observacaoRh: estado.observacaoRh,
        questoes: estado.questoes,
        respostas: estado.respostas,
        resultados: estado.resultados,
      });

      const linhaHistorico = {
        id_teste: idResultado,
        nome_candidato: estado.candidato.name,
        id_processo: processoVinculadoBase,
        id_processo_ref: processoVinculado,
        vaga: estado.candidato.role,
        nivel: estado.candidato.level,
        trilha: blueprint.label,
        pontuacao_final: estado.notaFinalPonderada.toFixed(1).replace('.', ','),
        pontuacao_bruta: `${estado.totalScore}/${estado.totalMax}`,
        arquivo_gabarito: montarResumoHistoricoDaProva({
          questoes: estado.questoes,
          respostas: estado.respostas,
          totalScore: estado.totalScore,
          totalMax: estado.totalMax,
        }),
        tempo_minutos: estado.candidato.time,
        data_iso: agora.toISOString(),
        data_exibicao: agora.toLocaleString('pt-BR'),
        status: estado.statusFinalizacao || 'Finalizado',
        etapas_json: JSON.stringify(estado.resumoEtapas || []),
      };

      await salvarHistorico(linhaHistorico);
      await salvarArquivoResposta({
        recordId: idResultado,
        payload: JSON.stringify(payloadGabarito),
      });
      if (processoVinculadoBase || processoVinculado) {
        await criarCandidatoNoProcesso({
          id_registro: estado.candidato.id_registro || null,
          id_entrevista: estado.candidato.id_entrevista || null,
          id_processo: processoVinculadoBase,
          id_processo_ref: processoVinculado,
          id_teste: idResultado,
          nome_candidato: estado.candidato.name,
          vaga: estado.candidato.role,
          status_candidato: statusInicialCandidato,
          pontuacao_final: estado.notaFinalPonderada
            .toFixed(1)
            .replace('.', ','),
          data_prova: agora.toISOString(),
          origem: 'Prova',
        });
      }

      atualizarEstado((anterior) => ({
        ...anterior,
        idResultadoAtual: idResultado,
        salvandoResultado: false,
        resultadoSalvo: true,
        candidato: {
          ...anterior.candidato,
          id_teste: idResultado,
        },
      }));

      invalidarCacheApi(
        'historico',
        'gabaritos',
        'candidatos-processos',
        'pipeline-candidatos',
      );
      return { ok: true };
    } catch (error) {
      atualizarEstado((anterior) => ({
        ...anterior,
        salvandoResultado: false,
      }));
      return {
        ok: false,
        mensagem:
          error?.message ||
          'Nao foi possivel salvar a prova no servidor. Verifique a API e tente novamente.',
      };
    }
  };

  const baixarPacoteAtual = async () =>
    baixarPacoteDaProva({
      candidato: estado.candidato,
      questoes: estado.questoes,
      respostas: estado.respostas,
      resultados: estado.resultados,
      notaFinalPonderada: estado.notaFinalPonderada,
      observacaoRh: estado.observacaoRh,
    });

  return {
    estado,
    blueprint,
    regrasCandidato: montarResumoRegrasDoCandidato(blueprint, estado.candidato),
    fazerLogin,
    sair,
    alternarBarraLateral,
    irParaMenu,
    irParaTelaProtegida,
    iniciarNovoFluxo,
    configurarFluxo,
    atualizarNomeCandidato,
    iniciarProva,
    atualizarResposta,
    definirIndiceAtual,
    encerrarProva,
    atualizarObservacaoRh,
    salvarResultado,
    baixarPacoteAtual,
  };
}

export {
  agendarEntrevista,
  adicionarPreAnaliseAoProcesso,
  atualizarEntrevista,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  analisarCvProcesso,
  baixarCvCandidato,
  criarCardPipeline,
  criarProcesso,
  desativarLinkPublicoCandidatura,
  encerrarProcesso,
  excluirCardPipeline,
  excluirPreAnaliseCv,
  gerarLinkPublicoCandidatura,
  lerAnalisesCandidatos,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerDetalheProcesso,
  lerEntrevistas,
  lerHistorico,
  lerHistoricoPaginado,
  lerPipelineCandidatos,
  lerPreAnalisesCv,
  lerProcessos,
  moverCardPipeline,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
};

```

## Front\fonte\features\candidatos\index.js

`$lang
import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  atualizarStatusCandidato,
  baixarCvCandidato,
  criarCandidatoNoProcesso,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerHistorico,
  lerProcessos,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
} from '../../servico-api.js';
import { baixarBlob } from '../../utilitarios.js';
import {
  EmptyState,
  MetricGrid,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  CANDIDATE_STATUS_ANALYSIS,
  CANDIDATE_STATUS_APPROVED,
  CANDIDATE_STATUS_ELIMINATED,
  CANDIDATE_STATUS_TALENT_BANK,
  getCandidateVisibleStatus,
} from '../../shared/process-flow.js';
import { abrirBlobEmNovaGuia } from '../../shared/browser-utils.js';
import {
  formatarDataHora,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { obterReferenciaProcesso } from '../../shared/process-reference.js';

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function montarChaveCandidato(item) {
  const idTeste = String(item?.id_teste || '').trim();
  const nome = normalizarTexto(item?.nome_candidato || item?.nome || '');
  const processo = String(
    item?.id_processo_ref || item?.id_processo || '',
  ).trim();

  if (idTeste) return `teste:${idTeste}`;
  return `nome:${nome}:processo:${processo}`;
}

function obterNotaCandidato(item) {
  return (
    item?.pontuacao_final ||
    item?.nota_final ||
    item?.score_final ||
    item?.pontuacao ||
    '-'
  );
}

function obterContatoPrincipal(item) {
  return item?.email || item?.telefone || item?.whatsapp || '';
}

function obterClassificacaoCandidato(item) {
  return item?.classificacao || item?.classificacao_slug || '';
}

function obterDataCandidato(item) {
  return (
    item?.data_movimentacao ||
    item?.data_prova ||
    item?.data_iso ||
    item?.created_at ||
    item?.data_criacao ||
    ''
  );
}

function resolverRotuloOrigem(item, fallback) {
  return item?.origem || fallback;
}

function montarCandidatoDeProcesso(item, processosPorReferencia) {
  const processoReferencia = String(
    item.id_processo_ref || item.id_processo || '',
  ).trim();
  const processo =
    processosPorReferencia.get(processoReferencia) ||
    processosPorReferencia.get(String(item.id_processo || '').trim()) ||
    null;

  return {
    ...item,
    origem_cadastro: 'processo',
    origem_rotulo: resolverRotuloOrigem(item, 'Processo seletivo'),
    chave: montarChaveCandidato(item),
    nome_candidato: item.nome_candidato || '-',
    status_visivel: getCandidateVisibleStatus(item),
    id_processo_ref: processoReferencia,
    processo_nome: processo?.id_processo || item.id_processo || '-',
    vaga: item.vaga || processo?.vaga || '-',
    nota_exibicao: obterNotaCandidato(item),
    classificacao_exibicao: obterClassificacaoCandidato(item),
    data_exibicao: obterDataCandidato(item),
    email: item.email || '',
    telefone: item.telefone || '',
    whatsapp: item.whatsapp || '',
    cidade: item.cidade || '',
    bairro: item.bairro || '',
    cv_disponivel: !!item.cv_disponivel,
    cv_nome_arquivo: item.cv_nome_arquivo || '',
    contato_principal: obterContatoPrincipal(item),
    pode_movimentar: true,
    pode_atrelar: true,
    id_registro_processo: item.id_registro,
  };
}

function montarCandidatoDoBanco(item) {
  return {
    ...item,
    origem_cadastro: 'banco',
    origem_rotulo: resolverRotuloOrigem(item, 'Banco de talentos'),
    chave: montarChaveCandidato(item),
    nome_candidato: item.nome_candidato || '-',
    status_visivel: CANDIDATE_STATUS_TALENT_BANK,
    id_processo_ref: item.id_processo_ref || item.id_processo || '',
    processo_nome: item.id_processo || '-',
    vaga: item.vaga || '-',
    nota_exibicao: obterNotaCandidato(item),
    classificacao_exibicao: obterClassificacaoCandidato(item),
    data_exibicao: obterDataCandidato(item),
    email: item.email || '',
    telefone: item.telefone || '',
    whatsapp: item.whatsapp || '',
    cidade: item.cidade || '',
    bairro: item.bairro || '',
    cv_disponivel: !!item.cv_disponivel,
    cv_nome_arquivo: item.cv_nome_arquivo || '',
    contato_principal: obterContatoPrincipal(item),
    pode_movimentar: false,
    pode_atrelar: true,
    id_banco: item.id_banco,
  };
}

function montarCandidatoDoHistorico(item) {
  return {
    ...item,
    origem_cadastro: 'historico',
    origem_rotulo: resolverRotuloOrigem(item, 'Historico de prova'),
    chave: montarChaveCandidato(item),
    nome_candidato: item.nome_candidato || '-',
    status_visivel: item.id_processo ? 'Em processo' : 'Sem processo vinculado',
    id_processo_ref: item.id_processo_ref || item.id_processo || '',
    processo_nome: item.id_processo || '-',
    vaga: item.vaga || '-',
    nota_exibicao: obterNotaCandidato(item),
    classificacao_exibicao: obterClassificacaoCandidato(item),
    data_exibicao: obterDataCandidato(item),
    email: item.email || '',
    telefone: item.telefone || '',
    whatsapp: item.whatsapp || '',
    cidade: item.cidade || '',
    bairro: item.bairro || '',
    cv_disponivel: !!item.cv_disponivel,
    cv_nome_arquivo: item.cv_nome_arquivo || '',
    contato_principal: obterContatoPrincipal(item),
    pode_movimentar: false,
    pode_atrelar: true,
  };
}

function resumirStatus(candidatos) {
  const resumo = {
    total: candidatos.length,
    aprovados: 0,
    eliminados: 0,
    analise: 0,
    processo: 0,
    banco: 0,
  };

  candidatos.forEach((candidato) => {
    const status = normalizarTexto(candidato.status_visivel);

    if (status.includes('aprovado')) {
      resumo.aprovados += 1;
    } else if (status.includes('eliminado') || status.includes('reprovado')) {
      resumo.eliminados += 1;
    } else if (status.includes('banco')) {
      resumo.banco += 1;
    } else if (
      candidato.origem_cadastro === 'processo' ||
      status.includes('processo') ||
      status.includes('agendado') ||
      status.includes('confirmado') ||
      status.includes('compareceu')
    ) {
      resumo.processo += 1;
    } else {
      resumo.analise += 1;
    }
  });

  return resumo;
}

function SelectProcesso({ processos, valor, onChange, disabled = false }) {
  return html`
    <select
      class="form-select"
      value=${valor}
      disabled=${disabled}
      onChange=${(event) => onChange(event.target.value)}
    >
      <option value="">Selecione um processo aberto</option>
      ${processos.map((processo) => {
        const referencia = obterReferenciaProcesso(processo);
        const rotulo = [
          processo.id_processo || 'Processo',
          processo.vaga ? `| ${processo.vaga}` : '',
          processo.operacao ? `| ${processo.operacao}` : '',
        ]
          .filter(Boolean)
          .join(' ');

        return html`
          <option key=${referencia} value=${referencia}>${rotulo}</option>
        `;
      })}
    </select>
  `;
}

export function TelaCandidatos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [candidatos, setCandidatos] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [filtros, setFiltros] = useState({
    busca: '',
    status: '',
    origem: '',
  });
  const [detalhe, setDetalhe] = useState(null);
  const [candidatoParaAtrelar, setCandidatoParaAtrelar] = useState(null);
  const [processoSelecionado, setProcessoSelecionado] = useState('');

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      window.alert('Nao ha curriculo disponivel para este candidato.');
      return;
    }

    try {
      const arquivo = await baixarCvCandidato(candidato.id_teste);
      const tipo = String(arquivo?.contentType || '').toLowerCase();
      if (tipo.includes('pdf')) {
        abrirBlobEmNovaGuia(arquivo.blob);
        return;
      }

      baixarBlob(arquivo.filename || 'curriculo', arquivo.blob);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel abrir o curriculo do candidato.',
      );
    }
  };

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const resultados = await Promise.allSettled([
        lerHistorico(),
        lerCandidatosProcessos(true),
        lerBancoTalentos({ forcar: true }),
        lerProcessos(true),
      ]);

      const historico =
        resultados[0].status === 'fulfilled' && Array.isArray(resultados[0].value)
          ? resultados[0].value
          : [];
      const candidatosProcessos =
        resultados[1].status === 'fulfilled' && Array.isArray(resultados[1].value)
          ? resultados[1].value
          : [];
      const bancoTalentos =
        resultados[2].status === 'fulfilled' && Array.isArray(resultados[2].value)
          ? resultados[2].value
          : [];
      const processos =
        resultados[3].status === 'fulfilled' && Array.isArray(resultados[3].value)
          ? resultados[3].value
          : [];

      const falhas = resultados
        .filter((item) => item.status === 'rejected')
        .map((item) => item.reason);

      if (
        falhas.length &&
        !historico.length &&
        !candidatosProcessos.length &&
        !bancoTalentos.length &&
        !processos.length
      ) {
        setErro(
          falhas[0]?.message ||
            'Nao foi possivel carregar a pagina de candidatos.',
        );
      }

      const processosPorReferencia = new Map();
      processos.forEach((processo) => {
        const referencia = obterReferenciaProcesso(processo);
        if (referencia) processosPorReferencia.set(referencia, processo);
        if (processo.id_processo) {
          processosPorReferencia.set(String(processo.id_processo), processo);
        }
      });

      const abertos = processos.filter(
        (processo) => String(processo.status || '').trim() !== 'Encerrado',
      );

      const mapa = new Map();

      historico.forEach((item) => {
        const candidato = montarCandidatoDoHistorico(item);
        mapa.set(candidato.chave, candidato);
      });

      bancoTalentos.forEach((item) => {
        const candidato = montarCandidatoDoBanco(item);
        mapa.set(candidato.chave, candidato);
      });

      candidatosProcessos.forEach((item) => {
        const candidato = montarCandidatoDeProcesso(
          item,
          processosPorReferencia,
        );
        mapa.set(candidato.chave, candidato);
      });

      const lista = Array.from(mapa.values()).sort((a, b) =>
        String(b.data_exibicao || '').localeCompare(
          String(a.data_exibicao || ''),
        ),
      );

      setCandidatos(lista);
      setProcessosAbertos(abertos);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel carregar a pagina de candidatos.',
      );
      setCandidatos([]);
      setProcessosAbertos([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const candidatosFiltrados = useMemo(() => {
    const busca = normalizarTexto(filtros.busca);
    const statusFiltro = normalizarTexto(filtros.status);
    const origemFiltro = normalizarTexto(filtros.origem);

    return candidatos.filter((candidato) => {
      const textoBusca = normalizarTexto(
        [
          candidato.nome_candidato,
          candidato.email,
          candidato.telefone,
          candidato.whatsapp,
          candidato.vaga,
          candidato.processo_nome,
          candidato.id_processo,
          candidato.id_teste,
          candidato.status_visivel,
          candidato.origem_rotulo,
          candidato.classificacao_exibicao,
          candidato.cidade,
          candidato.bairro,
        ].join(' '),
      );

      const status = normalizarTexto(candidato.status_visivel);
      const origem = normalizarTexto(candidato.origem_cadastro);

      const bateBusca = !busca || textoBusca.includes(busca);
      const bateStatus = !statusFiltro || status.includes(statusFiltro);
      const bateOrigem = !origemFiltro || origem === origemFiltro;

      return bateBusca && bateStatus && bateOrigem;
    });
  }, [candidatos, filtros]);

  const resumo = useMemo(
    () => resumirStatus(candidatosFiltrados),
    [candidatosFiltrados],
  );

  const aplicarStatus = async (candidato, status) => {
    if (!candidato) return;

    if (candidato.origem_cadastro === 'banco') {
      if (status === CANDIDATE_STATUS_ELIMINATED) {
        const confirmar = window.confirm(
          `Deseja remover ${candidato.nome_candidato} do banco de talentos?`,
        );
        if (!confirmar) return;

        setSalvando(true);
        setErro('');

        try {
          await removerBancoTalentos(candidato.id_banco);
          setDetalhe(null);
          await carregar();
        } catch (error) {
          setErro(
            error?.message ||
              'Nao foi possivel remover o candidato do banco de talentos.',
          );
        } finally {
          setSalvando(false);
        }

        return;
      }

      window.alert(
        'Este candidato esta no banco de talentos. Para aprovar, primeiro atrele-o a um processo seletivo.',
      );
      return;
    }

    if (!candidato.id_registro_processo) {
      window.alert(
        'Este candidato ainda nao possui vinculo operacional com um processo. Atrele-o a um processo antes de aprovar ou eliminar.',
      );
      return;
    }

    const confirmar = window.confirm(
      `Deseja alterar o status de ${candidato.nome_candidato} para "${status}"?`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      await atualizarStatusCandidato(candidato.id_registro_processo, {
        status_candidato: status,
        data_movimentacao: new Date().toISOString(),
      });

      setDetalhe(null);
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel atualizar o status do candidato.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const enviarParaBanco = async (candidato) => {
    if (!candidato || candidato.origem_cadastro !== 'processo') {
      window.alert(
        'Somente candidatos vinculados a um processo podem ser enviados ao banco de talentos.',
      );
      return;
    }

    await aplicarStatus(candidato, CANDIDATE_STATUS_TALENT_BANK);
  };

  const abrirAtrelar = (candidato) => {
    setCandidatoParaAtrelar(candidato);
    setProcessoSelecionado('');
  };

  const candidatoJaVinculadoAoProcessoSelecionado = () => {
    if (!candidatoParaAtrelar || !processoSelecionado) {
      return false;
    }

    if (
      String(candidatoParaAtrelar.id_processo_ref || '').trim() ===
        String(processoSelecionado || '').trim() &&
      candidatoParaAtrelar.origem_cadastro === 'processo'
    ) {
      return true;
    }

    const idTeste = String(candidatoParaAtrelar.id_teste || '').trim();
    if (!idTeste) {
      return false;
    }

    return candidatos.some(
      (item) =>
        item.origem_cadastro === 'processo' &&
        String(item.id_teste || '').trim() === idTeste &&
        String(item.id_processo_ref || '').trim() ===
          String(processoSelecionado || '').trim(),
    );
  };

  const confirmarAtrelar = async () => {
    if (!candidatoParaAtrelar || !processoSelecionado) {
      window.alert('Selecione um processo seletivo aberto.');
      return;
    }

    const processo = processosAbertos.find(
      (item) => obterReferenciaProcesso(item) === processoSelecionado,
    );
    if (!processo) {
      window.alert('Processo selecionado nao encontrado.');
      return;
    }

    if (candidatoJaVinculadoAoProcessoSelecionado()) {
      window.alert('Este candidato ja esta vinculado ao processo selecionado.');
      return;
    }

    const confirmar = window.confirm(
      `Deseja atrelar ${candidatoParaAtrelar.nome_candidato} ao processo ${processo.id_processo || 'selecionado'}?`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      if (candidatoParaAtrelar.origem_cadastro === 'banco') {
        await usarCandidatoDoBancoTalentos(candidatoParaAtrelar.id_banco, {
          id_processo: processo.id_processo || '',
          id_processo_ref: processoSelecionado,
        });
      } else {
        await criarCandidatoNoProcesso({
          id_processo: processo.id_processo || '',
          id_processo_ref: processoSelecionado,
          id_teste: candidatoParaAtrelar.id_teste || '',
          nome_candidato: candidatoParaAtrelar.nome_candidato || '',
          vaga: candidatoParaAtrelar.vaga || processo.vaga || '',
          status_candidato: CANDIDATE_STATUS_ANALYSIS,
          pontuacao_final:
            candidatoParaAtrelar.pontuacao_final ||
            candidatoParaAtrelar.nota_final ||
            '',
          data_prova:
            candidatoParaAtrelar.data_prova ||
            candidatoParaAtrelar.data_iso ||
            new Date().toISOString(),
          origem:
            candidatoParaAtrelar.origem_cadastro === 'historico'
              ? 'Historico'
              : 'Candidatos',
        });
      }

      setCandidatoParaAtrelar(null);
      setProcessoSelecionado('');
      setDetalhe(null);
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel atrelar o candidato ao processo.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-candidates"
      navAtiva="screen-candidates"
      subtituloMarca="Candidatos"
      placeholderBusca="Gestao centralizada de candidatos"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console | Candidatos"
        title="Central de candidatos"
        description="Atalho operacional para consultar candidatos, ver detalhes e executar acoes principais sem remover as funcoes existentes das outras telas."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Resumo geral"
        description="Visao consolidada dos candidatos encontrados no historico, processos seletivos e banco de talentos."
      >
        <${MetricGrid}
          items=${[
            { label: 'Total filtrado', value: resumo.total },
            { label: 'Aprovados', value: resumo.aprovados },
            { label: 'Eliminados', value: resumo.eliminados },
            { label: 'Em analise', value: resumo.analise },
            { label: 'Em processo', value: resumo.processo },
            { label: 'Banco de talentos', value: resumo.banco },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Filtros"
        description="Filtre a lista geral por nome, vaga, processo, status ou origem."
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Busca geral</label>
            <input
              class="form-control"
              placeholder="Nome, email, vaga, processo, status..."
              value=${filtros.busca}
              onInput=${(event) =>
                setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>

          <div class="rh-filter-field">
            <label>Status</label>
            <select
              class="form-select"
              value=${filtros.status}
              onChange=${(event) =>
                setFiltros({ ...filtros, status: event.target.value })}
            >
              <option value="">Todos</option>
              <option value="aprovado">Aprovados</option>
              <option value="eliminado">Eliminados</option>
              <option value="analise">Em analise</option>
              <option value="processo">Em processo</option>
              <option value="banco">Banco de talentos</option>
            </select>
          </div>

          <div class="rh-filter-field">
            <label>Origem</label>
            <select
              class="form-select"
              value=${filtros.origem}
              onChange=${(event) =>
                setFiltros({ ...filtros, origem: event.target.value })}
            >
              <option value="">Todas</option>
              <option value="processo">Processo seletivo</option>
              <option value="banco">Banco de talentos</option>
              <option value="historico">Historico de prova</option>
            </select>
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Lista geral de candidatos"
        description="As acoes desta tela sao atalhos. As telas antigas continuam funcionando normalmente."
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-primary"
            disabled=${carregando || salvando}
            onClick=${carregar}
          >
            Atualizar
          </button>
        `}
      >
        ${carregando
          ? html`
              <${EmptyState}
                title="Carregando candidatos"
                text="Aguarde enquanto o sistema consolida as informacoes."
              />
            `
          : html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Candidato</th>
                      <th>Contato</th>
                      <th>Cidade</th>
                      <th>Bairro</th>
                      <th>Vaga</th>
                      <th>Processo</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th>Origem</th>
                      <th>Data</th>
                      <th>CV</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${candidatosFiltrados.length
                      ? candidatosFiltrados.map(
                          (candidato) => html`
                            <tr key=${candidato.chave}>
                              <td>
                                <strong>${candidato.nome_candidato || '-'}</strong>
                                <div class="text-muted small">
                                  ${candidato.id_teste || '-'}
                                </div>
                              </td>
                              <td>
                                <div>${candidato.email || '-'}</div>
                                <div class="text-muted small">
                                  ${candidato.telefone || candidato.whatsapp || '-'}
                                </div>
                              </td>
                              <td>${candidato.cidade || '-'}</td>
                              <td>${candidato.bairro || '-'}</td>
                              <td>${candidato.vaga || '-'}</td>
                              <td>
                                <div>${candidato.processo_nome || '-'}</div>
                                <div class="text-muted small">
                                  ${candidato.id_processo_ref || candidato.id_processo || '-'}
                                </div>
                              </td>
                              <td>
                                <div>${candidato.nota_exibicao || '-'}</div>
                                <div class="text-muted small">
                                  ${candidato.classificacao_exibicao || '-'}
                                </div>
                              </td>
                              <td>
                                <span
                                  class=${`rh-status-pill ${obterClasseStatusEntrevista(
                                    candidato.status_visivel,
                                  )}`}
                                >
                                  ${candidato.status_visivel || '-'}
                                </span>
                              </td>
                              <td>${candidato.origem_rotulo || '-'}</td>
                              <td>${formatarDataHora(candidato.data_exibicao)}</td>
                              <td>
                                ${candidato.cv_disponivel
                                  ? html`
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary"
                                        onClick=${() => abrirCurriculo(candidato)}
                                      >
                                        Ver CV
                                      </button>
                                    `
                                  : 'Sem CV'}
                              </td>
                              <td class="text-end">
                                <div class="btn-group btn-group-sm">
                                  <button
                                    type="button"
                                    class="btn btn-outline-primary"
                                    title="Ver detalhes"
                                    onClick=${() => setDetalhe(candidato)}
                                  >
                                    Detalhes
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-outline-success"
                                    title="Aprovar"
                                    disabled=${salvando}
                                    onClick=${() =>
                                      aplicarStatus(
                                        candidato,
                                        CANDIDATE_STATUS_APPROVED,
                                      )}
                                  >
                                    Aprovar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-outline-danger"
                                    title="Eliminar"
                                    disabled=${salvando}
                                    onClick=${() =>
                                      aplicarStatus(
                                        candidato,
                                        CANDIDATE_STATUS_ELIMINATED,
                                      )}
                                  >
                                    Eliminar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-outline-warning"
                                    title="Banco de talentos"
                                    disabled=${salvando || candidato.origem_cadastro !== 'processo'}
                                    onClick=${() => enviarParaBanco(candidato)}
                                  >
                                    Banco
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-outline-secondary"
                                    title="Atrelar a processo"
                                    disabled=${salvando}
                                    onClick=${() => abrirAtrelar(candidato)}
                                  >
                                    Atrelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `,
                        )
                      : html`
                          <${TabelaVazia}
                            colunas=${12}
                            texto="Nenhum candidato encontrado."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!detalhe}
        titulo=${`Detalhes | ${detalhe?.nome_candidato || 'Candidato'}`}
        subtitulo="Resumo operacional consolidado deste candidato."
        onClose=${() => setDetalhe(null)}
      >
        ${detalhe
          ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
                    {
                      label: 'Candidato',
                      value: detalhe.nome_candidato || '-',
                    },
                    {
                      label: 'Vaga',
                      value: detalhe.vaga || '-',
                    },
                    {
                      label: 'Processo',
                      value: detalhe.processo_nome || '-',
                    },
                    {
                      label: 'Status',
                      value: detalhe.status_visivel || '-',
                    },
                    {
                      label: 'Email',
                      value: detalhe.email || '-',
                    },
                    {
                      label: 'Telefone',
                      value: detalhe.telefone || detalhe.whatsapp || '-',
                    },
                    {
                      label: 'Origem',
                      value: detalhe.origem_rotulo || '-',
                    },
                    {
                      label: 'Cidade',
                      value: detalhe.cidade || '-',
                    },
                    {
                      label: 'Bairro',
                      value: detalhe.bairro || '-',
                    },
                    {
                      label: 'Nota',
                      value: detalhe.nota_exibicao || '-',
                    },
                    {
                      label: 'Classificacao',
                      value: detalhe.classificacao_exibicao || '-',
                    },
                    {
                      label: 'ID da prova',
                      value: detalhe.id_teste || '-',
                    },
                    {
                      label: 'ID processo ref',
                      value: detalhe.id_processo_ref || detalhe.id_processo || '-',
                    },
                    {
                      label: 'Data',
                      value: formatarDataHora(detalhe.data_exibicao),
                    },
                  ]}
                />

                <${SectionCard}
                  title="Contexto complementar"
                  description="Informacoes de contato, entrevista e observacoes ja consolidadas no sistema."
                  className="rh-section-card--flat"
                >
                  <div class="row g-3">
                    <div class="col-md-6">
                      <div><strong>Contato principal:</strong> ${detalhe.contato_principal || '-'}</div>
                      <div><strong>Status entrevista:</strong> ${detalhe.status_entrevista || '-'}</div>
                      <div><strong>Data entrevista:</strong> ${formatarDataHora(detalhe.data_entrevista)}</div>
                      <div><strong>Curriculo:</strong> ${detalhe.cv_nome_arquivo || 'Sem arquivo anexado.'}</div>
                    </div>
                    <div class="col-md-6">
                      <div><strong>Tags:</strong> ${(detalhe.tags || []).join(', ') || '-'}</div>
                      <div><strong>Habilidades:</strong> ${(detalhe.habilidades || []).join(', ') || '-'}</div>
                      <div><strong>Observacao RH:</strong> ${detalhe.observacao_rh || '-'}</div>
                    </div>
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Curriculo"
                  description="Acesse o CV enviado pelo candidato quando disponivel."
                  className="rh-section-card--flat"
                >
                  <div class="rh-modal-footer-actions">
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      disabled=${!detalhe.cv_disponivel}
                      onClick=${() => abrirCurriculo(detalhe)}
                    >
                      ${detalhe.cv_disponivel ? 'Visualizar ou baixar CV' : 'CV indisponivel'}
                    </button>
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Acoes rapidas"
                  description="As mesmas movimentacoes continuam disponiveis nas telas antigas. Esta pagina apenas centraliza atalhos."
                  className="rh-section-card--flat"
                >
                  <div class="rh-modal-footer-actions">
                    <button
                      type="button"
                      class="btn btn-outline-success"
                      disabled=${salvando}
                      onClick=${() =>
                        aplicarStatus(detalhe, CANDIDATE_STATUS_APPROVED)}
                    >
                      Aprovar
                    </button>

                    <button
                      type="button"
                      class="btn btn-outline-danger"
                      disabled=${salvando}
                      onClick=${() =>
                        aplicarStatus(detalhe, CANDIDATE_STATUS_ELIMINATED)}
                    >
                      Eliminar
                    </button>

                    <button
                      type="button"
                      class="btn btn-outline-warning"
                      disabled=${salvando || detalhe.origem_cadastro !== 'processo'}
                      onClick=${() => enviarParaBanco(detalhe)}
                    >
                      Banco de talentos
                    </button>

                    <button
                      type="button"
                      class="btn btn-outline-primary"
                      disabled=${salvando}
                      onClick=${() => abrirAtrelar(detalhe)}
                    >
                      Atrelar a processo
                    </button>
                  </div>
                </${SectionCard}>
              </div>

              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${() => setDetalhe(null)}
                >
                  Fechar
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!candidatoParaAtrelar}
        titulo=${`Atrelar candidato | ${
          candidatoParaAtrelar?.nome_candidato || 'Candidato'
        }`}
        subtitulo="Selecione um processo seletivo aberto para vincular este candidato."
        onClose=${() => {
          setCandidatoParaAtrelar(null);
          setProcessoSelecionado('');
        }}
      >
        <div class="rh-details-body">
          <${MetricGrid}
            items=${[
              {
                label: 'Candidato',
                value: candidatoParaAtrelar?.nome_candidato || '-',
              },
              {
                label: 'Vaga atual',
                value: candidatoParaAtrelar?.vaga || '-',
              },
              {
                label: 'Origem',
                value: candidatoParaAtrelar?.origem_rotulo || '-',
              },
            ]}
          />

          <div class="rh-filter-field">
            <label>Processo seletivo</label>
            <${SelectProcesso}
              processos=${processosAbertos}
              valor=${processoSelecionado}
              disabled=${salvando}
              onChange=${setProcessoSelecionado}
            />
          </div>
        </div>

        <footer class="rh-modal-footer">
          <div class="rh-modal-footer-actions">
            <button
              type="button"
              class="btn btn-outline-secondary"
              disabled=${salvando}
              onClick=${() => {
                setCandidatoParaAtrelar(null);
                setProcessoSelecionado('');
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              class="btn btn-primary"
              disabled=${salvando || !processoSelecionado}
              onClick=${confirmarAtrelar}
            >
              ${salvando ? 'Salvando...' : 'Confirmar vinculo'}
            </button>
          </div>
        </footer>
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}

```

## Front\fonte\features\gestao\index.js

`$lang
import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  TAMANHO_ANALISE,
  TAMANHO_HISTORICO,
  TAMANHO_RECENTES,
  atualizarStatusCandidato,
  baixarCvCandidato,
  baixarPacoteHistorico,
  carregarDetalhesProva,
  construirMapaStatusAtual,
  criarProcesso,
  lerAnalisesCandidatos,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerHistorico,
  lerHistoricoPaginado,
  lerProcessos,
  montarIdProcesso,
  obterClasseSituacaoAtual,
  obterRegrasFormularioProcesso,
  obterRotuloSituacaoAtual,
  atualizarPerfilCandidato,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
} from '../../app/controlador-aplicacao.js';
import {
  baixarBlob,
  formatarDataParaInput,
  formatarNotaAnalise,
  formatarPercentualAfinidade,
  formatarPontuacaoDetalhada,
  obterItensPaginados,
} from '../../utilitarios.js';
import { abrirBlobEmNovaGuia } from '../../shared/browser-utils.js';
import {
  formatarDataHora,
  obterClasseAderencia,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  getCandidateActionState,
  getCandidateVisibleStatus,
  isProcessClosed,
} from '../../shared/process-flow.js';
import { obterTourLogin } from '../../shared/tour-config.js';
import {
  obterChaveProcesso,
  obterReferenciaProcesso,
} from '../../shared/process-reference.js';
import {
  quebrarListaTexto,
  validarFormularioProcesso,
  validarPerfilCandidato,
} from '../../shared/validacoes.js';
import { BlocoFiltro, CampoFiltro } from './components/filtros.js';
import {
  EmptyState,
  GrupoPaginacao,
  LoadingState,
  MetricGrid,
  ModalDetalhesProva,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import { BotaoAjudaTour, TourGuiado } from '../../ui/tour-guiado.js';

export function TelaLogin({ controlador }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [tourReopenSignal, setTourReopenSignal] = useState(0);
  const tourLogin = obterTourLogin();

  const enviar = async () => {
    const resultado = await controlador.fazerLogin(
      usuario.trim(),
      senha.trim(),
    );

    if (!resultado.ok) {
      setMensagemErro(resultado.mensagem);
    }
  };

  return html`
    <section class="active screen" id="screen-login">
      <div class="rh-login-page">
        <div class="rh-login-hero" data-tour-id="login-hero">
          <div class="rh-login-hero-badge">Sistema Interno RH</div>
          <h1 class="rh-login-hero-title">Plataforma de provas, processos e analise.</h1>
          <p class="rh-login-hero-text">
            Um fluxo unico para aplicacao de provas, acompanhamento de candidatos,
            banco de talentos e analise operacional.
          </p>
          <div class="rh-login-hero-points">
            <span>Historico consolidado</span>
            <span>Processos seletivos</span>
            <span>Analise de candidatos</span>
          </div>
        </div>

        <div
          class="rh-login-panel rh-login-panel-modern"
          data-tour-id="login-panel"
        >
          <div class="rh-login-brand-block rh-login-brand-block-centered">
            <img
              alt="Conecta C24h"
              class="rh-login-brand-image"
              src="estilos/logo-conecta-c24h.png"
            />
          </div>

          <div class="rh-login-copy-block">
            <h2 class="rh-login-welcome-title">Acesso ao ambiente RH</h2>
            <p class="rh-login-welcome-text">
              Entre com as credenciais para continuar.
            </p>
          </div>

          <div class="mb-3">
            <label class="form-label rh-login-label">Login</label>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon">
                alternate_email
              </span>
              <input
                class="form-control rh-login-input rh-login-input-modern"
                placeholder="nome@empresa.com.br"
                value=${usuario}
                onInput=${(event) => setUsuario(event.target.value)}
                type="text"
              />
            </div>
          </div>

          <div class="mb-2">
            <div class="rh-login-label-row">
              <label class="form-label rh-login-label mb-0">Senha</label>
              <button class="rh-login-link-btn" tabindex="-1" type="button">
                Ambiente restrito
              </button>
            </div>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon">
                lock
              </span>
              <input
                class="form-control rh-login-input rh-login-input-modern"
                placeholder="••••••••"
                value=${senha}
                onInput=${(event) => setSenha(event.target.value)}
                type="password"
              />
            </div>
          </div>

          ${mensagemErro
            ? html`<div class="alert alert-danger mb-3">${mensagemErro}</div>`
            : null}

          <button
            class="btn rh-login-btn rh-login-btn-modern w-100"
            data-tour-id="login-submit"
            onClick=${enviar}
          >
            <span>Acessar sistema</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>

          <div class="rh-login-help-row">
            <${BotaoAjudaTour}
              compact=${true}
              label="Ver orientacoes"
              onClick=${() => setTourReopenSignal((valor) => valor + 1)}
            />
          </div>

          <div class="rh-login-footer-meta">
            <span>© 2026 Conecta C24h</span>
            <span>Privacidade</span>
            <span>Termos</span>
            <span>Suporte</span>
          </div>
        </div>
      </div>

      <${TourGuiado}
        screenId="screen-login"
        userId=""
        steps=${tourLogin.steps}
        reopenSignal=${tourReopenSignal}
      />
    </section>
  `;
}

export function TelaInicio({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [recentes, setRecentes] = useState([]);
  const [detalheAberto, setDetalheAberto] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const historico = await lerHistorico();
      const ordenado = (Array.isArray(historico) ? historico : [])
        .sort((a, b) =>
          String(b.data_iso || '').localeCompare(String(a.data_iso || '')),
        )
        .slice(0, TAMANHO_RECENTES);
      setRecentes(ordenado);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  return html`
    <${PainelRh}
      screenId="screen-menu"
      navAtiva="screen-menu"
      subtituloMarca="Conecta C24h"
      placeholderBusca="Painel executivo do RH"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar teste',
        onClick: () => controlador.iniciarNovoFluxo(),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Painel principal"
        title="Ultimas provas salvas"
        description="Acesso rapido aos registros mais recentes com historico detalhado e download do pacote salvo."
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${carregar}
          >
            Atualizar
          </button>
        `}
      />

      <${SectionCard}
        title="Resumo rapido"
        description="Visao imediata do volume mais recente salvo no sistema."
      >
        <${MetricGrid}
          items=${[
            {
              label: 'Registros recentes',
              value: recentes.length,
              helper: 'Ultimos itens visiveis no painel',
            },
            {
              label: 'Status de carregamento',
              value: carregando ? 'Atualizando' : 'Pronto',
              helper: 'Consulta do historico consolidado',
            },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Atalhos operacionais"
        description="Acesse os fluxos principais do sistema."
        tourId="home-shortcuts"
      >
        <div class="rh-action-grid">
          <button
            type="button"
            class="rh-action-card"
            onClick=${() => controlador.iniciarNovoFluxo()}
          >
            <span class="material-symbols-outlined">play_circle</span>
            <strong>Nova prova</strong>
            <p>Inicie uma avaliacao individual ou vinculada a um processo.</p>
          </button>
          <button
            type="button"
            class="rh-action-card"
            onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
          >
            <span class="material-symbols-outlined">folder_managed</span>
            <strong>Processos seletivos</strong>
            <p>Gerencie vagas, status e candidatos em andamento.</p>
          </button>
          <button
            type="button"
            class="rh-action-card"
            onClick=${() => controlador.irParaTelaProtegida('screen-history')}
          >
            <span class="material-symbols-outlined">history</span>
            <strong>Historico completo</strong>
            <p>Filtre provas salvas por nome, vaga e data.</p>
          </button>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Registros recentes"
        description="Clique em um registro para abrir o detalhamento salvo."
        tourId="home-recent"
      >
        ${carregando
          ? html`<div class="alert alert-secondary">Carregando provas recentes...</div>`
          : recentes.length
            ? html`
                <div class="rh-recent-grid">
                  ${recentes.map(
                    (item) => html`
                      <button
                        key=${item.id_teste}
                        type="button"
                        class="rh-recent-card"
                        onClick=${async () =>
                          setDetalheAberto(
                            await carregarDetalhesProva(item.id_teste),
                          )}
                      >
                        <div class="rh-recent-avatar-wrap">
                          <span class="rh-recent-avatar">
                            ${String(item.nome_candidato || 'C')
                              .trim()
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                        </div>
                        <div class="rh-recent-card-body">
                          <strong>${item.nome_candidato || '-'}</strong>
                          <span>${item.vaga || '-'}</span>
                          <span>${item.data_exibicao || '-'}</span>
                        </div>
                        <span class="material-symbols-outlined">arrow_forward</span>
                      </button>
                    `,
                  )}
                </div>
              `
            : html`
                <${EmptyState}
                  title="Nenhum registro salvo"
                  text="Assim que uma prova for concluida e salva, ela aparecera aqui."
                />
              `}
      </${SectionCard}>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
          baixarPacoteHistorico(
            detalheAberto?.linha?.id_teste,
            detalheAberto?.linha?.nome_candidato || 'candidato',
          )}
      />
    </${PainelRh}>
  `;
}

export function TelaHistorico({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [paginacao, setPaginacao] = useState({
    paginaAtual: 1,
    totalPaginas: 1,
    totalItens: 0,
  });
  const [filtros, setFiltros] = useState({ nome: '', vaga: '', data: '' });
  const [detalheAberto, setDetalheAberto] = useState(null);
  const [mapaStatus, setMapaStatus] = useState({});

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const [historico, statusAtual] = await Promise.all([
          lerHistoricoPaginado({
            pagina,
            tamanho: TAMANHO_HISTORICO,
            nome: filtros.nome,
            vaga: filtros.vaga,
            data: filtros.data,
          }),
          construirMapaStatusAtual(),
        ]);
        setLinhas(Array.isArray(historico?.items) ? historico.items : []);
        setPaginacao({
          paginaAtual: historico?.page || pagina,
          totalPaginas: historico?.total_pages || 1,
          totalItens: historico?.total_items || 0,
        });
        setMapaStatus(statusAtual);
      } finally {
        setCarregando(false);
      }
    })();
  }, [filtros, pagina]);

  return html`
    <${PainelRh}
      screenId="screen-history"
      navAtiva="screen-history"
      subtituloMarca="Historico de provas"
      placeholderBusca="Consulta do historico de avaliacoes"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar teste',
        onClick: () => controlador.iniciarNovoFluxo(),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Historico"
        title="Historico de exames"
        description="Consulte resultados salvos com filtros por candidato, vaga e data."
      />

      <${BlocoFiltro} tourId="history-filters">
        <div class="rh-filter-grid">
          <${CampoFiltro} label="Candidato" icon="person_search">
            <input
              class="form-control"
              placeholder="Pesquisar por nome..."
              value=${filtros.nome}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, nome: event.target.value });
              }}
            />
          </${CampoFiltro}>

          <${CampoFiltro} label="Vaga" icon="work">
            <input
              class="form-control"
              placeholder="Pesquisar por vaga..."
              value=${filtros.vaga}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, vaga: event.target.value });
              }}
            />
          </${CampoFiltro}>

          <${CampoFiltro} label="Data" icon="calendar_month">
            <input
              class="form-control"
              type="date"
              value=${filtros.data}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, data: event.target.value });
              }}
            />
          </${CampoFiltro}>
        </div>
      </${BlocoFiltro}>

      <${SectionCard}
        title="Resultados salvos"
        description="Tabela consolidada com status atualizado e acoes de consulta."
        tourId="history-results"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nivel</th>
                <th>Data</th>
                <th>Nota</th>
                <th>Status</th>
                <th class="text-end">Acoes</th>
              </tr>
            </thead>
            <tbody>
              ${carregando
                ? html`<${TabelaVazia} colunas=${7} texto="Carregando historico..." />`
                : linhas.length
                  ? linhas.map(
                      (linha) => html`
                        <tr key=${linha.id_teste}>
                          <td>${linha.nome_candidato || '-'}</td>
                          <td>${linha.vaga || '-'}</td>
                          <td>${linha.nivel || '-'}</td>
                          <td>${linha.data_exibicao || '-'}</td>
                          <td>
                            ${formatarPontuacaoDetalhada(
                              linha.pontuacao_final,
                              '',
                            )}
                          </td>
                          <td>
                            <span
                              class=${`rh-status-pill ${obterClasseSituacaoAtual(obterRotuloSituacaoAtual(linha, mapaStatus))}`}
                            >
                              ${obterRotuloSituacaoAtual(linha, mapaStatus)}
                            </span>
                          </td>
                          <td class="text-end">
                            <div class="d-flex justify-content-end gap-2 flex-wrap">
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-primary"
                                onClick=${async () =>
                                  setDetalheAberto(
                                    await carregarDetalhesProva(linha.id_teste),
                                  )}
                              >
                                Detalhes
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-success"
                                onClick=${() =>
                                  baixarPacoteHistorico(
                                    linha.id_teste,
                                    linha.nome_candidato || 'candidato',
                                  )}
                              >
                                Baixar prova
                              </button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                  : html`
                      <${TabelaVazia}
                        colunas=${7}
                        texto="Nenhum registro encontrado para os filtros informados."
                      />
                    `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginacao.paginaAtual}
          totalPaginas=${paginacao.totalPaginas}
          onChange=${setPagina}
        />
      </${SectionCard}>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
          baixarPacoteHistorico(
            detalheAberto?.linha?.id_teste,
            detalheAberto?.linha?.nome_candidato || 'candidato',
          )}
      />
    </${PainelRh}>
  `;
}

export function TelaCriarProcesso({ controlador }) {
  const [formulario, setFormulario] = useState({
    vaga: '',
    quantidade: 1,
    dataEncerramento: '',
    operacao: '',
    trilha: '',
    usaNotaCorte: false,
    notaCorte: '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const regras = obterRegrasFormularioProcesso(formulario.vaga);

  useEffect(() => {
    if (regras.trilhaFixa && formulario.trilha !== regras.trilhaFixa) {
      setFormulario((anterior) => ({ ...anterior, trilha: regras.trilhaFixa }));
    }
  }, [regras.trilhaFixa, formulario.trilha]);

  const criar = async () => {
    const mensagemErro = validarFormularioProcesso(formulario, regras);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setErro('');
    setSalvando(true);

    try {
      await criarProcesso({
        id_processo: montarIdProcesso(formulario.vaga),
        vaga: formulario.vaga,
        quantidade_vagas: Number(formulario.quantidade),
        vagas_preenchidas: 0,
        data_encerramento: formulario.dataEncerramento,
        operacao: formulario.operacao,
        trilha: regras.trilhaFixa || formulario.trilha,
        usa_nota_corte: formulario.usaNotaCorte ? 1 : 0,
        nota_corte: formulario.usaNotaCorte
          ? Number(formulario.notaCorte)
          : null,
        status: 'Aberto',
        data_criacao: new Date().toISOString(),
        link_agendamento: '',
      });

      controlador.irParaTelaProtegida('screen-processes');
    } catch (error) {
      setErro(error?.message || 'Nao foi possivel criar o processo.');
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-process-create"
      navAtiva="screen-process-create"
      subtituloMarca="Novo processo seletivo"
      placeholderBusca="Cadastro de novo processo"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Ver processos',
        onClick: () => controlador.irParaTelaProtegida('screen-processes'),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Novo processo"
        title="Abrir processo seletivo"
        description="Cadastre uma vaga com a mesma logica funcional do sistema atual, agora em uma composicao mais previsivel."
      />

      <${SectionCard}
        title="Dados do processo"
        description="Os campos abaixo mantem a compatibilidade com a API e com o fluxo atual de provas."
        tourId="process-create-form"
      >
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Vaga do processo</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.vaga}
              onChange=${(event) =>
                setFormulario({ ...formulario, vaga: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option>Jovem Aprendiz</option>
              <option>Operador</option>
              <option>Estagiario</option>
              <option>Supervisor</option>
              <option>Control Desk</option>
              <option>Planejamento</option>
              <option>TI</option>
              <option>Analista</option>
              <option>Outros</option>
            </select>
          </div>

          <div class="col-md-3">
            <label class="form-label">Quantidade de vagas</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="1"
              value=${formulario.quantidade}
              onInput=${(event) =>
                setFormulario({ ...formulario, quantidade: event.target.value })}
            />
          </div>

          <div class="col-md-3">
            <label class="form-label">Data de encerramento</label>
            <input
              class="form-control rh-flow-input"
              type="date"
              value=${formulario.dataEncerramento}
              onInput=${(event) =>
                setFormulario({
                  ...formulario,
                  dataEncerramento: event.target.value,
                })}
            />
          </div>

          <div class="col-md-6">
            <label class="form-label">Operacao</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.operacao}
              onChange=${(event) =>
                setFormulario({ ...formulario, operacao: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option>CRF</option>
              <option>DAVITA</option>
              <option>NEWE</option>
              <option>BRAVA</option>
              <option>ENDOVIEW</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Trilha</label>
            <select
              class="form-select rh-flow-input"
              disabled=${!!regras.trilhaFixa}
              value=${regras.trilhaFixa || formulario.trilha}
              onChange=${(event) =>
                setFormulario({ ...formulario, trilha: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="RH">RH</option>
              <option value="TI">TI</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label d-block mb-2">Ativar nota de corte</label>
            <label class="rh-cutoff-toggle">
              <input
                type="checkbox"
                checked=${formulario.usaNotaCorte}
                onChange=${(event) =>
                  setFormulario({
                    ...formulario,
                    usaNotaCorte: event.target.checked,
                  })}
              />
              <span class="rh-cutoff-toggle-slider"></span>
            </label>
          </div>

          <div class="col-md-6">
            <label class="form-label">Nota de corte</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="4"
              max="10"
              step="0.1"
              disabled=${!formulario.usaNotaCorte}
              value=${formulario.notaCorte}
              onInput=${(event) =>
                setFormulario({ ...formulario, notaCorte: event.target.value })}
            />
          </div>

        </div>

        ${erro ? html`<div class="alert alert-danger mt-4">${erro}</div>` : null}

        <div class="rh-form-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
          >
            Voltar
          </button>
          <button
            type="button"
            class="btn btn-success btn-lg"
            disabled=${salvando}
            onClick=${criar}
          >
            ${salvando ? 'Salvando...' : 'Criar processo'}
          </button>
        </div>
      </${SectionCard}>
    </${PainelRh}>
  `;
}

export function TelaBancoTalentos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [linhas, setLinhas] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [candidatoParaUtilizar, setCandidatoParaUtilizar] = useState(null);
  const [processoSelecionadoUso, setProcessoSelecionadoUso] = useState('');
  const [perfilEdicao, setPerfilEdicao] = useState(null);
  const [formularioPerfil, setFormularioPerfil] = useState({
    tags: '',
    habilidades: '',
    observacao_rh: '',
  });
  const [filtros, setFiltros] = useState({
    busca: '',
    habilidade: '',
    tag: '',
  });

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const [banco, processos] = await Promise.all([
        lerBancoTalentos({
          forcar: true,
          search: filtros.busca,
          skill: filtros.habilidade,
          tag: filtros.tag,
        }),
        lerProcessos(true),
      ]);

      setLinhas(Array.isArray(banco) ? banco : []);
      setProcessosAbertos(
        (Array.isArray(processos) ? processos : []).filter(
          (processo) => String(processo.status || '').trim() !== 'Encerrado',
        ),
      );
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel carregar o banco de talentos.',
      );
      setLinhas([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [filtros.busca, filtros.habilidade, filtros.tag]);

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      window.alert('Nao ha curriculo disponivel para este candidato.');
      return;
    }

    try {
      const arquivo = await baixarCvCandidato(candidato.id_teste);
      const tipo = String(arquivo?.contentType || '').toLowerCase();
      if (tipo.includes('pdf')) {
        abrirBlobEmNovaGuia(arquivo.blob);
        return;
      }

      baixarBlob(arquivo.filename || 'curriculo', arquivo.blob);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel abrir o curriculo do candidato.',
      );
    }
  };

  const remover = async (idBanco) => {
    if (!window.confirm('Deseja eliminar este candidato do banco de talentos?')) {
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await removerBancoTalentos(idBanco);
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel remover o candidato do banco.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicaoPerfil = (candidato) => {
    setPerfilEdicao(candidato);
    setFormularioPerfil({
      tags: Array.isArray(candidato.tags) ? candidato.tags.join(', ') : '',
      habilidades: Array.isArray(candidato.habilidades)
        ? candidato.habilidades.join(', ')
        : '',
      observacao_rh: candidato.observacao_rh || '',
    });
  };

  const salvarPerfil = async () => {
    if (!perfilEdicao) return;

    const mensagemErro = validarPerfilCandidato(formularioPerfil);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      await atualizarPerfilCandidato(perfilEdicao.id_teste, {
        nome_candidato: perfilEdicao.nome_candidato,
        tags: quebrarListaTexto(formularioPerfil.tags),
        habilidades: quebrarListaTexto(formularioPerfil.habilidades),
        observacao_rh: formularioPerfil.observacao_rh,
      });
      setPerfilEdicao(null);
      await carregar();
    } catch (error) {
      setErro(error?.message || 'Nao foi possivel atualizar o perfil RH.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarUso = async () => {
    if (!candidatoParaUtilizar || !processoSelecionadoUso) {
      window.alert('Selecione um processo antes de continuar.');
      return;
    }

    const confirmar = window.confirm(
      `Deseja realmente utilizar o candidato ${candidatoParaUtilizar?.nome_candidato || ''} no processo ${processoSelecionadoUso}?`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      const processoSelecionado = processosAbertos.find(
        (processo) => obterReferenciaProcesso(processo) === processoSelecionadoUso,
      );
      await usarCandidatoDoBancoTalentos(candidatoParaUtilizar.id_banco, {
        id_processo: processoSelecionado?.id_processo || '',
        id_processo_ref: processoSelecionadoUso,
      });

      setCandidatoParaUtilizar(null);
      setProcessoSelecionadoUso('');
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel reutilizar o candidato selecionado.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-talent-bank"
      navAtiva="screen-talent-bank"
      subtituloMarca="Banco de talentos"
      placeholderBusca="Reaproveitamento de candidatos"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Banco de talentos"
        title="Candidatos reaproveitaveis"
        description="Acompanhe candidatos guardados para oportunidades futuras, filtre por habilidade e registre tags e observacoes do RH."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Filtros"
        description="Busque candidatos por nome, habilidade e tags cadastradas."
        tourId="talent-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Busca por nome</label>
            <input
              class="form-control"
              placeholder="Nome, vaga ou processo"
              value=${filtros.busca}
              onInput=${(event) =>
                setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Habilidade</label>
            <input
              class="form-control"
              placeholder="Excel, Atendimento, TI..."
              value=${filtros.habilidade}
              onInput=${(event) =>
                setFiltros({ ...filtros, habilidade: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Tag</label>
            <input
              class="form-control"
              placeholder="Prioritario, Boa aderencia..."
              value=${filtros.tag}
              onInput=${(event) =>
                setFiltros({ ...filtros, tag: event.target.value })}
            />
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Lista atual"
        description="Reaproveitamento, perfil RH e filtros avancados funcionando sobre dados persistidos."
        tourId="talent-table"
      >
        ${carregando
          ? html`
              <${LoadingState}
                titulo="Carregando banco de talentos"
                descricao="Buscando candidatos, tags e observacoes persistidas."
              />
            `
          : html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Candidato</th>
                      <th>Cidade</th>
                      <th>Bairro</th>
                      <th>Vaga</th>
                      <th>Nota</th>
                      <th>Habilidades / tags</th>
                      <th>Observacoes RH</th>
                      <th>Entrevista</th>
                      <th>CV</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhas.length
                      ? linhas.map(
                          (linha) => html`
                            <tr key=${linha.id_banco}>
                              <td>${linha.id_processo || '-'}</td>
                              <td>
                                <strong>${linha.nome_candidato || '-'}</strong>
                                <div class="small text-muted mt-1">
                                  ${formatarDataHora(linha.data_movimentacao)}
                                </div>
                              </td>
                              <td>${linha.cidade || '-'}</td>
                              <td>${linha.bairro || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.pontuacao_final || '-'}</td>
                              <td>
                                <div class="rh-cell-stack">
                                  <div class="rh-chip-wrap">
                                    ${(linha.habilidades || []).map(
                                      (item) => html`
                                        <span key=${item} class="rh-chip is-skill">${item}</span>
                                      `,
                                    )}
                                    ${(linha.tags || []).map(
                                      (item) => html`
                                        <span key=${item} class="rh-chip">${item}</span>
                                      `,
                                    )}
                                  </div>
                                  <small>${linha.origem || '-'}</small>
                                </div>
                              </td>
                              <td>${linha.observacao_rh || 'Sem observacoes.'}</td>
                              <td>
                                ${linha.status_entrevista
                                  ? html`
                                      <div class="rh-cell-stack">
                                        <span
                                          class=${`rh-status-pill ${obterClasseStatusEntrevista(linha.status_entrevista)}`}
                                        >
                                          ${linha.status_entrevista}
                                        </span>
                                        <small>${formatarDataHora(linha.data_entrevista)}</small>
                                      </div>
                                    `
                                  : 'Nao agendada'}
                              </td>
                              <td>
                                ${linha.cv_disponivel
                                  ? html`
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary"
                                        onClick=${() => abrirCurriculo(linha)}
                                      >
                                        Ver CV
                                      </button>
                                    `
                                  : 'Sem CV'}
                              </td>
                              <td class="text-end">
                                <div class="d-flex justify-content-end gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    onClick=${() => abrirEdicaoPerfil(linha)}
                                  >
                                    Perfil RH
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    disabled=${salvando}
                                    onClick=${() => remover(linha.id_banco)}
                                  >
                                    Eliminar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-primary"
                                    onClick=${() => {
                                      setCandidatoParaUtilizar(linha);
                                      setProcessoSelecionadoUso('');
                                    }}
                                  >
                                    Utilizar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `,
                        )
                      : html`
                          <${TabelaVazia}
                            colunas=${11}
                            texto="Nenhum candidato no banco de talentos."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!candidatoParaUtilizar}
        titulo="Utilizar candidato"
        subtitulo="Selecione o processo aberto e confirme a reutilizacao."
        onClose=${() => {
          setCandidatoParaUtilizar(null);
          setProcessoSelecionadoUso('');
        }}
      >
        <div class="rh-details-body">
          <label class="form-label">Processo aberto</label>
          <select
            class="form-select"
            value=${processoSelecionadoUso}
            onChange=${(event) => setProcessoSelecionadoUso(event.target.value)}
          >
            <option value="">Selecione...</option>
              ${processosAbertos.map(
                (processo) => html`
                <option key=${obterChaveProcesso(processo)} value=${obterReferenciaProcesso(processo)}>
                  ${processo.id_processo} • ${processo.vaga} •
                  ${processo.operacao || processo.trilha || '-'}
                </option>
              `,
            )}
          </select>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => {
              setCandidatoParaUtilizar(null);
              setProcessoSelecionadoUso('');
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${salvando}
            onClick=${confirmarUso}
          >
            Confirmar utilizacao
          </button>
        </footer>
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!perfilEdicao}
        titulo="Perfil RH do candidato"
        subtitulo="Cadastre habilidades, tags e observacoes persistidas para reutilizacao futura."
        onClose=${() => setPerfilEdicao(null)}
      >
        ${perfilEdicao
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-12">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${perfilEdicao.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Habilidades</label>
                    <input
                      class="form-control"
                      placeholder="Excel, Atendimento, Administrativo..."
                      value=${formularioPerfil.habilidades}
                      onInput=${(event) =>
                        setFormularioPerfil({
                          ...formularioPerfil,
                          habilidades: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Tags</label>
                    <input
                      class="form-control"
                      placeholder="Prioritario, Boa aderencia..."
                      value=${formularioPerfil.tags}
                      onInput=${(event) =>
                        setFormularioPerfil({
                          ...formularioPerfil,
                          tags: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observacao RH</label>
                    <textarea
                      class="form-control"
                      rows="5"
                      value=${formularioPerfil.observacao_rh}
                      onInput=${(event) =>
                        setFormularioPerfil({
                          ...formularioPerfil,
                          observacao_rh: event.target.value,
                        })}
                    ></textarea>
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setPerfilEdicao(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  disabled=${salvando}
                  onClick=${salvarPerfil}
                >
                  ${salvando ? 'Salvando...' : 'Salvar perfil'}
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}

function GraficoComparativoAnalise({ itens = [] }) {
  const dados = Array.isArray(itens) ? itens : [];
  const maiorValor = Math.max(
    1,
    ...dados.flatMap((item) => [
      Number(item?.obtained || 0),
      Number(item?.expected || 0),
    ]),
  );

  if (!dados.length) {
    return html`
      <${EmptyState}
        title="Sem dados para o grafico"
        text="Nao ha informacoes suficientes para exibir a comparacao."
      />
    `;
  }

  return html`
    <div class="rh-analysis-chart">
      ${dados.map(
        (item, indice) => html`
          <div key=${indice} class="rh-analysis-chart-row">
            <div class="rh-analysis-chart-label">${item.label || '-'}</div>
            <div class="rh-analysis-chart-bars">
              <div class="rh-analysis-chart-bar-track">
                <div
                  class="rh-analysis-chart-bar is-obtained"
                  style=${{
                    width: `${(Number(item?.obtained || 0) / maiorValor) * 100}%`,
                  }}
                ></div>
              </div>
              <div class="rh-analysis-chart-bar-track">
                <div
                  class="rh-analysis-chart-bar is-expected"
                  style=${{
                    width: `${(Number(item?.expected || 0) / maiorValor) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
            <div class="rh-analysis-chart-value">
              ${formatarNotaAnalise(item?.obtained || 0)} x
              ${formatarNotaAnalise(item?.expected || 0)}
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

export function TelaAnaliseCandidatos({ controlador }) {
  const [linhas, setLinhas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({
    processo: '',
    candidato: '',
    vaga: '',
    nota: '',
  });
  const [detalhe, setDetalhe] = useState(null);

  const carregarAnalises = async () => {
    const dados = await lerAnalisesCandidatos();
    setLinhas(Array.isArray(dados) ? dados : []);
  };

  useEffect(() => {
    carregarAnalises();
  }, []);

  const filtrado = useMemo(
    () =>
      linhas.filter((linha) => {
        const matchProcesso =
          !filtros.processo ||
          String(linha.id_processo || '')
            .toLowerCase()
            .includes(filtros.processo.toLowerCase());
        const matchCandidato =
          !filtros.candidato ||
          String(linha.nome_candidato || '')
            .toLowerCase()
            .includes(filtros.candidato.toLowerCase());
        const matchVaga =
          !filtros.vaga ||
          String(linha.vaga || '')
            .toLowerCase()
            .includes(filtros.vaga.toLowerCase());

        let matchNota = true;
        if (filtros.nota) {
          const notaMinima = Number(String(filtros.nota).replace(',', '.'));
          const notaAtual = Number(
            String(linha.nota_final || 0).replace(',', '.'),
          );
          if (!Number.isNaN(notaMinima)) {
            matchNota = notaAtual >= notaMinima;
          }
        }

        return matchProcesso && matchCandidato && matchVaga && matchNota;
      }),
    [linhas, filtros],
  );

  const paginado = obterItensPaginados(filtrado, pagina, TAMANHO_ANALISE);
  const detalheEstadoAcoes = useMemo(
    () => getCandidateActionState(detalhe || {}, detalhe?.status_processo || ''),
    [detalhe],
  );

  const aplicarAcao = async (statusCandidato) => {
    if (!detalhe?.id_teste) return;
    if (detalheEstadoAcoes.processClosed) {
      window.alert('O processo seletivo deste candidato esta encerrado e nao permite novas movimentacoes.');
      return;
    }
    if (
      statusCandidato === 'Aprovado' &&
      !detalheEstadoAcoes.canApprove
    ) {
      window.alert('A aprovacao nao esta disponivel para o status atual deste candidato.');
      return;
    }
    if (
      statusCandidato === 'Eliminado' &&
      !detalheEstadoAcoes.canEliminate
    ) {
      window.alert('A eliminacao nao esta disponivel para o status atual deste candidato.');
      return;
    }
    if (
      statusCandidato === 'Banco de talentos' &&
      !detalheEstadoAcoes.canSendToTalentBank
    ) {
      window.alert('O envio para banco de talentos nao esta disponivel para o status atual deste candidato.');
      return;
    }

    const candidatosProcesso = await lerCandidatosProcessos(true);
    const vinculo = candidatosProcesso.find(
      (item) =>
        String(item.id_teste || '').trim() ===
        String(detalhe.id_teste || '').trim(),
    );

    if (!vinculo) {
      window.alert(
        'Nao foi possivel localizar o vinculo do candidato com o processo.',
      );
      return;
    }

    await atualizarStatusCandidato(vinculo.id_registro, {
      status_candidato: statusCandidato,
      data_movimentacao: new Date().toISOString(),
    });

    await carregarAnalises();
    setDetalhe(await lerDetalheAnaliseCandidato(detalhe.id_teste));
  };

  return html`
    <${PainelRh}
      screenId="screen-analysis-candidates"
      navAtiva="screen-analysis-candidates"
      subtituloMarca="Analise por candidato"
      placeholderBusca="Inteligencia analitica do RH"
      controlador=${controlador}
      mostrarAtalhos=${false}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Analise"
        title="Analise por candidato"
        description="Compare desempenho, afinidade e recomendacao usando os dados ja consolidados pela aplicacao."
      />

      <${BlocoFiltro} tourId="analysis-filters">
        <div class="rh-filter-grid rh-filter-grid--wide">
          <${CampoFiltro} label="Processo" icon="folder_managed">
            <input
              class="form-control"
              value=${filtros.processo}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, processo: event.target.value });
              }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Candidato" icon="person_search">
            <input
              class="form-control"
              value=${filtros.candidato}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, candidato: event.target.value });
              }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Vaga" icon="work">
            <input
              class="form-control"
              value=${filtros.vaga}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, vaga: event.target.value });
              }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Nota minima" icon="star">
            <input
              class="form-control"
              type="number"
              step="0.1"
              min="0"
              max="10"
              value=${filtros.nota}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, nota: event.target.value });
              }}
            />
          </${CampoFiltro}>
        </div>
      </${BlocoFiltro}>

      <${SectionCard}
        title="Ranking analitico"
        description="O modal de detalhe respeita o status atual do candidato e bloqueia movimentacoes em processo encerrado."
        tourId="analysis-ranking"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Processo</th>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nota</th>
                <th>Afinidade</th>
                <th>Recomendacao</th>
                <th>Status</th>
                <th class="text-end">Acoes</th>
              </tr>
            </thead>
            <tbody>
              ${paginado.itens.length
                ? paginado.itens.map(
                    (linha) => html`
                      <tr key=${linha.id_teste}>
                        <td>${linha.id_processo || '-'}</td>
                        <td>${linha.nome_candidato || '-'}</td>
                        <td>${linha.vaga || '-'}</td>
                        <td>${formatarNotaAnalise(linha.nota_final)}</td>
                        <td>
                          ${formatarPercentualAfinidade(
                            linha.afinidade_percentual,
                          )}%
                        </td>
                        <td>
                          <span class=${obterClasseAderencia(linha.recomendacao)}>
                            ${linha.recomendacao || '-'}
                          </span>
                        </td>
                        <td>${getCandidateVisibleStatus(linha) || '-'}</td>
                        <td class="text-end">
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-primary"
                            onClick=${async () =>
                              setDetalhe(
                                await lerDetalheAnaliseCandidato(linha.id_teste),
                              )}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    `,
                  )
                : html`
                    <${TabelaVazia}
                      colunas=${8}
                      texto="Nenhuma analise disponivel."
                    />
                  `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginado.paginaAtual}
          totalPaginas=${paginado.totalPaginas}
          onChange=${setPagina}
        />
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!detalhe}
        titulo=${`Analise do candidato • ${detalhe?.nome_candidato || 'Candidato'}`}
        subtitulo="Comparativo analitico entre desempenho e expectativa da vaga."
        onClose=${() => setDetalhe(null)}
      >
        ${detalhe
          ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
                    { label: 'Processo', value: detalhe.id_processo || '-' },
                    { label: 'Candidato', value: detalhe.nome_candidato || '-' },
                    { label: 'Vaga', value: detalhe.vaga || '-' },
                    {
                      label: 'Nota final',
                      value: formatarNotaAnalise(detalhe.nota_final),
                    },
                    {
                      label: 'Afinidade',
                      value: `${formatarPercentualAfinidade(
                        detalhe.afinidade_percentual,
                      )}%`,
                    },
                    {
                      label: 'Recomendacao',
                      value: html`
                        <span class=${obterClasseAderencia(detalhe.recomendacao)}>
                          ${detalhe.recomendacao || '-'}
                        </span>
                      `,
                    },
                    {
                      label: 'Status atual',
                      value: getCandidateVisibleStatus(detalhe) || '-',
                    },
                    {
                      label: 'Processo',
                      value: detalhe.status_processo || 'Aberto',
                    },
                  ]}
                />

                <${SectionCard}
                  title="Etapas comparadas"
                  className="rh-section-card--flat"
                >
                  <${GraficoComparativoAnalise} itens=${detalhe.grafico || []} />
                </${SectionCard}>

                <${SectionCard}
                  title="Observacoes"
                  className="rh-section-card--flat"
                >
                  <div class="rh-detail-list">
                    <div>
                      Nota textual geral:
                      ${formatarNotaAnalise(
                        detalhe?.analise_texto?.overall || 0,
                      )}
                    </div>
                    ${(detalhe.ressalvas || []).map(
                      (item, indice) => html`<div key=${indice}>${item}</div>`,
                    )}
                    <div>${detalhe.parecer_final || '-'}</div>
                  </div>
                </${SectionCard}>
              </div>

              <footer class="rh-modal-footer">
                <div class="rh-modal-footer-actions">
                  ${detalheEstadoAcoes.canApprove
                    ? html`
                        <button
                          type="button"
                          class="btn btn-outline-success"
                          onClick=${() => aplicarAcao('Aprovado')}
                        >
                          Aprovar
                        </button>
                      `
                    : null}
                  ${detalheEstadoAcoes.canEliminate
                    ? html`
                        <button
                          type="button"
                          class="btn btn-outline-danger"
                          onClick=${() => aplicarAcao('Eliminado')}
                        >
                          Eliminar
                        </button>
                      `
                    : null}
                  ${detalheEstadoAcoes.canSendToTalentBank
                    ? html`
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          onClick=${() => aplicarAcao('Banco de talentos')}
                        >
                          Banco de talentos
                        </button>
                      `
                    : null}
                  ${!detalheEstadoAcoes.canApprove &&
                  !detalheEstadoAcoes.canEliminate &&
                  !detalheEstadoAcoes.canSendToTalentBank
                    ? html`
                        <span class="text-muted">
                          ${isProcessClosed(detalhe?.status_processo)
                            ? 'Processo encerrado: sem movimentacoes.'
                            : 'Sem acoes operacionais para o status atual.'}
                        </span>
                      `
                    : null}
                </div>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${() => setDetalhe(null)}
                >
                  Fechar
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}


```

## Front\fonte\features\pipeline\index.js

`$lang
import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  baixarCvCandidato,
  criarCardPipeline,
  excluirCardPipeline,
  lerPipelineCandidatos,
  lerProcessos,
  moverCardPipeline,
} from '../../app/controlador-aplicacao.js';
import {
  formatarDataHora,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { AcaoSair } from '../../shared/components/actions.js';
import {
  getCandidateVisibleStatus,
  getPipelineStageLabel,
  isProcessClosed,
} from '../../shared/process-flow.js';
import { validarCardPipeline } from '../../shared/validacoes.js';
import { baixarBlob, formatarNotaAnalise } from '../../utilitarios.js';
import { abrirBlobEmNovaGuia } from '../../shared/browser-utils.js';
import {
  CHAVE_PIPELINE_CANDIDATO,
  CHAVE_PIPELINE_PROCESSO,
} from '../processos/state.js';
import {
  EmptyState,
  LoadingState,
  MetricGrid,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import {
  montarPayloadProcessoSelecionado,
  obterChaveProcesso,
  obterReferenciaProcesso,
} from '../../shared/process-reference.js';

const ETAPAS_PIPELINE = [
  'Triagem',
  'Prova',
  'Entrevista',
  'Aprovado',
  'Reprovado',
];

function indiceEtapa(etapa) {
  return ETAPAS_PIPELINE.indexOf(etapa);
}

export function TelaPipelineCandidatos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [processos, setProcessos] = useState([]);
  const [cards, setCards] = useState([]);
  const [filtros, setFiltros] = useState(() => ({
    processo: sessionStorage.getItem(CHAVE_PIPELINE_PROCESSO) || '',
    busca: '',
  }));
  const [candidatoFoco, setCandidatoFoco] = useState(
    sessionStorage.getItem(CHAVE_PIPELINE_CANDIDATO) || '',
  );
  const [modalCriacaoAberto, setModalCriacaoAberto] = useState(false);
  const [cardsRecolhidos, setCardsRecolhidos] = useState({});
  const [novoCard, setNovoCard] = useState({
    id_processo: sessionStorage.getItem(CHAVE_PIPELINE_PROCESSO) || '',
    nome_candidato: '',
    vaga: '',
    etapa_pipeline: 'Triagem',
  });

  const abrirCurriculo = async (card) => {
    if (!card?.id_teste || !card?.cv_disponivel) {
      setErro('Nao ha curriculo disponivel para este candidato.');
      return;
    }

    try {
      const arquivo = await baixarCvCandidato(card.id_teste);
      const tipo = String(arquivo?.contentType || '').toLowerCase();
      if (tipo.includes('pdf')) {
        abrirBlobEmNovaGuia(arquivo.blob);
        return;
      }

      baixarBlob(arquivo.filename || 'curriculo', arquivo.blob);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel abrir o curriculo do candidato.',
      );
    }
  };

  const carregar = async (forcar = false) => {
    setCarregando(true);
    setErro('');

    try {
      const [listaProcessos, listaCards] = await Promise.all([
        lerProcessos(forcar),
        lerPipelineCandidatos(filtros.processo, filtros.busca),
      ]);

      setProcessos(Array.isArray(listaProcessos) ? listaProcessos : []);
      setCards(Array.isArray(listaCards) ? listaCards : []);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel carregar o pipeline de candidatos.',
      );
      setCards([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [filtros.processo, filtros.busca]);

  useEffect(() => {
    if (filtros.processo) {
      sessionStorage.setItem(CHAVE_PIPELINE_PROCESSO, filtros.processo);
    } else {
      sessionStorage.removeItem(CHAVE_PIPELINE_PROCESSO);
    }
  }, [filtros.processo]);

  useEffect(() => {
    if (!candidatoFoco) return;

    const timeout = window.setTimeout(() => {
      setCandidatoFoco('');
      sessionStorage.removeItem(CHAVE_PIPELINE_CANDIDATO);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [candidatoFoco]);

  const processosAbertos = useMemo(
    () => processos.filter((processo) => !isProcessClosed(processo.status)),
    [processos],
  );

  const cardsPorEtapa = useMemo(
    () =>
      ETAPAS_PIPELINE.map((etapa) => ({
        etapa,
        items: cards.filter(
          (item) => String(item.etapa_pipeline || '').trim() === etapa,
        ),
      })),
    [cards],
  );

  const resumo = useMemo(() => {
    const base = { total: cards.length, entrevistasAtivas: 0 };
    ETAPAS_PIPELINE.forEach((etapa) => {
      base[etapa] = cards.filter(
        (item) => String(item.etapa_pipeline || '').trim() === etapa,
      ).length;
    });
    base.entrevistasAtivas = cards.filter((item) => item.status_entrevista).length;
    return base;
  }, [cards]);

  const mover = async (card, direcao) => {
    if (isProcessClosed(card.status_processo)) {
      setErro('O processo seletivo deste candidato esta encerrado e nao permite movimentacao no pipeline.');
      return;
    }

    const posicaoAtual = indiceEtapa(card.etapa_pipeline);
    const proximaPosicao = posicaoAtual + direcao;

    if (proximaPosicao < 0 || proximaPosicao >= ETAPAS_PIPELINE.length) {
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      await moverCardPipeline(card.id_registro, {
        etapa_pipeline: ETAPAS_PIPELINE[proximaPosicao],
        data_movimentacao: new Date().toISOString(),
      });
      await carregar(true);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel mover o candidato no pipeline.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (card) => {
    const confirmar = window.confirm(
      `Deseja realmente excluir o card de ${card.nome_candidato || 'candidato'}? Essa remocao sera persistida e refletida nas telas relacionadas.`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      await excluirCardPipeline(card.id_registro);
      await carregar(true);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel excluir o card selecionado.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const salvarNovoCard = async () => {
    const mensagemErro = validarCardPipeline(novoCard);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      const processoSelecionado = montarPayloadProcessoSelecionado(
        processos,
        novoCard.id_processo,
      );
      if (!processoSelecionado.id_processo) {
        setErro('Selecione um processo valido para criar o card.');
        return;
      }

      await criarCardPipeline({
        ...novoCard,
        id_processo: processoSelecionado.id_processo,
        id_processo_ref: processoSelecionado.id_processo_ref,
        nome_candidato: novoCard.nome_candidato.trim(),
      });

      setModalCriacaoAberto(false);
      setNovoCard({
        id_processo: novoCard.id_processo,
        nome_candidato: '',
        vaga: '',
        etapa_pipeline: 'Triagem',
      });
      await carregar(true);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel criar o card do candidato.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const alternarCardRecolhido = (event, idRegistro) => {
    event.preventDefault();
    event.stopPropagation();
    setCardsRecolhidos((anterior) => ({
      ...anterior,
      [idRegistro]: !anterior[idRegistro],
    }));
  };

  return html`
    <${PainelRh}
      screenId="screen-candidate-pipeline"
      navAtiva="screen-candidate-pipeline"
      subtituloMarca="Pipeline de candidatos"
      placeholderBusca="Pipeline de candidatos"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Novo card',
        onClick: () => setModalCriacaoAberto(true),
      }}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary"
          onClick=${() => carregar(true)}
        >
          Atualizar
        </button>
        <${AcaoSair} controlador=${controlador} />
      `}
    >
      <${PageIntro}
        kicker="Console â€¢ Pipeline"
        title="Pipeline de candidatos"
        description="Acompanhe o fluxo operacional por etapa. Processos encerrados permanecem visiveis, mas sem permitir movimentacao."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Visao executiva"
        description="Resumo rapido do kanban por etapa e entrevistas em andamento."
      >
        <${MetricGrid}
          items=${[
            { label: 'Total', value: resumo.total || 0 },
            { label: 'Analise', value: resumo.Triagem || 0, variant: 'is-analysis' },
            { label: 'Qualificados', value: resumo.Prova || 0, variant: 'is-highlight' },
            { label: 'Entrevistas', value: resumo.Entrevista || 0, variant: 'is-confirmed' },
            { label: 'Entrevistas agendadas', value: resumo.entrevistasAtivas || 0, variant: 'is-highlight' },
            { label: 'Aprovado', value: resumo.Aprovado || 0, variant: 'is-approved' },
            { label: 'Finalizados', value: resumo.Reprovado || 0, variant: 'is-eliminated' },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Filtros"
        description="Filtre por processo ou pesquise rapidamente por nome, vaga ou codigo do processo."
        tourId="pipeline-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Processo</label>
            <select
              class="form-select"
              value=${filtros.processo}
              onChange=${(event) =>
                setFiltros({ ...filtros, processo: event.target.value })}
            >
              <option value="">Todos os processos</option>
              ${processosAbertos.map(
                (processo) => html`
                  <option
                    key=${obterChaveProcesso(processo)}
                    value=${obterReferenciaProcesso(processo)}
                  >
                    ${processo.id_processo} â€¢ ${processo.vaga}
                  </option>
                `,
              )}
            </select>
          </div>

          <div class="rh-filter-field">
            <label>Busca rapida</label>
            <input
              class="form-control"
              value=${filtros.busca}
              placeholder="Nome, vaga ou processo"
              onInput=${(event) =>
                setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>
        </div>
      </${SectionCard}>

      <section class="rh-pipeline-board-wrap" data-tour-id="pipeline-board">
        <section class="rh-pipeline-board">
          ${cardsPorEtapa.map(
            (coluna) => html`
              <article key=${coluna.etapa} class="rh-pipeline-column">
                <header class="rh-pipeline-column-header">
                  <strong>${getPipelineStageLabel(coluna.etapa)}</strong>
                  <span>${coluna.items.length}</span>
                </header>

                <div class="rh-pipeline-column-body">
                  ${carregando
                    ? html`
                        <${LoadingState}
                          titulo="Carregando cards"
                          descricao="Buscando movimentacoes persistidas no pipeline."
                        />
                      `
                    : coluna.items.length
                      ? coluna.items.map(
                          (card) => html`
                            <div
                              key=${card.id_registro}
                              class=${`rh-pipeline-card ${String(card.id_registro) === String(candidatoFoco) ? 'is-focused' : ''} ${cardsRecolhidos[card.id_registro] ? 'is-collapsed' : ''}`.trim()}
                            >
                              <div class="rh-pipeline-card-top">
                                <div class="rh-pipeline-card-headline">
                                  <strong>${card.nome_candidato || '-'}</strong>
                                  <button
                                    type="button"
                                    class="rh-pipeline-collapse-btn"
                                    aria-expanded=${!cardsRecolhidos[card.id_registro]}
                                    aria-pressed=${!!cardsRecolhidos[card.id_registro]}
                                    aria-label=${cardsRecolhidos[card.id_registro]
                                      ? 'Expandir card'
                                      : 'Recolher card'}
                                    title=${cardsRecolhidos[card.id_registro]
                                      ? 'Expandir card'
                                      : 'Recolher card'}
                                    onClick=${(event) =>
                                      alternarCardRecolhido(
                                        event,
                                        card.id_registro,
                                      )}
                                  >
                                    <span class="material-symbols-outlined">
                                      ${cardsRecolhidos[card.id_registro]
                                        ? 'keyboard_arrow_down'
                                        : 'keyboard_arrow_up'}
                                    </span>
                                  </button>
                                </div>
                                <span class="rh-status-pill">
                                  ${getCandidateVisibleStatus(card) || '-'}
                                </span>
                              </div>

                              <div class="rh-pipeline-card-meta">
                                <span>${card.id_processo || '-'}</span>
                                <span>${card.vaga || '-'}</span>
                                ${isProcessClosed(card.status_processo)
                                  ? html`<span>Processo encerrado</span>`
                                  : null}
                              </div>

                              ${cardsRecolhidos[card.id_registro]
                                ? null
                                : html`
                                    ${card.tags?.length
                                      ? html`
                                          <div class="rh-chip-wrap mt-3">
                                            ${card.tags.slice(0, 3).map(
                                              (tag) => html`
                                                <span key=${tag} class="rh-chip">${tag}</span>
                                              `,
                                            )}
                                          </div>
                                        `
                                      : null}

                                    <div class="rh-pipeline-card-details">
                                      <span>Origem: ${card.origem || '-'}</span>
                                      <span>
                                        Nota:
                                        ${card.pontuacao_final !== undefined &&
                                        card.pontuacao_final !== null &&
                                        card.pontuacao_final !== ''
                                          ? formatarNotaAnalise(card.pontuacao_final)
                                          : '-'}
                                      </span>
                                      <span>
                                        Entrevista:
                                        ${card.status_entrevista
                                          ? html`
                                              <span
                                                class=${`rh-status-pill ${obterClasseStatusEntrevista(card.status_entrevista)}`}
                                              >
                                                ${card.status_entrevista}
                                              </span>
                                            `
                                          : 'Nao agendada'}
                                      </span>
                                      ${card.data_entrevista
                                        ? html`
                                            <span>
                                              Data entrevista: ${formatarDataHora(
                                                card.data_entrevista,
                                              )}
                                            </span>
                                          `
                                        : null}
                                      ${(card.cidade || card.bairro)
                                        ? html`
                                            <span>
                                              Localidade:
                                              ${[card.cidade, card.bairro]
                                                .filter(Boolean)
                                                .join(' â€¢ ')}
                                            </span>
                                          `
                                        : null}
                                    </div>
                                  `}

                              ${cardsRecolhidos[card.id_registro]
                                ? null
                                : html`
                                    <div class="rh-pipeline-card-actions">
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary"
                                        disabled=${!card.cv_disponivel}
                                        onClick=${() => abrirCurriculo(card)}
                                      >
                                        ${card.cv_disponivel ? 'Ver CV' : 'Sem CV'}
                                      </button>
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary"
                                        disabled=${salvando ||
                                        indiceEtapa(card.etapa_pipeline) === 0 ||
                                        isProcessClosed(card.status_processo)}
                                        onClick=${() => mover(card, -1)}
                                      >
                                        Etapa anterior
                                      </button>
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-primary"
                                        disabled=${salvando ||
                                        indiceEtapa(card.etapa_pipeline) ===
                                          ETAPAS_PIPELINE.length - 1 ||
                                        isProcessClosed(card.status_processo)}
                                        onClick=${() => mover(card, 1)}
                                      >
                                        Proxima etapa
                                      </button>
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-danger"
                                        disabled=${salvando}
                                        onClick=${() => remover(card)}
                                      >
                                        Excluir card
                                      </button>
                                    </div>
                                  `}
                            </div>
                          `,
                        )
                      : html`
                          <div class="rh-pipeline-empty">
                            Nenhum candidato nesta etapa.
                          </div>
                        `}
                </div>
              </article>
            `,
          )}
        </section>
      </section>

      ${!carregando && !cards.length
        ? html`
            <${EmptyState}
              title="Nenhum card no pipeline"
              text="Crie um novo card ou ajuste os filtros para visualizar candidatos."
            />
          `
        : null}

      <${ModalPadrao}
        aberto=${modalCriacaoAberto}
        titulo="Novo card de candidato"
        subtitulo="Crie um card manual e vincule o candidato ao processo correto."
        onClose=${() => setModalCriacaoAberto(false)}
      >
        <div class="row g-3">
          <div class="col-md-12">
            <label class="form-label">Processo</label>
            <select
              class="form-select"
              value=${novoCard.id_processo}
              onChange=${(event) =>
                setNovoCard({ ...novoCard, id_processo: event.target.value })}
            >
              <option value="">Selecione...</option>
              ${processos.map(
                (processo) => html`
                  <option
                    key=${obterChaveProcesso(processo)}
                    value=${obterReferenciaProcesso(processo)}
                  >
                    ${processo.id_processo} â€¢ ${processo.vaga}
                  </option>
                `,
              )}
            </select>
          </div>

          <div class="col-md-8">
            <label class="form-label">Nome do candidato</label>
            <input
              class="form-control"
              value=${novoCard.nome_candidato}
              onInput=${(event) =>
                setNovoCard({
                  ...novoCard,
                  nome_candidato: event.target.value,
                })}
            />
          </div>

          <div class="col-md-4">
            <label class="form-label">Etapa inicial</label>
            <select
              class="form-select"
              value=${novoCard.etapa_pipeline}
              onChange=${(event) =>
                setNovoCard({
                  ...novoCard,
                  etapa_pipeline: event.target.value,
                })}
            >
              ${ETAPAS_PIPELINE.map(
                (etapa) => html`
                  <option key=${etapa} value=${etapa}>
                    ${getPipelineStageLabel(etapa)}
                  </option>
                `,
              )}
            </select>
          </div>

          <div class="col-md-12">
            <label class="form-label">Vaga</label>
            <input
              class="form-control"
              placeholder="Opcional: se vazio, usa a vaga do processo"
              value=${novoCard.vaga}
              onInput=${(event) =>
                setNovoCard({ ...novoCard, vaga: event.target.value })}
            />
          </div>
        </div>

        <div class="rh-form-footer mt-4">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setModalCriacaoAberto(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${salvando}
            onClick=${salvarNovoCard}
          >
            ${salvando ? 'Salvando...' : 'Criar card'}
          </button>
        </div>
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}

```

## Front\fonte\features\processos\index.js

`$lang
import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  TAMANHO_DETALHE_PROCESSO,
  agendarEntrevista,
  adicionarPreAnaliseAoProcesso,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  analisarCvProcesso,
  baixarCvCandidato,
  desativarLinkPublicoCandidatura,
  encerrarProcesso,
  excluirPreAnaliseCv,
  gerarLinkPublicoCandidatura,
  lerCandidatosProcessos,
  lerDetalheProcesso,
  lerEntrevistas,
  lerPreAnalisesCv,
  lerProcessos,
} from '../../app/controlador-aplicacao.js';
import {
  baixarBlob,
  formatarDataParaInput,
  obterItensPaginados,
} from '../../utilitarios.js';
import {
  formatarDataHora,
  montarResumoAnaliticoCv,
  obterClasseStatusEntrevista,
  obterClasseStatusProcesso,
} from '../../shared/helpers-visuais.js';
import {
  abrirBlobEmNovaGuia,
  copiarTexto,
  montarUrlPublicaCandidatura,
  toDatetimeLocal,
} from '../../shared/browser-utils.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  getCandidateActionState,
  isProcessClosed,
} from '../../shared/process-flow.js';
import {
  validarFormularioEntrevista,
  validarFormularioProcesso,
} from '../../shared/validacoes.js';
import {
  encontrarProcessoPorReferencia,
  obterChaveProcesso,
  obterReferenciaProcesso,
  obterReferenciaProcessoDoCandidato,
} from '../../shared/process-reference.js';
import { CHAVE_PROCESSO_DETALHE } from './state.js';
import { CabecalhoSecaoColapsavel } from './components/section-toggle.js';
import {
  EmptyState,
  GrupoPaginacao,
  LoadingState,
  MetricGrid,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';

function montarCandidatoDeFluxo(candidato, processoStatus = '') {
  const estadoAcoes = getCandidateActionState(candidato, processoStatus);

  return {
    ...candidato,
    status_fluxo: estadoAcoes.visibleStatus,
    status_processo: processoStatus || candidato.status_processo || '',
    acoes_fluxo: estadoAcoes,
  };
}

function renderizarAcoesDoCandidato({
  candidato,
  onAtualizarStatus,
  onAgendarEntrevista,
}) {
  const estadoAcoes = candidato.acoes_fluxo || getCandidateActionState(candidato);
  const botoes = [];

  if (estadoAcoes.canScheduleInterview && typeof onAgendarEntrevista === 'function') {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          onClick=${() => onAgendarEntrevista(candidato)}
        >
          Agendar entrevista
        </button>
      `,
    );
  }

  if (estadoAcoes.canApprove) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-success"
          onClick=${() => onAtualizarStatus(candidato, 'Aprovado')}
        >
          Aprovar
        </button>
      `,
    );
  }

  if (estadoAcoes.canEliminate) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-danger"
          onClick=${() => onAtualizarStatus(candidato, 'Eliminado')}
        >
          Eliminar
        </button>
      `,
    );
  }

  if (estadoAcoes.canSendToTalentBank) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          onClick=${() => onAtualizarStatus(candidato, 'Banco de talentos')}
        >
          Banco de talentos
        </button>
      `,
    );
  }

  if (!botoes.length) {
    return html`<span class="text-muted">Sem acoes disponiveis</span>`;
  }

  return html`<div class="d-flex justify-content-end gap-2 flex-wrap">${botoes}</div>`;
}

export function TelaProcessos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processos, setProcessos] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [filtros, setFiltros] = useState({
    vaga: '',
    operacao: '',
    notaCorte: '',
    status: '',
  });
  const [blocos, setBlocos] = useState({
    abertos: true,
    encerrados: false,
    candidatos: false,
  });
  const [edicao, setEdicao] = useState(null);
  const [processoParaEncerrar, setProcessoParaEncerrar] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const [resultadoProcessos, resultadoCandidatos] =
        await Promise.allSettled([
          lerProcessos(true),
          lerCandidatosProcessos(true),
        ]);

      const mensagensErro = [];

      if (resultadoProcessos.status === 'fulfilled') {
        setProcessos(
          Array.isArray(resultadoProcessos.value) ? resultadoProcessos.value : [],
        );
      } else {
        setProcessos([]);
        mensagensErro.push(
          resultadoProcessos.reason?.message ||
            'Nao foi possivel carregar os processos seletivos.',
        );
      }

      if (resultadoCandidatos.status === 'fulfilled') {
        setCandidatos(
          Array.isArray(resultadoCandidatos.value)
            ? resultadoCandidatos.value
            : [],
        );
      } else {
        setCandidatos([]);
        mensagensErro.push(
          resultadoCandidatos.reason?.message ||
            'Nao foi possivel carregar os candidatos vinculados.',
        );
      }

      if (mensagensErro.length) {
        setErro(mensagensErro.join(' '));
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const processosAbertos = useMemo(
    () =>
      processos
        .filter((processo) => String(processo.status || '').trim() !== 'Encerrado')
        .filter((processo) => {
          const vaga = String(processo.vaga || '').toLowerCase();
          const operacao = String(processo.operacao || '').toLowerCase();
          const usaNota = Number(processo.usa_nota_corte || 0) ? 'sim' : 'nao';
          const status = String(processo.status || '').toLowerCase();

          const matchVaga =
            !filtros.vaga || vaga.includes(filtros.vaga.toLowerCase());
          const matchOperacao =
            !filtros.operacao ||
            operacao.includes(filtros.operacao.toLowerCase());
          const matchNota =
            !filtros.notaCorte || usaNota === filtros.notaCorte;
          const matchStatus =
            !filtros.status || status.includes(filtros.status.toLowerCase());

          return matchVaga && matchOperacao && matchNota && matchStatus;
        }),
    [filtros, processos],
  );

  const processosEncerrados = useMemo(
    () =>
      processos.filter(
        (processo) => String(processo.status || '').trim() === 'Encerrado',
      ),
    [processos],
  );

  const processosPorId = useMemo(
    () =>
      processos.reduce((acc, processo) => {
        const referencia = obterReferenciaProcesso(processo);
        if (referencia) {
          acc[referencia] = processo;
        }
        return acc;
      }, {}),
    [processos],
  );

  const candidatosComFluxo = useMemo(
    () =>
      candidatos.map((candidato) => {
        const processo =
          processosPorId[obterReferenciaProcessoDoCandidato(candidato)];
        return montarCandidatoDeFluxo(candidato, processo?.status || '');
      }),
    [candidatos, processosPorId],
  );

  const candidatosComDecisaoPendente = useMemo(
    () =>
      candidatosComFluxo.filter(
        (candidato) =>
          candidato.acoes_fluxo?.canApprove ||
          candidato.acoes_fluxo?.canEliminate ||
          candidato.acoes_fluxo?.canSendToTalentBank,
      ),
    [candidatosComFluxo],
  );

  const resumo = useMemo(
    () => ({
      totalProcessos: processos.length,
      abertos: processosAbertos.length,
      encerrados: processosEncerrados.length,
      candidatosComDecisaoPendente: candidatosComDecisaoPendente.length,
    }),
    [
      processos.length,
      processosAbertos.length,
      processosEncerrados.length,
      candidatosComDecisaoPendente.length,
    ],
  );

  const atualizarStatus = async (registro, statusCandidato, idProcesso) => {
    const processo = encontrarProcessoPorReferencia(processos, idProcesso);

    if (isProcessClosed(processo)) {
      window.alert('O processo seletivo esta encerrado e nao permite novas movimentacoes.');
      return;
    }

    if (
      statusCandidato === 'Aprovado' &&
      Number(processo?.quantidade_vagas || 0) === 1
    ) {
      const confirmar = window.confirm(
        'Este processo possui apenas 1 vaga. Ao aprovar o candidato, o processo pode ser encerrado automaticamente. Deseja continuar?',
      );
      if (!confirmar) return;
    }

    await atualizarStatusCandidato(registro, {
      status_candidato: statusCandidato,
      data_movimentacao: new Date().toISOString(),
    });

    await carregar();
  };

  const salvarEdicao = async () => {
    const mensagemErro = validarFormularioProcesso(
      {
        vaga: edicao?.vaga,
        quantidade: edicao?.quantidade_vagas,
        dataEncerramento: edicao?.data_encerramento,
        operacao: edicao?.operacao,
        trilha: edicao?.trilha,
        usaNotaCorte: Number(edicao?.usa_nota_corte || 0) === 1,
        notaCorte: edicao?.nota_corte,
        linkAgendamento: edicao?.link_agendamento || '',
      },
      { exigeOperacao: false, exigeTrilha: false, trilhaFixa: '' },
    );
    if (mensagemErro || !obterReferenciaProcesso(edicao)) {
      setErro(mensagemErro || 'Preencha os campos obrigatorios para editar o processo.');
      return;
    }

    await atualizarProcesso(obterReferenciaProcesso(edicao), {
      quantidade_vagas: Number(edicao.quantidade_vagas),
      data_encerramento: edicao.data_encerramento,
      operacao: edicao.operacao || '',
      trilha: edicao.trilha || '',
      usa_nota_corte: Number(edicao.usa_nota_corte || 0),
      nota_corte:
        edicao.nota_corte !== '' && edicao.nota_corte !== null
          ? Number(edicao.nota_corte)
          : null,
      status: edicao.status || 'Aberto',
      link_agendamento: edicao.link_agendamento || '',
    });

    setEdicao(null);
    await carregar();
  };

  const confirmarEncerramento = async () => {
    if (!processoParaEncerrar) return;
    await encerrarProcesso(processoParaEncerrar);
    setProcessoParaEncerrar('');
    await carregar();
  };

  const abrirDetalhe = (processo) => {
    sessionStorage.setItem(
      CHAVE_PROCESSO_DETALHE,
      obterReferenciaProcesso(processo),
    );
    controlador.irParaTelaProtegida('screen-process-details');
  };

  const processoSelecionadoParaEncerramento = useMemo(
    () => encontrarProcessoPorReferencia(processos, processoParaEncerrar),
    [processoParaEncerrar, processos],
  );

  return html`
    <${PainelRh}
      screenId="screen-processes"
      navAtiva="screen-processes"
      subtituloMarca="Processos seletivos"
      placeholderBusca="Gerenciamento de processos e candidatos"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Novo processo',
        onClick: () => controlador.irParaTelaProtegida('screen-process-create'),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Processos"
        title="Gestao de processos seletivos"
        description="Controle processos abertos, acompanhe as etapas do RH e conclua apenas as acoes que ainda estao pendentes."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Visao executiva"
        description="Indicadores rapidos para acompanhamento operacional."
      >
        <${MetricGrid}
          items=${[
            { label: 'Processos totais', value: resumo.totalProcessos },
            { label: 'Abertos', value: resumo.abertos, variant: 'is-approved' },
            { label: 'Encerrados', value: resumo.encerrados, variant: 'is-eliminated' },
            {
              label: 'Decisoes pendentes',
              value: resumo.candidatosComDecisaoPendente,
              variant: 'is-analysis',
            },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Filtros"
        description="Aplicados somente na lista de processos abertos."
        tourId="process-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Vaga</label>
            <input
              class="form-control"
              value=${filtros.vaga}
              placeholder="Filtrar por vaga"
              onInput=${(event) =>
                setFiltros({ ...filtros, vaga: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Operacao</label>
            <input
              class="form-control"
              value=${filtros.operacao}
              placeholder="Filtrar por operacao"
              onInput=${(event) =>
                setFiltros({ ...filtros, operacao: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Nota de corte</label>
            <select
              class="form-select"
              value=${filtros.notaCorte}
              onChange=${(event) =>
                setFiltros({ ...filtros, notaCorte: event.target.value })}
            >
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Nao</option>
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Status</label>
            <select
              class="form-select"
              value=${filtros.status}
              onChange=${(event) =>
                setFiltros({ ...filtros, status: event.target.value })}
            >
              <option value="">Todos</option>
              <option value="aberto">Aberto</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title=""
        tourId="process-open-table"
        actions=${html`
          <${CabecalhoSecaoColapsavel}
            aberto=${blocos.abertos}
            titulo="Processos abertos"
            onClick=${() => setBlocos({ ...blocos, abertos: !blocos.abertos })}
          />
        `}
      >
        ${blocos.abertos
          ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Operacao</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Link agendamento</th>
                      <th>Status</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${carregando
                      ? html`<${TabelaVazia} colunas=${11} texto="Carregando processos..." />`
                      : processosAbertos.length
                        ? processosAbertos.map(
                            (processo) => html`
                              <tr key=${obterChaveProcesso(processo)}>
                                <td>${processo.id_processo || '-'}</td>
                                <td>${processo.vaga || '-'}</td>
                                <td>${processo.operacao || '-'}</td>
                                <td>${processo.trilha || '-'}</td>
                                <td>${Number(processo.usa_nota_corte || 0) ? 'Sim' : 'Nao'}</td>
                                <td>${processo.nota_corte || '-'}</td>
                                <td>
                                  ${`${processo.vagas_preenchidas || 0}/${processo.quantidade_vagas || 0}`}
                                </td>
                                <td>${processo.data_encerramento || '-'}</td>
                                <td>
                                  ${processo.link_agendamento
                                    ? html`
                                        <a
                                          href=${processo.link_agendamento}
                                          target="_blank"
                                          rel="noreferrer"
                                          class="rh-link-inline"
                                        >
                                          Abrir
                                        </a>
                                      `
                                    : 'Nao informado'}
                                </td>
                                <td>
                                  <span class="rh-status-pill is-finished">
                                    ${processo.status || '-'}
                                  </span>
                                </td>
                                <td class="text-end">
                                  <div class="d-flex justify-content-end gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-secondary"
                                      onClick=${() =>
                                        setEdicao({
                                          ...processo,
                                          data_encerramento: formatarDataParaInput(
                                            processo.data_encerramento,
                                          ),
                                        })}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-primary"
                                      onClick=${() => abrirDetalhe(processo)}
                                    >
                                      Detalhes
                                    </button>
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-danger"
                                      onClick=${() =>
                                        setProcessoParaEncerrar(
                                          obterReferenciaProcesso(processo),
                                        )}
                                    >
                                      Encerrar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            `,
                          )
                        : html`
                            <${TabelaVazia}
                              colunas=${11}
                              texto="Nenhum processo aberto encontrado."
                            />
                          `}
                  </tbody>
                </table>
              </div>
            `
          : null}
      </${SectionCard}>

      <${SectionCard}
        title=""
        actions=${html`
          <${CabecalhoSecaoColapsavel}
            aberto=${blocos.encerrados}
            titulo="Processos encerrados"
            onClick=${() =>
              setBlocos({ ...blocos, encerrados: !blocos.encerrados })}
          />
        `}
      >
        ${blocos.encerrados
          ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Operacao</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Link agendamento</th>
                      <th>Status</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${processosEncerrados.length
                      ? processosEncerrados.map(
                          (processo) => html`
                              <tr key=${obterChaveProcesso(processo)}>
                              <td>${processo.id_processo || '-'}</td>
                              <td>${processo.vaga || '-'}</td>
                              <td>${processo.operacao || '-'}</td>
                              <td>${processo.trilha || '-'}</td>
                              <td>${Number(processo.usa_nota_corte || 0) ? 'Sim' : 'Nao'}</td>
                              <td>${processo.nota_corte || '-'}</td>
                              <td>
                                ${`${processo.vagas_preenchidas || 0}/${processo.quantidade_vagas || 0}`}
                              </td>
                              <td>${processo.data_encerramento || '-'}</td>
                              <td>
                                ${processo.link_agendamento
                                  ? html`
                                      <a
                                        href=${processo.link_agendamento}
                                        target="_blank"
                                        rel="noreferrer"
                                        class="rh-link-inline"
                                      >
                                        Abrir
                                      </a>
                                    `
                                  : 'Nao informado'}
                              </td>
                              <td>
                                <span class="rh-status-pill is-unsaved">
                                  ${processo.status || '-'}
                                </span>
                              </td>
                              <td class="text-end">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-primary"
                                  onClick=${() => abrirDetalhe(processo)}
                                >
                                  Detalhes
                                </button>
                              </td>
                            </tr>
                          `,
                        )
                      : html`
                          <${TabelaVazia}
                            colunas=${11}
                            texto="Nenhum processo encerrado."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `
          : null}
      </${SectionCard}>

      <${SectionCard}
        title=""
        actions=${html`
          <${CabecalhoSecaoColapsavel}
            aberto=${blocos.candidatos}
            titulo="Decisoes finais pendentes"
            onClick=${() =>
              setBlocos({ ...blocos, candidatos: !blocos.candidatos })}
          />
        `}
      >
        ${blocos.candidatos
          ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Candidato</th>
                      <th>Vaga</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${candidatosComDecisaoPendente.length
                      ? candidatosComDecisaoPendente.map(
                          (candidato) => html`
                            <tr key=${candidato.id_registro}>
                              <td>${candidato.id_processo || '-'}</td>
                              <td>${candidato.nome_candidato || '-'}</td>
                              <td>${candidato.vaga || '-'}</td>
                              <td>${candidato.pontuacao_final || '-'}</td>
                              <td>
                                <span
                                  class=${`process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_fluxo)}`}
                                >
                                  ${candidato.status_fluxo || '-'}
                                </span>
                              </td>
                              <td class="text-end">
                                ${renderizarAcoesDoCandidato({
                                  candidato,
                                  onAtualizarStatus: (item, status) =>
                                    atualizarStatus(
                                      item.id_registro,
                                      status,
                                      obterReferenciaProcessoDoCandidato(item),
                                    ),
                                })}
                              </td>
                            </tr>
                          `,
                        )
                      : html`
                          <${TabelaVazia}
                            colunas=${6}
                            texto="Nenhum candidato com decisao final pendente."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `
          : null}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!edicao}
        titulo="Editar processo"
        subtitulo="Ajuste as informacoes sem alterar a integracao existente."
        onClose=${() => setEdicao(null)}
      >
        ${edicao
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Vaga</label>
                    <input class="form-control" readonly value=${edicao.vaga || ''} />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Quantidade de vagas</label>
                    <input
                      class="form-control"
                      type="number"
                      min="1"
                      value=${edicao.quantidade_vagas || 0}
                      onInput=${(event) =>
                        setEdicao({
                          ...edicao,
                          quantidade_vagas: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Data de encerramento</label>
                    <input
                      class="form-control"
                      type="date"
                      value=${edicao.data_encerramento || ''}
                      onInput=${(event) =>
                        setEdicao({
                          ...edicao,
                          data_encerramento: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Operacao</label>
                    <input
                      class="form-control"
                      value=${edicao.operacao || ''}
                      onInput=${(event) =>
                        setEdicao({ ...edicao, operacao: event.target.value })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Trilha</label>
                    <input
                      class="form-control"
                      value=${edicao.trilha || ''}
                      onInput=${(event) =>
                        setEdicao({ ...edicao, trilha: event.target.value })}
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label d-block mb-2">Nota de corte</label>
                    <div class="form-check form-switch pt-2">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        checked=${Number(edicao.usa_nota_corte || 0) === 1}
                        onChange=${(event) =>
                          setEdicao({
                            ...edicao,
                            usa_nota_corte: event.target.checked ? 1 : 0,
                          })}
                      />
                    </div>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Valor corte</label>
                    <input
                      class="form-control"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value=${edicao.nota_corte ?? ''}
                      disabled=${Number(edicao.usa_nota_corte || 0) !== 1}
                      onInput=${(event) =>
                        setEdicao({ ...edicao, nota_corte: event.target.value })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Status</label>
                    <select
                      class="form-select"
                      value=${edicao.status || 'Aberto'}
                      onChange=${(event) =>
                        setEdicao({ ...edicao, status: event.target.value })}
                    >
                      <option value="Aberto">Aberto</option>
                      <option value="Encerrado">Encerrado</option>
                    </select>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Link de agendamento</label>
                    <input
                      class="form-control"
                      placeholder="https://bookings.cloud.microsoft/..."
                      value=${edicao.link_agendamento || ''}
                      onInput=${(event) =>
                        setEdicao({
                          ...edicao,
                          link_agendamento: event.target.value,
                        })}
                    />
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setEdicao(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${salvarEdicao}
                >
                  Salvar alteracoes
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!processoParaEncerrar}
        titulo="Encerrar processo"
        subtitulo="Essa acao move o processo para a lista de encerrados."
        onClose=${() => setProcessoParaEncerrar('')}
      >
        <div class="rh-details-body">
          <div class="alert alert-warning mb-0">
            Deseja realmente encerrar o processo ${processoSelecionadoParaEncerramento?.id_processo || processoParaEncerrar || ''}?
          </div>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setProcessoParaEncerrar('')}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick=${confirmarEncerramento}
          >
            Encerrar processo
          </button>
        </footer>
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}

export function TelaDetalhesProcesso({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvandoEntrevista, setSalvandoEntrevista] = useState(false);
  const [erro, setErro] = useState('');
  const [processo, setProcesso] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [entrevistas, setEntrevistas] = useState([]);
  const [preAnalises, setPreAnalises] = useState([]);
  const [paginaPreAnalises, setPaginaPreAnalises] = useState(1);
  const [totalPaginasPreAnalises, setTotalPaginasPreAnalises] = useState(1);
  const [arquivoCv, setArquivoCv] = useState(null);
  const [guardarCvOriginal, setGuardarCvOriginal] = useState(false);
  const [analisandoCv, setAnalisandoCv] = useState(false);
  const [preAnaliseSelecionada, setPreAnaliseSelecionada] = useState(null);
  const [visualizacaoCv, setVisualizacaoCv] = useState(null);
  const [resultadoAnaliseSelecionado, setResultadoAnaliseSelecionado] =
    useState(null);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState(null);
  const [formularioEntrevista, setFormularioEntrevista] = useState({
    id_registro: '',
    id_processo: '',
    id_processo_ref: '',
    data_entrevista: '',
    status_entrevista: 'Agendado',
    link_agendamento: '',
    observacoes_rh: '',
    email: '',
    telefone: '',
    whatsapp: '',
  });
  const [feedbackLinkPublico, setFeedbackLinkPublico] = useState('');

  const idProcesso = sessionStorage.getItem(CHAVE_PROCESSO_DETALHE) || '';

  useEffect(() => {
    if (!feedbackLinkPublico) return undefined;

    const timeout = window.setTimeout(() => setFeedbackLinkPublico(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedbackLinkPublico]);

  const carregar = async (pagina = 1) => {
    if (!idProcesso) {
      setErro('Processo nao identificado.');
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro('');

    try {
      const [detalhe, listaPreAnalises, listaEntrevistas] = await Promise.all([
        lerDetalheProcesso(idProcesso),
        lerPreAnalisesCv(idProcesso, pagina, 5),
        lerEntrevistas({ idProcesso }),
      ]);

      if (detalhe?.processo) {
        sessionStorage.setItem(
          CHAVE_PROCESSO_DETALHE,
          obterReferenciaProcesso(detalhe.processo),
        );
      }
      setProcesso(detalhe?.processo || null);
      setResumo(detalhe?.resumo || null);
      setCandidatos(Array.isArray(detalhe?.candidatos) ? detalhe.candidatos : []);
      setPreAnalises(
        Array.isArray(listaPreAnalises?.items) ? listaPreAnalises.items : [],
      );
      setPaginaPreAnalises(Number(listaPreAnalises?.page || 1));
      setTotalPaginasPreAnalises(Number(listaPreAnalises?.total_pages || 1));
      setEntrevistas(Array.isArray(listaEntrevistas) ? listaEntrevistas : []);
    } catch (error) {
      setErro(
        error.message || 'Nao foi possivel carregar o detalhe do processo.',
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar(1);
  }, []);

  const processoEncerrado = isProcessClosed(processo);
  const urlPublicaCandidatura = useMemo(
    () =>
      processo?.link_publico_slug
        ? montarUrlPublicaCandidatura(processo.link_publico_slug)
        : '',
    [processo?.link_publico_slug],
  );
  const linkPublicoAtivo = Boolean(processo?.link_publico_ativo) && !processoEncerrado;
  const statusPaginaPublica = !processo?.link_publico_slug
    ? 'Nao gerada'
    : linkPublicoAtivo
      ? 'Ativa'
      : 'Inativa';
  const candidatosComFluxo = useMemo(
    () =>
      candidatos.map((candidato) =>
        montarCandidatoDeFluxo(candidato, processo?.status || ''),
      ),
    [candidatos, processo?.status],
  );

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      setErro('Nao ha curriculo disponivel para este candidato.');
      return;
    }

    try {
      const arquivo = await baixarCvCandidato(candidato.id_teste);
      const tipo = String(arquivo?.contentType || '').toLowerCase();
      if (tipo.includes('pdf')) {
        abrirBlobEmNovaGuia(arquivo.blob);
        return;
      }

      baixarBlob(arquivo.filename || 'curriculo', arquivo.blob);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel abrir o curriculo do candidato.',
      );
    }
  };

  const gerarPaginaPublica = async () => {
    if (!processo) return;

    try {
      const resultado = await gerarLinkPublicoCandidatura(
        obterReferenciaProcesso(processo) || idProcesso,
      );
      await carregar(paginaPreAnalises);
      if (resultado?.url) {
        setFeedbackLinkPublico('Pagina publica gerada com sucesso.');
      }
    } catch (error) {
      setErro(
        error?.message ||
          'Nao foi possivel gerar a pagina publica de candidatura.',
      );
    }
  };

  const copiarLinkPublico = async () => {
    if (!urlPublicaCandidatura || !linkPublicoAtivo) return;

    try {
      await copiarTexto(urlPublicaCandidatura);
      setFeedbackLinkPublico('Link copiado.');
    } catch (error) {
      setErro('Nao foi possivel copiar o link publico agora.');
    }
  };

  const abrirPaginaPublica = () => {
    if (!urlPublicaCandidatura) return;
    window.open(urlPublicaCandidatura, '_blank', 'noopener,noreferrer');
  };

  const desativarPaginaPublica = async () => {
    if (!processo) return;
    if (!window.confirm('Deseja desativar o link publico desta vaga?')) {
      return;
    }

    try {
      await desativarLinkPublicoCandidatura(
        obterReferenciaProcesso(processo) || idProcesso,
      );
      await carregar(paginaPreAnalises);
      setFeedbackLinkPublico('Link publico desativado.');
    } catch (error) {
      setErro(
        error?.message ||
          'Nao foi possivel desativar o link publico desta vaga.',
      );
    }
  };

  const atualizarStatus = async (idRegistro, status) => {
    const statusSeguro = String(status || '').trim();

    if (processoEncerrado) {
      setErro('O processo seletivo esta encerrado e nao permite novas movimentacoes.');
      return;
    }

    if (statusSeguro === 'Eliminado') {
      const confirmar = window.confirm(
        'Deseja realmente eliminar este candidato?',
      );
      if (!confirmar) return;
    }

    try {
      await atualizarStatusCandidato(idRegistro, {
        status_candidato: statusSeguro,
      });
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Nao foi possivel atualizar o status.');
    }
  };

  const enviarCv = async () => {
    if (!arquivoCv) {
      alert('Selecione um CV antes de analisar.');
      return;
    }

    try {
      setAnalisandoCv(true);
      const formData = new FormData();
      formData.append('arquivo', arquivoCv);
      formData.append('guardar_cv_original', guardarCvOriginal ? '1' : '0');
      await analisarCvProcesso(idProcesso, formData);
      setArquivoCv(null);
      await carregar(1);
    } catch (error) {
      alert(error.message || 'Nao foi possivel analisar o CV.');
    } finally {
      setAnalisandoCv(false);
    }
  };

  const salvarEdicao = async () => {
    if (!preAnaliseSelecionada) return;

    try {
      await atualizarPreAnaliseCv(preAnaliseSelecionada.id_pre_analise, {
        nome_candidato: preAnaliseSelecionada.nome_candidato,
        email: preAnaliseSelecionada.email,
        telefone: preAnaliseSelecionada.telefone,
        whatsapp: preAnaliseSelecionada.whatsapp,
      });

      setPreAnaliseSelecionada(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Nao foi possivel salvar a edicao.');
    }
  };

  const excluirPreAnalise = async (idPreAnalise) => {
    if (!window.confirm('Deseja excluir esta pre-analise?')) return;

    try {
      await excluirPreAnaliseCv(idPreAnalise);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Nao foi possivel excluir a pre-analise.');
    }
  };

  const incluirNoProcesso = async (idPreAnalise) => {
    try {
      await adicionarPreAnaliseAoProcesso(idPreAnalise);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Nao foi possivel adicionar ao processo.');
    }
  };

  const abrirAgendamento = (candidato) => {
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');
    if (estadoAcoes.processClosed || !estadoAcoes.canScheduleInterview) {
      setErro('Somente candidatos qualificados em processo aberto podem seguir para agendamento.');
      return;
    }

    setAgendamentoSelecionado(candidato);
    setFormularioEntrevista({
      id_registro: candidato.id_registro,
      id_processo: candidato.id_processo,
      id_processo_ref:
        obterReferenciaProcessoDoCandidato(candidato) ||
        obterReferenciaProcesso(processo),
      data_entrevista: '',
      status_entrevista: 'Agendado',
      link_agendamento: processo?.link_agendamento || candidato.link_entrevista || '',
      observacoes_rh: '',
      email: candidato.email || '',
      telefone: candidato.telefone || '',
      whatsapp: candidato.whatsapp || candidato.telefone || '',
    });
  };

  const montarMensagemEntrevista = () => {
    const nome = agendamentoSelecionado?.nome_candidato || 'candidato(a)';
    const link = formularioEntrevista.link_agendamento || processo?.link_agendamento || '';
    return [
      `Olá ${nome}, gostaríamos de reservar uma entrevista com você.`,
      'Escolha o melhor dia para o contato.',
      link ? `Link do agendamento: ${link}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const salvarAgendamento = async (canal = '') => {
    if (processoEncerrado) {
      setErro('O processo seletivo esta encerrado e nao permite novas movimentacoes.');
      return;
    }

    const mensagemErro = validarFormularioEntrevista(formularioEntrevista);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvandoEntrevista(true);
    setErro('');

    try {
      const resultado = await agendarEntrevista({
        ...formularioEntrevista,
        data_entrevista: null,
      });
      const mensagem = resultado?.mensagem_base || montarMensagemEntrevista();
      await copiarTexto(mensagem).catch(() => null);

      if (canal === 'whatsapp') {
        const numeroBase = String(formularioEntrevista.whatsapp || formularioEntrevista.telefone || '').replace(/\D/g, '');
        if (!numeroBase) {
          throw new Error('O candidato nao possui numero de WhatsApp valido extraido do CV.');
        }
        window.open(`https://wa.me/${numeroBase}?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener,noreferrer');
      }

      if (canal === 'email') {
        const emailDestino = String(formularioEntrevista.email || '').trim();
        if (!emailDestino) {
          throw new Error('O candidato nao possui e-mail valido extraido do CV.');
        }
        const assunto = encodeURIComponent('Agendamento de entrevista');
        window.location.href = `mailto:${emailDestino}?subject=${assunto}&body=${encodeURIComponent(mensagem)}`;
      }

      if (!canal) {
        window.alert('Mensagem preparada com sucesso e copiada para a area de transferencia.');
      }

      setAgendamentoSelecionado(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      setErro(error?.message || 'Nao foi possivel agendar a entrevista.');
    } finally {
      setSalvandoEntrevista(false);
    }
  };

  if (carregando) {
    return html`
      <${PainelRh}
        screenId="screen-process-details"
        navAtiva="screen-processes"
        subtituloMarca="Detalhes do processo"
        placeholderBusca="Detalhes do processo"
        controlador=${controlador}
        acaoPrimaria=${{
          label: 'Voltar para processos',
          onClick: () => controlador.irParaTelaProtegida('screen-processes'),
        }}
        acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
      >
        <div class="alert alert-info">Carregando detalhes do processo...</div>
      </${PainelRh}>
    `;
  }

  return html`
    <${PainelRh}
      screenId="screen-process-details"
      navAtiva="screen-processes"
      subtituloMarca="Detalhes do processo"
      placeholderBusca="Detalhes do processo"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Gerenciar processos',
        onClick: () => controlador.irParaTelaProtegida('screen-processes'),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Processo seletivo"
        title="Detalhes do processo"
        description="Acompanhe o fluxo completo do RH: pre-analise, qualificacao, entrevistas, decisao final e fechamento do processo."
      />

      ${erro ? html`<div class="alert alert-danger">${erro}</div>` : null}
      ${processoEncerrado
        ? html`
            <div class="rh-inline-alert">
              Processo encerrado. As movimentacoes operacionais de candidatos ficam bloqueadas.
            </div>
          `
        : null}

      <${SectionCard}
        title="Resumo do processo"
        description=${processo
          ? `${processo.id_processo || '-'} • ${processo.vaga || '-'}`
          : 'Processo nao localizado.'}
        tourId="process-summary"
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
          >
            Voltar
          </button>
        `}
      >
        <${MetricGrid}
          items=${[
            { label: 'Nome', value: processo?.nome_processo || '-' },
            { label: 'Vaga', value: processo?.vaga || '-' },
            { label: 'Operacao', value: processo?.operacao || '-' },
            { label: 'Trilha', value: processo?.trilha || '-' },
            {
              label: 'Status',
              value: processo?.status || '-',
            },
            {
              label: 'Nota de corte',
              value: Number(processo?.usa_nota_corte || 0)
                ? processo?.nota_corte || '-'
                : 'Nao',
            },
            { label: 'Vagas', value: processo?.quantidade_vagas || 0 },
            {
              label: 'Encerramento',
              value: processo?.data_encerramento || '-',
            },
            {
              label: 'Link agendamento',
              value: processo?.link_agendamento
                ? html`
                    <a
                      href=${processo.link_agendamento}
                      target="_blank"
                      rel="noreferrer"
                      class="rh-link-inline"
                    >
                      Abrir link
                    </a>
                  `
                : 'Nao informado',
            },
          ]}
        />
        <div class="mt-4">
          <${MetricGrid}
            items=${[
              { label: 'Total', value: resumo?.total || 0 },
              { label: 'Em analise', value: resumo?.analise || 0, variant: 'is-analysis' },
              { label: 'Qualificados', value: resumo?.qualificados || 0, variant: 'is-highlight' },
              { label: 'Entrevistas', value: resumo?.entrevistas || 0, variant: 'is-confirmed' },
              { label: 'Aprovados', value: resumo?.aprovados || 0, variant: 'is-approved' },
              { label: 'Eliminados', value: resumo?.eliminados || 0, variant: 'is-eliminated' },
              { label: 'Banco de talentos', value: resumo?.banco || 0, variant: 'is-talent' },
            ]}
          />
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Pagina publica de candidatura"
        description="Gere um link exclusivo para esta vaga e acompanhe o status da pagina publica sem expor informacoes administrativas."
      >
        <${MetricGrid}
          items=${[
            { label: 'Status', value: statusPaginaPublica },
            {
              label: 'Slug publico',
              value: processo?.link_publico_slug || 'Ainda nao gerado',
            },
            {
              label: 'Criado em',
              value: formatarDataHora(processo?.link_publico_criado_em),
            },
          ]}
        />

        <div class="row g-3 align-items-end mt-1">
          <div class="col-lg-8">
            <label class="form-label">Link publico</label>
            <input
              class="form-control"
              readonly
              value=${urlPublicaCandidatura || 'Gere a pagina para visualizar o link publico.'}
            />
            <div class="form-text">
              A pagina publica exibe a vaga, uma descricao objetiva e o formulario
              de candidatura. Quando nao houver texto publico cadastrado, o sistema
              monta um resumo automatico com base na vaga, operacao e trilha.
            </div>
          </div>

          <div class="col-lg-4">
            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
              ${!processo?.link_publico_slug
                ? html`
                    <button
                      type="button"
                      class="btn btn-primary"
                      disabled=${processoEncerrado}
                      onClick=${gerarPaginaPublica}
                    >
                      Gerar pagina de CV
                    </button>
                  `
                : html`
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      disabled=${!linkPublicoAtivo}
                      onClick=${copiarLinkPublico}
                    >
                      Copiar link
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-primary"
                      disabled=${!urlPublicaCandidatura}
                      onClick=${abrirPaginaPublica}
                    >
                      Abrir pagina
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-danger"
                      disabled=${!linkPublicoAtivo}
                      onClick=${desativarPaginaPublica}
                    >
                      Desativar link
                    </button>
                    ${!linkPublicoAtivo && !processoEncerrado
                      ? html`
                          <button
                            type="button"
                            class="btn btn-primary"
                            onClick=${gerarPaginaPublica}
                          >
                            Gerar nova pagina
                          </button>
                        `
                      : null}
                  `}
            </div>
          </div>
        </div>

        ${feedbackLinkPublico
          ? html`<div class="alert alert-success mt-3 mb-0">${feedbackLinkPublico}</div>`
          : null}
      </${SectionCard}>

      <${SectionCard}
        title="Pre-analise de CV"
        description="Analise automatica com possibilidade de ajuste manual antes da inclusao no processo."
        tourId="process-cv-preanalysis"
      >
        <div class="row g-3 align-items-end">
          <div class="col-md-6">
            <label class="form-label">Adicionar CV</label>
            <input
              type="file"
              class="form-control"
              accept=".pdf,.doc,.docx,.txt"
              onChange=${(event) => setArquivoCv(event.target.files?.[0] || null)}
            />
          </div>
          <div class="col-md-3">
            <div class="form-check mt-4">
              <input
                class="form-check-input"
                type="checkbox"
                id="guardarCvOriginal"
                checked=${guardarCvOriginal}
                onChange=${(event) => setGuardarCvOriginal(!!event.target.checked)}
              />
              <label class="form-check-label" for="guardarCvOriginal">
                Guardar CV original
              </label>
            </div>
          </div>
          <div class="col-md-3">
            <button
              type="button"
              class="btn btn-primary w-100"
              onClick=${enviarCv}
              disabled=${analisandoCv}
            >
              ${analisandoCv ? 'Analisando...' : 'Analisar CV'}
            </button>
          </div>
        </div>

        <div class="table-responsive mt-4">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Classificacao</th>
                <th>Score</th>
                <th class="text-end">Acoes</th>
              </tr>
            </thead>
            <tbody>
              ${preAnalises.length
                ? preAnalises.map(
                    (item) => html`
                      <tr key=${item.id_pre_analise}>
                        <td>${item.nome_candidato || '-'}</td>
                        <td>${item.email || '-'}</td>
                        <td>${item.telefone || item.whatsapp || '-'}</td>
                        <td>
                          <span
                            class=${`cv-classification-badge ${item.classificacao_slug || ''}`}
                          >
                            ${item.classificacao || '-'}
                          </span>
                        </td>
                        <td>${item.score_final ?? '-'}</td>
                        <td class="text-end">
                          <div class="d-flex justify-content-end gap-2 flex-wrap">
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-secondary"
                              onClick=${() => setPreAnaliseSelecionada({ ...item })}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-dark"
                              onClick=${() => setResultadoAnaliseSelecionado(item)}
                            >
                              Resultado
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-info"
                              onClick=${() => setVisualizacaoCv(item)}
                            >
                              Ver CV
                            </button>
                            ${Number(item.ja_adicionado_ao_processo || 0) !== 1 &&
                            String(item.classificacao || '').trim() === 'Qualificado'
                              ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-success"
                                    onClick=${() =>
                                      incluirNoProcesso(item.id_pre_analise)}
                                  >
                                    Adicionar
                                  </button>
                                `
                              : null}
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-danger"
                              onClick=${() => excluirPreAnalise(item.id_pre_analise)}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                : html`
                    <${TabelaVazia}
                      colunas=${6}
                      texto="Nenhuma pre-analise encontrada."
                    />
                  `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginaPreAnalises}
          totalPaginas=${totalPaginasPreAnalises}
          onChange=${(pagina) => carregar(pagina)}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Candidatos no processo"
        description="As acoes aparecem somente quando a etapa do candidato permite movimentacao dentro do fluxo do RH."
        tourId="process-candidates"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Contato / origem</th>
                <th>Localidade</th>
                <th>Status</th>
                <th>Entrevista</th>
                <th>CV</th>
                <th class="text-end">Acoes</th>
              </tr>
            </thead>
            <tbody>
              ${candidatosComFluxo.length
                ? candidatosComFluxo.map(
                    (candidato) => html`
                      <tr key=${candidato.id_registro}>
                        <td>
                          <strong>${candidato.nome_candidato || '-'}</strong>
                          <div class="small text-muted mt-1">
                            ${candidato.vaga || '-'}
                          </div>
                          ${candidato.tags?.length
                            ? html`
                                <div class="rh-chip-wrap mt-2">
                                  ${candidato.tags.slice(0, 3).map(
                                    (tag) => html`
                                      <span key=${tag} class="rh-chip">${tag}</span>
                                    `,
                                  )}
                                </div>
                              `
                            : null}
                        </td>
                        <td>
                          <div>${candidato.email || '-'}</div>
                          <div class="small text-muted">
                            ${candidato.whatsapp || candidato.telefone || '-'}
                          </div>
                          <div class="small text-muted">
                            ${candidato.origem || '-'}
                          </div>
                        </td>
                        <td>
                          <div>${candidato.cidade || '-'}</div>
                          <div class="small text-muted">
                            ${candidato.bairro || '-'}
                          </div>
                        </td>
                        <td>
                          <span
                            class=${`process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_fluxo)}`}
                          >
                            ${candidato.status_fluxo || '-'}
                          </span>
                        </td>
                        <td>
                          ${candidato.status_entrevista
                            ? html`
                                <div class="rh-cell-stack">
                                  <span
                                    class=${`rh-status-pill ${obterClasseStatusEntrevista(candidato.status_entrevista)}`}
                                  >
                                    ${candidato.status_entrevista}
                                  </span>
                                  <small>${formatarDataHora(candidato.data_entrevista)}</small>
                                </div>
                              `
                            : candidato.acoes_fluxo?.canScheduleInterview
                              ? 'Aguardando agendamento'
                              : processoEncerrado
                                ? 'Processo encerrado'
                                : 'Sem entrevista prevista'}
                        </td>
                        <td>
                          ${candidato.cv_disponivel
                            ? html`
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-secondary"
                                  onClick=${() => abrirCurriculo(candidato)}
                                >
                                  Ver CV
                                </button>
                              `
                            : 'Sem CV'}
                        </td>
                        <td class="text-end">
                          ${renderizarAcoesDoCandidato({
                            candidato,
                            onAgendarEntrevista: abrirAgendamento,
                            onAtualizarStatus: (item, status) =>
                              atualizarStatus(item.id_registro, status),
                          })}
                        </td>
                      </tr>
                    `,
                  )
                : html`
                    <${TabelaVazia}
                      colunas=${6}
                      texto="Nenhum candidato vinculado a este processo."
                    />
                  `}
            </tbody>
          </table>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Entrevistas agendadas"
        description="Agenda vinculada ao processo atual, reutilizando o link de agendamento quando disponivel."
        tourId="process-interviews"
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => controlador.irParaTelaProtegida('screen-interviews')}
          >
            Ver agenda completa
          </button>
        `}
      >
        ${carregando
          ? html`
              <${LoadingState}
                titulo="Carregando entrevistas"
                descricao="Sincronizando agenda e status do candidato."
              />
            `
          : entrevistas.length
            ? html`
                <div class="table-responsive">
                  <table class="table align-middle rh-modern-history-table">
                    <thead>
                      <tr>
                        <th>Candidato</th>
                        <th>Data / hora</th>
                        <th>Status</th>
                        <th>Link</th>
                        <th>Observacoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${entrevistas.map(
                        (entrevista) => html`
                          <tr key=${entrevista.id_entrevista}>
                            <td>${entrevista.nome_candidato || '-'}</td>
                            <td>${formatarDataHora(entrevista.data_entrevista)}</td>
                            <td>
                              <span
                                class=${`rh-status-pill ${obterClasseStatusEntrevista(entrevista.status_entrevista)}`}
                              >
                                ${entrevista.status_entrevista || '-'}
                              </span>
                            </td>
                            <td>
                              ${entrevista.link_agendamento
                                ? html`
                                    <a
                                      href=${entrevista.link_agendamento}
                                      target="_blank"
                                      rel="noreferrer"
                                      class="rh-link-inline"
                                    >
                                      Abrir
                                    </a>
                                  `
                                : 'Sem link'}
                            </td>
                            <td>${entrevista.observacoes_rh || 'Sem observacoes.'}</td>
                          </tr>
                        `,
                      )}
                    </tbody>
                  </table>
                </div>
              `
            : html`
                <${EmptyState}
                  title="Nenhuma entrevista agendada"
                  text="Use o botao “Agendar entrevista” na tabela de candidatos para registrar o compromisso."
                />
              `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!agendamentoSelecionado}
        titulo="Agendar entrevista"
        subtitulo="A entrevista sera vinculada ao candidato e ao processo selecionado."
        onClose=${() => setAgendamentoSelecionado(null)}
      >
        ${agendamentoSelecionado
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${agendamentoSelecionado.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Processo</label>
                    <input
                      class="form-control"
                      readonly
                      value=${agendamentoSelecionado.id_processo || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Vaga</label>
                    <input
                      class="form-control"
                      readonly
                      value=${agendamentoSelecionado.vaga || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Status inicial</label>
                    <select
                      class="form-select"
                      value=${formularioEntrevista.status_entrevista}
                      onChange=${(event) =>
                        setFormularioEntrevista({
                          ...formularioEntrevista,
                          status_entrevista: event.target.value,
                        })}
                    >
                      <option value="Agendado">Agendado</option>
                      <option value="Confirmado">Confirmado</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Link de agendamento</label>
                    <input
                      class="form-control"
                      placeholder="https://bookings.cloud.microsoft/..."
                      value=${formularioEntrevista.link_agendamento}
                      onInput=${(event) =>
                        setFormularioEntrevista({
                          ...formularioEntrevista,
                          link_agendamento: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">WhatsApp extraido do CV</label>
                    <input
                      class="form-control"
                      placeholder="21999999999"
                      value=${formularioEntrevista.whatsapp || formularioEntrevista.telefone || ''}
                      onInput=${(event) =>
                        setFormularioEntrevista({
                          ...formularioEntrevista,
                          whatsapp: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">E-mail extraido do CV</label>
                    <input
                      class="form-control"
                      placeholder="candidato@email.com"
                      value=${formularioEntrevista.email || ''}
                      onInput=${(event) =>
                        setFormularioEntrevista({
                          ...formularioEntrevista,
                          email: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Mensagem que sera enviada</label>
                    <textarea
                      class="form-control"
                      rows="6"
                      readonly
                      value=${montarMensagemEntrevista()}
                    ></textarea>
                    ${processo?.link_agendamento
                      ? html`
                          <div class="form-text">
                            O link de agendamento do processo sera reaproveitado automaticamente nesta mensagem.
                          </div>
                        `
                      : null}
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observacoes RH</label>
                    <textarea
                      class="form-control"
                      rows="4"
                      value=${formularioEntrevista.observacoes_rh}
                      onInput=${(event) =>
                        setFormularioEntrevista({
                          ...formularioEntrevista,
                          observacoes_rh: event.target.value,
                        })}
                    ></textarea>
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setAgendamentoSelecionado(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  disabled=${salvandoEntrevista || processoEncerrado}
                  onClick=${() => salvarAgendamento('email')}
                >
                  ${salvandoEntrevista ? 'Salvando...' : 'Enviar por e-mail'}
                </button>
                <button
                  type="button"
                  class="btn btn-success"
                  disabled=${salvandoEntrevista || processoEncerrado}
                  onClick=${() => salvarAgendamento('whatsapp')}
                >
                  ${salvandoEntrevista
                    ? 'Salvando...'
                    : processoEncerrado
                      ? 'Processo encerrado'
                      : 'Enviar por WhatsApp'}
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!preAnaliseSelecionada}
        titulo="Editar pre-cadastro"
        subtitulo="Ajuste as informacoes extraidas do CV antes de seguir."
        onClose=${() => setPreAnaliseSelecionada(null)}
      >
        ${preAnaliseSelecionada
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Nome</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.nome_candidato || ''}
                      onInput=${(event) =>
                        setPreAnaliseSelecionada({
                          ...preAnaliseSelecionada,
                          nome_candidato: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">E-mail</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.email || ''}
                      onInput=${(event) =>
                        setPreAnaliseSelecionada({
                          ...preAnaliseSelecionada,
                          email: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Telefone</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.telefone || ''}
                      onInput=${(event) =>
                        setPreAnaliseSelecionada({
                          ...preAnaliseSelecionada,
                          telefone: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">WhatsApp</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.whatsapp || ''}
                      onInput=${(event) =>
                        setPreAnaliseSelecionada({
                          ...preAnaliseSelecionada,
                          whatsapp: event.target.value,
                        })}
                    />
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setPreAnaliseSelecionada(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${salvarEdicao}
                >
                  Salvar
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!visualizacaoCv}
        titulo="Visualizacao do CV"
        subtitulo="Texto bruto extraido do curriculo."
        onClose=${() => setVisualizacaoCv(null)}
        className="cv-preview-dialog"
      >
        ${visualizacaoCv
          ? html`
              <div class="rh-details-body">
                <div class="cv-preview-box">
                  ${visualizacaoCv.texto_extraido || 'Sem conteudo extraido.'}
                </div>
                ${visualizacaoCv.arquivo_original_base64
                  ? html`
                      <div class="mt-3 text-end">
                        <button
                          type="button"
                          class="btn btn-outline-primary"
                          onClick=${() => {
                            const link = document.createElement('a');
                            link.href = `data:${visualizacaoCv.mime_type || 'application/octet-stream'};base64,${visualizacaoCv.arquivo_original_base64}`;
                            link.download = visualizacaoCv.nome_arquivo || 'cv';
                            link.click();
                          }}
                        >
                          Baixar original
                        </button>
                      </div>
                    `
                  : null}
              </div>
            `
          : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!resultadoAnaliseSelecionado}
        titulo="Resultado da analise"
        subtitulo="Resumo analitico da classificacao automatica do CV."
        onClose=${() => setResultadoAnaliseSelecionado(null)}
      >
        ${resultadoAnaliseSelecionado
          ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
                    {
                      label: 'Score',
                      value: resultadoAnaliseSelecionado.score_final ?? '-',
                    },
                    {
                      label: 'Classificacao',
                      value: html`
                        <span
                          class=${`cv-classification-badge ${resultadoAnaliseSelecionado.classificacao_slug || ''}`}
                        >
                          ${resultadoAnaliseSelecionado.classificacao || '-'}
                        </span>
                      `,
                    },
                  ]}
                />

                <${SectionCard}
                  title="Palavras-chave identificadas"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${(() => {
                      try {
                        const palavras = JSON.parse(
                          resultadoAnaliseSelecionado.palavras_chave || '[]',
                        );
                        return Array.isArray(palavras) && palavras.length
                          ? palavras.join(', ')
                          : 'Nenhuma palavra-chave relevante foi identificada.';
                      } catch (error) {
                        return (
                          resultadoAnaliseSelecionado.palavras_chave ||
                          'Nenhuma palavra-chave relevante foi identificada.'
                        );
                      }
                    })()}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Pontos observados pelo sistema"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${(() => {
                      try {
                        const problemas = JSON.parse(
                          resultadoAnaliseSelecionado.problemas || '[]',
                        );
                        return Array.isArray(problemas) && problemas.length
                          ? problemas.join('\n')
                          : 'Nenhum problema critico foi apontado.';
                      } catch (error) {
                        return (
                          resultadoAnaliseSelecionado.problemas ||
                          'Nenhum problema critico foi apontado.'
                        );
                      }
                    })()}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Resumo analitico"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${montarResumoAnaliticoCv(resultadoAnaliseSelecionado)}
                  </div>
                </${SectionCard}>
              </div>
            `
          : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}

```

## Front\fonte\features\public-candidacy\index.js

`$lang
import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  enviarCandidaturaPublica,
  lerPaginaPublicaCandidatura,
} from '../../servico-api.js';
import { obterSlugCandidaturaPorHash } from '../../rotas.js';

function quebrarTextoEmLinhas(valor) {
  return String(valor || '')
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TelaCandidaturaPublica() {
  const [slug, setSlug] = useState(() =>
    obterSlugCandidaturaPorHash(window.location.hash),
  );
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [dados, setDados] = useState(null);
  const [formulario, setFormulario] = useState({
    nome_completo: '',
    email: '',
    telefone: '',
    cidade: '',
    bairro: '',
    lgpd_aceito: false,
    curriculo: null,
  });

  useEffect(() => {
    const aoTrocarHash = () =>
      setSlug(obterSlugCandidaturaPorHash(window.location.hash));
    window.addEventListener('hashchange', aoTrocarHash);
    return () => window.removeEventListener('hashchange', aoTrocarHash);
  }, []);

  useEffect(() => {
    const carregar = async () => {
      if (!slug) {
        setDados(null);
        setErro('Link de candidatura invalido.');
        setCarregando(false);
        return;
      }

      setCarregando(true);
      setErro('');
      setMensagemSucesso('');

      try {
        const resposta = await lerPaginaPublicaCandidatura(slug);
        setDados(resposta || null);
      } catch (error) {
        setDados(null);
        setErro(
          error?.message ||
            'Nao foi possivel carregar os detalhes desta vaga agora.',
        );
      } finally {
        setCarregando(false);
      }
    };

    carregar();
  }, [slug]);

  const requisitos = useMemo(
    () => quebrarTextoEmLinhas(dados?.requisitos_publicos || ''),
    [dados],
  );

  const descricaoLinhas = useMemo(
    () => quebrarTextoEmLinhas(dados?.descricao_publica || ''),
    [dados],
  );

  const atualizarCampo = (campo, valor) =>
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));

  const enviar = async (event) => {
    event?.preventDefault?.();
    if (!slug || !dados?.disponivel) return;

    if (!formulario.curriculo) {
      setErro('Anexe o curriculo antes de enviar a candidatura.');
      return;
    }

    setEnviando(true);
    setErro('');

    try {
      const formData = new FormData();
      formData.append('nome_completo', formulario.nome_completo);
      formData.append('email', formulario.email);
      formData.append('telefone', formulario.telefone);
      formData.append('cidade', formulario.cidade);
      formData.append('bairro', formulario.bairro);
      formData.append('lgpd_aceito', formulario.lgpd_aceito ? '1' : '0');
      formData.append('curriculo', formulario.curriculo);

      const resposta = await enviarCandidaturaPublica(slug, formData);
      setMensagemSucesso(
        resposta?.message ||
          'Candidatura enviada com sucesso. Recebemos suas informacoes e seu curriculo. O RH analisara seu perfil e podera entrar em contato pelo telefone ou e-mail informado.',
      );
      setFormulario({
        nome_completo: '',
        email: '',
        telefone: '',
        cidade: '',
        bairro: '',
        lgpd_aceito: false,
        curriculo: null,
      });
      const inputArquivo = document.getElementById('candidatura-curriculo');
      if (inputArquivo) {
        inputArquivo.value = '';
      }
    } catch (error) {
      setErro(
        error?.message ||
          'Nao foi possivel enviar sua candidatura agora. Tente novamente em instantes.',
      );
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <section class="active screen" id="screen-public-candidacy">
      <div class="rh-public-application-shell">
        <aside class="rh-public-application-hero">
          <div class="rh-public-application-brand">
            <img
              alt="Conecta C24h"
              class="rh-public-application-logo"
              src="estilos/logo-conecta-c24h.png"
            />
            <span class="rh-public-application-badge">
              Candidatura publica
            </span>
          </div>

          <div>
            <h1 class="rh-public-application-title">
              ${dados?.vaga || 'Candidatura Conecta C24h'}
            </h1>
            <p class="rh-public-application-text">
              Candidate-se a esta oportunidade em poucos minutos. Seus dados
              serao usados exclusivamente para este processo seletivo.
            </p>
          </div>

          <div class="rh-public-application-points">
            <span>Formulario responsivo</span>
            <span>Upload seguro do curriculo</span>
            <span>Retorno pelo RH</span>
          </div>
        </aside>

        <main class="rh-public-application-main">
          <article class="rh-public-card">
            <div class="rh-public-card-header">
              <div>
                <p class="rh-modern-kicker">Vaga</p>
                <h2 class="rh-public-card-title">
                  ${dados?.vaga || 'Carregando vaga'}
                </h2>
              </div>
              ${dados
                ? html`
                    <span
                      class=${`rh-status-pill ${dados.disponivel ? 'is-approved' : 'is-eliminated'}`}
                    >
                      ${dados.status || '-'}
                    </span>
                  `
                : null}
            </div>

            ${carregando
              ? html`
                  <div class="alert alert-secondary mb-0">
                    Carregando informacoes da vaga...
                  </div>
                `
              : erro && !dados
                ? html`<div class="alert alert-danger mb-0">${erro}</div>`
                : html`
                    <div class="rh-public-copy-stack">
                      <section>
                        <h3 class="rh-public-copy-title">Descricao da vaga</h3>
                        ${descricaoLinhas.length
                          ? descricaoLinhas.map(
                              (linha, indice) => html`
                                <p key=${indice} class="rh-public-copy-text">
                                  ${linha}
                                </p>
                              `,
                            )
                          : html`
                              <p class="rh-public-copy-text">
                                Informacoes publicas desta vaga serao apresentadas aqui.
                              </p>
                            `}
                      </section>

                      <section>
                        <h3 class="rh-public-copy-title">Requisitos</h3>
                        ${requisitos.length
                          ? html`
                              <ul class="rh-public-copy-list">
                                ${requisitos.map(
                                  (item, indice) => html`
                                    <li key=${indice}>${item}</li>
                                  `,
                                )}
                              </ul>
                            `
                          : html`
                              <p class="rh-public-copy-text">
                                O RH pode detalhar requisitos adicionais ao longo do processo.
                              </p>
                            `}
                      </section>
                    </div>
                  `}
          </article>

          <article class="rh-public-card">
            <div class="rh-public-card-header">
              <div>
                <p class="rh-modern-kicker">Formulario</p>
                <h2 class="rh-public-card-title">Envie sua candidatura</h2>
              </div>
            </div>

            ${erro && dados
              ? html`<div class="alert alert-danger">${erro}</div>`
              : null}

            ${mensagemSucesso
              ? html`
                  <div class="alert alert-success mb-0">
                    ${mensagemSucesso}
                  </div>
                `
              : !dados?.disponivel
                ? html`
                    <div class="alert alert-warning mb-0">
                      ${dados?.mensagem ||
                      'Esta vaga esta encerrada e nao aceita novas candidaturas.'}
                    </div>
                  `
                : html`
                    <form class="rh-public-form" onSubmit=${enviar}>
                      <div class="row g-3">
                        <div class="col-md-12">
                          <label class="form-label">Nome completo</label>
                          <input
                            class="form-control"
                            required
                            value=${formulario.nome_completo}
                            onInput=${(event) =>
                              atualizarCampo(
                                'nome_completo',
                                event.target.value,
                              )}
                          />
                        </div>

                        <div class="col-md-6">
                          <label class="form-label">Telefone / WhatsApp</label>
                          <input
                            class="form-control"
                            required
                            value=${formulario.telefone}
                            onInput=${(event) =>
                              atualizarCampo('telefone', event.target.value)}
                          />
                        </div>

                        <div class="col-md-6">
                          <label class="form-label">E-mail</label>
                          <input
                            class="form-control"
                            type="email"
                            required
                            value=${formulario.email}
                            onInput=${(event) =>
                              atualizarCampo('email', event.target.value)}
                          />
                        </div>

                        <div class="col-md-6">
                          <label class="form-label">Cidade</label>
                          <input
                            class="form-control"
                            required
                            value=${formulario.cidade}
                            onInput=${(event) =>
                              atualizarCampo('cidade', event.target.value)}
                          />
                        </div>

                        <div class="col-md-6">
                          <label class="form-label">Bairro</label>
                          <input
                            class="form-control"
                            required
                            value=${formulario.bairro}
                            onInput=${(event) =>
                              atualizarCampo('bairro', event.target.value)}
                          />
                        </div>

                        <div class="col-md-12">
                          <label class="form-label">Curriculo</label>
                          <input
                            id="candidatura-curriculo"
                            class="form-control"
                            type="file"
                            accept=".pdf,.doc,.docx"
                            required
                            onChange=${(event) =>
                              atualizarCampo(
                                'curriculo',
                                event.target.files?.[0] || null,
                              )}
                          />
                          <div class="form-text">
                            Formatos aceitos: PDF, DOC ou DOCX. Tamanho maximo: 5 MB.
                          </div>
                        </div>

                        <div class="col-md-12">
                          <div class="form-check rh-public-lgpd-check">
                            <input
                              class="form-check-input"
                              id="public-lgpd"
                              type="checkbox"
                              checked=${formulario.lgpd_aceito}
                              onChange=${(event) =>
                                atualizarCampo(
                                  'lgpd_aceito',
                                  !!event.target.checked,
                                )}
                            />
                            <label
                              class="form-check-label"
                              for="public-lgpd"
                            >
                              Autorizo o uso dos meus dados neste processo seletivo,
                              conforme a LGPD.
                            </label>
                          </div>
                        </div>
                      </div>

                      <div class="rh-public-form-footer">
                        <p class="rh-public-form-note">
                          Seus dados nao exibem notas, classificacoes internas ou
                          informacoes administrativas.
                        </p>
                        <button
                          type="submit"
                          class="btn btn-primary"
                          disabled=${enviando}
                        >
                          ${enviando ? 'Enviando candidatura...' : 'Enviar candidatura'}
                        </button>
                      </div>
                    </form>
                  `}
          </article>
        </main>
      </div>
    </section>
  `;
}

```

## Front\fonte\rotas.js

`$lang
// Mantém a navegação em hash simples para funcionar sem etapa de build.
export const ROTAS_POR_TELA = {
  'screen-login': 'login',
  'screen-menu': 'inicio',
  'screen-history': 'historico',
  'screen-processes': 'processos',
  'screen-candidates': 'candidatos',
  'screen-candidate-pipeline': 'pipeline-candidatos',
  'screen-process-create': 'novo-processo',
  'screen-process-details': 'detalhes-processo',
  'screen-interviews': 'entrevistas',
  'screen-talent-bank': 'banco-talentos',
  'screen-config': 'configuracao',
  'screen-candidate': 'candidato',
  'screen-exam': 'prova',
  'screen-thanks': 'conclusao',
  'screen-result': 'resultado',
  'screen-analysis-candidates': 'analise-candidatos',
  'screen-public-candidacy': 'candidatar',
};

export const TELAS_POR_ROTA = Object.entries(ROTAS_POR_TELA).reduce(
  (mapa, [tela, rota]) => {
    mapa[rota] = tela;
    return mapa;
  },
  {},
);

export function obterRotaPorTela(tela) {
  return ROTAS_POR_TELA[tela] || ROTAS_POR_TELA['screen-login'];
}

export function obterTelaPorHash(hashAtual) {
  const rota = String(hashAtual || '')
    .replace(/^#\/?/, '')
    .trim();

  if (!rota) return 'screen-login';
  if (rota.startsWith('candidatar/')) return 'screen-public-candidacy';
  return TELAS_POR_ROTA[rota] || 'screen-login';
}

export function montarHashDaTela(tela) {
  return `#/${obterRotaPorTela(tela)}`;
}

export function obterSlugCandidaturaPorHash(hashAtual) {
  const rota = String(hashAtual || '')
    .replace(/^#\/?/, '')
    .trim();

  if (!rota.startsWith('candidatar/')) return '';
  return decodeURIComponent(rota.slice('candidatar/'.length));
}

export function montarHashCandidatura(slug) {
  return `#/candidatar/${encodeURIComponent(String(slug || '').trim())}`;
}

```

## Front\fonte\services\api\core.js

`$lang
import { criarLogger } from '../../logger.js';

const URL_API_BASE = window.__RH_API_BASE__ || 'http://127.0.0.1:8010';
const TEMPO_CACHE_MS = 15000;
const CHAVE_TOKEN_AUTENTICACAO = 'rh_api_access_token';
const CHAVE_USUARIO_AUTENTICADO = 'rh_api_authenticated_user';

export const EVENTO_AUTENTICACAO_EXPIRADA = 'rh-auth-expired';

const cacheMemoria = new Map();
const logger = criarLogger('api');

function lerCache(chave) {
  const entrada = cacheMemoria.get(chave);
  if (!entrada) return null;

  if (Date.now() - entrada.timestamp > TEMPO_CACHE_MS) {
    cacheMemoria.delete(chave);
    return null;
  }

  return entrada.data;
}

function gravarCache(chave, data) {
  cacheMemoria.set(chave, {
    data,
    timestamp: Date.now(),
  });
}

export function lerSessaoAutenticacao() {
  return {
    token: sessionStorage.getItem(CHAVE_TOKEN_AUTENTICACAO) || '',
    usuario: sessionStorage.getItem(CHAVE_USUARIO_AUTENTICADO) || '',
  };
}

export function salvarSessaoAutenticacao(token, usuario) {
  sessionStorage.setItem(CHAVE_TOKEN_AUTENTICACAO, token || '');
  sessionStorage.setItem(CHAVE_USUARIO_AUTENTICADO, usuario || '');
}

export function limparSessaoAutenticacao() {
  sessionStorage.removeItem(CHAVE_TOKEN_AUTENTICACAO);
  sessionStorage.removeItem(CHAVE_USUARIO_AUTENTICADO);
}

export function possuiSessaoAutenticada() {
  return Boolean(lerSessaoAutenticacao().token);
}

function notificarSessaoExpirada() {
  window.dispatchEvent(new CustomEvent(EVENTO_AUTENTICACAO_EXPIRADA));
}

async function lerMensagemErro(resposta) {
  const tipo = resposta.headers.get('content-type') || '';

  if (tipo.includes('application/json')) {
    const json = await resposta.json().catch(() => null);
    if (json?.message) return json.message;
    if (json?.detail) return json.detail;
  }

  return resposta.text().catch(() => '');
}

async function executarRequisicao(caminho, opcoes = {}, configuracao = {}) {
  const { autenticado = true } = configuracao;
  const headers = new Headers(opcoes.headers || {});
  const sessao = lerSessaoAutenticacao();

  if (autenticado && sessao.token) {
    headers.set('Authorization', `Bearer ${sessao.token}`);
  }

  let resposta;

  try {
    resposta = await fetch(`${URL_API_BASE}${caminho}`, {
      cache: 'no-store',
      ...opcoes,
      headers,
    });
  } catch (error) {
    logger.error('Falha de conectividade com a API.', {
      caminho,
      mensagem: error?.message || '',
    });
    throw new Error(
      `Nao foi possivel conectar com a API em ${URL_API_BASE}${caminho}. Verifique se o servidor da API esta ativo.`,
    );
  }

  if (!resposta.ok) {
    const textoErro = await lerMensagemErro(resposta);

    if (resposta.status === 401) {
      limparSessaoAutenticacao();
      notificarSessaoExpirada();
    }

    logger.warn('Resposta de erro recebida da API.', {
      caminho,
      status: resposta.status,
      textoErro,
    });
    throw new Error(textoErro || `Falha na API (${resposta.status}).`);
  }

  return resposta;
}

function extrairNomeArquivo(resposta) {
  const disposition = resposta.headers.get('content-disposition') || '';
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return 'arquivo';
}

export async function requisitar(caminho, opcoes = {}, configuracao = {}) {
  const resposta = await executarRequisicao(caminho, opcoes, configuracao);

  const tipo = resposta.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    return resposta.json();
  }

  return resposta.text();
}

export async function requisitarArquivo(caminho, opcoes = {}, configuracao = {}) {
  const resposta = await executarRequisicao(caminho, opcoes, configuracao);
  return {
    blob: await resposta.blob(),
    filename: extrairNomeArquivo(resposta),
    contentType:
      resposta.headers.get('content-type') || 'application/octet-stream',
  };
}

export function invalidarCacheApi(...chaves) {
  chaves.forEach((chave) => {
    cacheMemoria.delete(chave);
    Array.from(cacheMemoria.keys())
      .filter((cacheKey) => cacheKey.startsWith(`${chave}:`))
      .forEach((cacheKey) => cacheMemoria.delete(cacheKey));
  });
}

export { gravarCache, lerCache };

```

## Front\fonte\services\api\processes.js

`$lang
import {
  gravarCache,
  invalidarCacheApi,
  lerCache,
  requisitarArquivo,
  requisitar,
} from './core.js';

export async function lerProcessos(forcar = false) {
  if (!forcar) {
    const emCache = lerCache('processos');
    if (emCache) return emCache;
  }

  const dados = await requisitar('/processes', { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache('processos', lista);
  return lista;
}

export async function criarProcesso(dadosProcesso) {
  const resultado = await requisitar('/processes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosProcesso),
  });

  invalidarCacheApi('processos');
  return resultado;
}

export async function atualizarProcesso(idProcesso, dadosProcesso) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosProcesso),
    },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function encerrarProcesso(idProcesso) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/close`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function lerCandidatosProcessos(forcar = false) {
  if (!forcar) {
    const emCache = lerCache('candidatos-processos');
    if (emCache) return emCache;
  }

  const dados = await requisitar('/process-candidates', { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache('candidatos-processos', lista);
  return lista;
}

export async function criarCandidatoNoProcesso(dadosCandidato) {
  const resultado = await requisitar('/process-candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosCandidato),
  });

  invalidarCacheApi(
    'candidatos-processos',
    'banco-talentos',
    'processos',
    'pipeline-candidatos',
  );
  return resultado;
}

export async function atualizarStatusCandidato(idRegistro, dadosStatus) {
  const resultado = await requisitar(
    `/process-candidates/${idRegistro}/status`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosStatus),
    },
  );

  invalidarCacheApi('candidatos-processos', 'banco-talentos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function lerBancoTalentos({
  forcar = false,
  search = '',
  skill = '',
  tag = '',
} = {}) {
  const chaveCache = `banco-talentos:${search}:${skill}:${tag}`;

  if (!forcar) {
    const emCache = lerCache(chaveCache);
    if (emCache) return emCache;
  }

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (skill) params.set('skill', skill);
  if (tag) params.set('tag', tag);

  const sufixo = params.toString() ? `?${params.toString()}` : '';
  const dados = await requisitar(`/talent-bank${sufixo}`, { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache(chaveCache, lista);
  return lista;
}

export async function removerBancoTalentos(idBanco) {
  const resultado = await requisitar(`/talent-bank/${idBanco}`, {
    method: 'DELETE',
  });

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'processos');
  return resultado;
}

export async function atualizarPerfilCandidato(idTeste, payload) {
  const resultado = await requisitar(
    `/candidate-profiles/${encodeURIComponent(idTeste)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'pipeline-candidatos');
  return resultado;
}

export async function usarCandidatoDoBancoTalentos(idBanco, dadosUso) {
  const resultado = await requisitar(`/talent-bank/${idBanco}/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosUso),
  });

  invalidarCacheApi(
    'banco-talentos',
    'candidatos-processos',
    'processos',
    'pipeline-candidatos',
  );
  return resultado;
}

export async function lerDetalheProcesso(idProcesso) {
  return requisitar(`/processes/${encodeURIComponent(idProcesso)}/details`, {
    method: 'GET',
  });
}

export async function lerPreAnalisesCv(idProcesso, pagina = 1, tamanho = 5) {
  const params = new URLSearchParams({
    page: String(pagina),
    page_size: String(tamanho),
  });

  return requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/cv-pre-analyses?${params.toString()}`,
    { method: 'GET' },
  );
}

export async function analisarCvProcesso(idProcesso, formData) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/cv-pre-analyses`,
    {
      method: 'POST',
      body: formData,
    },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function atualizarPreAnaliseCv(idPreAnalise, payload) {
  return requisitar(`/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function excluirPreAnaliseCv(idPreAnalise) {
  return requisitar(`/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}`, {
    method: 'DELETE',
  });
}

export async function adicionarPreAnaliseAoProcesso(idPreAnalise) {
  const resultado = await requisitar(
    `/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}/add-to-process`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function gerarLinkPublicoCandidatura(idProcesso) {
  const resultado = await requisitar(
    `/processos/${encodeURIComponent(idProcesso)}/gerar-link-candidatura`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function desativarLinkPublicoCandidatura(idProcesso) {
  const resultado = await requisitar(
    `/processos/${encodeURIComponent(idProcesso)}/link-candidatura/desativar`,
    { method: 'PATCH' },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function baixarCvCandidato(idTeste) {
  return requisitarArquivo(
    `/candidate-profiles/${encodeURIComponent(idTeste)}/cv`,
    { method: 'GET' },
  );
}

```

## Front\fonte\services\api\public-candidacy.js

`$lang
import { requisitar } from './core.js';

export async function lerPaginaPublicaCandidatura(slug) {
  return requisitar(
    `/public/candidatura/${encodeURIComponent(slug)}`,
    { method: 'GET' },
    { autenticado: false },
  );
}

export async function enviarCandidaturaPublica(slug, formData) {
  return requisitar(
    `/public/candidatura/${encodeURIComponent(slug)}/enviar`,
    {
      method: 'POST',
      body: formData,
    },
    { autenticado: false },
  );
}

```

## Front\fonte\servico-api.js

`$lang
/**
 * @typedef {import('./types/api').SaveAnswerFileRequest} SaveAnswerFileRequest
 * @typedef {import('./types/api').UpdateCandidateStatusRequest} UpdateCandidateStatusRequest
 * @typedef {import('./types/models').HistoryRecord} HistoryRecord
 * @typedef {import('./types/models').Process} Process
 */

export {
  EVENTO_AUTENTICACAO_EXPIRADA,
  invalidarCacheApi,
  limparSessaoAutenticacao,
  lerSessaoAutenticacao,
  possuiSessaoAutenticada,
  salvarSessaoAutenticacao,
} from './services/api/core.js';
export {
  encerrarSessaoApi,
  fazerLoginApi,
  verificarSessaoApi,
} from './services/api/auth.js';
export {
  lerArquivosResposta,
  lerHistorico,
  lerHistoricoPaginado,
  salvarArquivoResposta,
  salvarHistorico,
} from './services/api/history.js';
export {
  adicionarPreAnaliseAoProcesso,
  analisarCvProcesso,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  baixarCvCandidato,
  criarCandidatoNoProcesso,
  criarProcesso,
  desativarLinkPublicoCandidatura,
  encerrarProcesso,
  excluirPreAnaliseCv,
  gerarLinkPublicoCandidatura,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheProcesso,
  lerPreAnalisesCv,
  lerProcessos,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
} from './services/api/processes.js';
export {
  enviarCandidaturaPublica,
  lerPaginaPublicaCandidatura,
} from './services/api/public-candidacy.js';
export {
  lerAnalisesCandidatos,
  lerDetalheAnaliseCandidato,
} from './services/api/analytics.js';
export {
  criarCardPipeline,
  excluirCardPipeline,
  lerPipelineCandidatos,
  moverCardPipeline,
} from './services/api/pipeline.js';
export {
  agendarEntrevista,
  atualizarEntrevista,
  lerEntrevistas,
} from './services/api/interviews.js';

```

## Front\fonte\shared\browser-utils.js

`$lang
export function copiarTexto(texto) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(texto || '');
  }

  const area = document.createElement('textarea');
  area.value = texto || '';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
  return Promise.resolve();
}

export function toDatetimeLocal(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';

  const pad = (item) => String(item).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

export function montarUrlPublicaCandidatura(slug, hrefBase = window.location.href) {
  const safeSlug = String(slug || '').trim();
  if (!safeSlug) return '';

  const url = new URL(hrefBase, window.location.origin);
  url.hash = `/candidatar/${encodeURIComponent(safeSlug)}`;
  return url.toString();
}

export function abrirBlobEmNovaGuia(blob) {
  const url = URL.createObjectURL(blob);
  const janela = window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return janela;
}

```

