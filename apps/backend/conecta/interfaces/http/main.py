"""Entrypoint canônico; delega ao app legado durante a migração incremental."""

from rh_api.main import app, create_app

__all__ = ["app", "create_app"]
