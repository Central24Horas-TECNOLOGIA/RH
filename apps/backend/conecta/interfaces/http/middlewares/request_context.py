from __future__ import annotations

import logging
import re
import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware

from ....infrastructure.observability.context import request_id_var, user_id_var


logger = logging.getLogger("conecta.http")
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        supplied = request.headers.get("x-request-id", "").strip()
        request_id = supplied if REQUEST_ID_PATTERN.fullmatch(supplied) else uuid4().hex
        request_token = request_id_var.set(request_id)
        user_token = user_id_var.set("")
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            logger.info(
                "request_completed",
                extra={
                    "action": f"{request.method} {request.url.path}",
                    "status": status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            request_id_var.reset(request_token)
            user_id_var.reset(user_token)
