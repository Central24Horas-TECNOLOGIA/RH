from __future__ import annotations

from datetime import datetime

from rh_api.repositories.base import BaseRepository


class _FakeCursor:
    """Fake mínimo o suficiente para exercitar _upsert_candidate_profile de
    ponta a ponta sem banco real: descreve as colunas do SELECT inicial e
    devolve a linha existente (ou nenhuma) que o teste configurar."""

    def __init__(self, existing_row: dict | None) -> None:
        self._existing_row = existing_row
        self.description = None
        self._select_columns: list[str] = []
        self.executed: list[tuple[str, tuple]] = []

    def execute(self, sql: str, params: tuple = ()) -> None:
        self.executed.append((sql, params))
        if "SELECT" in sql and "FROM candidatos_metadata" in sql:
            columns = [
                line.strip().rstrip(",")
                for line in sql.strip().splitlines()[2:-2]
                if line.strip().rstrip(",")
            ]
            self._select_columns = columns
            self.description = [(col,) for col in columns]

    def fetchall(self):
        if self._existing_row is None:
            return []
        return [tuple(self._existing_row.get(col) for col in self._select_columns)]


def _repo() -> BaseRepository:
    repo = BaseRepository.__new__(BaseRepository)
    return repo


def _last_call(cursor: _FakeCursor) -> tuple[str, tuple]:
    return cursor.executed[-1]


def test_new_candidate_with_explicit_consent_persists_timestamp_version_and_ip():
    cursor = _FakeCursor(existing_row=None)
    repo = _repo()

    repo._upsert_candidate_profile(
        cursor,
        id_teste="PUB-TESTE-1",
        nome_candidato="Ana Silva",
        email="ana@example.com",
        lgpd_consentimento_novo=True,
        lgpd_consentimento_versao="1.0",
        lgpd_consentimento_ip="203.0.113.10",
    )

    sql, params = _last_call(cursor)
    assert "INSERT INTO candidatos_metadata" in sql
    # As 3 últimas colunas do INSERT são lgpd_consentimento_{aceito_em,versao,ip}
    aceito_em, versao, ip = params[-3], params[-2], params[-1]
    assert isinstance(aceito_em, datetime)
    assert versao == "1.0"
    assert ip == "203.0.113.10"


def test_internal_edit_without_consent_flag_preserves_existing_consent():
    original_timestamp = datetime(2026, 1, 5, 10, 30, 0)
    cursor = _FakeCursor(
        existing_row={
            "nome_candidato": "Ana Silva",
            "habilidades_json": "[]",
            "tags_json": "[]",
            "observacao_rh": "",
            "classificacao_indicacao": "",
            "justificativa_indicacao": "",
            "email": "ana@example.com",
            "telefone": "",
            "whatsapp": "",
            "cep": "",
            "endereco": "",
            "numero": "",
            "cidade": "",
            "bairro": "",
            "idade": None,
            "data_nascimento": None,
            "escolaridade": "",
            "possui_experiencia": "",
            "musica": "",
            "prato": "",
            "futebol": "",
            "time": "",
            "rede_social": "",
            "lgpd_consentimento_aceito_em": original_timestamp,
            "lgpd_consentimento_versao": "1.0",
            "lgpd_consentimento_ip": "203.0.113.10",
            "atualizado_em": original_timestamp,
        }
    )
    repo = _repo()

    # RH edita a observação interna do candidato — não é um novo aceite LGPD.
    repo._upsert_candidate_profile(
        cursor,
        id_teste="PUB-TESTE-1",
        observacao_rh="Candidato promissor",
    )

    sql, params = _last_call(cursor)
    assert "UPDATE candidatos_metadata" in sql
    aceito_em, versao, ip = params[-4], params[-3], params[-2]
    assert aceito_em == original_timestamp
    assert versao == "1.0"
    assert ip == "203.0.113.10"


def test_resubmission_with_new_consent_overwrites_previous_timestamp():
    original_timestamp = datetime(2026, 1, 5, 10, 30, 0)
    cursor = _FakeCursor(
        existing_row={
            "nome_candidato": "Ana Silva",
            "habilidades_json": "[]",
            "tags_json": "[]",
            "observacao_rh": "",
            "classificacao_indicacao": "",
            "justificativa_indicacao": "",
            "email": "ana@example.com",
            "telefone": "",
            "whatsapp": "",
            "cep": "",
            "endereco": "",
            "numero": "",
            "cidade": "",
            "bairro": "",
            "idade": None,
            "data_nascimento": None,
            "escolaridade": "",
            "possui_experiencia": "",
            "musica": "",
            "prato": "",
            "futebol": "",
            "time": "",
            "rede_social": "",
            "lgpd_consentimento_aceito_em": original_timestamp,
            "lgpd_consentimento_versao": "1.0",
            "lgpd_consentimento_ip": "203.0.113.10",
            "atualizado_em": original_timestamp,
        }
    )
    repo = _repo()

    repo._upsert_candidate_profile(
        cursor,
        id_teste="PUB-TESTE-1",
        lgpd_consentimento_novo=True,
        lgpd_consentimento_versao="1.1",
        lgpd_consentimento_ip="198.51.100.7",
    )

    sql, params = _last_call(cursor)
    aceito_em, versao, ip = params[-4], params[-3], params[-2]
    assert aceito_em != original_timestamp
    assert isinstance(aceito_em, datetime)
    assert versao == "1.1"
    assert ip == "198.51.100.7"
