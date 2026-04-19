from __future__ import annotations

import pyodbc

from .config import Settings, get_settings


def build_connection_string(settings: Settings | None = None) -> str:
    active_settings = settings or get_settings()
    return (
        f"DRIVER={{{active_settings.sql_driver}}};"
        f"SERVER={active_settings.sql_server};"
        f"DATABASE={active_settings.sql_database};"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
    )


def get_connection(settings: Settings | None = None) -> pyodbc.Connection:
    return pyodbc.connect(build_connection_string(settings))
