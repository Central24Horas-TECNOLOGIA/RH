"""Adapter temporário para a conexão legada, mantendo um único ponto de acesso."""

from rh_api.db import build_connection_string, get_connection

__all__ = ["build_connection_string", "get_connection"]
