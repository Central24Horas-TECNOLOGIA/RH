from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote


def generate_secret(size: int = 20) -> str:
    return base64.b32encode(secrets.token_bytes(size)).decode("ascii").rstrip("=")


def _decode_secret(secret: str) -> bytes:
    normalized = str(secret or "").replace(" ", "").upper()
    padding = "=" * (-len(normalized) % 8)
    return base64.b32decode(normalized + padding, casefold=True)


def generate_code(secret: str, *, timestamp: int | None = None, period: int = 30) -> str:
    current = int(time.time() if timestamp is None else timestamp)
    counter = current // period
    digest = hmac.new(
        _decode_secret(secret),
        struct.pack(">Q", counter),
        hashlib.sha1,
    ).digest()
    offset = digest[-1] & 0x0F
    value = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{value:06d}"


def verify_code(
    secret: str,
    code: str,
    *,
    timestamp: int | None = None,
    valid_window: int = 1,
    period: int = 30,
) -> bool:
    candidate = str(code or "").strip()
    if len(candidate) != 6 or not candidate.isdigit() or not secret:
        return False
    current = int(time.time() if timestamp is None else timestamp)
    return any(
        hmac.compare_digest(
            generate_code(secret, timestamp=current + offset * period, period=period),
            candidate,
        )
        for offset in range(-valid_window, valid_window + 1)
    )


def provisioning_uri(secret: str, account: str, issuer: str = "Conecta") -> str:
    safe_issuer = str(issuer or "Conecta").strip()
    label = quote(f"{safe_issuer}:{account}")
    return (
        f"otpauth://totp/{label}?secret={quote(secret)}"
        f"&issuer={quote(safe_issuer)}&algorithm=SHA1&digits=6&period=30"
    )
