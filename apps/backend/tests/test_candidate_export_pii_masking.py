from __future__ import annotations

import csv
import io

from rh_api.repositories.analytics import AnalyticsRepositoryMixin
from rh_api.repositories.security import _mask_email, _mask_phone


class _FakeCandidateReportRepository(AnalyticsRepositoryMixin):
    """Exercita export_candidate_report_csv real, sem precisar de banco."""

    def list_candidate_report(self, **kwargs) -> list[dict]:
        return [
            {
                "id_candidato": "1",
                "nome": "Ana Silva",
                "telefone": "(11) 91234-5678",
                "e_mail": "ana.silva@example.com",
            }
        ]


def _read_csv_rows(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text), delimiter=";"))


def test_mask_email_hides_local_part():
    assert _mask_email("ana.silva@example.com") == "a***@example.com"
    assert _mask_email("") == "conta-nao-identificada"


def test_mask_phone_keeps_only_last_four_digits():
    assert _mask_phone("(11) 91234-5678") == "*******5678"
    assert _mask_phone("") == "telefone-nao-identificado"


def test_export_candidate_report_masks_pii_by_default():
    repository = _FakeCandidateReportRepository()
    _, content = repository.export_candidate_report_csv()
    rows = _read_csv_rows(content)

    assert rows[0]["Telefone"] == "*******5678"
    assert rows[0]["E-mail"] == "a***@example.com"


def test_export_candidate_report_reveals_pii_when_explicitly_requested():
    repository = _FakeCandidateReportRepository()
    _, content = repository.export_candidate_report_csv(mask_pii=False)
    rows = _read_csv_rows(content)

    assert rows[0]["Telefone"] == "(11) 91234-5678"
    assert rows[0]["E-mail"] == "ana.silva@example.com"
