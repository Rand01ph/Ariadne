"""Centralized logging setup for Ariadne server.

Call ``setup()`` once before starting uvicorn.  After that every
``logging.getLogger(__name__)`` in the codebase writes to both the
console and a rotating file at ``~/.ariadne/server.log``.

The log file is the primary debugging artifact for LLM-driven sessions:

    cat ~/.ariadne/server.log
    tail -f ~/.ariadne/server.log
"""
from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path

LOG_DIR = Path.home() / ".ariadne"
LOG_FILE = LOG_DIR / "server.log"

_FMT = "%(asctime)s %(levelname)-5s [%(module)s] %(message)s"
_DATE_FMT = "%Y-%m-%d %H:%M:%S"


def setup(level: str = "info") -> None:
    """Configure root logger: console + rotating file."""
    LOG_DIR.mkdir(exist_ok=True)

    root = logging.getLogger()
    root.setLevel(level.upper())

    # Remove any handlers added by basicConfig / previous calls
    root.handlers.clear()

    fmt = logging.Formatter(_FMT, _DATE_FMT)

    console = logging.StreamHandler()
    console.setFormatter(fmt)
    root.addHandler(console)

    file_handler = logging.handlers.RotatingFileHandler(
        LOG_FILE,
        maxBytes=5 * 1024 * 1024,  # 5 MB per file
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)

    logging.getLogger(__name__).info("Logging to %s", LOG_FILE)
