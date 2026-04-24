from __future__ import annotations

import json
import math
from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import (
    normalize_compare_text,
    normalize_text,
    parse_float_br,
    rows_to_dicts,
)
from .bootstrap import (
    ensure_decimal_process_columns,
    ensure_process_reference_columns,
    get_gabaritos_payload_column,
)


class HistoryRepositoryMixin:
    @staticmethod
    def _normalize_column_lookup(columns_meta) -> dict[str, str]:
        result = {}
        for column in columns_meta:
            safe_name = normalize_text(getattr(column, "column_name", ""))
            if safe_name:
                result[normalize_compare_text(safe_name)] = safe_name
        return result

    @staticmethod
    def _resolve_history_column(column_lookup: dict[str, str], *aliases: str) -> str:
        for alias in aliases:
            resolved = column_lookup.get(normalize_compare_text(alias))
            if resolved:
                return resolved
        return ""

    @staticmethod
    def _is_identity_history_column(cursor, column_name: str) -> bool:
        safe_column = normalize_text(column_name)
        if not safe_column:
            return False

        cursor.execute(
            """
            SELECT CONVERT(INT, COLUMNPROPERTY(OBJECT_ID('dbo.historico_provas'), ?, 'IsIdentity'))
            """,
            (safe_column,),
        )
        row = cursor.fetchone()
        return bool(int(row[0] or 0)) if row else False

    def get_gabaritos_columns(self) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            columns = [col.column_name for col in cursor.columns(table="gabaritos")]
            return {"columns": columns}
        finally:
            conn.close()

    def list_history(self, page: int | None = None, page_size: int = 10, nome: str = "", vaga: str = "", data: str = ""):
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_reference_columns(cursor)
            ensure_decimal_process_columns(cursor)
            filters = []
            params = []

            if normalize_text(nome):
                filters.append("nome_candidato LIKE ?")
                params.append(f"%{nome.strip()}%")
            if normalize_text(vaga):
                filters.append("vaga LIKE ?")
                params.append(f"%{vaga.strip()}%")
            if normalize_text(data):
                filters.append("data_iso LIKE ?")
                params.append(f"{data.strip()}%")

            base_select = """
                SELECT
                    id_teste,
                    id_processo,
                    id_processo_ref,
                    nome_candidato,
                    vaga,
                    nivel,
                    trilha,
                    data_iso,
                    data_exibicao,
                    pontuacao_final,
                    status,
                    tempo_minutos,
                    arquivo_gabarito,
                    etapas_json
                FROM historico_provas
            """

            where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
            if page is None and not filters:
                cursor.execute(base_select)
                return rows_to_dicts(cursor, cursor.fetchall())

            page_safe = max(1, int(page or 1))
            page_size_safe = max(1, min(int(page_size or 10), 100))
            offset = (page_safe - 1) * page_size_safe

            cursor.execute(f"SELECT COUNT(*) FROM historico_provas{where_clause}", tuple(params))
            total_items = int(cursor.fetchone()[0] or 0)

            order_clause = " ORDER BY data_iso DESC, id_teste DESC"
            pagination_clause = " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
            cursor.execute(
                f"{base_select}{where_clause}{order_clause}{pagination_clause}",
                tuple(params + [offset, page_size_safe]),
            )
            items = rows_to_dicts(cursor, cursor.fetchall())
            total_pages = max(1, math.ceil(total_items / page_size_safe))
            return {
                "items": items,
                "page": page_safe,
                "page_size": page_size_safe,
                "total_items": total_items,
                "total_pages": total_pages,
            }
        finally:
            conn.close()

    def save_history(self, row: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_reference_columns(cursor)
            ensure_decimal_process_columns(cursor)
            columns_meta = list(cursor.columns(table="historico_provas", schema="dbo"))
            column_lookup = self._normalize_column_lookup(columns_meta)
            if not column_lookup:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Nao foi possivel identificar as colunas da tabela historico_provas.",
                )

            id_teste = normalize_text(row.get("id_teste"))
            agora = datetime.now()
            codigo_legado = (
                normalize_text(row.get("Codigo"))
                or normalize_text(row.get("codigo"))
                or id_teste
                or f"HIST-{agora.strftime('%Y%m%d%H%M%S')}"
            )
            arquivo_gabarito = normalize_text(row.get("arquivo_gabarito")) or normalize_text(
                row.get("pontuacao_bruta"),
            )

            payload = {
                "id_teste": id_teste,
                "id_processo": normalize_text(row.get("id_processo")),
                "id_processo_ref": normalize_text(row.get("id_processo_ref")),
                "nome_candidato": normalize_text(row.get("nome_candidato")),
                "vaga": normalize_text(row.get("vaga")),
                "nivel": normalize_text(row.get("nivel")),
                "trilha": normalize_text(row.get("trilha")),
                "data_iso": normalize_text(row.get("data_iso")),
                "data_exibicao": normalize_text(row.get("data_exibicao")),
                "pontuacao_final": parse_float_br(row.get("pontuacao_final", 0)),
                "status": normalize_text(row.get("status")),
                "tempo_minutos": int(float(row.get("tempo_minutos", 0) or 0)),
                "arquivo_gabarito": arquivo_gabarito,
                "etapas_json": normalize_text(row.get("etapas_json")),
            }

            code_column = self._resolve_history_column(
                column_lookup,
                "Código",
                "Codigo",
                "codigo",
            )
            include_code_column = bool(code_column) and not self._is_identity_history_column(cursor, code_column)

            ordered_columns = []
            values = []
            if include_code_column:
                ordered_columns.append(code_column)
                values.append(codigo_legado)

            for alias in (
                "id_teste",
                "id_processo",
                "id_processo_ref",
                "nome_candidato",
                "vaga",
                "nivel",
                "trilha",
                "data_iso",
                "data_exibicao",
                "pontuacao_final",
                "status",
                "tempo_minutos",
                "arquivo_gabarito",
                "etapas_json",
            ):
                column_name = self._resolve_history_column(column_lookup, alias)
                if not column_name:
                    continue
                ordered_columns.append(column_name)
                values.append(payload.get(alias, payload.get(column_name, "")))

            if not ordered_columns:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Nenhuma coluna valida foi encontrada para gravar o historico da prova.",
                )

            placeholders = ", ".join(["?"] * len(ordered_columns))
            columns_sql = ",\n                    ".join(f"[{column}]" for column in ordered_columns)
            cursor.execute(
                f"""
                INSERT INTO historico_provas
                (
                    {columns_sql}
                )
                VALUES ({placeholders})
                """,
                tuple(values),
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def get_answer_files(self) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            payload_column = get_gabaritos_payload_column(cursor)
            cursor.execute(f"SELECT record_id, {payload_column} FROM gabaritos")
            rows = cursor.fetchall()
            result = {}
            for row in rows:
                result[str(row[0])] = {"content": row[1]}
            return result
        finally:
            conn.close()

    def save_answer_file(self, data: dict) -> dict:
        record_id = data.get("recordId")
        payload = data.get("payload")
        if not record_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="recordId e obrigatorio.")

        payload_text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
        conn = self._connect()
        try:
            cursor = conn.cursor()
            payload_column = get_gabaritos_payload_column(cursor)
            cursor.execute("SELECT COUNT(*) FROM gabaritos WHERE record_id = ?", (record_id,))
            exists = int(cursor.fetchone()[0] or 0)
            if exists:
                cursor.execute(
                    f"UPDATE gabaritos SET {payload_column} = ? WHERE record_id = ?",
                    (payload_text, record_id),
                )
            else:
                cursor.execute(
                    f"INSERT INTO gabaritos (record_id, {payload_column}) VALUES (?, ?)",
                    (record_id, payload_text),
                )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()
