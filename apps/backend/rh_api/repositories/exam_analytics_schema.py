from __future__ import annotations

from pathlib import Path


def _migration_path() -> Path:
    return (
        Path(__file__).resolve().parents[4]
        / "infra"
        / "sql"
        / "migrations"
        / "V005__exam_analytical_results.sql"
    )


def ensure_exam_analytics_tables(cursor, *, create_if_missing: bool = False) -> None:
    """Confirma o schema; bootstrap explicito pode aplicar o DDL idempotente."""
    cursor.execute("SELECT OBJECT_ID('dbo.resultados_analiticos_processos', 'U')")
    row = cursor.fetchone()
    exists = bool(row and row[0])
    if exists and not create_if_missing:
        return
    if not exists and not create_if_missing:
        raise RuntimeError(
            "Schema analitico ausente; aplique a migration V005 antes de iniciar API/worker."
        )
    migration = _migration_path()
    if not migration.is_file():
        raise RuntimeError(
            "Migracao V005 do modulo analitico nao encontrada; execute as migrations versionadas."
        )
    cursor.execute(migration.read_text(encoding="utf-8"))


__all__ = ["ensure_exam_analytics_tables"]
