from __future__ import annotations

import json
import random

from fastapi import HTTPException, status

from ..services.helpers import normalize_text, rows_to_dicts, safe_json_loads
from ..services.raciocinio_engine import (
    ORDEM_DIFICULDADE,
    corrigir_raciocinio,
    escolher_proxima_pergunta_adaptativa,
    montar_prova_balanceada_por_nivel,
    proxima_dificuldade_adaptativa,
)
from .bootstrap import ensure_raciocinio_tables


class RaciocinioLogicoRepositoryMixin:
    """Teste de raciocínio lógico/numérico: banco de questões + correção automática."""

    # ------------------------------------------------------------------
    # Banco de questões (administração RH)
    # ------------------------------------------------------------------
    def list_raciocinio_perguntas(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_raciocinio_tables(cursor)
            cursor.execute(
                """
                SELECT id_pergunta, enunciado, tipo, alternativas_json, gabarito, dificuldade, feedback_erro, ativo, criado_em
                FROM dbo.raciocinio_perguntas
                ORDER BY ativo DESC, criado_em DESC, id_pergunta DESC
                """
            )
            perguntas = rows_to_dicts(cursor, cursor.fetchall())
            for pergunta in perguntas:
                pergunta["alternativas"] = safe_json_loads(pergunta.pop("alternativas_json", None), [])
            return perguntas
        finally:
            conn.close()

    def create_raciocinio_pergunta(self, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_raciocinio_tables(cursor)
            alternativas = data.get("alternativas") or []
            gabarito = int(data.get("gabarito") or 0)
            if gabarito < 0 or gabarito >= len(alternativas):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O gabarito deve apontar para uma alternativa válida.")
            cursor.execute(
                """
                INSERT INTO dbo.raciocinio_perguntas
                (enunciado, tipo, alternativas_json, gabarito, dificuldade, feedback_erro, ativo, criado_em)
                OUTPUT INSERTED.id_pergunta
                VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE())
                """,
                (
                    normalize_text(data.get("enunciado")),
                    normalize_text(data.get("tipo")),
                    json.dumps(alternativas, ensure_ascii=False),
                    gabarito,
                    normalize_text(data.get("dificuldade")),
                    normalize_text(data.get("feedback_erro")) or None,
                    1 if data.get("ativo", True) else 0,
                ),
            )
            id_pergunta = int(cursor.fetchone()[0])
            conn.commit()
        finally:
            conn.close()
        return {"success": True, "id_pergunta": id_pergunta}

    def update_raciocinio_pergunta(self, id_pergunta: int, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_raciocinio_tables(cursor)
            cursor.execute("SELECT id_pergunta FROM dbo.raciocinio_perguntas WHERE id_pergunta = ?", (int(id_pergunta or 0),))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Questão de raciocínio não encontrada.")
            alternativas = data.get("alternativas") or []
            gabarito = int(data.get("gabarito") or 0)
            if gabarito < 0 or gabarito >= len(alternativas):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O gabarito deve apontar para uma alternativa válida.")
            cursor.execute(
                """
                UPDATE dbo.raciocinio_perguntas
                SET enunciado = ?, tipo = ?, alternativas_json = ?, gabarito = ?, dificuldade = ?, feedback_erro = ?, ativo = ?
                WHERE id_pergunta = ?
                """,
                (
                    normalize_text(data.get("enunciado")),
                    normalize_text(data.get("tipo")),
                    json.dumps(alternativas, ensure_ascii=False),
                    gabarito,
                    normalize_text(data.get("dificuldade")),
                    normalize_text(data.get("feedback_erro")) or None,
                    1 if data.get("ativo", True) else 0,
                    int(id_pergunta),
                ),
            )
            conn.commit()
        finally:
            conn.close()
        return {"success": True, "id_pergunta": int(id_pergunta)}

    def delete_raciocinio_pergunta(self, id_pergunta: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_raciocinio_tables(cursor)
            cursor.execute("UPDATE dbo.raciocinio_perguntas SET ativo = 0 WHERE id_pergunta = ?", (int(id_pergunta or 0),))
            conn.commit()
        finally:
            conn.close()
        return {"success": True}

    # ------------------------------------------------------------------
    # Aplicação por candidato
    # ------------------------------------------------------------------
    def create_raciocinio_aplicacao(self, data: dict) -> dict:
        id_teste = normalize_text(data.get("id_teste"))
        if not id_teste:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o candidato para a aplicação do teste.")
        quantidade = int(data.get("quantidade_questoes") or 10)
        # Roadmap (respostas.txt): modo adaptativo opcional (default False =
        # modo fixo, comportamento existente inalterado) + nivel de vaga
        # opcional (balanceia a composicao de dificuldade no modo fixo).
        modo_adaptativo = bool(data.get("modo_adaptativo") or False)
        nivel_vaga = normalize_text(data.get("nivel_vaga")).lower() or None

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_raciocinio_tables(cursor)
            cursor.execute(
                "SELECT id_pergunta, enunciado, tipo, alternativas_json, gabarito, dificuldade, feedback_erro FROM dbo.raciocinio_perguntas WHERE ativo = 1"
            )
            perguntas = rows_to_dicts(cursor, cursor.fetchall())
            if not perguntas:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não há questões cadastradas no banco de raciocínio lógico.")
            for pergunta in perguntas:
                pergunta["alternativas"] = safe_json_loads(pergunta.pop("alternativas_json", None), [])

            estado_adaptativo_json = None

            if modo_adaptativo:
                # Modo adaptativo: nao pre-seleciona a prova inteira. Monta um
                # pool (agrupado por dificuldade, ja embaralhado) do qual as
                # questoes vao sendo retiradas uma a uma, dinamicamente,
                # conforme o candidato responde (ver avancar_raciocinio_adaptativo).
                pool_por_dificuldade: dict[str, list[dict]] = {d: [] for d in ORDEM_DIFICULDADE}
                for pergunta in perguntas:
                    dificuldade = pergunta.get("dificuldade") if pergunta.get("dificuldade") in ORDEM_DIFICULDADE else "medio"
                    pool_por_dificuldade[dificuldade].append(pergunta)
                for grupo in pool_por_dificuldade.values():
                    random.shuffle(grupo)

                # Primeira questao comeca no nivel intermediario ("medio").
                primeira, dificuldade_efetiva = escolher_proxima_pergunta_adaptativa(pool_por_dificuldade, "medio")
                snapshot = [primeira] if primeira else []
                estado_adaptativo_json = json.dumps(
                    {
                        "pool": pool_por_dificuldade,
                        "dificuldade_atual": dificuldade_efetiva or "medio",
                        "quantidade_alvo": quantidade if quantidade > 0 else len(perguntas),
                    },
                    ensure_ascii=False,
                )
            elif nivel_vaga:
                # Modo fixo com nivel de vaga informado: balanceia a
                # composicao de dificuldade (ver COMPOSICAO_POR_NIVEL).
                perguntas_por_dificuldade: dict[str, list[dict]] = {d: [] for d in ORDEM_DIFICULDADE}
                for pergunta in perguntas:
                    dificuldade = pergunta.get("dificuldade") if pergunta.get("dificuldade") in ORDEM_DIFICULDADE else "medio"
                    perguntas_por_dificuldade[dificuldade].append(pergunta)
                for grupo in perguntas_por_dificuldade.values():
                    random.shuffle(grupo)
                snapshot = montar_prova_balanceada_por_nivel(perguntas_por_dificuldade, quantidade, nivel_vaga)
            else:
                # Modo fixo sem nivel de vaga informado: comportamento
                # original, inalterado (selecao aleatoria simples).
                random.shuffle(perguntas)
                snapshot = perguntas[:quantidade] if quantidade > 0 else perguntas

            cursor.execute(
                """
                INSERT INTO dbo.raciocinio_aplicacoes
                (id_teste, id_processo_ref, perguntas_snapshot_json, tempo_limite_minutos, status, iniciada_em, criada_em,
                 modo_adaptativo, nivel_vaga, estado_adaptativo_json)
                OUTPUT INSERTED.id_aplicacao
                VALUES (?, ?, ?, ?, 'Disponivel', GETDATE(), GETDATE(), ?, ?, ?)
                """,
                (
                    id_teste,
                    data.get("id_processo_ref"),
                    json.dumps(snapshot, ensure_ascii=False),
                    data.get("tempo_limite_minutos"),
                    1 if modo_adaptativo else 0,
                    nivel_vaga,
                    estado_adaptativo_json,
                ),
            )
            id_aplicacao = int(cursor.fetchone()[0])
            conn.commit()
        finally:
            conn.close()
        return self.get_raciocinio_aplicacao(id_aplicacao)

    def get_raciocinio_aplicacao(self, id_aplicacao: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_raciocinio_tables(cursor)
            cursor.execute(
                """
                SELECT id_aplicacao, id_teste, id_processo_ref, perguntas_snapshot_json, tempo_limite_minutos,
                       status, iniciada_em, finalizada_em, resultado_json, criada_em,
                       modo_adaptativo, nivel_vaga, estado_adaptativo_json
                FROM dbo.raciocinio_aplicacoes WHERE id_aplicacao = ?
                """,
                (int(id_aplicacao or 0),),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aplicação de raciocínio lógico não encontrada.")
            aplicacao = rows[0]
            perguntas = safe_json_loads(aplicacao.pop("perguntas_snapshot_json", None), [])
            estado_adaptativo = safe_json_loads(aplicacao.pop("estado_adaptativo_json", None), None)
            # Não expõe gabarito/feedback_erro ao candidato durante a aplicação.
            aplicacao["perguntas"] = [
                {
                    "id_pergunta": p.get("id_pergunta"),
                    "enunciado": p.get("enunciado"),
                    "tipo": p.get("tipo"),
                    "alternativas": p.get("alternativas"),
                    "dificuldade": p.get("dificuldade"),
                }
                for p in perguntas
            ]
            aplicacao["modo_adaptativo"] = bool(aplicacao.get("modo_adaptativo"))
            if aplicacao["modo_adaptativo"] and estado_adaptativo and aplicacao["status"] != "Finalizada":
                # Sinaliza ao candidato se ainda ha proximas questoes a buscar
                # via /aplicacoes/{id}/proxima-adaptativa (nao expõe o pool).
                quantidade_alvo = int(estado_adaptativo.get("quantidade_alvo") or 0)
                aplicacao["adaptativo_concluido"] = len(perguntas) >= quantidade_alvo if quantidade_alvo else False
            aplicacao["resultado"] = safe_json_loads(aplicacao.pop("resultado_json", None), None)
            return aplicacao
        finally:
            conn.close()

    def avancar_raciocinio_adaptativo(self, id_aplicacao: int, data: dict) -> dict:
        """Modo adaptativo: registra a resposta dada a ultima questao exibida
        (se houver) e escolhe a proxima questao com dificuldade adjacente
        (subiu se acertou, desceu se errou, mantem se nao houver questao
        disponivel no nivel adjacente), dentro do que ainda nao foi
        mostrado nesta aplicacao. Nao grava em raciocinio_respostas nem
        interfere na correcao final — a correcao continua acontecendo,
        igual ao modo fixo, em finalize_raciocinio_aplicacao a partir do
        payload de respostas enviado pelo candidato ao final do teste.
        """
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_raciocinio_tables(cursor)
            cursor.execute(
                """
                SELECT perguntas_snapshot_json, modo_adaptativo, estado_adaptativo_json, status
                FROM dbo.raciocinio_aplicacoes WHERE id_aplicacao = ?
                """,
                (int(id_aplicacao or 0),),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aplicação de raciocínio lógico não encontrada.")
            columns = [c[0] for c in cursor.description]
            registro = dict(zip(columns, row))

            if not registro.get("modo_adaptativo"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Esta aplicação não está no modo adaptativo.",
                )
            if registro.get("status") == "Finalizada":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta aplicação já foi finalizada.")

            snapshot = safe_json_loads(registro.get("perguntas_snapshot_json"), [])
            estado = safe_json_loads(registro.get("estado_adaptativo_json"), {}) or {}
            pool = estado.get("pool") or {d: [] for d in ORDEM_DIFICULDADE}
            for dificuldade in ORDEM_DIFICULDADE:
                pool.setdefault(dificuldade, [])
            dificuldade_atual = estado.get("dificuldade_atual") or "medio"
            quantidade_alvo = int(estado.get("quantidade_alvo") or 0)

            pergunta_id_respondida = data.get("pergunta_id")
            alternativa_marcada = data.get("alternativa_marcada")
            if pergunta_id_respondida is not None:
                pergunta_respondida = next(
                    (p for p in snapshot if int(p.get("id_pergunta") or 0) == int(pergunta_id_respondida)), None
                )
                if pergunta_respondida is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="A questão informada não pertence a esta aplicação.",
                    )
                gabarito = pergunta_respondida.get("gabarito")
                acertou = (
                    alternativa_marcada is not None and gabarito is not None and int(alternativa_marcada) == int(gabarito)
                )
                dificuldade_alvo = proxima_dificuldade_adaptativa(dificuldade_atual, acertou)
            else:
                # Primeira chamada (nenhuma questao respondida ainda): mantem
                # o nivel atual definido na criação da aplicação (medio).
                dificuldade_alvo = dificuldade_atual

            proxima_pergunta = None
            if quantidade_alvo <= 0 or len(snapshot) < quantidade_alvo:
                proxima_pergunta, dificuldade_efetiva = escolher_proxima_pergunta_adaptativa(pool, dificuldade_alvo)
                if proxima_pergunta is not None:
                    snapshot.append(proxima_pergunta)
                    dificuldade_atual = dificuldade_efetiva

            concluido = proxima_pergunta is None or (quantidade_alvo > 0 and len(snapshot) >= quantidade_alvo)

            cursor.execute(
                """
                UPDATE dbo.raciocinio_aplicacoes
                SET perguntas_snapshot_json = ?, estado_adaptativo_json = ?
                WHERE id_aplicacao = ?
                """,
                (
                    json.dumps(snapshot, ensure_ascii=False),
                    json.dumps(
                        {"pool": pool, "dificuldade_atual": dificuldade_atual, "quantidade_alvo": quantidade_alvo},
                        ensure_ascii=False,
                    ),
                    int(id_aplicacao),
                ),
            )
            conn.commit()
        finally:
            conn.close()

        pergunta_publica = None
        if proxima_pergunta is not None:
            pergunta_publica = {
                "id_pergunta": proxima_pergunta.get("id_pergunta"),
                "enunciado": proxima_pergunta.get("enunciado"),
                "tipo": proxima_pergunta.get("tipo"),
                "alternativas": proxima_pergunta.get("alternativas"),
                "dificuldade": proxima_pergunta.get("dificuldade"),
            }
        return {
            "proxima_pergunta": pergunta_publica,
            "concluido": concluido,
            "questoes_mostradas": len(snapshot),
            "quantidade_alvo": quantidade_alvo,
        }

    def finalize_raciocinio_aplicacao(self, id_aplicacao: int, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_raciocinio_tables(cursor)
            cursor.execute(
                "SELECT perguntas_snapshot_json FROM dbo.raciocinio_aplicacoes WHERE id_aplicacao = ?",
                (int(id_aplicacao or 0),),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aplicação de raciocínio lógico não encontrada.")
            perguntas = safe_json_loads(row[0], [])

            respostas_input = data.get("respostas") or []
            respostas_map = {
                int(r.get("pergunta_id")): (int(r["alternativa_marcada"]) if r.get("alternativa_marcada") is not None else None)
                for r in respostas_input
                if r.get("pergunta_id") is not None
            }

            resultado = corrigir_raciocinio(perguntas, respostas_map)

            for detalhe in resultado["detalhes"]:
                cursor.execute(
                    """
                    INSERT INTO dbo.raciocinio_respostas (aplicacao_id, pergunta_id, alternativa_marcada, correta, respondido_em)
                    VALUES (?, ?, ?, ?, GETDATE())
                    """,
                    (
                        int(id_aplicacao),
                        detalhe["id_pergunta"],
                        detalhe["alternativa_marcada"],
                        1 if detalhe["correta"] else 0,
                    ),
                )

            cursor.execute(
                """
                UPDATE dbo.raciocinio_aplicacoes
                SET status = 'Finalizada', finalizada_em = GETDATE(), resultado_json = ?
                WHERE id_aplicacao = ?
                """,
                (json.dumps(resultado, ensure_ascii=False), int(id_aplicacao)),
            )
            conn.commit()
        finally:
            conn.close()

        return {"success": True, "id_aplicacao": int(id_aplicacao), "status": "Finalizada", "resultado": resultado}

    def get_raciocinio_resultado_candidato(self, id_teste: str) -> dict:
        """Busca o resultado mais recente de raciocínio lógico finalizado para um
        candidato (id_teste), no mesmo padrão de conveniência já adotado pelo
        DISC e pelo Fit Cultural, usado pela ficha do candidato no frontend."""
        id_teste = normalize_text(id_teste)
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_raciocinio_tables(cursor)
            cursor.execute(
                """
                SELECT TOP 1 id_aplicacao, status, finalizada_em, resultado_json
                FROM dbo.raciocinio_aplicacoes
                WHERE id_teste = ? AND resultado_json IS NOT NULL
                ORDER BY finalizada_em DESC, id_aplicacao DESC
                """,
                (id_teste,),
            )
            row = cursor.fetchone()
            if not row:
                return {"possui_resultado": False}
            columns = [c[0] for c in cursor.description]
            data = dict(zip(columns, row))
            return {
                "possui_resultado": True,
                "id_aplicacao": data.get("id_aplicacao"),
                "finalizada_em": data.get("finalizada_em"),
                "resultado": safe_json_loads(data.get("resultado_json"), {}),
            }
        finally:
            conn.close()
