# Ariadne

> Named after the Greek myth — Ariadne's thread guided Theseus out of the labyrinth.

**Ariadne** is a secure bridge between remote AI agents and your local Chrome browser.
The AI decides what to do; your browser executes it — visibly, auditably, always under your control.

**[中文文档 →](README.zh.md)**

```
AI Agent  ──POST /v1/cmd──▶  Ariadne Server  ──WebSocket──▶  Chrome Extension  ──▶  Browser
                                    ◀──────────── RESP_RESULT ◀──────────────────────
```

---

## Philosophy: Human-in-the-Control

Every browser operation runs inside a dedicated **"🤖 Ariadne Agent" tab group** — visible, auditable, and stoppable at any time. The AI never hides what it's doing.

---

## Quick Start

### Prerequisites

- Python 3.12+, [uv](https://docs.astral.sh/uv/)
- Node.js 22+, pnpm 9+
- Chrome 116+

### 1 — Install the Gateway Server

**From a GitHub Release (recommended):**

```bash
uv tool install https://github.com/Rand01ph/Ariadne/releases/latest/download/ariadne_server-0.1.0-py3-none-any.whl
```

**From source:**

```bash
cd packages/server && uv sync
```

### 2 — Start the Server

```bash
ariadne-server
# Listening on http://127.0.0.1:8000
```

On first run, a token is auto-generated and saved to `packages/server/.ariadne.key`.
The startup log shows a masked preview — get the full token with:

```bash
ariadne-server token
```

### 3 — Load the Chrome Extension

**From a GitHub Release:**
1. Download `ariadne-extension-*-chrome.zip` from the [latest release](https://github.com/Rand01ph/Ariadne/releases/latest)
2. Unzip it
3. Open `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select the unzipped folder

**From source (dev mode with hot-reload):**

```bash
pnpm install
pnpm dev
# Then load packages/extension/.output/chrome-mv3 in Chrome
```

### 4 — Connect the Extension

Click the extension icon and fill in the popup:

| Field | Value |
|-------|-------|
| **Browser Name** | A short identifier, e.g. `my-mac` (used as `{browser_id}` in API calls) |
| **Server URL** | `ws://localhost:8000` |
| **API Token** | Paste the output of `ariadne-server token` |

Click **Apply & Reconnect** — the icon changes color to reflect connection state:

| Icon color | Meaning |
|------------|---------|
| Gray | No token configured |
| Amber | Connecting… |
| Green | Connected |
| Red | Disconnected or auth failed |

The **Apply & Reconnect** button is always clickable — use it any time to force a reconnect (e.g. after a network blip) without changing any settings.

### 5 — Send Your First Command

```bash
curl -s -X POST http://127.0.0.1:8000/v1/cmd/my-mac \
  -H "Authorization: Bearer $(ariadne-server token)" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "action": "read", "screenshot": false}'
```

---

## API Reference

### `POST /v1/cmd/{browser_id}`

Send a browsing command to the named browser.

**Request body:**

```json
{
  "url": "https://example.com",
  "action": "read",
  "screenshot": false,
  "selector": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | yes | URL to navigate to |
| `action` | `"read"` \| `"navigate"` \| `"highlight"` | yes | Operation type |
| `screenshot` | boolean | no | Include a JPEG screenshot in the response |
| `selector` | string | no | CSS selector — required when `action = "highlight"` |

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "markdown": "# Example Domain\n\nThis domain is...",
    "screenshot": "data:image/jpeg;base64,..."
  }
}
```

**Status codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 401 | Missing or invalid API token |
| 404 | Browser not connected |
| 504 | Command timed out (30 s) |

### Token Management

```bash
ariadne-server token    # print current token
ariadne-server rotate   # rotate to a new token (old one invalidated immediately)

# Rotate via API (requires Bearer auth)
curl -X POST http://127.0.0.1:8000/admin/token/rotate \
  -H "Authorization: Bearer <TOKEN>"
```

### `GET /health`

```bash
curl http://127.0.0.1:8000/health
# {"status": "ok"}
```

---

## Architecture

```
Ariadne/
├── packages/
│   ├── extension/              # Chrome Extension (WXT + React, MV3)
│   │   ├── entrypoints/
│   │   │   ├── background/     # Service Worker: WebSocket + command dispatch
│   │   │   └── popup/          # Connection status panel
│   │   └── lib/
│   │       ├── websocket.ts    # Heartbeat + exponential backoff reconnect
│   │       ├── tab-gate.ts     # Tab group isolation
│   │       ├── badge.ts        # Visual feedback
│   │       └── alarm.ts        # Service Worker keep-alive
│   │
│   └── server/                 # FastAPI Gateway
│       └── src/ariadne_server/
│           ├── cli.py          # ariadne-server CLI
│           ├── manager/
│           │   └── connection.py   # asyncio.Future bridge
│           └── router/
│               ├── cmd.py      # POST /v1/cmd/{browser_id}
│               ├── ws.py       # WebSocket /ws/{browser_id}
│               └── admin.py    # POST /admin/token/rotate
```

### How the asyncio.Future Bridge Works

```
POST /v1/cmd/{browser_id}
  → create Future, send command to Extension via WebSocket
  → await asyncio.wait_for(future, 30s)   ← suspended, non-blocking

Extension completes the operation
  → sends RESP_RESULT over WebSocket
  → future.set_result(response)           ← resumes
  → HTTP returns 200
```

### Service Worker Triple Keep-Alive

Chrome MV3 Service Workers can be terminated at any time. Ariadne uses three layers:

| Mechanism | Implementation | Interval |
|-----------|---------------|----------|
| Chrome Alarms | `chrome.alarms` (official API) | 30 s |
| WebSocket heartbeat | PING / PONG | 15 s |
| Exponential backoff reconnect | 1 s → 2 s → 4 s … 60 s | on disconnect |

---

## Logs

The server writes structured logs to `~/.ariadne/server.log` (5 MB rotating, 3 files kept):

```
2026-03-02 10:23:40 INFO  [log] Logging to /Users/you/.ariadne/server.log
2026-03-02 10:23:40 INFO  [main] Ariadne Gateway starting
2026-03-02 10:23:45 INFO  [connection] Client registered: my-mac
2026-03-02 10:24:01 INFO  [cmd] CMD_BROWSE dispatched: client=my-mac cmd_id=abc123 url=https://example.com
2026-03-02 10:24:03 INFO  [cmd] CMD_BROWSE ok: client=my-mac cmd_id=abc123 elapsed=2.14s
```

```bash
tail -f ~/.ariadne/server.log          # real-time
grep -E "ERROR|WARN" ~/.ariadne/server.log  # errors only
```

---

## Configuration

Server settings via environment variables (prefix `ARIADNE_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `ARIADNE_HOST` | `127.0.0.1` | Bind address |
| `ARIADNE_PORT` | `8000` | Bind port |
| `ARIADNE_COMMAND_TIMEOUT` | `30` | Command timeout in seconds |
| `ARIADNE_LOG_LEVEL` | `info` | Log level |
| `ARIADNE_API_KEY` | _(from file)_ | Override token (not written to disk) |

---

## Development

```bash
# Run server tests
cd packages/server && uv run pytest -v

# Extension dev mode (hot-reload)
pnpm dev

# Build extension for distribution
pnpm build
```

### Releases

Pushing a `v*` tag triggers a GitHub Actions release that builds and attaches:
- `ariadne-extension-*-chrome.zip` — load unpacked in Chrome
- `ariadne_server-*.whl` — install with uv

```bash
git tag v0.1.0 && git push origin v0.1.0
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension framework | [WXT](https://wxt.dev/) 0.20 + React 19 |
| Content extraction | [@mozilla/readability](https://github.com/mozilla/readability) + [Turndown](https://github.com/mixmark-io/turndown) |
| Gateway server | [FastAPI](https://fastapi.tiangolo.com/) 0.115 + uvicorn |
| Validation | [Pydantic](https://docs.pydantic.dev/) v2 + pydantic-settings |
| Python packaging | [uv](https://docs.astral.sh/uv/) |
| JS packaging | pnpm 9 (monorepo) |
| Testing | pytest + pytest-asyncio |

---

## License

MIT
