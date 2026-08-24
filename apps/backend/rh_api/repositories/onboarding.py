from __future__ import annotations

from fastapi import HTTPException, status

from ..services.helpers import normalize_text, rows_to_dicts
from .bootstrap import ensure_onboarding_tables


_TRILHA_COLUMNS = """
    id_trilha,
    nome,
    descricao,
    ativo,
    criado_por,
    criado_em,
    atualizado_em
"""

_TRILHA_ITEM_COLUMNS = """
    id_item,
    trilha_id,
    titulo,
    descricao,
    ordem,
    obrigatorio,
    criado_em
"""

_ONBOARDING_ITEM_COLUMNS = """
    id_onboarding_item,
    onboarding_candidato_id,
    trilha_item_id,
    titulo,
    descricao,
    ordem,
    obrigatorio,
    concluido,
    concluido_em,
    concluido_por
"""


class OnboardingRepositoryMixin:
    """Trilhas de onboarding (checklist configurável) e progresso por candidato."""

    # ------------------------------------------------------------------
    # Trilhas (administração)
    # ------------------------------------------------------------------
    def list_onboarding_trilhas(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)
            cursor.execute(
                f"""
                SELECT {_TRILHA_COLUMNS}
                FROM trilhas_onboarding
                ORDER BY ativo DESC, criado_em DESC, id_trilha DESC
                """
            )
            trilhas = rows_to_dicts(cursor, cursor.fetchall())

            for trilha in trilhas:
                cursor.execute(
                    f"""
                    SELECT {_TRILHA_ITEM_COLUMNS}
                    FROM trilhas_onboarding_itens
                    WHERE trilha_id = ?
                    ORDER BY ordem ASC, id_item ASC
                    """,
                    (int(trilha["id_trilha"]),),
                )
                trilha["itens"] = rows_to_dicts(cursor, cursor.fetchall())
            return trilhas
        finally:
            conn.close()

    def get_onboarding_trilha(self, id_trilha: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)
            cursor.execute(
                f"""
                SELECT {_TRILHA_COLUMNS}
                FROM trilhas_onboarding
                WHERE id_trilha = ?
                """,
                (int(id_trilha or 0),),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trilha de onboarding não encontrada.")
            trilha = rows[0]

            cursor.execute(
                f"""
                SELECT {_TRILHA_ITEM_COLUMNS}
                FROM trilhas_onboarding_itens
                WHERE trilha_id = ?
                ORDER BY ordem ASC, id_item ASC
                """,
                (int(id_trilha or 0),),
            )
            trilha["itens"] = rows_to_dicts(cursor, cursor.fetchall())
            return trilha
        finally:
            conn.close()

    @staticmethod
    def _validate_trilha_input(data: dict) -> tuple[str, str, bool, list[dict]]:
        nome = normalize_text(data.get("nome"))
        if not nome:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o nome da trilha.")
        descricao = normalize_text(data.get("descricao"))
        ativo = bool(data.get("ativo", True))
        itens_raw = data.get("itens") or []
        itens: list[dict] = []
        for index, item in enumerate(itens_raw):
            titulo = normalize_text(item.get("titulo") if isinstance(item, dict) else None)
            if not titulo:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o título de todos os itens da trilha.")
            itens.append(
                {
                    "titulo": titulo,
                    "descricao": normalize_text(item.get("descricao")),
                    "ordem": int(item.get("ordem") if item.get("ordem") is not None else index),
                    "obrigatorio": bool(item.get("obrigatorio", True)),
                }
            )
        return nome, descricao, ativo, itens

    def create_onboarding_trilha(self, data: dict, *, actor: str = "") -> dict:
        nome, descricao, ativo, itens = self._validate_trilha_input(data)

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            cursor.execute(
                """
                INSERT INTO trilhas_onboarding
                (nome, descricao, ativo, criado_por, criado_em, atualizado_em)
                OUTPUT INSERTED.id_trilha
                VALUES (?, ?, ?, ?, GETDATE(), GETDATE())
                """,
                (nome, descricao, 1 if ativo else 0, normalize_text(actor)),
            )
            inserted = cursor.fetchone()
            id_trilha = int(inserted[0] or 0)

            for item in itens:
                cursor.execute(
                    """
                    INSERT INTO trilhas_onboarding_itens
                    (trilha_id, titulo, descricao, ordem, obrigatorio, criado_em)
                    VALUES (?, ?, ?, ?, ?, GETDATE())
                    """,
                    (id_trilha, item["titulo"], item["descricao"], item["ordem"], 1 if item["obrigatorio"] else 0),
                )
            conn.commit()
        finally:
            conn.close()

        return self.get_onboarding_trilha(id_trilha)

    def update_onboarding_trilha(self, id_trilha: int, data: dict, *, actor: str = "") -> dict:
        nome, descricao, ativo, itens = self._validate_trilha_input(data)

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            cursor.execute("SELECT id_trilha FROM trilhas_onboarding WHERE id_trilha = ?", (int(id_trilha or 0),))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trilha de onboarding não encontrada.")

            cursor.execute(
                """
                UPDATE trilhas_onboarding
                SET nome = ?, descricao = ?, ativo = ?, atualizado_em = GETDATE()
                WHERE id_trilha = ?
                """,
                (nome, descricao, 1 if ativo else 0, int(id_trilha or 0)),
            )

            # Itens da trilha (modelo genérico/editável): substitui o conjunto de
            # itens pelo enviado. Onboardings já iniciados usam um snapshot
            # próprio (onboarding_candidatos_itens) e não são afetados por isso.
            cursor.execute("DELETE FROM trilhas_onboarding_itens WHERE trilha_id = ?", (int(id_trilha or 0),))
            for item in itens:
                cursor.execute(
                    """
                    INSERT INTO trilhas_onboarding_itens
                    (trilha_id, titulo, descricao, ordem, obrigatorio, criado_em)
                    VALUES (?, ?, ?, ?, ?, GETDATE())
                    """,
                    (int(id_trilha or 0), item["titulo"], item["descricao"], item["ordem"], 1 if item["obrigatorio"] else 0),
                )
            conn.commit()
        finally:
            conn.close()

        return self.get_onboarding_trilha(id_trilha)

    # ------------------------------------------------------------------
    # Instância de onboarding por candidato
    # ------------------------------------------------------------------
    def _get_candidate_process_row(self, cursor, id_registro: int) -> dict:
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
        return rows[0]

    def start_onboarding(self, id_registro: int, trilha_id: int, *, actor: str = "") -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            candidato = self._get_candidate_process_row(cursor, id_registro)

            cursor.execute(
                f"""
                SELECT {_TRILHA_COLUMNS}
                FROM trilhas_onboarding
                WHERE id_trilha = ?
                """,
                (int(trilha_id or 0),),
            )
            trilha_rows = rows_to_dicts(cursor, cursor.fetchall())
            if not trilha_rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trilha de onboarding não encontrada.")

            cursor.execute(
                f"""
                SELECT {_TRILHA_ITEM_COLUMNS}
                FROM trilhas_onboarding_itens
                WHERE trilha_id = ?
                ORDER BY ordem ASC, id_item ASC
                """,
                (int(trilha_id or 0),),
            )
            trilha_itens = rows_to_dicts(cursor, cursor.fetchall())

            cursor.execute(
                """
                INSERT INTO onboarding_candidatos
                (id_registro, trilha_id, iniciado_por, iniciado_em)
                OUTPUT INSERTED.id_onboarding
                VALUES (?, ?, ?, GETDATE())
                """,
                (int(candidato["id_registro"]), int(trilha_id or 0), normalize_text(actor)),
            )
            inserted = cursor.fetchone()
            id_onboarding = int(inserted[0] or 0)

            # Snapshot dos itens da trilha no momento da criação, para que
            # futuras edições na trilha não afetem onboardings em andamento.
            for item in trilha_itens:
                cursor.execute(
                    """
                    INSERT INTO onboarding_candidatos_itens
                    (onboarding_candidato_id, trilha_item_id, titulo, descricao, ordem, obrigatorio, concluido)
                    VALUES (?, ?, ?, ?, ?, ?, 0)
                    """,
                    (
                        id_onboarding,
                        int(item["id_item"]),
                        item["titulo"],
                        item.get("descricao"),
                        int(item.get("ordem") or 0),
                        1 if item.get("obrigatorio") else 0,
                    ),
                )
            conn.commit()
        finally:
            conn.close()

        return self.get_onboarding_progress(id_registro)

    def get_onboarding_progress(self, id_registro: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            candidato = self._get_candidate_process_row(cursor, id_registro)

            cursor.execute(
                """
                SELECT TOP 1 id_onboarding, id_registro, trilha_id, iniciado_por, iniciado_em
                FROM onboarding_candidatos
                WHERE id_registro = ?
                ORDER BY iniciado_em DESC, id_onboarding DESC
                """,
                (int(candidato["id_registro"]),),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                return {
                    "iniciado": False,
                    "candidato": candidato,
                    "onboarding": None,
                    "itens": [],
                    "total_itens": 0,
                    "itens_concluidos": 0,
                    "percentual_concluido": 0,
                }

            onboarding = rows[0]
            cursor.execute(
                f"""
                SELECT {_ONBOARDING_ITEM_COLUMNS}
                FROM onboarding_candidatos_itens
                WHERE onboarding_candidato_id = ?
                ORDER BY ordem ASC, id_onboarding_item ASC
                """,
                (int(onboarding["id_onboarding"]),),
            )
            itens = rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

        total_itens = len(itens)
        itens_concluidos = sum(1 for item in itens if item.get("concluido"))
        percentual = round((itens_concluidos / total_itens) * 100) if total_itens else 0

        return {
            "iniciado": True,
            "candidato": candidato,
            "onboarding": onboarding,
            "itens": itens,
            "total_itens": total_itens,
            "itens_concluidos": itens_concluidos,
            "percentual_concluido": percentual,
        }

    def set_onboarding_item_status(self, id_onboarding_item: int, concluido: bool, *, actor: str = "") -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            cursor.execute(
                """
                SELECT oi.id_onboarding_item, oc.id_registro
                FROM onboarding_candidatos_itens oi
                JOIN onboarding_candidatos oc ON oc.id_onboarding = oi.onboarding_candidato_id
                WHERE oi.id_onboarding_item = ?
                """,
                (int(id_onboarding_item or 0),),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item de onboarding não encontrado.")
            id_registro = int(row[1])

            cursor.execute(
                """
                UPDATE onboarding_candidatos_itens
                SET concluido = ?, concluido_em = ?, concluido_por = ?
                WHERE id_onboarding_item = ?
                """,
                (
                    1 if concluido else 0,
                    None if not concluido else None,
                    normalize_text(actor) if concluido else None,
                    int(id_onboarding_item or 0),
                ),
            )
            # concluido_em precisa de GETDATE() quando concluído; ajusta em uma
            # segunda instrução para manter a primeira portátil entre drivers.
            if concluido:
                cursor.execute(
                    """
                    UPDATE onboarding_candidatos_itens
                    SET concluido_em = GETDATE()
                    WHERE id_onboarding_item = ?
                    """,
                    (int(id_onboarding_item or 0),),
                )
            conn.commit()
        finally:
            conn.close()

        return self.get_onboarding_progress(id_registro)
