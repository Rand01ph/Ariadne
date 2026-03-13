# Ariadne

> 命名灵感来自希腊神话——阿里阿德涅的线团引导忒修斯走出迷宫。

**Ariadne** 是一个安全桥梁，连接远程 AI Agent 与你的本地浏览器。AI 负责决策，你的浏览器执行操作，一切尽在掌控。

**[English →](README.md)**

```
AI Agent  ──POST /v1/cmd──▶  Ariadne Server  ──WebSocket──▶  Chrome Extension  ──▶  Browser
                                    ◀──────────── RESP_RESULT ◀──────────────────────
```

---

## 与 OpenClaw 完美配合

Ariadne 是 [OpenClaw](https://github.com/openclaw/openclaw)（开源本地 AI Agent）的天然搭档。OpenClaw 负责调度任务，Ariadne 则赋予它在本地 Chrome 浏览器中的"眼睛"和"双手"——包括云端 Agent 永远无法访问的页面。

| 场景 | 为什么 Ariadne + OpenClaw 能解决 |
|------|--------------------------------|
| **内网 & VPN 隔离的站点** | 两者都在本地运行，OpenClaw 可读取公司 Wiki、Jira、Confluence 等内部系统，无需暴露到云端 |
| **需要登录的页面** | 浏览器已经处于登录状态，Ariadne 直接复用现有 Session，无需传递任何密码 |
| **可视化 Agent 行为** | Agent 访问的每个页面都出现在独立的「🤖 Ariadne Agent」标签组中，全程可见、可随时干预 |
| **截图反馈** | 每次命令可附带 JPEG 截图，让 LLM 获得页面的视觉确认 |

**与 OpenClaw 配合的快速接入：**

```bash
# 1 — 启动 Ariadne
ariadne-server &

# 2 — 加载 Chrome 扩展，粘贴 Token，图标变绿

# 3 — 让 OpenClaw 通过 Ariadne 访问页面
curl -s -X POST http://127.0.0.1:8000/v1/cmd/my-browser \
  -H "Authorization: Bearer $(ariadne-server token)" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://internal.corp/wiki", "action": "read"}'
```

响应中的 Markdown 内容可直接交给 OpenClaw 进行摘要、提取或后续操作。

---

## 核心哲学：Human-in-the-Control

所有浏览操作都发生在独立的 **"🤖 Ariadne Agent" 标签组**中，可见、可审计、可随时中断。AI 从不隐藏它在做什么。

---

## 快速开始

### 环境依赖

- Python 3.12+，[uv](https://docs.astral.sh/uv/)
- Node.js 22+，pnpm 9+
- Chrome 116+

### 1 — 安装网关服务

**从 GitHub Release 安装（推荐）：**

```bash
uv tool install https://github.com/Rand01ph/Ariadne/releases/latest/download/ariadne_server-0.3.0-py3-none-any.whl
```

**从源码安装：**

```bash
cd packages/server && uv sync
```

### 2 — 启动服务

```bash
ariadne-server
# 监听 http://127.0.0.1:8000
```

首次启动会自动生成 Token，保存到 `packages/server/.ariadne.key`。日志中显示脱敏预览，用以下命令获取完整 Token：

```bash
ariadne-server token
```

### 3 — 加载 Chrome 扩展

**从 GitHub Release：**
1. 在 [最新 Release](https://github.com/Rand01ph/Ariadne/releases/latest) 下载 `ariadne-extension-*-chrome.zip`
2. 解压
3. 打开 `chrome://extensions/` → 开启**开发者模式** → **加载已解压的扩展** → 选择解压后的文件夹

**从源码（开发模式，支持热重载）：**

```bash
pnpm install
pnpm dev
# 然后在 Chrome 加载 packages/extension/.output/chrome-mv3
```

### 4 — 连接扩展

点击扩展图标，在 Popup 中填写：

| 字段 | 填写内容 |
|------|---------|
| **Browser Name** | 自定义标识符，如 `my-mac`（即 API 调用中的 `{browser_id}`） |
| **Server URL** | `ws://localhost:8000` |
| **API Token** | 粘贴 `ariadne-server token` 的输出内容 |

点击 **Apply & Reconnect**，图标颜色反映连接状态：

| 图标颜色 | 含义 |
|----------|------|
| 灰色 | 未配置 Token |
| 琥珀色 | 连接中… |
| 绿色 | 已连接 |
| 红色 | 断线或认证失败 |

**Apply & Reconnect 按钮随时可点击** — 网络短暂中断恢复后，无需修改任何配置，直接点击即可强制重连。

### 5 — 发送第一条命令

```bash
curl -s -X POST http://127.0.0.1:8000/v1/cmd/my-mac \
  -H "Authorization: Bearer $(ariadne-server token)" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "action": "read", "screenshot": false}'
```

---

## API 参考

### `POST /v1/cmd/{browser_id}`

向指定浏览器发送操作命令。`browser_id` 即扩展 Popup 中设置的 **Browser Name**。

**请求体：**

```json
{
  "url": "https://example.com",
  "action": "read",
  "screenshot": false,
  "selector": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 要访问的页面 URL |
| `action` | `"read"` \| `"navigate"` \| `"highlight"` | 是 | 操作类型 |
| `screenshot` | boolean | 否 | 是否在响应中附带 JPEG 截图 |
| `selector` | string | 否 | CSS 选择器（`action = "highlight"` 时高亮对应元素） |

**响应：**

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

**HTTP 状态码：**

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 401 | Token 缺失或无效 |
| 404 | 浏览器未连接 |
| 504 | 命令超时（30 秒） |

### Token 管理

```bash
ariadne-server token    # 打印当前完整 Token
ariadne-server rotate   # 轮换 Token（旧 Token 立即失效）

# 通过 API 轮换（需要 Bearer 认证）
curl -X POST http://127.0.0.1:8000/admin/token/rotate \
  -H "Authorization: Bearer <TOKEN>"
```

### `GET /health`

```bash
curl http://127.0.0.1:8000/health
# {"status": "ok"}
```

---

## 架构

```
Ariadne/
├── packages/
│   ├── extension/              # Chrome 扩展 (WXT + React, MV3)
│   │   ├── entrypoints/
│   │   │   ├── background/     # Service Worker：WebSocket + 命令调度
│   │   │   └── popup/          # 连接状态面板
│   │   └── lib/
│   │       ├── websocket.ts    # 心跳 + 指数退避重连
│   │       ├── tab-gate.ts     # 标签组隔离
│   │       ├── badge.ts        # 视觉反馈
│   │       └── alarm.ts        # SW 保活
│   │
│   └── server/                 # FastAPI 网关
│       └── src/ariadne_server/
│           ├── cli.py          # ariadne-server CLI
│           ├── manager/
│           │   └── connection.py   # asyncio.Future 桥接核心
│           └── router/
│               ├── cmd.py      # POST /v1/cmd/{browser_id}
│               ├── ws.py       # WebSocket /ws/{browser_id}
│               └── admin.py    # POST /admin/token/rotate
```

### asyncio.Future 桥接原理

```
POST /v1/cmd/{browser_id}
  → 创建 Future，通过 WebSocket 发送命令给 Extension
  → await asyncio.wait_for(future, 30s)   ← 挂起，不阻塞事件循环

Extension 完成操作
  → 通过 WebSocket 发送 RESP_RESULT
  → future.set_result(response)           ← 唤醒
  → HTTP 返回 200
```

### Service Worker 三重保活

Chrome MV3 Service Worker 会被浏览器随时终止，Ariadne 通过三层机制保持连接：

| 机制 | 实现 | 间隔 |
|------|------|------|
| Chrome Alarms | `chrome.alarms`（官方 API） | 30 秒 |
| WebSocket 心跳 | PING / PONG | 15 秒 |
| 指数退避重连 | 1s → 2s → 4s … 60s | 断线后自动 |

---

## 日志

服务端将结构化日志写入 `~/.ariadne/server.log`（单文件 5 MB，保留 3 个轮转文件）：

```
2026-03-02 10:23:40 INFO  [log] Logging to /Users/you/.ariadne/server.log
2026-03-02 10:23:40 INFO  [main] Ariadne Gateway starting
2026-03-02 10:23:45 INFO  [connection] Client registered: my-mac
2026-03-02 10:24:01 INFO  [cmd] CMD_BROWSE dispatched: client=my-mac cmd_id=abc123 url=https://example.com
2026-03-02 10:24:03 INFO  [cmd] CMD_BROWSE ok: client=my-mac cmd_id=abc123 elapsed=2.14s
```

```bash
tail -f ~/.ariadne/server.log                # 实时跟踪
grep -E "ERROR|WARN" ~/.ariadne/server.log   # 只看错误
```

---

## 配置

通过 `ARIADNE_` 前缀的环境变量覆盖默认配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ARIADNE_HOST` | `127.0.0.1` | 绑定地址 |
| `ARIADNE_PORT` | `8000` | 监听端口 |
| `ARIADNE_COMMAND_TIMEOUT` | `30` | 命令超时（秒） |
| `ARIADNE_LOG_LEVEL` | `info` | 日志级别 |
| `ARIADNE_API_KEY` | （来自文件） | 覆盖 Token（不写入磁盘） |

---

## 开发

```bash
# 运行 Server 测试
cd packages/server && uv run pytest -v

# 扩展开发模式（热重载）
pnpm dev

# 扩展生产构建
pnpm build
```

### 发布

推送 `v*` tag 自动触发 GitHub Actions，构建并附加到 Release：
- `ariadne-extension-*-chrome.zip` — Chrome 加载已解压扩展
- `ariadne_server-*.whl` — uv 安装服务端

```bash
git tag v0.3.0 && git push origin v0.3.0
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 扩展框架 | [WXT](https://wxt.dev/) 0.20 + React 19 |
| 内容提取 | [@mozilla/readability](https://github.com/mozilla/readability) + [Turndown](https://github.com/mixmark-io/turndown) |
| 网关服务 | [FastAPI](https://fastapi.tiangolo.com/) 0.115 + uvicorn |
| 数据校验 | [Pydantic](https://docs.pydantic.dev/) v2 + pydantic-settings |
| Python 包管理 | [uv](https://docs.astral.sh/uv/) |
| JS 包管理 | pnpm 9（monorepo） |
| 测试 | pytest + pytest-asyncio |

---

## License

MIT
