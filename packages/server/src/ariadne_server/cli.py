"""
ariadne-server CLI entry point.

Usage:
  ariadne-server              # start the gateway server
  ariadne-server token        # print the current API token (full value)
  ariadne-server rotate       # rotate token and print the new one
  ariadne-server start        # alias for bare invocation
"""
from __future__ import annotations

import argparse
import sys


def cmd_start(args: argparse.Namespace) -> None:
    import uvicorn

    from ariadne_server.config import settings

    uvicorn.run(
        "ariadne_server.main:app",
        host=args.host or settings.host,
        port=args.port or settings.port,
        log_level=args.log_level or settings.log_level,
        reload=args.reload,
    )


def cmd_token(_args: argparse.Namespace) -> None:
    from ariadne_server.config import get_api_key

    print(get_api_key())


def cmd_rotate(_args: argparse.Namespace) -> None:
    from ariadne_server.config import rotate_api_key

    new_token = rotate_api_key()
    print(new_token)
    print("Token rotated. Update your Chrome extension popup with the new token.", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="ariadne-server",
        description="Ariadne Gateway — bridge between AI agents and your local browser",
    )
    sub = parser.add_subparsers(dest="command")

    # ── start (default) ────────────────────────────────────────────────────────
    start_p = sub.add_parser("start", help="Start the gateway server (default)")
    _add_server_flags(start_p)

    # ── token ──────────────────────────────────────────────────────────────────
    sub.add_parser("token", help="Print the current API token")

    # ── rotate ─────────────────────────────────────────────────────────────────
    sub.add_parser("rotate", help="Rotate the API token and print the new one")

    # Bare invocation also accepts server flags
    _add_server_flags(parser)

    args = parser.parse_args()

    if args.command == "token":
        cmd_token(args)
    elif args.command == "rotate":
        cmd_rotate(args)
    else:
        # "start" or no subcommand → start the server
        cmd_start(args)


def _add_server_flags(p: argparse.ArgumentParser) -> None:
    p.add_argument("--host", default="", help="Bind host (default: 127.0.0.1)")
    p.add_argument("--port", type=int, default=0, help="Bind port (default: 8000)")
    p.add_argument("--log-level", default="", help="Log level (default: info)")
    p.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
