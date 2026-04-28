from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import pyodbc
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .logging_config import configure_logging
from .repositories import (
    bootstrap_runtime_schema,
    describe_database_error,
    is_deadlock_error,
)
from .routers.analytics import router as analytics_router
from .routers.auth import router as auth_router
from .routers.history import router as history_router
from .routers.interviews import router as interviews_router
from .routers.pipeline import router as pipeline_router
from .routers.processes import router as processes_router
from .routers.public_candidacy import router as public_candidacy_router
from .routers.system import router as system_router


configure_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        try:
            bootstrap_runtime_schema(settings)
        except pyodbc.Error as exc:
            logger.exception(
                "Falha ao preparar o schema complementar do RH na inicializacao: %s",
                describe_database_error(exc),
            )
        except Exception as exc:
            logger.exception(
                "Falha ao preparar o schema complementar do RH na inicializacao: %s",
                exc,
            )
        yield

    app = FastAPI(title="Conecta C24h API", lifespan=lifespan)

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
        logger.warning("Falha HTTP %s: %s", exc.status_code, message)
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "message": message},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_exception(_: Request, exc: RequestValidationError):
        errors = exc.errors()
        first_error = errors[0] if errors else {}
        loc = ".".join(str(item) for item in first_error.get("loc", []) if item not in {"body", "query", "path"})
        message = first_error.get("msg") or "Dados invalidos."
        if loc:
            message = f"{loc}: {message}"

        logger.warning("Falha de validacao na API: %s", errors)
        return JSONResponse(
            status_code=422,
            content={"success": False, "message": message, "details": errors},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(_: Request, exc: Exception):
        logger.exception("Erro nao tratado na API: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Erro interno do servidor."},
        )

    @app.exception_handler(pyodbc.Error)
    async def handle_database_exception(_: Request, exc: pyodbc.Error):
        detailed_message = describe_database_error(exc)
        if is_deadlock_error(exc):
            logger.warning(
                "Deadlock nao tratado interceptado pela API: %s",
                detailed_message,
            )
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "message": "O banco de dados ficou temporariamente indisponivel por conflito de concorrencia. Tente novamente em instantes.",
                },
            )

        logger.exception(
            "Erro de banco de dados nao tratado: %s",
            detailed_message,
        )
        message = "Falha ao acessar o banco de dados."
        if settings.is_development and detailed_message:
            message = f"{message} {detailed_message}"
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": message},
        )

    app.include_router(system_router)
    app.include_router(auth_router)
    app.include_router(history_router)
    app.include_router(processes_router)
    app.include_router(public_candidacy_router)
    app.include_router(interviews_router)
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
