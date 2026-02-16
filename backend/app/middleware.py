"""
Request logging and rate limiting middleware.
"""

import logging
import time
from collections import defaultdict
from typing import Callable

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("buddhira")

# Rate limit: (window_seconds, max_requests)
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 120  # per IP per minute


def _user_id_from_request(request: Request) -> str | None:
    """Extract user id from Bearer token for logging only (no verification)."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("sub")
    except Exception:
        return None


def _client_ip(request: Request) -> str:
    """Client IP for rate limiting (respect X-Forwarded-For if set)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request: route, user_id, status, latency_ms."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.perf_counter()
        user_id = _user_id_from_request(request) or "anon"
        path = request.url.path or ""
        method = request.method or ""

        response = await call_next(request)
        latency_ms = round((time.perf_counter() - start) * 1000)
        logger.info(
            "request path=%s method=%s user_id=%s status=%s latency_ms=%s",
            path,
            method,
            user_id,
            response.status_code,
            latency_ms,
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory rate limit per IP. Returns 429 when exceeded.
    Skip rate limit for /health and / (so load balancers keep working).
    """

    def __init__(self, app, window_seconds: int = RATE_LIMIT_WINDOW, max_requests: int = RATE_LIMIT_MAX):
        super().__init__(app)
        self.window = window_seconds
        self.max_requests = max_requests
        self._counts: dict[str, list[float]] = defaultdict(list)

    def _clean_old(self, key: str, now: float) -> None:
        cutoff = now - self.window
        self._counts[key] = [t for t in self._counts[key] if t > cutoff]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path or ""
        if path in ("/health", "/"):
            return await call_next(request)

        ip = _client_ip(request)
        now = time.perf_counter()
        self._clean_old(ip, now)

        if len(self._counts[ip]) >= self.max_requests:
            return Response(
                content='{"detail":"Too many requests","code":"rate_limit_exceeded"}',
                status_code=429,
                media_type="application/json",
            )
        self._counts[ip].append(now)

        return await call_next(request)
