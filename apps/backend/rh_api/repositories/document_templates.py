from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status

from ..cache import get_cache_client
from ..services.document_template_engine import render_template_text
from ..services.helpers import normalize_text, rows_to_dicts
from .bootstrap import ensure_document_templates_table

# Cache de queries (roadmap de expansão, respostas.txt): templates de
# documentos são lidos com frequência (toda geração de documento consulta a
# lista) e mudam pouco (RH edita templates ocasionalmente). TTL de 2 minutos
# — mais curto que datas comemorativas por serem usados em fluxos onde uma
# edição recente do RH deve refletir rápido; também invalidado ativamente em
# toda escrita abaixo.
_DOCUMENT_TEMPLATES_CACHE_KEY = "conecta:cache:document_templates:list"
_DOCUMENT_TEMPLATES_CACHE_TTL_SECONDS = 120


_TEMPLATE_COLUMNS = """
    id_template,
    titulo,
    corpo_texto,
    ativo,
    criado_em,
    atualizado_em
"""


class DocumentTemplateRepositoryMixin:
    """Templates de documentos com placeholders {{variavel}} e geração de texto final."""

    def list_document_templates(self) -> list[dict]:
        cache = get_cache_client()
        cached_rows = cache.get(_DOCUMENT_TEMPLATES_CACHE_KEY)
        if cached_rows is not None:
            return cached_rows

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_document_templates_table(cursor)
            cursor.execute(
                f"""
                SELECT {_TEMPLATE_COLUMNS}
                FROM templates_documentos
                ORDER BY ativo DESC, atualizado_em DESC, id_template DESC
                """
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

        cache.set(_DOCUMENT_TEMPLATES_CACHE_KEY, rows, ttl_seconds=_DOCUMENT_TEMPLATES_CACHE_TTL_SECONDS)
        return rows

    def get_document_template(self, id_template: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_document_templates_table(cursor)
            cursor.execute(
                f"""
                SELECT {_TEMPLATE_COLUMNS}
                FROM templates_documentos
                WHERE id_template = ?
                """,
                (int(id_template or 0),),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template de documento não encontrado.")
            return rows[0]
        finally:
            conn.close()

    @staticmethod
    def _validate_template_input(data: dict) -> tuple[str, str, bool]:
        titulo = normalize_text(data.get("titulo"))
        if not titulo:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o título do template.")
        corpo_texto = str(data.get("corpo_texto") or "").strip()
        if not corpo_texto:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o texto do template.")
        ativo = bool(data.get("ativo", True))
        return titulo, corpo_texto, ativo

    def create_document_template(self, data: dict, *, actor: str = "") -> dict:
        titulo, corpo_texto, ativo = self._validate_template_input(data)

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_document_templates_table(cursor)
            cursor.execute(
                """
                INSERT INTO templates_documentos
                (titulo, corpo_texto, ativo, criado_em, atualizado_em)
                OUTPUT INSERTED.id_template
                VALUES (?, ?, ?, GETDATE(), GETDATE())
                """,
                (titulo, corpo_texto, 1 if ativo else 0),
            )
            inserted = cursor.fetchone()
            id_template = int(inserted[0] or 0)
            conn.commit()
        finally:
            conn.close()

        get_cache_client().invalidate(_DOCUMENT_TEMPLATES_CACHE_KEY)
        return self.get_document_template(id_template)

    def update_document_template(self, id_template: int, data: dict, *, actor: str = "") -> dict:
        titulo, corpo_texto, ativo = self._validate_template_input(data)

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_document_templates_table(cursor)

            cursor.execute("SELECT id_template FROM templates_documentos WHERE id_template = ?", (int(id_template or 0),))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template de documento não encontrado.")

            cursor.execute(
                """
                UPDATE templates_documentos
                SET titulo = ?, corpo_texto = ?, ativo = ?, atualizado_em = GETDATE()
                WHERE id_template = ?
                """,
                (titulo, corpo_texto, 1 if ativo else 0, int(id_template or 0)),
            )
            conn.commit()
        finally:
            conn.close()

        get_cache_client().invalidate(_DOCUMENT_TEMPLATES_CACHE_KEY)
        return self.get_document_template(id_template)

    def delete_document_template(self, id_template: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_document_templates_table(cursor)

            cursor.execute("SELECT id_template FROM templates_documentos WHERE id_template = ?", (int(id_template or 0),))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template de documento não encontrado.")

            cursor.execute("DELETE FROM templates_documentos WHERE id_template = ?", (int(id_template or 0),))
            conn.commit()
        finally:
            conn.close()

        get_cache_client().invalidate(_DOCUMENT_TEMPLATES_CACHE_KEY)
        return {"success": True}

    def _build_document_variables(self, cursor, id_registro: int, variaveis_extra: dict | None) -> dict:
        cursor.execute(
            """
            SELECT id_registro, id_processo, id_processo_ref, id_teste, nome_candidato, vaga, status_candidato
            FROM candidatos_processos
            WHERE id_registro = ?
            """,
            (int(id_registro or 0),),
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato não encontrado no processo informado.")
        candidato = rows[0]

        email_candidato = ""
        telefone_candidato = ""
        id_teste = normalize_text(candidato.get("id_teste"))
        if id_teste:
            cursor.execute(
                "SELECT email, telefone FROM candidatos_metadata WHERE id_teste = ?",
                (id_teste,),
            )
            metadata_row = cursor.fetchone()
            if metadata_row:
                email_candidato = normalize_text(metadata_row[0])
                telefone_candidato = normalize_text(metadata_row[1])

        variaveis = {
            "nome_candidato": normalize_text(candidato.get("nome_candidato")),
            "vaga": normalize_text(candidato.get("vaga")),
            "email_candidato": email_candidato,
            "telefone_candidato": telefone_candidato,
            "id_processo": normalize_text(candidato.get("id_processo")),
            "status_candidato": normalize_text(candidato.get("status_candidato")),
            "nome_empresa": "Central 24 Horas",
            "data_atual": datetime.now().strftime("%d/%m/%Y"),
        }

        if isinstance(variaveis_extra, dict):
            for chave, valor in variaveis_extra.items():
                safe_chave = normalize_text(chave)
                if safe_chave:
                    variaveis[safe_chave] = valor

        return variaveis

    def generate_document(self, template_id: int, id_registro: int, *, variaveis_extra: dict | None = None) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_document_templates_table(cursor)

            cursor.execute(
                f"""
                SELECT {_TEMPLATE_COLUMNS}
                FROM templates_documentos
                WHERE id_template = ?
                """,
                (int(template_id or 0),),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template de documento não encontrado.")
            template = rows[0]

            variaveis = self._build_document_variables(cursor, id_registro, variaveis_extra)
        finally:
            conn.close()

        texto_gerado = render_template_text(template.get("corpo_texto"), variaveis)

        return {
            "template_id": int(template["id_template"]),
            "titulo_template": template.get("titulo"),
            "id_registro": int(id_registro or 0),
            "variaveis_utilizadas": variaveis,
            "texto_gerado": texto_gerado,
            "gerado_em": datetime.now().isoformat(timespec="seconds"),
        }
