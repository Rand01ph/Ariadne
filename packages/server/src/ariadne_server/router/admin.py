import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ariadne_server.config import rotate_api_key

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/admin/token/rotate")
async def rotate_token() -> JSONResponse:
    """
    Generate a new API token. Requires the current token via Authorization header.
    The old token is immediately invalidated.
    Update your browser extension with the new token.
    """
    new_token = rotate_api_key()
    logger.info("API key rotated: %s...[hidden]", new_token[:20])
    return JSONResponse({
        "token": new_token,
        "message": "Token rotated. Update your browser extension.",
    })
