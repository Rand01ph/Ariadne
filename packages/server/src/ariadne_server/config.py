import hmac
import os
import secrets
from pathlib import Path

from pydantic_settings import BaseSettings

# Token file: packages/server/.ariadne.key
# config.py is at packages/server/src/ariadne_server/config.py → 3 parents up
_TOKEN_FILE = Path(__file__).parent.parent.parent / ".ariadne.key"


class Settings(BaseSettings):
    host: str = "127.0.0.1"
    port: int = 8000
    command_timeout: float = 30.0
    log_level: str = "info"

    model_config = {"env_prefix": "ARIADNE_"}


settings = Settings()


# ── Token management ───────────────────────────────────────────────────────────

def _init_token() -> str:
    """
    Priority:
      1. ARIADNE_API_KEY env var  (never written to file)
      2. .ariadne.key file        (persists across restarts)
      3. Auto-generate            (written to file, printed at startup)
    """
    env_key = os.environ.get("ARIADNE_API_KEY", "").strip()
    if env_key:
        return env_key

    if _TOKEN_FILE.exists():
        token = _TOKEN_FILE.read_text().strip()
        if token:
            return token

    # Generate and persist
    token = "ariadne_sk_" + secrets.token_hex(32)
    _TOKEN_FILE.write_text(token + "\n")
    _TOKEN_FILE.chmod(0o600)
    return token


_api_key: str = _init_token()


def get_api_key() -> str:
    return _api_key


def rotate_api_key() -> str:
    """Generate a new token, persist it, return it. Old token is immediately invalid."""
    global _api_key
    new_key = "ariadne_sk_" + secrets.token_hex(32)
    _TOKEN_FILE.write_text(new_key + "\n")
    _TOKEN_FILE.chmod(0o600)
    _api_key = new_key
    return new_key


def verify_token(token: str) -> bool:
    """Constant-time comparison to prevent timing side-channel attacks."""
    if not token:
        return False
    return hmac.compare_digest(token.encode(), _api_key.encode())
