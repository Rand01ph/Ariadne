import asyncio
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from ariadne_server.manager.connection import manager
from ariadne_server.models import BrowseRequest, CommandModel

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/v1/cmd/{client_id}")
async def send_command(client_id: str, request: BrowseRequest) -> JSONResponse:
    if not manager.is_connected(client_id):
        raise HTTPException(status_code=404, detail=f"Client '{client_id}' is not connected")

    command = CommandModel(
        type="CMD_BROWSE",
        payload=request.model_dump(),
    )

    try:
        result = await manager.send_command(client_id, command)
        if result.success:
            return JSONResponse(content={"cmd_id": result.cmd_id, "data": result.data})
        else:
            logger.error("Extension error for client=%s: %s", client_id, result.error)
            return JSONResponse(
                status_code=500,
                content={"cmd_id": result.cmd_id, "error": result.error},
            )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Command timed out waiting for browser response")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
