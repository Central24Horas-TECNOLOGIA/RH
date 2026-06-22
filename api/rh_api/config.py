from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv() -> None:
    """Carrega .env sem sobrescrever variáveis já definidas pelo processo."""
    for dotenv_path in (PROJECT_ROOT / "api" / ".env", PROJECT_ROOT / ".env"):
        if not dotenv_path.is_file():
            continue

        for line in dotenv_path.read_text(encoding="utf-8-sig").splitlines():
            item = line.strip()
            if not item or item.startswith("#") or "=" not in item:
                continue

            key, raw_value = item.split("=", 1)
            key = key.strip()
            if not key:
                continue
            value = raw_value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def _env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default


def _read_bool_env(*names: str, default: bool = False) -> bool:
    raw_value = _env(*names)
    if not raw_value:
        return default
    normalized = raw_value.lower()
    if normalized in {"1", "true", "yes", "y", "on", "sim", "s"}:
        return True
    if normalized in {"0", "false", "no", "n", "off", "nao", "não"}:
        return False
    return default


def _read_int_env(
    *names: str,
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    raw_value = _env(*names)
    try:
        value = int(raw_value) if raw_value else default
    except (TypeError, ValueError):
        value = default
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def _split_csv(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _resolve_project_path(value: str, default_relative: str) -> str:
    path = Path(value or default_relative).expanduser()
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return str(path.resolve())


@dataclass(frozen=True)
class Settings:
    app_env: str
    server_host: str
    server_port: int
    server_reload: bool
    serve_frontend: bool
    frontend_dir: str
    frontend_api_base_url: str
    process_dossier_ai_endpoint: str
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
    public_candidate_base_url: str
    public_cv_upload_dir: str
    doc_converter: str
    libreoffice_path: str
    email_inbox_enabled: bool
    email_inbox_mode: str
    email_inbox_path: str
    email_inbox_provider: str
    email_inbox_protocol: str
    email_inbox_address: str
    email_inbox_imap_host: str
    email_inbox_imap_port: int
    email_inbox_username: str
    email_inbox_auth_mode: str
    email_inbox_password_env: str
    email_inbox_mailbox: str
    email_inbox_tenant_id: str
    email_inbox_client_id: str
    email_inbox_client_secret_env: str
    email_inbox_oauth_scope: str
    email_inbox_attachments_dir: str
    email_inbox_max_messages: int
    email_inbox_max_attachment_mb: int
    email_graph_tenant_id: str
    email_graph_client_id: str
    email_graph_client_secret_env: str
    email_graph_mailbox: str
    email_graph_scope: str
    email_graph_base_url: str
    email_smtp_enabled: bool
    email_smtp_host: str
    email_smtp_port: int
    email_smtp_username: str
    email_smtp_password_env: str
    email_smtp_from: str
    email_smtp_use_tls: bool
    email_smtp_use_ssl: bool
    ai_enabled: bool
    ai_provider: str
    ai_model: str
    openai_api_key: str
    openai_base_url: str
    ai_timeout_seconds: int
    ai_max_curriculo_chars: int
    ai_duplicate_window_seconds: int

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() != "production"

    @property
    def ai_available(self) -> bool:
        return (
            self.ai_enabled
            and self.ai_provider.lower() == "openai"
            and bool(self.openai_api_key)
            and bool(self.ai_model)
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_dotenv()
    email_inbox_protocol = _env("RH_EMAIL_INBOX_PROTOCOL", default="imap")

    return Settings(
        app_env=_env("RH_APP_ENV", "ENV", default="development"),
        server_host=_env("RH_API_HOST", "RH_SERVER_HOST", "HOST", default="127.0.0.1"),
        server_port=_read_int_env(
            "RH_API_PORT", "RH_SERVER_PORT", "PORT", default=8000, minimum=1, maximum=65535
        ),
        server_reload=_read_bool_env("RH_SERVER_RELOAD", default=False),
        serve_frontend=_read_bool_env(
            "RH_FRONT_SERVE_STATIC", "RH_SERVE_FRONTEND", default=True
        ),
        frontend_dir=_resolve_project_path(_env("RH_FRONTEND_DIR"), "Front"),
        frontend_api_base_url=_env("RH_FRONTEND_API_BASE_URL"),
        process_dossier_ai_endpoint=_env("RH_PROCESS_DOSSIER_AI_ENDPOINT"),
        sql_server=_env("RH_SQL_SERVER"),
        sql_database=_env("RH_SQL_DATABASE", default="RH_Provas"),
        sql_driver=_env("RH_SQL_DRIVER", default="ODBC Driver 18 for SQL Server"),
        sql_connection_string=_env("RH_SQL_CONNECTION_STRING") or None,
        sql_username=_env("RH_SQL_USERNAME"),
        sql_password=os.getenv("RH_SQL_PASSWORD", ""),
        sql_trusted_connection=_read_bool_env("RH_SQL_TRUSTED_CONNECTION", default=True),
        sql_encrypt=_env("RH_SQL_ENCRYPT", default="no"),
        sql_trust_server_certificate=_read_bool_env(
            "RH_SQL_TRUST_SERVER_CERTIFICATE", default=True
        ),
        sql_timeout_seconds=_read_int_env(
            "RH_SQL_TIMEOUT_SECONDS", default=5, minimum=1, maximum=120
        ),
        auth_user=_env("RH_AUTH_USER", default="rh"),
        auth_password=os.getenv("RH_AUTH_PASSWORD", ""),
        auth_token_secret=_env("RH_AUTH_TOKEN_SECRET") or secrets.token_urlsafe(32),
        auth_token_ttl_minutes=_read_int_env(
            "RH_AUTH_TOKEN_TTL_MINUTES", default=480, minimum=1
        ),
        cors_allow_origins=_split_csv(_env("RH_CORS_ALLOW_ORIGINS")),
        cors_allow_origin_regex=_env("RH_CORS_ALLOW_ORIGIN_REGEX") or None,
        log_level=_env("RH_LOG_LEVEL", default="INFO"),
        public_frontend_base_url=_env("RH_PUBLIC_FRONTEND_BASE_URL"),
        public_candidate_base_url=_env(
            "RH_PUBLIC_CANDIDATE_BASE_URL", "PUBLIC_CANDIDATE_BASE_URL"
        ),
        public_cv_upload_dir=_resolve_project_path(
            _env("RH_PUBLIC_CV_UPLOAD_DIR"), "data/private/public-cvs"
        ),
        doc_converter=_env("DOC_CONVERTER", "RH_CV_DOC_CONVERTER", default="auto"),
        libreoffice_path=_env("LIBREOFFICE_PATH", "RH_LIBREOFFICE_PATH"),
        email_inbox_enabled=_read_bool_env("RH_EMAIL_INBOX_ENABLED", default=False),
        email_inbox_mode=_env("RH_EMAIL_INBOX_MODE", default=email_inbox_protocol),
        email_inbox_path=_env("RH_EMAIL_INBOX_PATH"),
        email_inbox_provider=_env("RH_EMAIL_INBOX_PROVIDER", default="microsoft365"),
        email_inbox_protocol=email_inbox_protocol,
        email_inbox_address=_env("RH_EMAIL_INBOX_ADDRESS"),
        email_inbox_imap_host=_env(
            "RH_EMAIL_INBOX_IMAP_HOST", default="outlook.office365.com"
        ),
        email_inbox_imap_port=_read_int_env(
            "RH_EMAIL_INBOX_IMAP_PORT", default=993, minimum=1, maximum=65535
        ),
        email_inbox_username=_env("RH_EMAIL_INBOX_USERNAME"),
        email_inbox_auth_mode=_env("RH_EMAIL_INBOX_AUTH_MODE", default="oauth2"),
        email_inbox_password_env=_env(
            "RH_EMAIL_INBOX_PASSWORD_ENV", default="RH_EMAIL_PASSWORD"
        ),
        email_inbox_mailbox=_env("RH_EMAIL_INBOX_MAILBOX", default="INBOX"),
        email_inbox_tenant_id=_env(
            "RH_EMAIL_INBOX_TENANT_ID", "RH_EMAIL_GRAPH_TENANT_ID"
        ),
        email_inbox_client_id=_env(
            "RH_EMAIL_INBOX_CLIENT_ID", "RH_EMAIL_GRAPH_CLIENT_ID"
        ),
        email_inbox_client_secret_env=_env(
            "RH_EMAIL_INBOX_CLIENT_SECRET_ENV", default="RH_EMAIL_CLIENT_SECRET"
        ),
        email_inbox_oauth_scope=_env(
            "RH_EMAIL_INBOX_SCOPES",
            "RH_EMAIL_INBOX_OAUTH_SCOPE",
            default="https://outlook.office365.com/.default",
        ),
        email_inbox_attachments_dir=_resolve_project_path(
            _env("RH_EMAIL_INBOX_ATTACHMENTS_DIR"), "data/private/email_attachments"
        ),
        email_inbox_max_messages=_read_int_env(
            "RH_EMAIL_INBOX_MAX_MESSAGES", default=50, minimum=1, maximum=500
        ),
        email_inbox_max_attachment_mb=_read_int_env(
            "RH_EMAIL_INBOX_MAX_ATTACHMENT_MB", default=10, minimum=1, maximum=100
        ),
        email_graph_tenant_id=_env("RH_EMAIL_GRAPH_TENANT_ID"),
        email_graph_client_id=_env("RH_EMAIL_GRAPH_CLIENT_ID"),
        email_graph_client_secret_env=_env(
            "RH_EMAIL_GRAPH_CLIENT_SECRET_ENV", default="RH_EMAIL_GRAPH_CLIENT_SECRET"
        ),
        email_graph_mailbox=_env("RH_EMAIL_GRAPH_MAILBOX"),
        email_graph_scope=_env(
            "RH_EMAIL_GRAPH_SCOPE", default="https://graph.microsoft.com/.default"
        ),
        email_graph_base_url=_env(
            "RH_EMAIL_GRAPH_BASE_URL", default="https://graph.microsoft.com/v1.0"
        ),
        email_smtp_enabled=_read_bool_env("RH_EMAIL_SMTP_ENABLED", default=False),
        email_smtp_host=_env("RH_EMAIL_SMTP_HOST"),
        email_smtp_port=_read_int_env(
            "RH_EMAIL_SMTP_PORT", default=587, minimum=1, maximum=65535
        ),
        email_smtp_username=_env("RH_EMAIL_SMTP_USERNAME"),
        email_smtp_password_env=_env(
            "RH_EMAIL_SMTP_PASSWORD_ENV", default="RH_EMAIL_APP_PASSWORD"
        ),
        email_smtp_from=_env("RH_EMAIL_SMTP_FROM"),
        email_smtp_use_tls=_read_bool_env("RH_EMAIL_SMTP_USE_TLS", default=True),
        email_smtp_use_ssl=_read_bool_env("RH_EMAIL_SMTP_USE_SSL", default=False),
        ai_enabled=_read_bool_env("AI_ENABLED", default=False),
        ai_provider=_env("AI_PROVIDER", default="openai").lower(),
        ai_model=_env("AI_MODEL"),
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        openai_base_url=_env(
            "OPENAI_BASE_URL", default="https://api.openai.com/v1"
        ).rstrip("/"),
        ai_timeout_seconds=_read_int_env(
            "AI_TIMEOUT_SECONDS", default=60, minimum=5, maximum=300
        ),
        ai_max_curriculo_chars=_read_int_env(
            "AI_MAX_CURRICULO_CHARS", default=30000, minimum=1000, maximum=100000
        ),
        ai_duplicate_window_seconds=_read_int_env(
            "AI_DUPLICATE_WINDOW_SECONDS", default=30, minimum=0, maximum=600
        ),
    )
