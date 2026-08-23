from __future__ import annotations

import base64
import secrets
import unicodedata
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from ..services.helpers import normalize_text, rows_to_dicts
from .bootstrap import ensure_documento_rh_table


TIPO_PASTA = "pasta"
TIPO_ARQUIVO = "arquivo"

# Categorias de extensão usadas no filtro "tipo de arquivo" da UI.
CATEGORIAS_POR_EXTENSAO: dict[str, str] = {
    ".pdf": "pdf",
    ".doc": "documento",
    ".docx": "documento",
    ".odt": "documento",
    ".rtf": "documento",
    ".txt": "texto",
    ".md": "texto",
    ".log": "texto",
    ".csv": "planilha",
    ".xls": "planilha",
    ".xlsx": "planilha",
    ".ods": "planilha",
    ".ppt": "apresentacao",
    ".pptx": "apresentacao",
    ".png": "imagem",
    ".jpg": "imagem",
    ".jpeg": "imagem",
    ".gif": "imagem",
    ".webp": "imagem",
    ".svg": "imagem",
    ".zip": "compactado",
    ".rar": "compactado",
    ".7z": "compactado",
}

MIME_POR_EXTENSAO: dict[str, str] = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".rtf": "application/rtf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".log": "text/plain",
    ".csv": "text/csv",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".zip": "application/zip",
    ".rar": "application/vnd.rar",
    ".7z": "application/x-7z-compressed",
}

# Extensões cujo conteúdo pode ser exibido como texto simples no modal de visualização.
EXTENSOES_VISUALIZAVEIS_TEXTO = {".txt", ".md", ".log", ".csv", ".json"}
EXTENSOES_VISUALIZAVEIS_PDF = {".pdf"}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_TEXTO_VISUALIZACAO_BYTES = 2 * 1024 * 1024


def _categoria_extensao(extensao: str) -> str:
    return CATEGORIAS_POR_EXTENSAO.get(extensao.lower(), "outro")


def _slugify(value: str, *, fallback: str = "arquivo", max_length: int = 60) -> str:
    normalized = unicodedata.normalize("NFD", normalize_text(value))
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    sanitized = []
    last_was_dash = False
    for char in without_marks.lower():
        if char.isalnum():
            sanitized.append(char)
            last_was_dash = False
            continue
        if sanitized and not last_was_dash:
            sanitized.append("-")
            last_was_dash = True
    slug = "".join(sanitized).strip("-")
    if not slug:
        slug = fallback
    if len(slug) > max_length:
        slug = slug[:max_length].rstrip("-")
    return slug or fallback


class DocumentosRhRepositoryMixin:
    def _get_documentos_rh_storage_root(self) -> Path:
        root = Path(self.settings.documentos_rh_dir).expanduser()
        root.mkdir(parents=True, exist_ok=True)
        return root.resolve()

    def _serialize_documento_rh(self, row: dict) -> dict:
        tipo = normalize_text(row.get("tipo")) or TIPO_ARQUIVO
        extensao = normalize_text(row.get("extensao"))
        return {
            "id": row.get("id_documento"),
            "nome": normalize_text(row.get("nome")),
            "tipo": tipo,
            "extensao": extensao,
            "categoria_extensao": _categoria_extensao(extensao) if tipo == TIPO_ARQUIVO else "",
            "mimetype": normalize_text(row.get("mimetype")),
            "tamanho_bytes": row.get("tamanho_bytes"),
            "id_pasta_pai": row.get("id_pasta_pai"),
            "criado_por": normalize_text(row.get("criado_por")),
            "criado_em": row.get("criado_em"),
            "atualizado_em": row.get("atualizado_em"),
            "pode_visualizar": tipo == TIPO_ARQUIVO
            and extensao.lower() in (EXTENSOES_VISUALIZAVEIS_TEXTO | EXTENSOES_VISUALIZAVEIS_PDF),
        }

    def list_documentos_rh(
        self,
        *,
        id_pasta_pai: int | None = None,
        tipo: str = "",
        categoria_extensao: str = "",
        busca: str = "",
        criado_por: str = "",
        data_criacao_de: str = "",
        data_criacao_ate: str = "",
        data_modificacao_de: str = "",
        data_modificacao_ate: str = "",
    ) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_documento_rh_table(cursor)

            clauses = []
            params: list = []

            if id_pasta_pai is None:
                clauses.append("id_pasta_pai IS NULL")
            else:
                clauses.append("id_pasta_pai = ?")
                params.append(id_pasta_pai)

            safe_tipo = normalize_text(tipo).lower()
            if safe_tipo in (TIPO_PASTA, TIPO_ARQUIVO):
                clauses.append("tipo = ?")
                params.append(safe_tipo)

            safe_busca = normalize_text(busca)
            if safe_busca:
                clauses.append("nome LIKE ?")
                params.append(f"%{safe_busca}%")

            safe_criado_por = normalize_text(criado_por)
            if safe_criado_por:
                clauses.append("criado_por LIKE ?")
                params.append(f"%{safe_criado_por}%")

            if normalize_text(data_criacao_de):
                clauses.append("criado_em >= ?")
                params.append(normalize_text(data_criacao_de))
            if normalize_text(data_criacao_ate):
                clauses.append("criado_em <= ?")
                params.append(f"{normalize_text(data_criacao_ate)} 23:59:59")
            if normalize_text(data_modificacao_de):
                clauses.append("atualizado_em >= ?")
                params.append(normalize_text(data_modificacao_de))
            if normalize_text(data_modificacao_ate):
                clauses.append("atualizado_em <= ?")
                params.append(f"{normalize_text(data_modificacao_ate)} 23:59:59")

            safe_categoria = normalize_text(categoria_extensao).lower()
            if safe_categoria:
                extensoes = [
                    extensao
                    for extensao, categoria in CATEGORIAS_POR_EXTENSAO.items()
                    if categoria == safe_categoria
                ]
                if extensoes:
                    placeholders = ", ".join("?" for _ in extensoes)
                    clauses.append(f"LOWER(ISNULL(extensao, '')) IN ({placeholders})")
                    params.extend(extensoes)
                else:
                    clauses.append("1 = 0")

            where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
            cursor.execute(
                f"""
                SELECT
                    id_documento,
                    nome,
                    tipo,
                    extensao,
                    mimetype,
                    tamanho_bytes,
                    caminho_arquivo,
                    nome_arquivo_armazenado,
                    id_pasta_pai,
                    criado_por,
                    criado_em,
                    atualizado_em
                FROM documentos_rh
                {where_sql}
                ORDER BY tipo DESC, nome ASC
                """,
                tuple(params),
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            return [self._serialize_documento_rh(row) for row in rows]
        finally:
            conn.close()

    def get_documento_rh_breadcrumb(self, id_pasta_pai: int | None) -> list[dict]:
        if id_pasta_pai is None:
            return []

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_documento_rh_table(cursor)
            trilha: list[dict] = []
            atual = id_pasta_pai
            visitados: set[int] = set()

            while atual is not None and atual not in visitados:
                visitados.add(atual)
                cursor.execute(
                    """
                    SELECT id_documento, nome, id_pasta_pai
                    FROM documentos_rh
                    WHERE id_documento = ? AND tipo = 'pasta'
                    """,
                    (atual,),
                )
                row = cursor.fetchone()
                if not row:
                    break
                trilha.append({"id": row[0], "nome": normalize_text(row[1])})
                atual = row[2]

            trilha.reverse()
            return trilha
        finally:
            conn.close()

    def _validar_pasta_pai_rh(self, cursor, id_pasta_pai: int | None) -> None:
        if id_pasta_pai is None:
            return
        cursor.execute(
            "SELECT tipo FROM documentos_rh WHERE id_documento = ?",
            (id_pasta_pai,),
        )
        row = cursor.fetchone()
        if not row or normalize_text(row[0]) != TIPO_PASTA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pasta de destino inválida.",
            )

    def criar_pasta_documento_rh(
        self,
        *,
        nome: str,
        id_pasta_pai: int | None,
        criado_por: str,
    ) -> dict:
        safe_nome = normalize_text(nome)
        if not safe_nome:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe um nome para a pasta.",
            )

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_documento_rh_table(cursor)
            self._validar_pasta_pai_rh(cursor, id_pasta_pai)

            cursor.execute(
                """
                INSERT INTO documentos_rh
                (nome, tipo, id_pasta_pai, criado_por, criado_em, atualizado_em)
                OUTPUT INSERTED.id_documento
                VALUES (?, 'pasta', ?, ?, GETDATE(), GETDATE())
                """,
                (safe_nome, id_pasta_pai, normalize_text(criado_por)),
            )
            novo_id = cursor.fetchone()[0]
            conn.commit()
            return {"success": True, "id": novo_id}
        finally:
            conn.close()

    async def upload_arquivo_documento_rh(
        self,
        *,
        arquivo: UploadFile,
        id_pasta_pai: int | None,
        criado_por: str,
    ) -> dict:
        conteudo = await arquivo.read()
        if not conteudo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo enviado está vazio.",
            )
        if len(conteudo) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo excede o limite de 25 MB permitido.",
            )

        nome_original = normalize_text(arquivo.filename) or "arquivo"
        extensao = Path(nome_original).suffix.lower()
        mimetype = (
            normalize_text(arquivo.content_type)
            or MIME_POR_EXTENSAO.get(extensao, "application/octet-stream")
        )
        nome_armazenado = f"{_slugify(Path(nome_original).stem)}-{secrets.token_hex(10)}{extensao}"

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_documento_rh_table(cursor)
            self._validar_pasta_pai_rh(cursor, id_pasta_pai)

            storage_root = self._get_documentos_rh_storage_root()
            stored_path = storage_root / nome_armazenado
            stored_path.write_bytes(conteudo)

            cursor.execute(
                """
                INSERT INTO documentos_rh
                (
                    nome,
                    tipo,
                    extensao,
                    mimetype,
                    tamanho_bytes,
                    caminho_arquivo,
                    nome_arquivo_armazenado,
                    id_pasta_pai,
                    criado_por,
                    criado_em,
                    atualizado_em
                )
                OUTPUT INSERTED.id_documento
                VALUES (?, 'arquivo', ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
                """,
                (
                    nome_original,
                    extensao,
                    mimetype,
                    len(conteudo),
                    str(stored_path),
                    nome_armazenado,
                    id_pasta_pai,
                    normalize_text(criado_por),
                ),
            )
            novo_id = cursor.fetchone()[0]
            conn.commit()
            return {
                "success": True,
                "id": novo_id,
                "nome": nome_original,
                "tamanho_bytes": len(conteudo),
            }
        finally:
            conn.close()

    def renomear_documento_rh(self, id_documento: int, novo_nome: str) -> dict:
        safe_nome = normalize_text(novo_nome)
        if not safe_nome:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe um novo nome.",
            )

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_documento_rh_table(cursor)
            cursor.execute(
                "SELECT id_documento FROM documentos_rh WHERE id_documento = ?",
                (id_documento,),
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item não encontrado.",
                )

            cursor.execute(
                """
                UPDATE documentos_rh
                SET nome = ?, atualizado_em = GETDATE()
                WHERE id_documento = ?
                """,
                (safe_nome, id_documento),
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def _coletar_ids_para_exclusao(self, cursor, id_documento: int) -> list[tuple[int, str, str]]:
        """Retorna (id, tipo, caminho_arquivo) de um item e de toda sua descendência."""
        pendentes = [id_documento]
        coletados: list[tuple[int, str, str]] = []
        visitados: set[int] = set()

        while pendentes:
            atual = pendentes.pop()
            if atual in visitados:
                continue
            visitados.add(atual)

            cursor.execute(
                "SELECT id_documento, tipo, caminho_arquivo FROM documentos_rh WHERE id_documento = ?",
                (atual,),
            )
            row = cursor.fetchone()
            if not row:
                continue
            coletados.append((row[0], normalize_text(row[1]), normalize_text(row[2])))

            if normalize_text(row[1]) == TIPO_PASTA:
                cursor.execute(
                    "SELECT id_documento FROM documentos_rh WHERE id_pasta_pai = ?",
                    (atual,),
                )
                pendentes.extend(int(filho[0]) for filho in cursor.fetchall())

        return coletados

    def excluir_documento_rh(self, id_documento: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_documento_rh_table(cursor)
            cursor.execute(
                "SELECT id_documento FROM documentos_rh WHERE id_documento = ?",
                (id_documento,),
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item não encontrado.",
                )

            itens = self._coletar_ids_para_exclusao(cursor, id_documento)
            storage_root = self._get_documentos_rh_storage_root()

            for item_id, item_tipo, caminho_arquivo in itens:
                if item_tipo == TIPO_ARQUIVO and caminho_arquivo:
                    try:
                        alvo = Path(caminho_arquivo).resolve()
                        if storage_root in alvo.parents and alvo.exists():
                            alvo.unlink()
                    except Exception:
                        pass

            ids = [item_id for item_id, _, _ in itens]
            if ids:
                placeholders = ", ".join("?" for _ in ids)
                cursor.execute(
                    f"DELETE FROM documentos_rh WHERE id_documento IN ({placeholders})",
                    tuple(ids),
                )
            conn.commit()
            return {"success": True, "itens_removidos": len(ids)}
        finally:
            conn.close()

    def obter_conteudo_documento_rh(self, id_documento: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_documento_rh_table(cursor)
            cursor.execute(
                """
                SELECT nome, tipo, extensao, mimetype, caminho_arquivo, tamanho_bytes
                FROM documentos_rh
                WHERE id_documento = ?
                """,
                (id_documento,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Arquivo não encontrado.",
                )

            nome, tipo, extensao, mimetype, caminho_arquivo, tamanho_bytes = row
            if normalize_text(tipo) != TIPO_ARQUIVO:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Apenas arquivos podem ser visualizados.",
                )

            caminho = Path(normalize_text(caminho_arquivo))
            if not caminho.is_file():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="O arquivo não foi encontrado no armazenamento.",
                )

            extensao_lower = normalize_text(extensao).lower()
            resultado = {
                "nome": normalize_text(nome),
                "extensao": extensao_lower,
                "mimetype": normalize_text(mimetype) or "application/octet-stream",
                "tamanho_bytes": tamanho_bytes,
            }

            if extensao_lower in EXTENSOES_VISUALIZAVEIS_TEXTO:
                if (tamanho_bytes or 0) > MAX_TEXTO_VISUALIZACAO_BYTES:
                    resultado["modo_visualizacao"] = "indisponivel"
                    resultado["mensagem"] = "Arquivo muito grande para visualização em texto."
                    return resultado
                bruto = caminho.read_bytes()
                resultado["modo_visualizacao"] = "texto"
                resultado["conteudo"] = bruto.decode("utf-8", errors="replace")
                return resultado

            if extensao_lower in EXTENSOES_VISUALIZAVEIS_PDF:
                bruto = caminho.read_bytes()
                resultado["modo_visualizacao"] = "pdf"
                resultado["conteudo_base64"] = base64.b64encode(bruto).decode("ascii")
                return resultado

            resultado["modo_visualizacao"] = "indisponivel"
            resultado["mensagem"] = "Visualização não suportada para este tipo de arquivo. Faça o download."
            return resultado
        finally:
            conn.close()

    def baixar_documento_rh(self, id_documento: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_documento_rh_table(cursor)
            cursor.execute(
                """
                SELECT nome, tipo, mimetype, caminho_arquivo
                FROM documentos_rh
                WHERE id_documento = ?
                """,
                (id_documento,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Arquivo não encontrado.",
                )

            nome, tipo, mimetype, caminho_arquivo = row
            if normalize_text(tipo) != TIPO_ARQUIVO:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Apenas arquivos podem ser baixados.",
                )

            caminho = Path(normalize_text(caminho_arquivo))
            if not caminho.is_file():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="O arquivo não foi encontrado no armazenamento.",
                )

            return {
                "path": caminho,
                "filename": normalize_text(nome),
                "media_type": normalize_text(mimetype) or "application/octet-stream",
            }
        finally:
            conn.close()
