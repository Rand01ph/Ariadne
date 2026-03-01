# ariadne-server

Ariadne 网关服务——通过 asyncio.Future 桥接 HTTP 命令与 WebSocket 浏览器连接。

详细文档请参阅项目根目录 [README.md](../../README.md)。

## 快速启动

```bash
uv sync
uv run fastapi dev src/ariadne_server/main.py
```

## 测试

```bash
uv sync --extra dev
uv run pytest -v
```
