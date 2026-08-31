from __future__ import annotations

from datetime import datetime

import pytest
from fastapi import HTTPException

from rh_api.repositories.base import BaseRepository


class _FakeCursor:
    def __init__(self, existing_anonimizado_em=None, exists: bool = True) -> None:
        self._existing_anonimizado_em = existing_anonimizado_em
        self._exists = exists
        self.executed: list[tuple[str, tuple]] = []

    def execute(self, sql: str, params: tuple = ()) -> None:
        self.executed.append((sql, params))

    def fetchone(self):
        if not self._exists:
            return None
        return (self._existing_anonimizado_em,)


class _FakeConn:
    def __init__(self, cursor: _FakeCursor) -> None:
        self._cursor = cursor
        self.committed = False
        self.closed = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True

    def close(self):
        self.closed = True


def _repo(cursor: _FakeCursor) -> BaseRepository:
    repo = BaseRepository.__new__(BaseRepository)
    repo._connect = lambda: _FakeConn(cursor)
    return repo


def test_anonymize_candidate_raises_404_when_not_found():
    cursor = _FakeCursor(exists=False)
    repo = _repo(cursor)

    with pytest.raises(HTTPException) as exc_info:
        repo.anonymize_candidate("PUB-INEXISTENTE")
    assert exc_info.value.status_code == 404


def test_anonymize_candidate_is_idempotent_when_already_anonymized():
    cursor = _FakeCursor(existing_anonimizado_em=datetime(2026, 1, 1))
    repo = _repo(cursor)

    result = repo.anonymize_candidate("PUB-TESTE-1")

    assert result == {"success": True, "id_teste": "PUB-TESTE-1", "already_anonymized": True}
    # A rotina de anonimização de fato (scrub de PII, remoção de anexo) não
    # deve ter sido disparada de novo — só o bootstrap idempotente (que roda
    # sempre) e o SELECT de checagem.
    statements = [sql for sql, _ in cursor.executed]
    assert not any("lgpd_anonimizado_em = GETDATE()" in sql for sql in statements)
    assert not any("DELETE FROM candidatos_anexos" in sql for sql in statements)


def test_anonymize_candidate_scrubs_pii_and_removes_attachment():
    cursor = _FakeCursor(existing_anonimizado_em=None)
    repo = _repo(cursor)

    result = repo.anonymize_candidate("PUB-TESTE-1")

    assert result == {"success": True, "id_teste": "PUB-TESTE-1", "already_anonymized": False}
    statements = [sql for sql, _ in cursor.executed]

    metadata_update = next(sql for sql in statements if "UPDATE candidatos_metadata" in sql)
    assert "nome_candidato = ?" in metadata_update
    assert "email = N''" in metadata_update
    assert "lgpd_anonimizado_em = GETDATE()" in metadata_update
    # Consentimento LGPD (data/versão/IP) não é tocado — é evidência de conformidade.
    assert "lgpd_consentimento" not in metadata_update

    processos_update = next(sql for sql in statements if "UPDATE candidatos_processos" in sql)
    assert "nome_candidato = ?" in processos_update

    anexos_delete = next(sql for sql in statements if "DELETE FROM candidatos_anexos" in sql)
    assert "id_teste = ?" in anexos_delete
