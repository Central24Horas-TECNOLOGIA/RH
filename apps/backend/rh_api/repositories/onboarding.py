from __future__ import annotations

from fastapi import HTTPException, status

from ..services.helpers import normalize_text, rows_to_dicts
from .bootstrap import ensure_onboarding_tables, ensure_process_trainings_table


_TRILHA_COLUMNS = """
    id_trilha,
    nome,
    descricao,
    ativo,
    categoria,
    id_operacao,
    modalidade,
    local_padrao,
    conteudo_json,
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
    tipo_conteudo,
    conteudo_url,
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

_ONBOARDING_COLUMNS = """
    id_onboarding,
    id_registro,
    trilha_id,
    iniciado_por,
    iniciado_em,
    data_prevista,
    local,
    ministrante,
    status,
    acesso_plataforma,
    metodo_login,
    presenca
"""

_PROCESS_TRAINING_COLUMNS = """
    pt.id_processo_treinamento,
    pt.id_processo,
    pt.trilha_id,
    pt.vagas_totais,
    pt.vagas_liberadas,
    pt.criado_em,
    pt.atualizado_em
"""

CATEGORIAS_TREINAMENTO = ("LGPD", "Segurança da Informação", "Tecnologia", "Operações", "Onboarding", "Produto", "Outro")
MODALIDADES_TREINAMENTO = ("presencial", "virtual", "hibrido")
STATUS_ATRIBUICAO_TREINAMENTO = ("em_andamento", "concluido", "cancelado", "aplicado")
METODOS_LOGIN_TREINAMENTO = ("microsoft", "telefone", "email", "nome")


class OnboardingRepositoryMixin:
    """Trilhas de onboarding (checklist configurável) e progresso por candidato."""

    # ------------------------------------------------------------------
    # Trilhas (administração)
    # ------------------------------------------------------------------
    def list_onboarding_trilhas(self, *, categoria: str | None = None, id_operacao: int | None = None) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)
            condicoes = []
            parametros: list = []
            categoria_normalizada = normalize_text(categoria)
            if categoria_normalizada:
                condicoes.append("categoria = ?")
                parametros.append(categoria_normalizada)
            if id_operacao:
                condicoes.append("id_operacao = ?")
                parametros.append(int(id_operacao))
            filtro = f"WHERE {' AND '.join(condicoes)}" if condicoes else ""
            cursor.execute(
                f"""
                SELECT {_TRILHA_COLUMNS}
                FROM trilhas_onboarding
                {filtro}
                ORDER BY ativo DESC, criado_em DESC, id_trilha DESC
                """,
                tuple(parametros),
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
    def _validate_trilha_input(data: dict) -> tuple[str, str, bool, str, "int | None", str, str, str, list[dict]]:
        nome = normalize_text(data.get("nome"))
        if not nome:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o nome da trilha.")
        descricao = normalize_text(data.get("descricao"))
        ativo = bool(data.get("ativo", True))
        categoria = normalize_text(data.get("categoria")) or "Onboarding"
        id_operacao_raw = data.get("id_operacao")
        id_operacao = int(id_operacao_raw) if id_operacao_raw else None
        modalidade = normalize_text(data.get("modalidade"))
        local_padrao = normalize_text(data.get("local_padrao"))
        conteudo_json = normalize_text(data.get("conteudo_json"))
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
                    "tipo_conteudo": normalize_text(item.get("tipo_conteudo")),
                    "conteudo_url": normalize_text(item.get("conteudo_url")),
                }
            )
        return nome, descricao, ativo, categoria, id_operacao, modalidade, local_padrao, conteudo_json, itens

    def create_onboarding_trilha(self, data: dict, *, actor: str = "") -> dict:
        nome, descricao, ativo, categoria, id_operacao, modalidade, local_padrao, conteudo_json, itens = self._validate_trilha_input(data)

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            cursor.execute(
                """
                INSERT INTO trilhas_onboarding
                (nome, descricao, ativo, categoria, id_operacao, modalidade, local_padrao, conteudo_json, criado_por, criado_em, atualizado_em)
                OUTPUT INSERTED.id_trilha
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
                """,
                (nome, descricao, 1 if ativo else 0, categoria, id_operacao, modalidade, local_padrao, conteudo_json, normalize_text(actor)),
            )
            inserted = cursor.fetchone()
            id_trilha = int(inserted[0] or 0)

            for item in itens:
                cursor.execute(
                    """
                    INSERT INTO trilhas_onboarding_itens
                    (trilha_id, titulo, descricao, ordem, obrigatorio, tipo_conteudo, conteudo_url, criado_em)
                    VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE())
                    """,
                    (
                        id_trilha,
                        item["titulo"],
                        item["descricao"],
                        item["ordem"],
                        1 if item["obrigatorio"] else 0,
                        item["tipo_conteudo"],
                        item["conteudo_url"],
                    ),
                )
            conn.commit()
        finally:
            conn.close()

        return self.get_onboarding_trilha(id_trilha)

    def update_onboarding_trilha(self, id_trilha: int, data: dict, *, actor: str = "") -> dict:
        nome, descricao, ativo, categoria, id_operacao, modalidade, local_padrao, conteudo_json, itens = self._validate_trilha_input(data)

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
                SET nome = ?, descricao = ?, ativo = ?, categoria = ?, id_operacao = ?,
                    modalidade = ?, local_padrao = ?, conteudo_json = ?, atualizado_em = GETDATE()
                WHERE id_trilha = ?
                """,
                (nome, descricao, 1 if ativo else 0, categoria, id_operacao, modalidade, local_padrao, conteudo_json, int(id_trilha or 0)),
            )

            # Itens da trilha (modelo genérico/editável): substitui o conjunto de
            # itens pelo enviado. Onboardings já iniciados usam um snapshot
            # próprio (onboarding_candidatos_itens) e não são afetados por isso.
            cursor.execute("DELETE FROM trilhas_onboarding_itens WHERE trilha_id = ?", (int(id_trilha or 0),))
            for item in itens:
                cursor.execute(
                    """
                    INSERT INTO trilhas_onboarding_itens
                    (trilha_id, titulo, descricao, ordem, obrigatorio, tipo_conteudo, conteudo_url, criado_em)
                    VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE())
                    """,
                    (
                        int(id_trilha or 0),
                        item["titulo"],
                        item["descricao"],
                        item["ordem"],
                        1 if item["obrigatorio"] else 0,
                        item["tipo_conteudo"],
                        item["conteudo_url"],
                    ),
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

    def start_onboarding(
        self,
        id_registro: int,
        trilha_id: int,
        *,
        actor: str = "",
        data_prevista=None,
        local: str = "",
        ministrante: str = "",
    ) -> dict:
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
                (id_registro, trilha_id, iniciado_por, iniciado_em, data_prevista, local, ministrante, status)
                OUTPUT INSERTED.id_onboarding
                VALUES (?, ?, ?, GETDATE(), ?, ?, ?, 'em_andamento')
                """,
                (
                    int(candidato["id_registro"]),
                    int(trilha_id or 0),
                    normalize_text(actor),
                    data_prevista,
                    normalize_text(local),
                    normalize_text(ministrante),
                ),
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
                f"""
                SELECT TOP 1 {_ONBOARDING_COLUMNS}
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

    # ------------------------------------------------------------------
    # Visão de gestão (RH): quem está em treinamento, de qual trilha,
    # quando e onde — ver respostas.txt, item "Centro de Treinamentos".
    # ------------------------------------------------------------------
    def list_onboarding_assignments(self, *, status_filtro: str | None = None) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            condicoes = []
            parametros: list = []
            status_normalizado = normalize_text(status_filtro)
            if status_normalizado:
                condicoes.append("oc.status = ?")
                parametros.append(status_normalizado)
            filtro = f"WHERE {' AND '.join(condicoes)}" if condicoes else ""

            cursor.execute(
                f"""
                SELECT
                    oc.id_onboarding,
                    oc.id_registro,
                    oc.trilha_id,
                    oc.iniciado_por,
                    oc.iniciado_em,
                    oc.data_prevista,
                    oc.local,
                    oc.ministrante,
                    oc.status,
                    cp.nome_candidato,
                    cp.vaga,
                    t.nome AS trilha_nome,
                    t.categoria AS trilha_categoria,
                    t.modalidade AS trilha_modalidade
                FROM onboarding_candidatos oc
                JOIN candidatos_processos cp ON cp.id_registro = oc.id_registro
                JOIN trilhas_onboarding t ON t.id_trilha = oc.trilha_id
                {filtro}
                ORDER BY oc.iniciado_em DESC, oc.id_onboarding DESC
                """,
                tuple(parametros),
            )
            atribuicoes = rows_to_dicts(cursor, cursor.fetchall())

            for atribuicao in atribuicoes:
                cursor.execute(
                    """
                    SELECT COUNT(*) AS total, SUM(CASE WHEN concluido = 1 THEN 1 ELSE 0 END) AS concluidos
                    FROM onboarding_candidatos_itens
                    WHERE onboarding_candidato_id = ?
                    """,
                    (int(atribuicao["id_onboarding"]),),
                )
                contagem = rows_to_dicts(cursor, cursor.fetchall())[0]
                total = int(contagem.get("total") or 0)
                concluidos = int(contagem.get("concluidos") or 0)
                atribuicao["total_itens"] = total
                atribuicao["itens_concluidos"] = concluidos
                atribuicao["percentual_concluido"] = round((concluidos / total) * 100) if total else 0

            return atribuicoes
        finally:
            conn.close()

    def update_onboarding_assignment(self, id_onboarding: int, data: dict, *, actor: str = "") -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            cursor.execute(
                "SELECT id_registro FROM onboarding_candidatos WHERE id_onboarding = ?",
                (int(id_onboarding or 0),),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treinamento do colaborador não encontrado.")
            id_registro = int(row[0])

            status_valor = normalize_text(data.get("status")) or "em_andamento"
            if status_valor not in STATUS_ATRIBUICAO_TREINAMENTO:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status de treinamento inválido.")

            metodo_login = normalize_text(data.get("metodo_login"))
            if metodo_login and metodo_login not in METODOS_LOGIN_TREINAMENTO:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Método de login inválido.")

            cursor.execute(
                """
                UPDATE onboarding_candidatos
                SET data_prevista = ?, local = ?, ministrante = ?, status = ?,
                    acesso_plataforma = ?, metodo_login = ?
                WHERE id_onboarding = ?
                """,
                (
                    data.get("data_prevista"),
                    normalize_text(data.get("local")),
                    normalize_text(data.get("ministrante")),
                    status_valor,
                    1 if data.get("acesso_plataforma") else 0,
                    metodo_login or None,
                    int(id_onboarding or 0),
                ),
            )
            conn.commit()
        finally:
            conn.close()

        return self.get_onboarding_progress(id_registro)

    def delete_onboarding_assignment(self, id_onboarding: int, *, actor: str = "") -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            cursor.execute(
                "SELECT id_onboarding FROM onboarding_candidatos WHERE id_onboarding = ?",
                (int(id_onboarding or 0),),
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treinamento do colaborador não encontrado.")

            cursor.execute(
                "DELETE FROM onboarding_candidatos_itens WHERE onboarding_candidato_id = ?",
                (int(id_onboarding or 0),),
            )
            cursor.execute(
                "DELETE FROM onboarding_candidatos WHERE id_onboarding = ?",
                (int(id_onboarding or 0),),
            )
            conn.commit()
        finally:
            conn.close()

        return {"success": True}

    def save_onboarding_attendance(self, presencas: list[dict], *, actor: str = "") -> dict:
        """Salva a lista de presença de um ou mais treinamentos agendados.

        Ao salvar, cada linha ganha a tag APLICADO (status='aplicado') — ver
        Correcoes.txt, item Central de Treinamentos."""
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_onboarding_tables(cursor)

            atualizados: list[int] = []
            for item in presencas or []:
                id_onboarding = int(item.get("id_onboarding") or 0)
                if not id_onboarding:
                    continue
                presente = bool(item.get("presente"))
                cursor.execute(
                    """
                    UPDATE onboarding_candidatos
                    SET presenca = ?, status = 'aplicado'
                    WHERE id_onboarding = ?
                    """,
                    ("presente" if presente else "falta", id_onboarding),
                )
                atualizados.append(id_onboarding)
            conn.commit()
        finally:
            conn.close()

        return {"success": True, "atualizados": atualizados}

    # ------------------------------------------------------------------
    # Treinamentos vinculados a um processo seletivo (Correcoes.txt, rodada
    # 03/set/2026) — bloqueio/liberação de vagas por processo.
    # ------------------------------------------------------------------
    def sync_process_trainings(self, id_processo: str, *, vagas_totais: int, trilha_ids: list[int]) -> None:
        """Chamado ao criar o processo: uma linha por trilha selecionada, com
        todas as vagas do processo inicialmente bloqueadas (AGUARDANDO
        PROCESSO). Idempotente — não duplica se já existir para o par
        (processo, trilha)."""
        safe_process_id = normalize_text(id_processo)
        if not safe_process_id or not trilha_ids:
            return

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_trainings_table(cursor)
            for trilha_id_raw in trilha_ids:
                try:
                    trilha_id = int(trilha_id_raw)
                except (TypeError, ValueError):
                    continue
                cursor.execute(
                    "SELECT 1 FROM processos_treinamentos WHERE id_processo = ? AND trilha_id = ?",
                    (safe_process_id, trilha_id),
                )
                if cursor.fetchone():
                    continue
                cursor.execute(
                    """
                    INSERT INTO processos_treinamentos (id_processo, trilha_id, vagas_totais, vagas_liberadas, criado_em, atualizado_em)
                    VALUES (?, ?, ?, 0, GETDATE(), GETDATE())
                    """,
                    (safe_process_id, trilha_id, int(vagas_totais or 0)),
                )
            conn.commit()
        finally:
            conn.close()

    def list_process_trainings(self, *, id_processo: str | None = None) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_trainings_table(cursor)
            ensure_onboarding_tables(cursor)

            filtro = ""
            parametros: list = []
            if id_processo:
                filtro = "WHERE pt.id_processo = ?"
                parametros.append(normalize_text(id_processo))

            cursor.execute(
                f"""
                SELECT
                    {_PROCESS_TRAINING_COLUMNS},
                    t.nome AS trilha_nome,
                    t.categoria AS trilha_categoria,
                    ps.vaga,
                    ps.status AS processo_status
                FROM processos_treinamentos pt
                JOIN trilhas_onboarding t ON t.id_trilha = pt.trilha_id
                JOIN processos_seletivos ps ON ps.id_processo = pt.id_processo
                {filtro}
                ORDER BY pt.criado_em DESC, pt.id_processo_treinamento DESC
                """,
                tuple(parametros),
            )
            linhas = rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

        for linha in linhas:
            vagas_totais = int(linha.get("vagas_totais") or 0)
            vagas_liberadas = int(linha.get("vagas_liberadas") or 0)
            linha["vagas_bloqueadas"] = max(vagas_totais - vagas_liberadas, 0)
        return linhas

    def list_process_training_release_candidates(self, id_processo_treinamento: int) -> list[dict]:
        """Candidatos aprovados do processo que ainda não entraram nesta
        trilha — para o Gestor escolher quem liberar."""
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_trainings_table(cursor)
            ensure_onboarding_tables(cursor)

            cursor.execute(
                "SELECT id_processo, trilha_id FROM processos_treinamentos WHERE id_processo_treinamento = ?",
                (int(id_processo_treinamento or 0),),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treinamento do processo não encontrado.")
            id_processo, trilha_id = normalize_text(row[0]), int(row[1])

            cursor.execute(
                """
                SELECT cp.id_registro, cp.nome_candidato
                FROM candidatos_processos cp
                WHERE cp.id_processo = ? AND cp.status_candidato = 'Aprovado'
                  AND NOT EXISTS (
                      SELECT 1 FROM onboarding_candidatos oc
                      WHERE oc.id_registro = cp.id_registro AND oc.trilha_id = ?
                  )
                ORDER BY cp.nome_candidato ASC
                """,
                (id_processo, trilha_id),
            )
            return rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

    def release_process_training_slots(
        self,
        id_processo_treinamento: int,
        *,
        candidatos: list[int],
        actor: str = "",
    ) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_trainings_table(cursor)
            ensure_onboarding_tables(cursor)

            cursor.execute(
                "SELECT id_processo, trilha_id, vagas_totais, vagas_liberadas FROM processos_treinamentos WHERE id_processo_treinamento = ?",
                (int(id_processo_treinamento or 0),),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treinamento do processo não encontrado.")
            id_processo, trilha_id, vagas_totais, vagas_liberadas = (
                normalize_text(row[0]),
                int(row[1]),
                int(row[2] or 0),
                int(row[3] or 0),
            )

            candidatos_validos = [int(item) for item in (candidatos or []) if item]
            vagas_disponiveis = vagas_totais - vagas_liberadas
            if len(candidatos_validos) > vagas_disponiveis:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Só é possível liberar até {vagas_disponiveis} vaga(s) neste treinamento.",
                )

            for id_registro in candidatos_validos:
                self.start_onboarding(id_registro, trilha_id, actor=actor)

            if candidatos_validos:
                cursor.execute(
                    """
                    UPDATE processos_treinamentos
                    SET vagas_liberadas = vagas_liberadas + ?, atualizado_em = GETDATE()
                    WHERE id_processo_treinamento = ?
                    """,
                    (len(candidatos_validos), int(id_processo_treinamento or 0)),
                )
            conn.commit()
        finally:
            conn.close()

        return {"success": True, "liberados": len(candidatos_validos)}
