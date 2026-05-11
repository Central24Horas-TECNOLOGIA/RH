from __future__ import annotations

import configparser
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

def _load_runtime_ini() -> configparser.ConfigParser:
    """
    Lê o config.ini central da pasta da Interface.

    Ordem de procura:
    1. Caminho informado em RH_CONFIG_INI
    2. config.ini na pasta pai do projeto RH
       Exemplo:
       central_servicos_c24h/
         config.ini
         RH/
           api/
    """
    parser = configparser.ConfigParser()

    api_dir = Path(__file__).resolve().parents[1]
    project_root = api_dir.parent

    candidates = []

    env_path = os.getenv("RH_CONFIG_INI", "").strip()
    if env_path:
        candidates.append(Path(env_path))

    candidates.append(project_root / "config.ini")
    candidates.append(project_root.parent / "config.ini")

    for ini_path in candidates:
        if ini_path.exists():
            parser.read(ini_path, encoding="utf-8-sig")
            break

    return parser


def _ini_value(
    parser: configparser.ConfigParser,
    section: str,
    option: str,
    default: str = "",
) -> str:
    if parser.has_option(section, option):
        return parser.get(section, option, fallback=default).strip()
    return default


def _ini_bool(
    parser: configparser.ConfigParser,
    section: str,
    option: str,
    default: bool,
) -> bool:
    if parser.has_option(section, option):
        return parser.getboolean(section, option, fallback=default)
    return default


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

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() != "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_dotenv()
    runtime_ini = _load_runtime_ini()
    has_ini_db = runtime_ini.has_section("RH_DATABASE")

    project_root = Path(__file__).resolve().parents[2]

    app_env = os.getenv("RH_APP_ENV", "development").strip() or "development"
    dev_mode = app_env.lower() != "production"
    cors_allow_origins = _split_csv(os.getenv("RH_CORS_ALLOW_ORIGINS"))

    if not cors_allow_origins and dev_mode:
        cors_allow_origins = list(DEFAULT_DEV_ORIGINS)

    cors_allow_origin_regex = os.getenv("RH_CORS_ALLOW_ORIGIN_REGEX", "").strip() or None
    if dev_mode and not cors_allow_origin_regex:
        cors_allow_origin_regex = r"https?://(localhost|127\.0\.0\.1|192\.168\.5\.19)(:\d+)?"

    email_inbox_provider = (
        os.getenv("RH_EMAIL_INBOX_PROVIDER", "").strip()
        or _ini_value(runtime_ini, "EMAIL_INBOX", "PROVIDER", "microsoft365")
        or "microsoft365"
    )
    email_inbox_protocol = (
        os.getenv("RH_EMAIL_INBOX_PROTOCOL", "").strip()
        or _ini_value(runtime_ini, "EMAIL_INBOX", "PROTOCOL", "imap")
        or "imap"
    )
    email_inbox_mode = (
        os.getenv("RH_EMAIL_INBOX_MODE", "").strip()
        or _ini_value(runtime_ini, "EMAIL_INBOX", "MODE", "")
        or email_inbox_protocol
        or "imap"
    )

    if has_ini_db:
        sql_server = _ini_value(runtime_ini, "RH_DATABASE", "server", r"PAULO_TI\SQLEXPRESS")
        sql_database = _ini_value(runtime_ini, "RH_DATABASE", "database", "RH_Provas")
        sql_driver = _ini_value(runtime_ini, "RH_DATABASE", "driver", "ODBC Driver 17 for SQL Server")
        sql_connection_string = _ini_value(runtime_ini, "RH_DATABASE", "connection_string", "") or None
        sql_username = _ini_value(runtime_ini, "RH_DATABASE", "username", "")
        sql_password = _ini_value(runtime_ini, "RH_DATABASE", "password", "")
        sql_trusted_connection = _ini_bool(runtime_ini, "RH_DATABASE", "trusted_connection", True)
        sql_encrypt = _ini_value(runtime_ini, "RH_DATABASE", "encrypt", "no") or "no"
        sql_trust_server_certificate = _ini_bool(
            runtime_ini,
            "RH_DATABASE",
            "trust_server_certificate",
            True,
        )
        sql_timeout_seconds = max(
            1,
            int(_ini_value(runtime_ini, "RH_DATABASE", "timeout_seconds", "5")),
        )
    else:
        sql_server = os.getenv("RH_SQL_SERVER", r"PAULO_TI\SQLEXPRESS").strip()
        sql_database = os.getenv("RH_SQL_DATABASE", "RH_Provas").strip()
        sql_driver = os.getenv("RH_SQL_DRIVER", "ODBC Driver 17 for SQL Server").strip()
        sql_connection_string = os.getenv("RH_SQL_CONNECTION_STRING", "").strip() or None
        sql_username = os.getenv("RH_SQL_USERNAME", "").strip()
        sql_password = os.getenv("RH_SQL_PASSWORD", "")
        sql_trusted_connection = _read_bool_env("RH_SQL_TRUSTED_CONNECTION", True)
        sql_encrypt = os.getenv("RH_SQL_ENCRYPT", "no").strip() or "no"
        sql_trust_server_certificate = _read_bool_env("RH_SQL_TRUST_SERVER_CERTIFICATE", True)
        sql_timeout_seconds = max(1, int(os.getenv("RH_SQL_TIMEOUT_SECONDS", "5")))

    return Settings(
        app_env=app_env,
        sql_server=sql_server,
        sql_database=sql_database,
        sql_driver=sql_driver,
        sql_connection_string=sql_connection_string,
        sql_username=sql_username,
        sql_password=sql_password,
        sql_trusted_connection=sql_trusted_connection,
        sql_encrypt=sql_encrypt,
        sql_trust_server_certificate=sql_trust_server_certificate,
        sql_timeout_seconds=sql_timeout_seconds,
        auth_user=os.getenv("RH_AUTH_USER", "rh").strip(),
        auth_password=os.getenv("RH_AUTH_PASSWORD", "1234").strip(),
        auth_token_secret=os.getenv("RH_AUTH_TOKEN_SECRET", "").strip()
        or secrets.token_urlsafe(32),
        auth_token_ttl_minutes=int(os.getenv("RH_AUTH_TOKEN_TTL_MINUTES", "480")),
        cors_allow_origins=cors_allow_origins,
        cors_allow_origin_regex=cors_allow_origin_regex,
        log_level=os.getenv("RH_LOG_LEVEL", "INFO").strip() or "INFO",
        public_frontend_base_url=os.getenv("RH_PUBLIC_FRONTEND_BASE_URL", "").strip(),
        public_candidate_base_url=(
            os.getenv("PUBLIC_CANDIDATE_BASE_URL", "").strip()
            or os.getenv("RH_PUBLIC_CANDIDATE_BASE_URL", "").strip()
            or _ini_value(runtime_ini, "PUBLIC", "PUBLIC_CANDIDATE_BASE_URL", "")
        ),
        public_cv_upload_dir=os.getenv(
            "RH_PUBLIC_CV_UPLOAD_DIR",
            str(project_root / "data" / "private" / "public-cvs"),
        ).strip(),
        doc_converter=(
            os.getenv("DOC_CONVERTER", "").strip()
            or os.getenv("RH_CV_DOC_CONVERTER", "").strip()
            or _ini_value(runtime_ini, "CV", "DOC_CONVERTER", "auto")
            or "auto"
        ),
        libreoffice_path=(
            os.getenv("LIBREOFFICE_PATH", "").strip()
            or os.getenv("RH_LIBREOFFICE_PATH", "").strip()
            or _ini_value(runtime_ini, "CV", "LIBREOFFICE_PATH", "")
        ),
        email_inbox_enabled=_read_bool_env(
            "RH_EMAIL_INBOX_ENABLED",
            _ini_bool(runtime_ini, "EMAIL_INBOX", "ENABLED", False),
        ),
        email_inbox_mode=email_inbox_mode,
        email_inbox_path=(
            os.getenv("RH_EMAIL_INBOX_PATH", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "INBOX_PATH", "")
        ),
        email_inbox_provider=email_inbox_provider,
        email_inbox_protocol=email_inbox_protocol,
        email_inbox_address=(
            os.getenv("RH_EMAIL_INBOX_ADDRESS", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "EMAIL_ADDRESS", "")
        ),
        email_inbox_imap_host=(
            os.getenv("RH_EMAIL_INBOX_IMAP_HOST", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "IMAP_HOST", "outlook.office365.com")
            or "outlook.office365.com"
        ),
        email_inbox_imap_port=int(
            os.getenv("RH_EMAIL_INBOX_IMAP_PORT", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "IMAP_PORT", "993")
            or "993"
        ),
        email_inbox_username=(
            os.getenv("RH_EMAIL_INBOX_USERNAME", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "USERNAME", "")
        ),
        email_inbox_auth_mode=(
            os.getenv("RH_EMAIL_INBOX_AUTH_MODE", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "AUTH_MODE", "oauth2")
            or "oauth2"
        ),
        email_inbox_password_env=(
            os.getenv("RH_EMAIL_INBOX_PASSWORD_ENV", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "EMAIL_PASSWORD_ENV", "")
            or _ini_value(runtime_ini, "EMAIL_INBOX", "PASSWORD_ENV", "RH_EMAIL_PASSWORD")
            or "RH_EMAIL_PASSWORD"
        ),
        email_inbox_mailbox=(
            os.getenv("RH_EMAIL_INBOX_MAILBOX", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "MAILBOX", "INBOX")
            or "INBOX"
        ),
        email_inbox_tenant_id=(
            os.getenv("RH_EMAIL_INBOX_TENANT_ID", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "TENANT_ID", "")
            or os.getenv("RH_EMAIL_GRAPH_TENANT_ID", "").strip()
            or _ini_value(runtime_ini, "EMAIL_GRAPH", "TENANT_ID", "")
        ),
        email_inbox_client_id=(
            os.getenv("RH_EMAIL_INBOX_CLIENT_ID", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "CLIENT_ID", "")
            or os.getenv("RH_EMAIL_GRAPH_CLIENT_ID", "").strip()
            or _ini_value(runtime_ini, "EMAIL_GRAPH", "CLIENT_ID", "")
        ),
        email_inbox_client_secret_env=(
            os.getenv("RH_EMAIL_INBOX_CLIENT_SECRET_ENV", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "CLIENT_SECRET_ENV", "RH_EMAIL_CLIENT_SECRET")
            or "RH_EMAIL_CLIENT_SECRET"
        ),
        email_inbox_oauth_scope=(
            os.getenv("RH_EMAIL_INBOX_OAUTH_SCOPE", "").strip()
            or os.getenv("RH_EMAIL_INBOX_SCOPES", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "SCOPES", "")
            or _ini_value(runtime_ini, "EMAIL_INBOX", "OAUTH_SCOPE", "https://outlook.office365.com/.default")
            or "https://outlook.office365.com/.default"
        ),
        email_inbox_attachments_dir=(
            os.getenv("RH_EMAIL_INBOX_ATTACHMENTS_DIR", "").strip()
            or _ini_value(runtime_ini, "EMAIL_INBOX", "ATTACHMENTS_DIR", "")
            or str(project_root / "data" / "private" / "email_attachments")
        ),
        email_inbox_max_messages=max(
            1,
            int(
                os.getenv("RH_EMAIL_INBOX_MAX_MESSAGES", "").strip()
                or _ini_value(runtime_ini, "EMAIL_INBOX", "MAX_MESSAGES", "50")
                or "50"
            ),
        ),
        email_inbox_max_attachment_mb=max(
            1,
            int(
                os.getenv("RH_EMAIL_INBOX_MAX_ATTACHMENT_MB", "").strip()
                or _ini_value(runtime_ini, "EMAIL_INBOX", "MAX_ATTACHMENT_MB", "10")
                or "10"
            ),
        ),
        email_graph_tenant_id=(
            os.getenv("RH_EMAIL_GRAPH_TENANT_ID", "").strip()
            or _ini_value(runtime_ini, "EMAIL_GRAPH", "TENANT_ID", "")
        ),
        email_graph_client_id=(
            os.getenv("RH_EMAIL_GRAPH_CLIENT_ID", "").strip()
            or _ini_value(runtime_ini, "EMAIL_GRAPH", "CLIENT_ID", "")
        ),
        email_graph_client_secret_env=(
            os.getenv("RH_EMAIL_GRAPH_CLIENT_SECRET_ENV", "").strip()
            or _ini_value(runtime_ini, "EMAIL_GRAPH", "CLIENT_SECRET_ENV", "RH_EMAIL_GRAPH_CLIENT_SECRET")
            or "RH_EMAIL_GRAPH_CLIENT_SECRET"
        ),
        email_graph_mailbox=(
            os.getenv("RH_EMAIL_GRAPH_MAILBOX", "").strip()
            or _ini_value(runtime_ini, "EMAIL_GRAPH", "MAILBOX", "")
        ),
        email_graph_scope=(
            os.getenv("RH_EMAIL_GRAPH_SCOPE", "").strip()
            or _ini_value(runtime_ini, "EMAIL_GRAPH", "SCOPE", "https://graph.microsoft.com/.default")
            or "https://graph.microsoft.com/.default"
        ),
        email_graph_base_url=(
            os.getenv("RH_EMAIL_GRAPH_BASE_URL", "").strip()
            or _ini_value(runtime_ini, "EMAIL_GRAPH", "BASE_URL", "https://graph.microsoft.com/v1.0")
            or "https://graph.microsoft.com/v1.0"
        ),
        email_smtp_enabled=_read_bool_env(
            "RH_EMAIL_SMTP_ENABLED",
            _ini_bool(runtime_ini, "EMAIL_SMTP", "ENABLED", False),
        ),
        email_smtp_host=(
            os.getenv("RH_EMAIL_SMTP_HOST", "").strip()
            or _ini_value(runtime_ini, "EMAIL_SMTP", "SMTP_HOST", "")
        ),
        email_smtp_port=int(
            os.getenv("RH_EMAIL_SMTP_PORT", "").strip()
            or _ini_value(runtime_ini, "EMAIL_SMTP", "SMTP_PORT", "587")
            or "587"
        ),
        email_smtp_username=(
            os.getenv("RH_EMAIL_SMTP_USERNAME", "").strip()
            or _ini_value(runtime_ini, "EMAIL_SMTP", "USERNAME", "")
        ),
        email_smtp_password_env=(
            os.getenv("RH_EMAIL_SMTP_PASSWORD_ENV", "").strip()
            or _ini_value(runtime_ini, "EMAIL_SMTP", "PASSWORD_ENV", "RH_EMAIL_APP_PASSWORD")
            or "RH_EMAIL_APP_PASSWORD"
        ),
        email_smtp_from=(
            os.getenv("RH_EMAIL_SMTP_FROM", "").strip()
            or _ini_value(runtime_ini, "EMAIL_SMTP", "FROM", "")
        ),
        email_smtp_use_tls=_read_bool_env(
            "RH_EMAIL_SMTP_USE_TLS",
            _ini_bool(runtime_ini, "EMAIL_SMTP", "USE_TLS", True),
        ),
        email_smtp_use_ssl=_read_bool_env(
            "RH_EMAIL_SMTP_USE_SSL",
            _ini_bool(runtime_ini, "EMAIL_SMTP", "USE_SSL", False),
        ),
    )
