import asyncio
import logging
from typing import Any

from fastapi import WebSocket

from ariadne_server.config import settings
from ariadne_server.models import CommandModel, ResponseModel

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}
        self._pending: dict[str, asyncio.Future[ResponseModel]] = {}

    def is_connected(self, client_id: str) -> bool:
        return client_id in self._connections

    async def connect(self, client_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[client_id] = ws
        logger.info("Client connected: %s", client_id)

    async def register(self, client_id: str, ws: WebSocket) -> None:
        """Register an already-accepted and authenticated WebSocket."""
        self._connections[client_id] = ws
        logger.info("Client registered: %s", client_id)

    def disconnect(self, client_id: str) -> None:
        self._connections.pop(client_id, None)
        # Cancel all pending futures for this client
        prefix = f"{client_id}:"
        to_cancel = [k for k in self._pending if k.startswith(prefix)]
        for key in to_cancel:
            future = self._pending.pop(key)
            if not future.done():
                future.cancel()
        logger.info("Client disconnected: %s (cancelled %d pending)", client_id, len(to_cancel))

    async def send_command(self, client_id: str, command: CommandModel) -> ResponseModel:
        ws = self._connections.get(client_id)
        if ws is None:
            raise RuntimeError(f"Client '{client_id}' is not connected")

        loop = asyncio.get_event_loop()
        future: asyncio.Future[ResponseModel] = loop.create_future()
        key = f"{client_id}:{command.cmd_id}"
        self._pending[key] = future

        try:
            await ws.send_json(command.model_dump())
            result = await asyncio.wait_for(future, timeout=settings.command_timeout)
            return result
        except asyncio.TimeoutError:
            self._pending.pop(key, None)
            raise
        except Exception:
            self._pending.pop(key, None)
            raise

    def resolve(self, client_id: str, response: ResponseModel) -> None:
        key = f"{client_id}:{response.cmd_id}"
        future = self._pending.pop(key, None)
        if future is None:
            logger.warning("No pending future for cmd_id=%s client=%s", response.cmd_id, client_id)
            return
        if not future.done():
            future.set_result(response)


manager = ConnectionManager()
