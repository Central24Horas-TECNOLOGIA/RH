from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status

from ..cache import get_cache_client
from ..services.helpers import normalize_text, rows_to_dicts
from .bootstrap import ensure_celebratory_dates_table
from .interviews import OCCUPYING_INTERVIEW_STATUSES

# Cache de queries (roadmap de expansão, respostas.txt): listagem de datas
# comemorativas muda raramente (o RH cadastra poucas vezes por ano) e é lida
# com frequência (tela de dashboard/lembretes). TTL de 5 minutos: baixo risco
# de dado desatualizado (também invalidado ativamente em toda escrita abaixo).
_CELEBRATORY_DATES_CACHE_KEY = "conecta:cache:celebratory_dates:list"
_CELEBRATORY_DATES_CACHE_TTL_SECONDS = 300


_DATE_COLUMNS = """
    id_data,
    titulo,
    dia,
    mes,
    descricao,
    criado_por,
    criado_em,
    atualizado_em
"""


def _days_until_next_occurrence(dia: int, mes: int, *, today: date | None = None) -> int:
    """Calcula quantos dias faltam para a próxima ocorrência anual de dia/mes."""
    hoje = today or date.today()
    try:
        proxima = date(hoje.year, mes, dia)
    except ValueError:
        # 29/02 em ano não bissexto: usa 28/02 como aproximação segura.
        proxima = date(hoje.year, mes, min(dia, 28))
    if proxima < hoje:
        try:
            proxima = date(hoje.year + 1, mes, dia)
        except ValueError:
            proxima = date(hoje.year + 1, mes, min(dia, 28))
    return (proxima - hoje).days


class CelebratoryDateRepositoryMixin:
    """Datas comemorativas de RH — puramente informativo, sem integrações."""

    def list_celebratory_dates(self) -> list[dict]:
        cache = get_cache_client()
        cached_rows = cache.get(_CELEBRATORY_DATES_CACHE_KEY)
        if cached_rows is not None:
            return cached_rows

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_celebratory_dates_table(cursor)
            cursor.execute(
                f"""
                SELECT {_DATE_COLUMNS}
                FROM datas_comemorativas
                ORDER BY mes, dia, titulo
                """
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

        for item in rows:
            try:
                dias_restantes = _days_until_next_occurrence(int(item.get("dia") or 1), int(item.get("mes") or 1))
            except Exception:
                dias_restantes = 9999
            item["dias_para_proxima_ocorrencia"] = dias_restantes

        rows.sort(key=lambda item: item.get("dias_para_proxima_ocorrencia", 9999))
        cache.set(_CELEBRATORY_DATES_CACHE_KEY, rows, ttl_seconds=_CELEBRATORY_DATES_CACHE_TTL_SECONDS)
        return rows

    def list_calendar_events(self, *, include_interviews: bool = False) -> list[dict]:
        """Combina datas comemorativas com entrevistas agendadas ativas, lendo ao vivo das
        duas fontes já existentes (sem duplicar dados em uma tabela própria de eventos)."""
        events: list[dict] = [
            {
                "id": f"data-{item.get('id_data')}",
                "tipo": "data_comemorativa",
                "titulo": item.get("titulo"),
                "dia": item.get("dia"),
                "mes": item.get("mes"),
                "descricao": item.get("descricao"),
                "dias_para_proxima_ocorrencia": item.get("dias_para_proxima_ocorrencia"),
            }
            for item in self.list_celebratory_dates()
        ]

        if include_interviews:
            for item in self.list_interviews():
                if not item.get("data_entrevista"):
                    continue
                if item.get("status_entrevista") not in OCCUPYING_INTERVIEW_STATUSES:
                    continue
                events.append(
                    {
                        "id": f"entrevista-{item.get('id_entrevista')}",
                        "tipo": "entrevista",
                        "titulo": f"Entrevista — {item.get('nome_candidato') or 'Candidato'}",
                        "data": item.get("data_entrevista"),
                        "vaga": item.get("vaga"),
                        "status": item.get("status_entrevista"),
                    }
                )

        return events

    def get_celebratory_date(self, id_data: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_celebratory_dates_table(cursor)
            cursor.execute(
                f"""
                SELECT {_DATE_COLUMNS}
                FROM datas_comemorativas
                WHERE id_data = ?
                """,
                (int(id_data or 0),),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data comemorativa não encontrada.")
            return rows[0]
        finally:
            conn.close()

    @staticmethod
    def _validate_day_month(dia, mes) -> tuple[int, int]:
        try:
            safe_dia = int(dia)
            safe_mes = int(mes)
        except (TypeError, ValueError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe dia e mês válidos.")
        if safe_mes < 1 or safe_mes > 12 or safe_dia < 1 or safe_dia > 31:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe dia e mês válidos.")
        return safe_dia, safe_mes

    def create_celebratory_date(self, data: dict, *, actor: str = "") -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_celebratory_dates_table(cursor)

            titulo = normalize_text(data.get("titulo"))
            if not titulo:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o título da data comemorativa.")
            dia, mes = self._validate_day_month(data.get("dia"), data.get("mes"))

            cursor.execute(
                """
                INSERT INTO datas_comemorativas
                (titulo, dia, mes, descricao, criado_por, criado_em, atualizado_em)
                OUTPUT INSERTED.id_data
                VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE())
                """,
                (
                    titulo,
                    dia,
                    mes,
                    normalize_text(data.get("descricao")),
                    normalize_text(actor),
                ),
            )
            inserted = cursor.fetchone()
            id_data = int(inserted[0] or 0)
            conn.commit()
        finally:
            conn.close()

        get_cache_client().invalidate(_CELEBRATORY_DATES_CACHE_KEY)
        return self.get_celebratory_date(id_data)

    def update_celebratory_date(self, id_data: int, data: dict, *, actor: str = "") -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_celebratory_dates_table(cursor)

            cursor.execute("SELECT id_data FROM datas_comemorativas WHERE id_data = ?", (int(id_data or 0),))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data comemorativa não encontrada.")

            titulo = normalize_text(data.get("titulo"))
            if not titulo:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o título da data comemorativa.")
            dia, mes = self._validate_day_month(data.get("dia"), data.get("mes"))

            cursor.execute(
                """
                UPDATE datas_comemorativas
                SET
                    titulo = ?,
                    dia = ?,
                    mes = ?,
                    descricao = ?,
                    atualizado_em = GETDATE()
                WHERE id_data = ?
                """,
                (
                    titulo,
                    dia,
                    mes,
                    normalize_text(data.get("descricao")),
                    int(id_data or 0),
                ),
            )
            conn.commit()
        finally:
            conn.close()

        get_cache_client().invalidate(_CELEBRATORY_DATES_CACHE_KEY)
        return self.get_celebratory_date(id_data)

    def delete_celebratory_date(self, id_data: int, *, actor: str = "") -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_celebratory_dates_table(cursor)

            cursor.execute("SELECT id_data FROM datas_comemorativas WHERE id_data = ?", (int(id_data or 0),))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data comemorativa não encontrada.")

            cursor.execute("DELETE FROM datas_comemorativas WHERE id_data = ?", (int(id_data or 0),))
            conn.commit()
        finally:
            conn.close()

        get_cache_client().invalidate(_CELEBRATORY_DATES_CACHE_KEY)
        return {"success": True}
