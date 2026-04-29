from __future__ import annotations

import unittest

from pydantic import ValidationError

from rh_api.schemas.interviews import InterviewCreateRequest, InterviewSlotCreateRequest
from rh_api.services.interviews import build_interview_message


class InterviewSchemaTests(unittest.TestCase):
    def test_empty_interview_datetime_is_accepted_as_none_when_slot_is_used(self):
        payload = InterviewCreateRequest(
            id_registro=10,
            id_slot=3,
            data_entrevista="",
            status_entrevista="Agendado",
        )

        self.assertIsNone(payload.data_entrevista)

    def test_interview_datetime_adds_seconds_to_iso_minute_value(self):
        payload = InterviewCreateRequest(
            id_registro=10,
            data_entrevista="2099-04-30T09:30",
            status_entrevista="Agendado",
        )

        self.assertEqual(payload.data_entrevista.isoformat(), "2099-04-30T09:30:00")

    def test_interview_datetime_rejects_time_only_with_clear_message(self):
        with self.assertRaises(ValidationError) as context:
            InterviewCreateRequest(
                id_registro=10,
                data_entrevista="09:30",
                status_entrevista="Agendado",
            )

        self.assertIn(
            "Informe data e hora da entrevista no formato YYYY-MM-DDTHH:MM:SS.",
            str(context.exception),
        )

    def test_slot_capacity_must_be_positive(self):
        with self.assertRaises(ValidationError) as context:
            InterviewSlotCreateRequest(
                data="2099-04-30",
                hora_inicio="09:00",
                hora_fim="10:00",
                capacidade_total=0,
            )

        self.assertIn("A capacidade do slot deve ser maior que zero.", str(context.exception))

    def test_default_whatsapp_message_uses_vacancy_without_process(self):
        message = build_interview_message(
            candidate_name="Maria Silva",
            vacancy_name="Operador",
            interview_datetime="2099-04-30T09:30:00",
            custom_message="Trazer documento.",
        )

        self.assertIn("Olá Maria Silva!", message)
        self.assertIn("vaga de: Operador", message)
        self.assertIn("30/04/2099 às 09:30", message)
        self.assertIn("Observação do RH: Trazer documento.", message)
        self.assertNotIn("Processo:", message)


if __name__ == "__main__":
    unittest.main()
