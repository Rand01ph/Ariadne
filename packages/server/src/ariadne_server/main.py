import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ariadne_server.config import get_api_key, settings
from ariadne_server.middleware.auth import AuthMiddleware
from ariadne_server.router.admin import router as admin_router
from ariadne_server.router.cmd import router as cmd_router
from ariadne_server.router.ws import router as ws_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    key = get_api_key()
    logger.info("Ariadne Gateway starting")
    logger.info("API Key: %s...[hidden]", key[:20])
    logger.info("Full key written to .ariadne.key — run: cat packages/server/.ariadne.key")
    if settings.host not in ("127.0.0.1", "localhost", "::1"):
        logger.warning(
            "⚠  Server bound to %s — traffic is unencrypted. "
            "Use a TLS reverse proxy for any network exposure.",
            settings.host,
        )
    yield
    logger.info("Ariadne Gateway shutting down")


app = FastAPI(
    title="Ariadne Gateway",
    description="Bridges remote AI agents to local browser via Chrome Extension",
    version="0.1.0",
    lifespan=lifespan,
)

# Middleware order: add AuthMiddleware first so CORS ends up outermost.
# Starlette applies middleware in reverse-add order:
#   add(Auth) → add(CORS) results in: CORS → Auth → app
# CORS must be outermost to handle OPTIONS preflight before Auth runs.
app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"chrome-extension://[a-z]+"           # Chrome extension
        r"|https?://(localhost|127\.0\.0\.1)(:\d+)?"  # localhost variants
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)
app.include_router(cmd_router)
app.include_router(admin_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
