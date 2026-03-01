import asyncio
from unittest.mock import AsyncMock, MagicMock
import pytest

from ariadne_server.manager.connection import ConnectionManager
from ariadne_server.models import CommandModel, ResponseModel


@pytest.fixture
def manager():
    return ConnectionManager()


@pytest.fixture
def mock_ws():
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    ws.receive_json = AsyncMock()
    return ws


@pytest.mark.asyncio
async def test_connect_and_disconnect(manager, mock_ws):
    await manager.connect("client1", mock_ws)
    assert manager.is_connected("client1")
    manager.disconnect("client1")
    assert not manager.is_connected("client1")


@pytest.mark.asyncio
async def test_send_command_not_connected(manager):
    command = CommandModel(type="CMD_BROWSE", payload={"url": "https://example.com"})
    with pytest.raises(RuntimeError, match="not connected"):
        await manager.send_command("ghost", command)


@pytest.mark.asyncio
async def test_send_and_resolve(manager, mock_ws):
    await manager.connect("client1", mock_ws)
    command = CommandModel(type="CMD_BROWSE", payload={"url": "https://example.com"})

    response = ResponseModel(
        cmd_id=command.cmd_id,
        type="RESP_RESULT",
        success=True,
        data={"title": "Example", "markdown": "# Example"},
    )

    async def resolve_after_send(*args, **kwargs):
        # Simulate extension responding after receiving command
        await asyncio.sleep(0.01)
        manager.resolve("client1", response)

    mock_ws.send_json.side_effect = resolve_after_send

    result = await manager.send_command("client1", command)
    assert result.success
    assert result.data["title"] == "Example"


@pytest.mark.asyncio
async def test_timeout(manager, mock_ws):
    await manager.connect("client1", mock_ws)
    command = CommandModel(type="CMD_BROWSE", payload={"url": "https://example.com"})

    # Patch settings timeout to be very short
    import ariadne_server.manager.connection as conn_module
    original_timeout = conn_module.settings.command_timeout
    conn_module.settings.command_timeout = 0.05

    try:
        with pytest.raises(asyncio.TimeoutError):
            await manager.send_command("client1", command)
    finally:
        conn_module.settings.command_timeout = original_timeout


@pytest.mark.asyncio
async def test_disconnect_cancels_pending(manager, mock_ws):
    await manager.connect("client1", mock_ws)
    command = CommandModel(type="CMD_BROWSE", payload={"url": "https://example.com"})

    async def disconnect_after_send(*args, **kwargs):
        await asyncio.sleep(0.01)
        manager.disconnect("client1")

    mock_ws.send_json.side_effect = disconnect_after_send

    with pytest.raises(asyncio.CancelledError):
        await manager.send_command("client1", command)
