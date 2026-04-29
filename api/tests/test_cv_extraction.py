from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.services.cv import CvTextExtractionError, extract_text_from_uploaded_file


class CvExtractionTests(unittest.TestCase):
    def test_extract_txt_with_cp1252_fallback(self):
        text = extract_text_from_uploaded_file(
            "curriculo.txt",
            "João Silva\nExperiência com atendimento".encode("cp1252"),
            "text/plain",
        )

        self.assertIn("João Silva", text)
        self.assertIn("atendimento", text)

    def test_extract_rtf_with_basic_fallback_when_striprtf_fails(self):
        with patch.dict("sys.modules", {"striprtf.striprtf": None}):
            text = extract_text_from_uploaded_file(
                "curriculo.rtf",
                br"{\rtf1\ansi Joao Silva\par Experiencia com atendimento}",
                "application/rtf",
            )

        self.assertIn("Joao Silva", text)
        self.assertIn("Experiencia com atendimento", text)

    def test_rejects_empty_file_with_specific_message(self):
        with self.assertRaises(CvTextExtractionError) as context:
            extract_text_from_uploaded_file("curriculo.docx", b"", "")

        self.assertEqual(context.exception.user_message, "Arquivo vazio ou corrompido.")

    def test_rejects_unknown_extension_with_specific_message(self):
        with self.assertRaises(CvTextExtractionError) as context:
            extract_text_from_uploaded_file("curriculo.zip", b"PK\x03\x04", "application/zip")

        self.assertIn("Formato nao suportado", context.exception.user_message)

    def test_image_without_ocr_returns_specific_message(self):
        with patch("rh_api.services.cv.shutil.which", return_value=None):
            with self.assertRaises(CvTextExtractionError) as context:
                extract_text_from_uploaded_file("curriculo.png", b"\x89PNG\r\n\x1a\nconteudo", "image/png")

        self.assertEqual(
            context.exception.user_message,
            "Imagem recebida, mas OCR nao esta habilitado neste servidor.",
        )


if __name__ == "__main__":
    unittest.main()
