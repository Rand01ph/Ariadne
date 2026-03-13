from typing import Any, Literal
from pydantic import BaseModel, Field
import uuid


class BrowsePayload(BaseModel):
    url: str
    action: Literal["read", "screenshot", "highlight"] = "read"
    screenshot: bool = False
    selector: str | None = None

class PingPayload(BaseModel):
    action: Literal["ping"] = "ping"


class CommandModel(BaseModel):
    cmd_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    payload: dict[str, Any]


class ResponseModel(BaseModel):
    cmd_id: str
    type: str
    success: bool
    data: dict[str, Any] | None = None
    error: str | None = None


class BrowseRequest(BaseModel):
    url: str
    action: Literal["read", "screenshot", "highlight"] = "read"
    screenshot: bool = False
    selector: str | None = None

class PingRequest(BaseModel):
    action: Literal["ping"] = "ping"
