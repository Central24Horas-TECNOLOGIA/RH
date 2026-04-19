from __future__ import annotations

import json
import math

from fastapi import HTTPException, status

from ..services.helpers import normalize_text, rows_to_dicts
from .bootstrap import get_gabaritos_payload_column


class HistoryRepositoryMixin:
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
            cursor.execute(
                """
                INSERT INTO historico_provas
                (
                    id_teste,
                    id_processo,
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
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.get("id_teste", ""),
                    row.get("id_processo", ""),
                    row.get("nome_candidato", ""),
                    row.get("vaga", ""),
                    row.get("nivel", ""),
                    row.get("trilha", ""),
                    row.get("data_iso", ""),
                    row.get("data_exibicao", ""),
                    row.get("pontuacao_final", 0),
                    row.get("status", ""),
                    row.get("tempo_minutos", 0),
                    row.get("arquivo_gabarito", ""),
                    row.get("etapas_json", ""),
                ),
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
