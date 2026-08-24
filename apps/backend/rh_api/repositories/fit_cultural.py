from __future__ import annotations

from fastapi import HTTPException, status

from ..services.fit_cultural_engine import calcular_score_fit_cultural
from ..services.helpers import normalize_text, rows_to_dicts
from .bootstrap import ensure_fit_cultural_tables


class FitCulturalRepositoryMixin:
    """Fit cultural aprofundado: valores da empresa, frases e respostas Likert 1-5."""

    # ------------------------------------------------------------------
    # Administração de valores/frases (RH)
    # ------------------------------------------------------------------
    def list_valores_empresa(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_fit_cultural_tables(cursor)
            cursor.execute(
                "SELECT id_valor, nome, descricao, ativo, criado_em, atualizado_em FROM dbo.valores_empresa ORDER BY ativo DESC, nome ASC"
            )
            valores = rows_to_dicts(cursor, cursor.fetchall())
            for valor in valores:
                cursor.execute(
                    "SELECT id_frase, valor_id, frase, ordem FROM dbo.valores_empresa_frases WHERE valor_id = ? ORDER BY ordem ASC, id_frase ASC",
                    (int(valor["id_valor"]),),
                )
                valor["frases"] = rows_to_dicts(cursor, cursor.fetchall())
            return valores
        finally:
            conn.close()

    def get_valor_empresa(self, id_valor: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_fit_cultural_tables(cursor)
            cursor.execute(
                "SELECT id_valor, nome, descricao, ativo, criado_em, atualizado_em FROM dbo.valores_empresa WHERE id_valor = ?",
                (int(id_valor or 0),),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Valor da empresa não encontrado.")
            valor = rows[0]
            cursor.execute(
                "SELECT id_frase, valor_id, frase, ordem FROM dbo.valores_empresa_frases WHERE valor_id = ? ORDER BY ordem ASC, id_frase ASC",
                (int(id_valor),),
            )
            valor["frases"] = rows_to_dicts(cursor, cursor.fetchall())
            return valor
        finally:
            conn.close()

    def create_valor_empresa(self, data: dict) -> dict:
        nome = normalize_text(data.get("nome"))
        if not nome:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o nome do valor da empresa.")
        frases = data.get("frases") or []

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_fit_cultural_tables(cursor)
            cursor.execute(
                """
                INSERT INTO dbo.valores_empresa (nome, descricao, ativo, criado_em, atualizado_em)
                OUTPUT INSERTED.id_valor
                VALUES (?, ?, ?, GETDATE(), GETDATE())
                """,
                (nome, normalize_text(data.get("descricao")), 1 if data.get("ativo", True) else 0),
            )
            id_valor = int(cursor.fetchone()[0])
            for ordem, frase in enumerate(frases):
                cursor.execute(
                    "INSERT INTO dbo.valores_empresa_frases (valor_id, frase, ordem) VALUES (?, ?, ?)",
                    (id_valor, normalize_text(frase.get("frase")), int(frase.get("ordem") if frase.get("ordem") is not None else ordem)),
                )
            conn.commit()
        finally:
            conn.close()
        return self.get_valor_empresa(id_valor)

    def update_valor_empresa(self, id_valor: int, data: dict) -> dict:
        nome = normalize_text(data.get("nome"))
        if not nome:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o nome do valor da empresa.")
        frases = data.get("frases") or []

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_fit_cultural_tables(cursor)
            cursor.execute("SELECT id_valor FROM dbo.valores_empresa WHERE id_valor = ?", (int(id_valor or 0),))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Valor da empresa não encontrado.")

            cursor.execute(
                """
                UPDATE dbo.valores_empresa
                SET nome = ?, descricao = ?, ativo = ?, atualizado_em = GETDATE()
                WHERE id_valor = ?
                """,
                (nome, normalize_text(data.get("descricao")), 1 if data.get("ativo", True) else 0, int(id_valor)),
            )
            # Substitui o conjunto de frases (modelo editável simples, igual ao
            # padrão adotado para trilhas de onboarding). Respostas de
            # candidatos já registradas continuam referenciando o id_frase
            # antigo se ele não for removido; frases removidas simplesmente
            # deixam de ser exibidas para novas aplicações.
            cursor.execute("DELETE FROM dbo.valores_empresa_frases WHERE valor_id = ?", (int(id_valor),))
            for ordem, frase in enumerate(frases):
                cursor.execute(
                    "INSERT INTO dbo.valores_empresa_frases (valor_id, frase, ordem) VALUES (?, ?, ?)",
                    (int(id_valor), normalize_text(frase.get("frase")), int(frase.get("ordem") if frase.get("ordem") is not None else ordem)),
                )
            conn.commit()
        finally:
            conn.close()
        return self.get_valor_empresa(id_valor)

    # ------------------------------------------------------------------
    # Aplicação ao candidato
    # ------------------------------------------------------------------
    def list_fit_cultural_frases_ativas(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_fit_cultural_tables(cursor)
            cursor.execute(
                """
                SELECT f.id_frase, f.valor_id, v.nome AS valor_nome, f.frase, f.ordem
                FROM dbo.valores_empresa_frases f
                JOIN dbo.valores_empresa v ON v.id_valor = f.valor_id
                WHERE v.ativo = 1
                ORDER BY v.nome ASC, f.ordem ASC, f.id_frase ASC
                """
            )
            return rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

    def submit_fit_cultural_respostas(self, data: dict) -> dict:
        candidato_processo_id = int(data.get("candidato_processo_id") or 0)
        if not candidato_processo_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o candidato para registrar as respostas.")
        respostas = data.get("respostas") or []

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_fit_cultural_tables(cursor)
            for resposta in respostas:
                cursor.execute(
                    """
                    INSERT INTO dbo.fit_cultural_respostas (candidato_processo_id, frase_id, nota_concordancia, respondido_em)
                    VALUES (?, ?, ?, GETDATE())
                    """,
                    (candidato_processo_id, int(resposta.get("frase_id")), int(resposta.get("nota_concordancia"))),
                )
            conn.commit()
        finally:
            conn.close()
        return self.get_fit_cultural_resultado(candidato_processo_id)

    def get_fit_cultural_resultado(self, candidato_processo_id: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_fit_cultural_tables(cursor)
            cursor.execute(
                """
                SELECT r.frase_id, r.nota_concordancia, f.valor_id, v.nome AS valor_nome
                FROM dbo.fit_cultural_respostas r
                JOIN dbo.valores_empresa_frases f ON f.id_frase = r.frase_id
                JOIN dbo.valores_empresa v ON v.id_valor = f.valor_id
                WHERE r.candidato_processo_id = ?
                """,
                (int(candidato_processo_id or 0),),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

        if not rows:
            return {"possui_resultado": False, "candidato_processo_id": candidato_processo_id}

        frases_por_id = {
            int(row["frase_id"]): {"valor_id": row["valor_id"], "valor_nome": row["valor_nome"]} for row in rows
        }
        respostas = [{"frase_id": int(row["frase_id"]), "nota_concordancia": row["nota_concordancia"]} for row in rows]
        score = calcular_score_fit_cultural(respostas, frases_por_id)
        return {"possui_resultado": True, "candidato_processo_id": candidato_processo_id, **score}
