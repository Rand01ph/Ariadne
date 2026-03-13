# Ariadne — AI Agent Setup Guide

This guide is written for AI agents (Claude, GPT, etc.) to autonomously install
and configure the Ariadne Gateway, then hand the user a ready-to-use API token.

---

## What Ariadne Does

Ariadne is a bridge between you (an AI agent) and the user's local Chrome browser.
Once set up, you can instruct the browser to navigate to URLs, read page content as
Markdown, and take screenshots — all via a simple HTTP API.

Human stays in control: every operation runs inside a visible "🤖 Ariadne Agent" tab
group that the user can monitor or close at any time.

---

## Prerequisites

Check these before starting:

```bash
python --version      # must be 3.12+
uv --version          # must be installed  →  pip install uv
```

If `uv` is missing:
```bash
pip install uv
# or on macOS/Linux:
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## Step 1 — Install the Server

**Option A — From GitHub Release (recommended, no git clone needed):**

```bash
# Find the latest release wheel URL from:
# https://github.com/Rand01ph/Ariadne/releases/latest
# Then install:
uv tool install https://github.com/Rand01ph/Ariadne/releases/latest/download/ariadne_server-0.3.0-py3-none-any.whl
```

**Option B — From source (if you have the repo cloned):**

```bash
cd packages/server
uv sync
```

---

## Step 2 — Start the Server

**If installed via `uv tool install` (Option A):**

```bash
ariadne-server
```

**If installed from source (Option B):**

```bash
cd packages/server
uv run ariadne-server
```

On first run, the server auto-generates a secure token and writes it to
`packages/server/.ariadne.key`.  The startup log will show a masked preview:

```
2026-03-02 10:23:40 INFO  [log] Logging to /Users/you/.ariadne/server.log
2026-03-02 10:23:40 INFO  [main] Ariadne Gateway starting
2026-03-02 10:23:40 INFO  [main] API Key: ariadne_sk_4f8a2c...[hidden]
2026-03-02 10:23:40 INFO  [main] Full key written to .ariadne.key
```

All logs are also written to `~/.ariadne/server.log`. If startup fails or the
server behaves unexpectedly, read this file first:

```bash
cat ~/.ariadne/server.log
```

The server listens on `http://127.0.0.1:8000` by default.

---

## Step 3 — Retrieve the Token

```bash
ariadne-server token
```

_(If from source: `uv run ariadne-server token`)_

**Output example:**
```
ariadne_sk_4f8a2c1e9b3d7f0a5c8e2b6d4a1f9e7c3b0d8a6f4c2e0b8d6a4f2c0e8b6d4a2f0
```

**Important:** Show this token to the user and ask them to paste it into the
Chrome extension popup → "API Token" field, then click "Apply & Reconnect".

The extension icon reflects connection state:

| Icon color | Meaning |
|------------|---------|
| Gray | No token configured |
| Amber | Connecting… |
| Green | Connected — ready to use |
| Red | Disconnected or auth failed |

The **Apply & Reconnect** button can be clicked at any time, even with unchanged
settings — useful for forcing a reconnect after a network interruption.

---

## Step 4 — Rotate the Token (Optional)

```bash
ariadne-server rotate
```

_(If from source: `uv run ariadne-server rotate`)_

The old token is immediately invalidated. Update the extension popup right away.

---

## Step 5 — Verify the Server is Running

```bash
curl http://127.0.0.1:8000/health
```

Expected response:
```json
{"status": "ok"}
```

---

## Step 6 — Get the User's Browser Name

Ask the user what "Browser Name" they configured in the extension popup
(default: `my-browser`).  All API calls use this name as the `{browser_id}`.

---

## API Reference

### Browse a URL and Read Content

```bash
curl -s -X POST http://127.0.0.1:8000/v1/cmd/{browser_id} \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "action": "read",
    "screenshot": false
  }'
```

**Request fields:**

| Field        | Type    | Required | Description                                  |
|--------------|---------|----------|----------------------------------------------|
| `url`        | string  | yes      | Full URL to navigate to                      |
| `action`     | string  | yes      | `"read"` · `"highlight"` · `"navigate"`      |
| `screenshot` | boolean | no       | `true` to include a JPEG screenshot in response |
| `selector`   | string  | no       | CSS selector — required when `action="highlight"` |

**Response (success):**

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "markdown": "# Example Domain\n\nThis domain is ...",
    "screenshot": "data:image/jpeg;base64,..."
  }
}
```

**Response (error):**

```json
{
  "success": false,
  "error": "Tab load timeout after 30s"
}
```

### Actions Explained

- **`read`** — Navigate to the URL, extract full page text as Markdown, return it.
- **`navigate`** — Navigate to the URL only; no content extraction.
- **`highlight`** — Navigate, then draw a red outline on the CSS-selector element
  and scroll it into view. Useful for pointing the user's attention somewhere.

### Ping Browser (Check Connection)

Use the `ping` command to verify the extension is connected and retrieve basic environment details. This is the recommended way to test the connection.

```bash
curl -s -X POST http://127.0.0.1:8000/v1/ping/{browser_id} \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "ping"}'
```

**Response (success):**

```json
{
  "cmd_id": "uuid-here",
  "data": {
    "browserVersion": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
    "tabCount": 14
  }
}
```

### Rotate Token via API

```bash
curl -s -X POST http://127.0.0.1:8000/admin/token/rotate \
  -H "Authorization: Bearer <TOKEN>"
```

Returns `{"token": "<NEW_TOKEN>", "message": "..."}`.

---

## Troubleshooting

**First step for any issue — check the log file:**

```bash
cat ~/.ariadne/server.log
# or for real-time tailing:
tail -f ~/.ariadne/server.log
```

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` | Wrong or missing token | Re-run `ariadne-server token`, update extension |
| `404 Client not connected` | Extension not connected to server | Open extension popup, check icon color |
| `504 Gateway Timeout` | Browser took > 30 s or extension offline | Check tab group, reload extension |
| Extension icon is red | Disconnected or auth failed | Click **Apply & Reconnect** in popup |
| Extension icon is gray | No token set | Paste token in popup → Apply & Reconnect |
| Extension shows "Auth failed" | Token mismatch | Re-run `ariadne-server token`, paste into extension |
| Extension shows "Disconnected" | Server not running | Run `ariadne-server` |

---

## Server Configuration (Environment Variables)

| Variable          | Default       | Description             |
|-------------------|---------------|-------------------------|
| `ARIADNE_HOST`    | `127.0.0.1`   | Bind address            |
| `ARIADNE_PORT`    | `8000`        | Bind port               |
| `ARIADNE_API_KEY` | _(from file)_ | Override token (no file write) |
| `ARIADNE_LOG_LEVEL` | `info`      | Uvicorn log level       |

---

## Conversation Flow Template

When helping a user set up Ariadne, follow this sequence:

1. Run Steps 1–3 above.
2. Show the user the token and say:
   > "Please open the Ariadne extension popup in Chrome, paste this token into the
   > **API Token** field, and click **Apply & Reconnect**. Let me know when the
   > extension icon turns green."
3. Once the user confirms the extension is connected, ask:
   > "What is your Browser Name in the extension popup? (Default is `my-browser`)"
4. Confirm you can reach the browser using the `ping` command:
   ```bash
   curl -s -X POST http://127.0.0.1:8000/v1/ping/{browser_id} \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"action": "ping"}'
   ```
5. If the response contains `"browserVersion"`, setup is complete.
