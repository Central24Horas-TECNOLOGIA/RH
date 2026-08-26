from __future__ import annotations

import logging
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.repositories.processes import ProcessRepositoryMixin


class FakeInactivityReminderRepository(ProcessRepositoryMixin):
    """Repositório mínimo só com o necessário para testar
    run_scheduled_inactivity_reminders sem tocar banco/SMTP de verdade
    (mesmo espírito de FakeNotificationRepository em
    test_automatic_stage_notifications.py)."""

    def __init__(
        self,
        *,
        lembretes_ativos: bool,
        alertas_criados: list[dict] | None = None,
        recipients: tuple[str, ...] = ("rh@empresa.com",),
        smtp_from: str = "",
        falha_ao_checar_configuracao: bool = False,
        falha_no_envio_email: bool = False,
    ):
        self.logger = logging.getLogger("test")
        self.settings = SimpleNamespace(
            scheduler_inactivity_dias_sem_movimentacao=30,
            scheduler_inactivity_dias_realerta=7,
            email_inactivity_alert_recipients=recipients,
            email_smtp_from=smtp_from,
        )
        self._lembretes_ativos = lembretes_ativos
        self._alertas_criados = alertas_criados or []
        self._falha_ao_checar_configuracao = falha_ao_checar_configuracao
        self._falha_no_envio_email = falha_no_envio_email

        self.chamadas_monitor: list[tuple[int, int]] = []
        self.emails_enviados: list[dict] = []
        self.auditorias: list[dict] = []
        self.status_marcados: list[tuple] = []

    def get_notification_automation_settings(self) -> dict:
        if self._falha_ao_checar_configuracao:
            raise RuntimeError("banco indisponível")
        return {"lembretes_automaticos_ativos": self._lembretes_ativos}

    def monitor_process_inactivity(self, *, dias: int = 30, dias_realerta: int = 7) -> dict:
        self.chamadas_monitor.append((dias, dias_realerta))
        return {
            "success": True,
            "alertas_criados": self._alertas_criados,
            "total": len(self._alertas_criados),
        }

    def send_internal_alert_email(self, *, destinatarios, assunto, mensagem):
        if self._falha_no_envio_email:
            raise RuntimeError("SMTP indisponível")
        self.emails_enviados.append(
            {"destinatarios": destinatarios, "assunto": assunto, "mensagem": mensagem}
        )
        return {"success": True, "destinatarios": destinatarios}

    def record_audit_log(self, **kwargs):
        self.auditorias.append(kwargs)
        return {"success": True}

    def _mark_inactivity_alert_email_status(self, id_alerta, status_envio: str) -> None:
        self.status_marcados.append((id_alerta, status_envio))


ALERTA_EXEMPLO = {
    "id_alerta": 1,
    "id_processo": "PROC-1",
    "id_processo_ref": "PROC-1@@Analista",
    "dias_sem_movimentacao": 35,
    "status_envio": "notificacao_interna_registrada_email_pendente_configuracao",
}


class AutomaticInactivityReminderTests(unittest.TestCase):
    def test_does_nothing_when_automation_disabled(self):
        repository = FakeInactivityReminderRepository(
            lembretes_ativos=False,
            alertas_criados=[ALERTA_EXEMPLO],
        )

        resultado = repository.run_scheduled_inactivity_reminders()

        self.assertEqual(resultado["skipped"], "automacao_desativada")
        self.assertEqual(repository.chamadas_monitor, [])
        self.assertEqual(repository.emails_enviados, [])
        self.assertEqual(repository.auditorias, [])

    def test_sends_email_and_audits_as_automatic_when_enabled(self):
        repository = FakeInactivityReminderRepository(
            lembretes_ativos=True,
            alertas_criados=[ALERTA_EXEMPLO],
        )

        resultado = repository.run_scheduled_inactivity_reminders()

        self.assertEqual(repository.chamadas_monitor, [(30, 7)])
        self.assertEqual(len(repository.emails_enviados), 1)
        self.assertEqual(repository.emails_enviados[0]["destinatarios"], ["rh@empresa.com"])
        self.assertIn("PROC-1@@Analista", repository.emails_enviados[0]["mensagem"])

        self.assertEqual(len(repository.auditorias), 1)
        auditoria = repository.auditorias[0]
        self.assertEqual(auditoria["acao"], "enviar_lembrete_inatividade_automatico")
        self.assertTrue(auditoria["valor_novo"]["automatico"])
        self.assertEqual(auditoria["valor_novo"]["id_alerta"], 1)

        self.assertEqual(repository.status_marcados, [(1, "email_enviado")])
        self.assertEqual(resultado["emails_enviados"], [1])
        self.assertTrue(resultado["automatico"])

    def test_uses_custom_dias_and_dias_realerta_when_provided(self):
        repository = FakeInactivityReminderRepository(lembretes_ativos=True, alertas_criados=[])

        repository.run_scheduled_inactivity_reminders(dias=45, dias_realerta=3)

        self.assertEqual(repository.chamadas_monitor, [(45, 3)])

    def test_falls_back_to_smtp_from_when_no_recipients_configured(self):
        repository = FakeInactivityReminderRepository(
            lembretes_ativos=True,
            alertas_criados=[ALERTA_EXEMPLO],
            recipients=(),
            smtp_from="notificacoes@empresa.com",
        )

        repository.run_scheduled_inactivity_reminders()

        self.assertEqual(len(repository.emails_enviados), 1)
        self.assertEqual(repository.emails_enviados[0]["destinatarios"], ["notificacoes@empresa.com"])

    def test_skips_alert_without_raising_when_no_recipients_available(self):
        repository = FakeInactivityReminderRepository(
            lembretes_ativos=True,
            alertas_criados=[ALERTA_EXEMPLO],
            recipients=(),
            smtp_from="",
        )

        resultado = repository.run_scheduled_inactivity_reminders()

        self.assertEqual(repository.emails_enviados, [])
        self.assertEqual(repository.auditorias, [])
        self.assertEqual(resultado["emails_enviados"], [])

    def test_never_raises_when_configuration_check_fails(self):
        repository = FakeInactivityReminderRepository(
            lembretes_ativos=True,
            falha_ao_checar_configuracao=True,
        )

        try:
            resultado = repository.run_scheduled_inactivity_reminders()
        except Exception as exc:  # pragma: no cover - falha do teste se levantar
            self.fail(f"run_scheduled_inactivity_reminders não deveria propagar exceção: {exc}")

        self.assertFalse(resultado["success"])
        self.assertEqual(resultado["skipped"], "falha_ao_checar_configuracao")

    def test_never_raises_when_email_send_fails_and_marks_failure_status(self):
        repository = FakeInactivityReminderRepository(
            lembretes_ativos=True,
            alertas_criados=[ALERTA_EXEMPLO],
            falha_no_envio_email=True,
        )

        try:
            resultado = repository.run_scheduled_inactivity_reminders()
        except Exception as exc:  # pragma: no cover - falha do teste se levantar
            self.fail(f"run_scheduled_inactivity_reminders não deveria propagar exceção: {exc}")

        self.assertEqual(repository.status_marcados, [(1, "falha_envio_email")])
        self.assertEqual(repository.auditorias, [])
        self.assertEqual(resultado["emails_enviados"], [])


if __name__ == "__main__":
    unittest.main()
