import time
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from ariadne_server.config import verify_token

# Paths that require no authentication
_PUBLIC = frozenset({"/health", "/docs", "/openapi.json", "/redoc"})

# WebSocket paths authenticate via first message, not HTTP header
_WS_PREFIX = "/ws/"

_WINDOW = 60.0   # sliding window in seconds
_MAX_FAIL = 10   # max failures per IP per window

_failures: dict[str, list[float]] = defaultdict(list)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: object) -> Response:
        path = request.url.path

        # Skip public and WebSocket paths
        if path in _PUBLIC or path.startswith(_WS_PREFIX):
            return await call_next(request)  # type: ignore[operator]

        # Allow CORS preflight to pass through unblocked
        if request.method == "OPTIONS":
            return await call_next(request)  # type: ignore[operator]

        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()

        # Prune stale failures and enforce rate limit
        _failures[ip] = [t for t in _failures[ip] if now - t < _WINDOW]
        if len(_failures[ip]) >= _MAX_FAIL:
            return Response(
                content='{"detail":"Too many failed attempts, slow down"}',
                status_code=429,
                media_type="application/json",
            )

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            _failures[ip].append(now)
            return Response(
                content='{"detail":"Missing or invalid Authorization header"}',
                status_code=401,
                media_type="application/json",
            )

        token = auth[len("Bearer "):]
        if not verify_token(token):
            _failures[ip].append(now)
            return Response(
                content='{"detail":"Invalid token"}',
                status_code=401,
                media_type="application/json",
            )

        return await call_next(request)  # type: ignore[operator]
