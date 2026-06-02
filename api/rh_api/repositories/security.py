from __future__ import annotations

import csv
import io
import json
from datetime import datetime

from fastapi import HTTPException, status

from ..auth import AuthenticatedUser
from ..passwords import hash_password, verify_password
from ..rbac import (
    PERMISSION_DEFINITIONS,
    ROLE_DEFINITIONS,
    ROLE_INTERN,
    SETTINGS_CATALOGS,
    get_role_definition,
    get_role_permissions,
    normalize_role_id,
    sanitize_permissions,
)
from ..services.helpers import normalize_text, rows_to_dicts, safe_json_loads


def _json_dump(value) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except TypeError:
        return str(value)


def _actor_payload(user: AuthenticatedUser | dict | None) -> dict:
    if isinstance(user, AuthenticatedUser):
        return {
            "id_usuario": user.id_usuario,
            "nome": user.nome or user.username,
            "email": user.email or user.username,
            "perfil_id": user.perfil,
            "perfil_nome": user.perfil_nome,
        }
    if isinstance(user, dict):
        role = get_role_definition(user.get("perfil") or user.get("perfil_id"))
        return {
            "id_usuario": user.get("id_usuario"),
            "nome": normalize_text(user.get("nome") or user.get("login") or user.get("email")),
            "email": normalize_text(user.get("email") or user.get("login")),
            "perfil_id": role.id,
            "perfil_nome": normalize_text(user.get("perfil_nome")) or role.name,
        }
    return {
        "id_usuario": None,
        "nome": "",
        "email": "",
        "perfil_id": "",
        "perfil_nome": "",
    }


class SecurityRepositoryMixin:
    def _insert_audit_log(
        self,
        cursor,
        *,
        user: AuthenticatedUser | dict | None = None,
        modulo: str = "",
        acao: str = "",
        entidade: str = "",
        entidade_id: str = "",
        valor_anterior=None,
        valor_novo=None,
        justificativa: str = "",
        origem: str = "",
        sucesso: bool = True,
    ) -> None:
        actor = _actor_payload(user)
        cursor.execute(
            """
            INSERT INTO logs_auditoria
            (
                id_usuario,
                nome_usuario,
                email_usuario,
                perfil_id,
                perfil_nome,
                data_hora,
                modulo,
                acao,
                entidade,
                entidade_id,
                valor_anterior,
                valor_novo,
                justificativa,
                origem,
                sucesso,
                criado_em
            )
            VALUES (?, ?, ?, ?, ?, GETDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
            """,
            (
                actor.get("id_usuario"),
                actor.get("nome"),
                actor.get("email"),
                actor.get("perfil_id"),
                actor.get("perfil_nome"),
                normalize_text(modulo),
                normalize_text(acao),
                normalize_text(entidade),
                normalize_text(entidade_id),
                _json_dump(valor_anterior),
                _json_dump(valor_novo),
                normalize_text(justificativa),
                normalize_text(origem),
                1 if sucesso else 0,
            ),
        )

    def record_audit_log(
        self,
        *,
        user: AuthenticatedUser | dict | None = None,
        modulo: str = "",
        acao: str = "",
        entidade: str = "",
        entidade_id: str = "",
        valor_anterior=None,
        valor_novo=None,
        justificativa: str = "",
        origem: str = "",
        sucesso: bool = True,
    ) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            self._insert_audit_log(
                cursor,
                user=user,
                modulo=modulo,
                acao=acao,
                entidade=entidade,
                entidade_id=entidade_id,
                valor_anterior=valor_anterior,
                valor_novo=valor_novo,
                justificativa=justificativa,
                origem=origem,
                sucesso=sucesso,
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def _get_role_permissions_from_db(self, cursor, role_id: str) -> list[str]:
        safe_role = normalize_role_id(role_id)
        cursor.execute(
            """
            SELECT chave_permissao, permitido
            FROM perfil_permissoes
            WHERE id_perfil = ?
            """,
            (safe_role,),
        )
        rows = cursor.fetchall()
        if not rows:
            return sorted(get_role_permissions(safe_role))
        permissions = [
            normalize_text(row[0])
            for row in rows
            if normalize_text(row[0]) and bool(row[1])
        ]
        return permissions

    def _serialize_system_user(self, row: dict, permissions: list[str] | None = None) -> dict:
        role = get_role_definition(row.get("perfil_id"))
        status_value = normalize_text(row.get("status")) or "Ativo"
        return {
            "id_usuario": row.get("id_usuario"),
            "login": normalize_text(row.get("login")),
            "nome": normalize_text(row.get("nome")),
            "email": normalize_text(row.get("email")),
            "perfil": role.id,
            "perfil_nome": normalize_text(row.get("perfil_nome")) or role.name,
            "nivel": normalize_text(row.get("nivel")) or role.level,
            "status": status_value,
            "criado_em": row.get("criado_em"),
            "ultimo_acesso": row.get("ultimo_acesso_em"),
            "criado_por": normalize_text(row.get("criado_por")),
            "atualizado_por": normalize_text(row.get("atualizado_por")),
            "atualizado_em": row.get("atualizado_em"),
            "permissoes": permissions or [],
        }

    def authenticate_system_user(self, usuario: str, senha: str, *, origem: str = "") -> dict:
        safe_login = normalize_text(usuario)
        if not safe_login:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario ou senha invalidos.")

        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT TOP 1
                    usuarios.id_usuario,
                    usuarios.login,
                    usuarios.nome,
                    usuarios.email,
                    usuarios.perfil_id,
                    perfis.nome AS perfil_nome,
                    perfis.nivel,
                    usuarios.status,
                    usuarios.senha_hash,
                    usuarios.criado_em,
                    usuarios.ultimo_acesso_em,
                    usuarios.criado_por,
                    usuarios.atualizado_por,
                    usuarios.atualizado_em
                FROM usuarios
                LEFT JOIN perfis ON perfis.id_perfil = usuarios.perfil_id
                WHERE LOWER(usuarios.login) = LOWER(?) OR LOWER(usuarios.email) = LOWER(?)
                ORDER BY usuarios.id_usuario
                """,
                (safe_login, safe_login),
            )
            row = cursor.fetchone()
            if not row:
                self._insert_audit_log(
                    cursor,
                    user={"email": safe_login, "nome": safe_login},
                    modulo="Autenticacao",
                    acao="login_negado",
                    entidade="usuario",
                    entidade_id=safe_login,
                    justificativa="Usuario nao encontrado.",
                    origem=origem,
                    sucesso=False,
                )
                conn.commit()
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario ou senha invalidos.")

            user_row = rows_to_dicts(cursor, [row])[0]
            user_context = self._serialize_system_user(user_row)
            if normalize_text(user_row.get("status")).lower() != "ativo":
                self._insert_audit_log(
                    cursor,
                    user=user_context,
                    modulo="Autenticacao",
                    acao="login_negado",
                    entidade="usuario",
                    entidade_id=str(user_row.get("id_usuario") or ""),
                    justificativa=f"Usuario com status {user_row.get('status') or 'indefinido'}.",
                    origem=origem,
                    sucesso=False,
                )
                conn.commit()
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inativo ou bloqueado.")

            if not verify_password(senha, user_row.get("senha_hash")):
                self._insert_audit_log(
                    cursor,
                    user=user_context,
                    modulo="Autenticacao",
                    acao="login_negado",
                    entidade="usuario",
                    entidade_id=str(user_row.get("id_usuario") or ""),
                    justificativa="Senha invalida.",
                    origem=origem,
                    sucesso=False,
                )
                conn.commit()
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario ou senha invalidos.")

            permissions = self._get_role_permissions_from_db(cursor, user_row.get("perfil_id"))
            cursor.execute(
                """
                UPDATE usuarios
                SET ultimo_acesso_em = GETDATE(), atualizado_em = GETDATE()
                WHERE id_usuario = ?
                """,
                (user_row.get("id_usuario"),),
            )
            result = self._serialize_system_user(user_row, permissions)
            self._insert_audit_log(
                cursor,
                user=result,
                modulo="Autenticacao",
                acao="login",
                entidade="usuario",
                entidade_id=str(user_row.get("id_usuario") or ""),
                origem=origem,
                sucesso=True,
            )
            conn.commit()
            return result
        finally:
            conn.close()

    def list_roles(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            return [
                {
                    "id": role.id,
                    "nome": role.name,
                    "nivel": role.level,
                    "descricao": role.description,
                    "permissoes": self._get_role_permissions_from_db(cursor, role.id),
                }
                for role in ROLE_DEFINITIONS.values()
            ]
        finally:
            conn.close()

    def list_permissions(self) -> list[dict]:
        return [
            {
                "chave": item.key,
                "modulo": item.module,
                "descricao": item.description,
                "critica": item.critical,
            }
            for item in PERMISSION_DEFINITIONS.values()
        ]

    def update_role_permissions(
        self,
        role_id: str,
        data: dict,
        *,
        actor: AuthenticatedUser | dict | None = None,
    ) -> dict:
        safe_role = normalize_role_id(role_id)
        if safe_role not in ROLE_DEFINITIONS:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil nao encontrado.")

        requested_permissions = sanitize_permissions(data.get("permissoes") or data.get("permissions"))
        conn = self._connect()
        try:
            cursor = conn.cursor()
            previous = self._get_role_permissions_from_db(cursor, safe_role)
            for permission_key in PERMISSION_DEFINITIONS:
                allowed = 1 if permission_key in requested_permissions else 0
                cursor.execute(
                    """
                    IF NOT EXISTS (
                        SELECT 1
                        FROM perfil_permissoes
                        WHERE id_perfil = ? AND chave_permissao = ?
                    )
                    BEGIN
                        INSERT INTO perfil_permissoes
                        (id_perfil, chave_permissao, permitido, criado_em, atualizado_em)
                        VALUES (?, ?, ?, GETDATE(), GETDATE())
                    END
                    ELSE
                    BEGIN
                        UPDATE perfil_permissoes
                        SET permitido = ?, atualizado_em = GETDATE()
                        WHERE id_perfil = ? AND chave_permissao = ?
                    END
                    """,
                    (
                        safe_role,
                        permission_key,
                        safe_role,
                        permission_key,
                        allowed,
                        allowed,
                        safe_role,
                        permission_key,
                    ),
                )
            self._insert_audit_log(
                cursor,
                user=actor,
                modulo="Configuracoes",
                acao="atualizar_permissoes_perfil",
                entidade="perfil",
                entidade_id=safe_role,
                valor_anterior={"permissoes": previous},
                valor_novo={"permissoes": sorted(requested_permissions)},
                justificativa=normalize_text(data.get("justificativa")),
                sucesso=True,
            )
            conn.commit()
            return {"success": True, "permissoes": sorted(requested_permissions)}
        finally:
            conn.close()

    def list_system_users(self, *, search: str = "", perfil: str = "", status_usuario: str = "") -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT
                    usuarios.id_usuario,
                    usuarios.login,
                    usuarios.nome,
                    usuarios.email,
                    usuarios.perfil_id,
                    perfis.nome AS perfil_nome,
                    perfis.nivel,
                    usuarios.status,
                    usuarios.criado_em,
                    usuarios.ultimo_acesso_em,
                    usuarios.criado_por,
                    usuarios.atualizado_por,
                    usuarios.atualizado_em
                FROM usuarios
                LEFT JOIN perfis ON perfis.id_perfil = usuarios.perfil_id
                ORDER BY usuarios.nome, usuarios.email
                """
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            users = [self._serialize_system_user(row) for row in rows]
        finally:
            conn.close()

        safe_search = normalize_text(search).lower()
        safe_role = normalize_role_id(perfil)
        safe_status = normalize_text(status_usuario).lower()
        if safe_search:
            users = [
                item
                for item in users
                if safe_search in item["nome"].lower()
                or safe_search in item["email"].lower()
                or safe_search in item["login"].lower()
            ]
        if safe_role:
            users = [item for item in users if item["perfil"] == safe_role]
        if safe_status:
            users = [item for item in users if item["status"].lower() == safe_status]
        return users

    def create_system_user(self, data: dict, *, actor: AuthenticatedUser | dict | None = None) -> dict:
        safe_name = normalize_text(data.get("nome"))
        safe_email = normalize_text(data.get("email"))
        safe_login = normalize_text(data.get("login")) or safe_email
        safe_password = normalize_text(data.get("senha") or data.get("password"))
        role = get_role_definition(data.get("perfil") or data.get("perfil_id") or ROLE_INTERN)
        safe_status = normalize_text(data.get("status")) or "Ativo"

        if not safe_name or not safe_email or not safe_login or not safe_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome, e-mail, login e senha sao obrigatorios.")

        actor_info = _actor_payload(actor)
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO usuarios
                (
                    login,
                    nome,
                    email,
                    perfil_id,
                    status,
                    senha_hash,
                    criado_por,
                    atualizado_por,
                    criado_em,
                    atualizado_em
                )
                OUTPUT INSERTED.id_usuario
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
                """,
                (
                    safe_login,
                    safe_name,
                    safe_email,
                    role.id,
                    safe_status,
                    hash_password(safe_password),
                    actor_info.get("email") or actor_info.get("nome"),
                    actor_info.get("email") or actor_info.get("nome"),
                ),
            )
            id_usuario = int(cursor.fetchone()[0])
            self._insert_audit_log(
                cursor,
                user=actor,
                modulo="Usuarios",
                acao="criar_usuario",
                entidade="usuario",
                entidade_id=str(id_usuario),
                valor_novo={
                    "nome": safe_name,
                    "email": safe_email,
                    "login": safe_login,
                    "perfil": role.id,
                    "status": safe_status,
                },
                sucesso=True,
            )
            conn.commit()
            return {"success": True, "id_usuario": id_usuario}
        finally:
            conn.close()

    def _get_system_user_by_id(self, cursor, id_usuario: int) -> dict:
        cursor.execute(
            """
            SELECT TOP 1
                usuarios.id_usuario,
                usuarios.login,
                usuarios.nome,
                usuarios.email,
                usuarios.perfil_id,
                perfis.nome AS perfil_nome,
                perfis.nivel,
                usuarios.status,
                usuarios.criado_em,
                usuarios.ultimo_acesso_em,
                usuarios.criado_por,
                usuarios.atualizado_por,
                usuarios.atualizado_em
            FROM usuarios
            LEFT JOIN perfis ON perfis.id_perfil = usuarios.perfil_id
            WHERE usuarios.id_usuario = ?
            """,
            (int(id_usuario),),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")
        return rows_to_dicts(cursor, [row])[0]

    def update_system_user(self, id_usuario: int, data: dict, *, actor: AuthenticatedUser | dict | None = None) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            previous = self._serialize_system_user(self._get_system_user_by_id(cursor, id_usuario))
            role = get_role_definition(data.get("perfil") or data.get("perfil_id") or previous["perfil"])
            new_values = {
                "login": normalize_text(data.get("login")) or previous["login"],
                "nome": normalize_text(data.get("nome")) or previous["nome"],
                "email": normalize_text(data.get("email")) or previous["email"],
                "perfil_id": role.id,
                "status": normalize_text(data.get("status")) or previous["status"],
            }
            actor_info = _actor_payload(actor)
            cursor.execute(
                """
                UPDATE usuarios
                SET
                    login = ?,
                    nome = ?,
                    email = ?,
                    perfil_id = ?,
                    status = ?,
                    atualizado_por = ?,
                    atualizado_em = GETDATE()
                WHERE id_usuario = ?
                """,
                (
                    new_values["login"],
                    new_values["nome"],
                    new_values["email"],
                    new_values["perfil_id"],
                    new_values["status"],
                    actor_info.get("email") or actor_info.get("nome"),
                    int(id_usuario),
                ),
            )
            action = "alterar_perfil" if previous["perfil"] != role.id else "editar_usuario"
            self._insert_audit_log(
                cursor,
                user=actor,
                modulo="Usuarios",
                acao=action,
                entidade="usuario",
                entidade_id=str(id_usuario),
                valor_anterior=previous,
                valor_novo=new_values,
                justificativa=normalize_text(data.get("justificativa")),
                sucesso=True,
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def reset_system_user_password(self, id_usuario: int, data: dict, *, actor: AuthenticatedUser | dict | None = None) -> dict:
        safe_password = normalize_text(data.get("senha") or data.get("password"))
        if not safe_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe a nova senha.")

        conn = self._connect()
        try:
            cursor = conn.cursor()
            self._get_system_user_by_id(cursor, id_usuario)
            actor_info = _actor_payload(actor)
            cursor.execute(
                """
                UPDATE usuarios
                SET senha_hash = ?, atualizado_por = ?, atualizado_em = GETDATE()
                WHERE id_usuario = ?
                """,
                (
                    hash_password(safe_password),
                    actor_info.get("email") or actor_info.get("nome"),
                    int(id_usuario),
                ),
            )
            self._insert_audit_log(
                cursor,
                user=actor,
                modulo="Usuarios",
                acao="redefinir_senha",
                entidade="usuario",
                entidade_id=str(id_usuario),
                justificativa=normalize_text(data.get("justificativa")),
                sucesso=True,
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def set_system_user_status(self, id_usuario: int, data: dict, *, actor: AuthenticatedUser | dict | None = None) -> dict:
        action = normalize_text(data.get("acao")).lower()
        status_by_action = {
            "ativar": "Ativo",
            "desativar": "Inativo",
            "bloquear": "Bloqueado",
            "desbloquear": "Ativo",
        }
        if action not in status_by_action:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Acao de status invalida.")

        conn = self._connect()
        try:
            cursor = conn.cursor()
            previous = self._serialize_system_user(self._get_system_user_by_id(cursor, id_usuario))
            new_status = status_by_action[action]
            actor_info = _actor_payload(actor)
            cursor.execute(
                """
                UPDATE usuarios
                SET
                    status = ?,
                    atualizado_por = ?,
                    atualizado_em = GETDATE(),
                    bloqueado_em = CASE WHEN ? = 'Bloqueado' THEN GETDATE() ELSE bloqueado_em END,
                    desativado_em = CASE WHEN ? = 'Inativo' THEN GETDATE() ELSE desativado_em END
                WHERE id_usuario = ?
                """,
                (
                    new_status,
                    actor_info.get("email") or actor_info.get("nome"),
                    new_status,
                    new_status,
                    int(id_usuario),
                ),
            )
            self._insert_audit_log(
                cursor,
                user=actor,
                modulo="Usuarios",
                acao=f"{action}_usuario",
                entidade="usuario",
                entidade_id=str(id_usuario),
                valor_anterior=previous,
                valor_novo={"status": new_status},
                justificativa=normalize_text(data.get("justificativa")),
                sucesso=True,
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def deactivate_system_user(self, id_usuario: int, *, actor: AuthenticatedUser | dict | None = None, justificativa: str = "") -> dict:
        return self.set_system_user_status(
            id_usuario,
            {"acao": "desativar", "justificativa": justificativa or "Exclusao logica solicitada."},
            actor=actor,
        )

    def list_audit_logs(
        self,
        *,
        limit: int = 100,
        modulo: str = "",
        acao: str = "",
        usuario: str = "",
    ) -> list[dict]:
        safe_limit = min(max(int(limit or 100), 1), 500)
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT TOP {safe_limit}
                    id_log,
                    id_usuario,
                    nome_usuario,
                    email_usuario,
                    perfil_id,
                    perfil_nome,
                    data_hora,
                    modulo,
                    acao,
                    entidade,
                    entidade_id,
                    valor_anterior,
                    valor_novo,
                    justificativa,
                    origem,
                    sucesso
                FROM logs_auditoria
                ORDER BY data_hora DESC, id_log DESC
                """
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

        safe_module = normalize_text(modulo).lower()
        safe_action = normalize_text(acao).lower()
        safe_user = normalize_text(usuario).lower()
        if safe_module:
            rows = [item for item in rows if safe_module in normalize_text(item.get("modulo")).lower()]
        if safe_action:
            rows = [item for item in rows if safe_action in normalize_text(item.get("acao")).lower()]
        if safe_user:
            rows = [
                item
                for item in rows
                if safe_user in normalize_text(item.get("nome_usuario")).lower()
                or safe_user in normalize_text(item.get("email_usuario")).lower()
            ]
        return rows

    def export_audit_logs_csv(self, *, limit: int = 500) -> tuple[str, str]:
        rows = self.list_audit_logs(limit=limit)
        output = io.StringIO()
        columns = [
            "id_log",
            "data_hora",
            "nome_usuario",
            "email_usuario",
            "perfil_nome",
            "modulo",
            "acao",
            "entidade",
            "entidade_id",
            "justificativa",
            "origem",
            "sucesso",
        ]
        writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
        return f"logs_auditoria_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv", output.getvalue()

    def list_configuration_catalog(self) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            sections = []
            for key, definition in SETTINGS_CATALOGS.items():
                table = definition["table"]
                cursor.execute(
                    f"""
                    SELECT
                        id_item,
                        chave,
                        nome,
                        descricao,
                        categoria,
                        payload_json,
                        ativo,
                        usado,
                        criado_em,
                        atualizado_em
                    FROM {table}
                    ORDER BY categoria, nome, id_item
                    """
                )
                items = []
                for row in rows_to_dicts(cursor, cursor.fetchall()):
                    item = dict(row)
                    item["payload"] = safe_json_loads(item.get("payload_json"), {})
                    item["ativo"] = bool(item.get("ativo"))
                    item["usado"] = bool(item.get("usado"))
                    items.append(item)
                sections.append(
                    {
                        "tipo": key,
                        "label": definition["label"],
                        "items": items,
                    }
                )
            return {"sections": sections}
        finally:
            conn.close()

    def upsert_configuration_item(
        self,
        tipo: str,
        data: dict,
        *,
        id_item: int | None = None,
        actor: AuthenticatedUser | dict | None = None,
    ) -> dict:
        definition = SETTINGS_CATALOGS.get(normalize_text(tipo))
        if not definition:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalogo de configuracao nao encontrado.")

        table = definition["table"]
        payload = data.get("payload") if isinstance(data.get("payload"), dict) else {}
        values = {
            "chave": normalize_text(data.get("chave")),
            "nome": normalize_text(data.get("nome")),
            "descricao": normalize_text(data.get("descricao")),
            "categoria": normalize_text(data.get("categoria")),
            "payload_json": json.dumps(payload, ensure_ascii=False),
            "ativo": 1 if data.get("ativo", True) else 0,
        }
        if not values["nome"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome da configuracao e obrigatorio.")
        if not values["chave"]:
            values["chave"] = values["nome"].lower().replace(" ", "_")[:120]

        conn = self._connect()
        try:
            cursor = conn.cursor()
            previous = None
            if id_item:
                cursor.execute(f"SELECT TOP 1 * FROM {table} WHERE id_item = ?", (int(id_item),))
                row = cursor.fetchone()
                if not row:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item de configuracao nao encontrado.")
                previous = rows_to_dicts(cursor, [row])[0]
                cursor.execute(
                    f"""
                    UPDATE {table}
                    SET
                        chave = ?,
                        nome = ?,
                        descricao = ?,
                        categoria = ?,
                        payload_json = ?,
                        ativo = ?,
                        atualizado_em = GETDATE()
                    WHERE id_item = ?
                    """,
                    (
                        values["chave"],
                        values["nome"],
                        values["descricao"],
                        values["categoria"],
                        values["payload_json"],
                        values["ativo"],
                        int(id_item),
                    ),
                )
                resolved_id = int(id_item)
                action = "editar_configuracao"
            else:
                cursor.execute(
                    f"""
                    INSERT INTO {table}
                    (
                        chave,
                        nome,
                        descricao,
                        categoria,
                        payload_json,
                        ativo,
                        usado,
                        criado_em,
                        atualizado_em
                    )
                    OUTPUT INSERTED.id_item
                    VALUES (?, ?, ?, ?, ?, ?, 0, GETDATE(), GETDATE())
                    """,
                    (
                        values["chave"],
                        values["nome"],
                        values["descricao"],
                        values["categoria"],
                        values["payload_json"],
                        values["ativo"],
                    ),
                )
                resolved_id = int(cursor.fetchone()[0])
                action = "criar_configuracao"

            self._insert_audit_log(
                cursor,
                user=actor,
                modulo="Configuracoes",
                acao=action,
                entidade=table,
                entidade_id=str(resolved_id),
                valor_anterior=previous,
                valor_novo=values,
                justificativa=normalize_text(data.get("justificativa")),
                sucesso=True,
            )
            conn.commit()
            return {"success": True, "id_item": resolved_id}
        finally:
            conn.close()

    def deactivate_configuration_item(
        self,
        tipo: str,
        id_item: int,
        *,
        actor: AuthenticatedUser | dict | None = None,
        justificativa: str = "",
    ) -> dict:
        definition = SETTINGS_CATALOGS.get(normalize_text(tipo))
        if not definition:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalogo de configuracao nao encontrado.")

        table = definition["table"]
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(f"SELECT TOP 1 * FROM {table} WHERE id_item = ?", (int(id_item),))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item de configuracao nao encontrado.")
            previous = rows_to_dicts(cursor, [row])[0]
            cursor.execute(
                f"""
                UPDATE {table}
                SET ativo = 0, atualizado_em = GETDATE()
                WHERE id_item = ?
                """,
                (int(id_item),),
            )
            self._insert_audit_log(
                cursor,
                user=actor,
                modulo="Configuracoes",
                acao="desativar_configuracao",
                entidade=table,
                entidade_id=str(id_item),
                valor_anterior=previous,
                valor_novo={"ativo": False},
                justificativa=justificativa,
                sucesso=True,
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def register_lgpd_request(self, data: dict, *, actor: AuthenticatedUser | dict | None = None) -> dict:
        payload = {
            "tipo_solicitacao": normalize_text(data.get("tipo_solicitacao")),
            "titular": normalize_text(data.get("titular")),
            "email": normalize_text(data.get("email")),
            "descricao": normalize_text(data.get("descricao")),
            "status": "Registrada",
        }
        if not payload["tipo_solicitacao"] or not payload["titular"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de solicitacao e titular sao obrigatorios.")
        return self.upsert_configuration_item(
            "lgpd",
            {
                "chave": f"solicitacao_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "nome": f"{payload['tipo_solicitacao']} - {payload['titular']}",
                "descricao": payload["descricao"],
                "categoria": "Solicitacoes LGPD",
                "payload": payload,
                "ativo": True,
                "justificativa": "Solicitacao LGPD operacional registrada.",
            },
            actor=actor,
        )
