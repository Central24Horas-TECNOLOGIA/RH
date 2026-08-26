from __future__ import annotations

import logging
import sys
import unittest
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.repositories.communications import CommunicationRepositoryMixin
from rh_api.services.notifications import transicao_elegivel_para_email_automatico
from rh_api.services.process_flow import CANDIDATE_STATUS_APPROVED, CANDIDATE_STATUS_ELIMINATED


class FakeNotificationRepository(CommunicationRepositoryMixin):
    """Repositório mínimo só com o necessário para testar
    disparar_notificacao_por_etapa sem tocar banco/SMTP de verdade."""

    def __init__(self, *, automacao_ativa: bool):
        self.logger = logging.getLogger("test")
        self._automacao_ativa = automacao_ativa
        self.emails_enviados: list[tuple] = []
        self.auditorias: list[dict] = []

    def get_notification_automation_settings(self) -> dict:
        return {"email_automatico_ativo": self._automacao_ativa}

    def send_candidate_approval_email(self, id_registro, data, *, usuario_responsavel=""):
        self.emails_enviados.append((id_registro, data, usuario_responsavel))
        return {"success": True}

    def record_audit_log(self, **kwargs):
        self.auditorias.append(kwargs)
        return {"success": True}


class AutomaticStageNotificationTests(unittest.TestCase):
    def test_only_approved_transition_is_eligible(self):
        self.assertTrue(transicao_elegivel_para_email_automatico(CANDIDATE_STATUS_APPROVED))
        self.assertFalse(transicao_elegivel_para_email_automatico(CANDIDATE_STATUS_ELIMINATED))
        self.assertFalse(transicao_elegivel_para_email_automatico("Em análise"))

    def test_dispatch_sends_email_reusing_manual_message_when_automation_active(self):
        repository = FakeNotificationRepository(automacao_ativa=True)

        repository.disparar_notificacao_por_etapa(
            candidato={"id_registro": 42, "id_teste": "CP-1", "nome_candidato": "Ana", "vaga": "Analista"},
            status_anterior="Em análise",
            status_novo=CANDIDATE_STATUS_APPROVED,
            payload={"mensagem_aprovacao": "Parabéns, você foi aprovado!"},
        )

        self.assertEqual(len(repository.emails_enviados), 1)
        id_registro, dados_email, usuario = repository.emails_enviados[0]
        self.assertEqual(id_registro, 42)
        self.assertEqual(dados_email["mensagem_aprovacao"], "Parabéns, você foi aprovado!")
        self.assertIn("Analista", dados_email["assunto"])
        self.assertEqual(usuario, "Automação Conecta")
        # Auditoria deve deixar claro que foi automático.
        self.assertEqual(len(repository.auditorias), 1)
        self.assertEqual(repository.auditorias[0]["acao"], "enviar_email_aprovacao_automatico")

    def test_dispatch_does_nothing_when_automation_disabled(self):
        repository = FakeNotificationRepository(automacao_ativa=False)

        repository.disparar_notificacao_por_etapa(
            candidato={"id_registro": 42, "vaga": "Analista"},
            status_anterior="Em análise",
            status_novo=CANDIDATE_STATUS_APPROVED,
            payload={"mensagem_aprovacao": "Parabéns!"},
        )

        self.assertEqual(repository.emails_enviados, [])
        self.assertEqual(repository.auditorias, [])

    def test_dispatch_does_nothing_for_non_eligible_transition(self):
        repository = FakeNotificationRepository(automacao_ativa=True)

        repository.disparar_notificacao_por_etapa(
            candidato={"id_registro": 42, "vaga": "Analista"},
            status_anterior="Em análise",
            status_novo=CANDIDATE_STATUS_ELIMINATED,
            payload={"mensagem_aprovacao": ""},
        )

        self.assertEqual(repository.emails_enviados, [])

    def test_dispatch_does_nothing_when_approval_message_missing(self):
        repository = FakeNotificationRepository(automacao_ativa=True)

        repository.disparar_notificacao_por_etapa(
            candidato={"id_registro": 42, "vaga": "Analista"},
            status_anterior="Em análise",
            status_novo=CANDIDATE_STATUS_APPROVED,
            payload={"mensagem_aprovacao": ""},
        )

        self.assertEqual(repository.emails_enviados, [])

    def test_dispatch_never_raises_when_manual_email_send_fails(self):
        repository = FakeNotificationRepository(automacao_ativa=True)

        def _falha(*args, **kwargs):
            raise RuntimeError("SMTP indisponível")

        repository.send_candidate_approval_email = _falha

        try:
            repository.disparar_notificacao_por_etapa(
                candidato={"id_registro": 42, "vaga": "Analista"},
                status_anterior="Em análise",
                status_novo=CANDIDATE_STATUS_APPROVED,
                payload={"mensagem_aprovacao": "Parabéns!"},
            )
        except Exception as exc:  # pragma: no cover - falha do teste se levantar
            self.fail(f"disparar_notificacao_por_etapa não deveria propagar exceção: {exc}")


if __name__ == "__main__":
    unittest.main()
