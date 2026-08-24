"""Fila de tarefas assíncronas com RQ + Redis (roadmap de expansão,
respostas.txt: tirar operações lentas — ex. envio de e-mail — do caminho
síncrono da resposta HTTP).

Infraestrutura leve e opcional/degradável (CLAUDE.md): usa o mesmo Redis do
módulo `cache.py` (`RH_REDIS_URL`). Se a URL não estiver configurada, se as
dependências opcionais 'redis'/'rq' não estiverem instaladas, ou se a conexão
falhar por qualquer motivo, `enfileirar()` cai em fallback síncrono — executa
a função imediatamente, no mesmo processo/request, exatamente como o sistema
já se comporta hoje sem fila nenhuma. O chamador nunca precisa saber qual dos
dois caminhos foi usado.

IMPORTANTE (produção): quando `RH_REDIS_URL` estiver configurada e o Redis
disponível, as tarefas enfileiradas só são de fato processadas se houver um
processo `rq worker` rodando separadamente (ex.: `rq worker conecta
--url $RH_REDIS_URL`). Este módulo não inicia esse worker automaticamente —
isso é esperado nesta entrega; é preciso operacionalizar o worker à parte
quando o Redis for habilitado em produção.

Modelo seguido: `rh_api/scheduler.py` (degradação do APScheduler).
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Callable

from .config import get_settings

logger = logging.getLogger(__name__)

_CONNECT_TIMEOUT_SECONDS = 1.5
_SOCKET_TIMEOUT_SECONDS = 1.5
_QUEUE_NAME = "conecta"

_fallback_warning_logged = False
_fallback_lock = threading.Lock()


def _log_fallback_once(message: str, *, exc_info: bool = False) -> None:
    global _fallback_warning_logged
    if _fallback_warning_logged:
        return
    with _fallback_lock:
        if _fallback_warning_logged:
            return
        _fallback_warning_logged = True
        logger.warning(message, exc_info=exc_info)


def reset_fallback_warning_for_tests() -> None:
    """Só para testes: permite reobservar o warning de fallback."""
    global _fallback_warning_logged
    _fallback_warning_logged = False


def _get_rq_queue():
    """Retorna uma `rq.Queue` conectada, ou `None` se a fila não estiver
    disponível (Redis não configurado, dependências ausentes, ou conexão
    falhou)."""
    settings = get_settings()
    redis_url = getattr(settings, "redis_url", "") or ""
    if not redis_url:
        _log_fallback_once(
            "RH_REDIS_URL não configurada; tarefas serão executadas de forma "
            "síncrona (sem fila), como o sistema já faz hoje."
        )
        return None

    try:
        import redis  # type: ignore[import-not-found]
        from rq import Queue  # type: ignore[import-not-found]
    except ImportError:
        _log_fallback_once(
            "Dependências opcionais 'redis'/'rq' não instaladas; tarefas serão "
            "executadas de forma síncrona (sem fila). Instale 'redis' e 'rq' "
            "para habilitar o enfileiramento."
        )
        return None

    try:
        connection = redis.from_url(
            redis_url,
            socket_connect_timeout=_CONNECT_TIMEOUT_SECONDS,
            socket_timeout=_SOCKET_TIMEOUT_SECONDS,
        )
        connection.ping()
        return Queue(_QUEUE_NAME, connection=connection)
    except Exception:
        _log_fallback_once(
            "Não foi possível conectar ao Redis/RQ (RH_REDIS_URL); tarefas "
            "serão executadas de forma síncrona (sem fila, o restante do "
            "backend continua funcionando normalmente).",
            exc_info=True,
        )
        return None


def enfileirar(func: Callable, *args: Any, **kwargs: Any) -> Any:
    """Tenta enfileirar `func(*args, **kwargs)` no RQ para execução em
    background. Se o Redis/RQ não estiver disponível (ou o enfileiramento
    falhar por qualquer motivo, incluindo a função/argumentos não serem
    "picklable"), executa `func` de forma síncrona e imediata como fallback —
    idêntico ao comportamento atual do sistema sem fila.

    Retorna o `Job` do RQ quando enfileirado com sucesso, ou o retorno direto
    de `func(*args, **kwargs)` quando executado de forma síncrona.
    """
    queue = _get_rq_queue()
    if queue is not None:
        try:
            job = queue.enqueue(func, *args, **kwargs)
            logger.info(
                "Tarefa enfileirada no RQ (job_id=%s, func=%s).",
                getattr(job, "id", ""),
                getattr(func, "__qualname__", getattr(func, "__name__", repr(func))),
            )
            return job
        except Exception:
            _log_fallback_once(
                "Falha ao enfileirar tarefa no RQ; executando de forma "
                "síncrona como fallback.",
                exc_info=True,
            )

    return func(*args, **kwargs)
