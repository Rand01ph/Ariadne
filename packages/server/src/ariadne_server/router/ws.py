import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ariadne_server.config import verify_token
from ariadne_server.manager.connection import manager
from ariadne_server.models import ResponseModel

logger = logging.getLogger(__name__)

router = APIRouter()

_ALLOWED_ORIGINS = (
    "chrome-extension://",
    "http://localhost",
    "http://127.0.0.1",
    "https://localhost",
    "https://127.0.0.1",
)


def _is_allowed_origin(origin: str) -> bool:
    return any(origin.startswith(o) for o in _ALLOWED_ORIGINS)


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(ws: WebSocket, client_id: str) -> None:
    # Accept first — rejection happens via close codes after accept
    await ws.accept()

    # ── Origin check ────────────────────────────────────────────────────────
    origin = ws.headers.get("origin", "")
    if origin and not _is_allowed_origin(origin):
        logger.warning("WS rejected: forbidden origin=%s client=%s", origin, client_id)
        await ws.close(code=4003)
        return

    # ── AUTH handshake — first message must arrive within 10 s ──────────────
    try:
        first = await asyncio.wait_for(ws.receive_json(), timeout=10.0)
        token = first.get("token", "") if first.get("type") == "AUTH" else ""
        if not verify_token(token):
            raise PermissionError("invalid token")
    except asyncio.TimeoutError:
        logger.warning("WS auth timeout: client=%s", client_id)
        await ws.send_json({"type": "AUTH_FAIL", "reason": "timeout"})
        await ws.close(code=4001)
        return
    except PermissionError:
        logger.warning("WS auth failed: client=%s", client_id)
        await ws.send_json({"type": "AUTH_FAIL", "reason": "invalid token"})
        await ws.close(code=4001)
        return
    except Exception as exc:
        logger.error("WS auth error client=%s: %s", client_id, exc)
        await ws.close(code=4001)
        return

    await ws.send_json({"type": "AUTH_OK"})
    await manager.register(client_id, ws)

    # ── Message loop ─────────────────────────────────────────────────────────
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "PING":
                await ws.send_json({"type": "PONG"})
            elif msg_type == "RESP_RESULT":
                try:
                    response = ResponseModel.model_validate(data)
                    manager.resolve(client_id, response)
                except Exception as exc:
                    logger.error("Invalid RESP_RESULT payload: %s", exc)
            else:
                logger.debug("Unknown message type from %s: %s", client_id, msg_type)
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as exc:
        logger.error("WebSocket error for %s: %s", client_id, exc)
        manager.disconnect(client_id)
