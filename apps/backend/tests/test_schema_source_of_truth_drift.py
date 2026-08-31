from __future__ import annotations

import re
from pathlib import Path

# apps/backend/tests -> apps/backend -> apps -> raiz do repositório
REPO_ROOT = Path(__file__).resolve().parents[3]
BOOTSTRAP_PATH = REPO_ROOT / "apps" / "backend" / "rh_api" / "repositories" / "bootstrap.py"
MIGRATIONS_DIR = REPO_ROOT / "infra" / "sql" / "migrations"

_CREATE_TABLE_PATTERN = re.compile(r"CREATE TABLE dbo\.([a-zA-Z_][a-zA-Z0-9_]*)")

# Achado DB-001/S-13 do programa de evolução (docs/connecta-evolution/):
# bootstrap.py (autobootstrap de DEV/HML) e infra/sql/migrations/ (autoridade
# de PROD) não têm garantia automatizada de que criam o mesmo schema. Este
# teste é um primeiro passo estático (comparação de NOMES de tabela, não de
# colunas/tipos) — não substitui a extração do DDL real de produção para as 5
# tabelas centrais que não existem em nenhum dos dois caminhos (candidatos,
# processos_seletivos, candidatos_processos, historico_provas, gabaritos),
# que exige acesso ao SQL Server de produção/homologação e está fora do
# alcance de um ambiente sem essa conexão.
#
# Tabelas abaixo existem hoje SÓ no bootstrap.py (nunca em uma migration
# versionada) — uma instalação nova provisionada exclusivamente a partir das
# migrations de infra/sql/migrations/ não as teria. Cada uma é uma dívida
# real (achado DB-001 ampliado), registrada aqui para não regredir
# silenciosamente enquanto migrations reais não são escritas para elas.
KNOWN_BOOTSTRAP_ONLY_TABLES = {
    "analises_curriculo_ia",
    "banco_talentos",
    "candidatos_anexos",
    "candidatos_metadata",
    "candidatos_movimentacoes",
    "cv_pre_analises",
    "decisoes_rh",
    "email_inbox_items",
    "entrevista_slots",
    "entrevistas_agendadas",
    "logs_auditoria",
    "perfil_permissoes",
    "perfis",
    "permissoes",
    "processos_dossie_anotacoes",
    "provas_geradas",
    "respostas_provas",
    "resultados_provas",
    "scores_conecta",
    "usuarios",
}

# As 5 tabelas centrais do domínio (achado DB-002) não aparecem em nenhuma
# das duas listas — não são "drift" (existir só de um lado), são ausência
# total de DDL versionado, um problema mais grave, sinalizado à parte.
KNOWN_MISSING_FROM_BOTH = {
    "candidatos",
    "processos_seletivos",
    "candidatos_processos",
    "historico_provas",
    "gabaritos",
}


def _tables_created_in(text: str) -> set[str]:
    return set(_CREATE_TABLE_PATTERN.findall(text))


def _bootstrap_tables() -> set[str]:
    return _tables_created_in(BOOTSTRAP_PATH.read_text(encoding="utf-8"))


def _migration_tables() -> set[str]:
    tables: set[str] = set()
    for sql_file in MIGRATIONS_DIR.glob("*.sql"):
        if sql_file.name.endswith(".rollback.sql"):
            continue
        tables |= _tables_created_in(sql_file.read_text(encoding="utf-8"))
    return tables


def test_bootstrap_only_tables_match_the_known_and_tracked_list():
    """Falha se uma tabela NOVA passar a existir só em bootstrap.py sem
    ninguém perceber — força a pessoa a decidir explicitamente: escrever a
    migration correspondente, ou registrar a nova exceção aqui com
    justificativa, em vez de a lista crescer silenciosamente."""
    bootstrap_only = _bootstrap_tables() - _migration_tables() - KNOWN_MISSING_FROM_BOTH

    newly_undocumented = bootstrap_only - KNOWN_BOOTSTRAP_ONLY_TABLES
    assert not newly_undocumented, (
        f"Tabela(s) nova(s) só em bootstrap.py, sem migration nem registro em "
        f"KNOWN_BOOTSTRAP_ONLY_TABLES: {newly_undocumented}"
    )

    no_longer_bootstrap_only = KNOWN_BOOTSTRAP_ONLY_TABLES - bootstrap_only
    assert not no_longer_bootstrap_only, (
        f"Tabela(s) que ganharam migration (ótimo!) — remova da lista "
        f"KNOWN_BOOTSTRAP_ONLY_TABLES para manter o teste honesto: {no_longer_bootstrap_only}"
    )


def test_the_five_core_tables_are_still_the_only_ones_missing_from_both_paths():
    """Se esta asserção falhar porque a lista DIMINUIU, é uma boa notícia —
    alguém já resolveu parte do achado DB-002 (ver S-13) e a lista
    KNOWN_MISSING_FROM_BOTH deve ser atualizada para refletir isso."""
    missing_from_both = (
        KNOWN_MISSING_FROM_BOTH - _bootstrap_tables() - _migration_tables()
    )
    assert missing_from_both == KNOWN_MISSING_FROM_BOTH
