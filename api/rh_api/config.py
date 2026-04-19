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


@dataclass(frozen=True)
class Settings:
    app_env: str
    sql_server: str
    sql_database: str
    sql_driver: str
    auth_user: str
    auth_password: str
    auth_token_secret: str
    auth_token_ttl_minutes: int
    cors_allow_origins: list[str]
    cors_allow_origin_regex: str | None
    log_level: str

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() != "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_dotenv()

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
        auth_user=os.getenv("RH_AUTH_USER", "").strip(),
        auth_password=os.getenv("RH_AUTH_PASSWORD", "").strip(),
        auth_token_secret=os.getenv("RH_AUTH_TOKEN_SECRET", "").strip()
        or secrets.token_urlsafe(32),
        auth_token_ttl_minutes=int(os.getenv("RH_AUTH_TOKEN_TTL_MINUTES", "480")),
        cors_allow_origins=cors_allow_origins,
        cors_allow_origin_regex=cors_allow_origin_regex,
        log_level=os.getenv("RH_LOG_LEVEL", "INFO").strip() or "INFO",
    )
