from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .logging_config import configure_logging
from .routers.analytics import router as analytics_router
from .routers.auth import router as auth_router
from .routers.history import router as history_router
from .routers.pipeline import router as pipeline_router
from .routers.processes import router as processes_router
from .routers.system import router as system_router


configure_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="API RH Provas")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_origin_regex=settings.cors_allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(HTTPException)
    async def handle_http_exception(_: Request, exc: HTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "Falha ao processar a requisicao."
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "message": message},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(_: Request, exc: Exception):
        logger.exception("Erro nao tratado na API: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Erro interno do servidor."},
        )

    app.include_router(system_router)
    app.include_router(auth_router)
    app.include_router(history_router)
    app.include_router(processes_router)
    app.include_router(analytics_router)
    app.include_router(pipeline_router)

    logger.info(
        "Aplicacao inicializada no ambiente '%s' com banco '%s/%s'.",
        settings.app_env,
        settings.sql_server,
        settings.sql_database,
    )
    return app


app = create_app()
