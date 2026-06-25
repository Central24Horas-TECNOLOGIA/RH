from __future__ import annotations

import pyodbc

from .config import Settings, get_settings


def _bool_to_connection_value(value: bool) -> str:
    return "yes" if value else "no"


def build_connection_string(settings: Settings | None = None) -> str:
    active_settings = settings or get_settings()
    if active_settings.sql_connection_string:
        return active_settings.sql_connection_string

    parts = [
        f"DRIVER={{{active_settings.sql_driver}}}",
        f"SERVER={active_settings.sql_server}",
        f"DATABASE={active_settings.sql_database}",
    ]

    if active_settings.sql_trusted_connection:
        parts.append("Trusted_Connection=yes")
    else:
        if active_settings.sql_username:
            parts.append(f"UID={active_settings.sql_username}")
        if active_settings.sql_password:
            parts.append(f"PWD={active_settings.sql_password}")

    parts.append(f"Encrypt={active_settings.sql_encrypt}")
    parts.append(
        f"TrustServerCertificate={_bool_to_connection_value(active_settings.sql_trust_server_certificate)}"
    )
    parts.append(f"Connection Timeout={active_settings.sql_timeout_seconds}")

    return ";".join(parts) + ";"


def get_connection(settings: Settings | None = None, *, autocommit: bool = False) -> pyodbc.Connection:
    active_settings = settings or get_settings()
    return pyodbc.connect(
        build_connection_string(active_settings),
        autocommit=autocommit,
        timeout=active_settings.sql_timeout_seconds,
    )
