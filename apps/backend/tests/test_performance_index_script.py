from __future__ import annotations

import re
from pathlib import Path

# apps/backend/tests -> apps/backend -> apps -> raiz do repositório
REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "infra" / "sql" / "performance_indexes_recommended.sql"


def _script_text() -> str:
    return SCRIPT_PATH.read_text(encoding="utf-8")


def test_script_file_exists():
    assert SCRIPT_PATH.is_file(), f"Script de índices não encontrado em {SCRIPT_PATH}"


def test_script_no_longer_references_the_nonexistent_entrevistas_table():
    text = _script_text()
    # A tabela real é "entrevistas_agendadas" — "entrevistas" sozinha nunca existiu
    # (era o bug original: o script mirava uma tabela que não existe no schema real).
    assert "dbo.entrevistas_agendadas" in text
    assert not re.search(r"dbo\.entrevistas(?!_agendadas)\b", text)


def test_script_uses_perfil_id_not_perfil_for_usuarios_table():
    text = _script_text()
    match = re.search(r"ON dbo\.usuarios \(([^)]*)\)", text)
    assert match, "Índice de dbo.usuarios não encontrado no script"
    columns = match.group(1)
    assert "perfil_id" in columns
    assert "perfil," not in columns and "perfil " not in columns.split(",")[0] + ","


def test_all_referenced_tables_match_known_bootstrap_tables():
    # candidatos_processos e processos_seletivos são 2 das 5 tabelas centrais
    # sem DDL versionado no repositório (achado DB-002/S-13, em aberto,
    # separado deste script) — não têm CREATE TABLE em bootstrap.py por esse
    # motivo já conhecido, não por um novo erro de nome como o que este teste
    # protege (entrevistas/perfil, já corrigidos acima).
    tables_without_bootstrap_ddl_pending_s13 = {"candidatos_processos", "processos_seletivos"}

    text = _script_text()
    referenced_tables = set(re.findall(r"OBJECT_ID\('dbo\.(\w+)'", text))
    bootstrap_text = (
        REPO_ROOT / "apps" / "backend" / "rh_api" / "repositories" / "bootstrap.py"
    ).read_text(encoding="utf-8")
    known_tables = set(re.findall(r"CREATE TABLE dbo\.(\w+)", bootstrap_text))
    known_tables |= tables_without_bootstrap_ddl_pending_s13

    missing = referenced_tables - known_tables
    assert not missing, f"Tabelas referenciadas no script de índices mas ausentes do bootstrap: {missing}"
