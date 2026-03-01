import {
  WS_PING_INTERVAL,
  WS_RECONNECT_BASE,
  WS_RECONNECT_MAX,
  WS_RECONNECT_MULTIPLIER,
  DEFAULT_SERVER_URL,
  DEFAULT_CLIENT_NAME,
  STORAGE_KEY_SERVER_URL,
  STORAGE_KEY_CLIENT_NAME,
  STORAGE_KEY_TOKEN,
  STORAGE_KEY_CONNECTION_STATUS,
  type ConnectionStatus,
} from "@/constants";
import type { Command, Response } from "@/types/protocol";

type MessageHandler = (message: Command) => void;

class AriadneWebSocket {
  private ws: WebSocket | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = WS_RECONNECT_BASE;
  private messageHandler: MessageHandler | null = null;
  private destroyed = false;
  private authFailed = false;   // stops auto-reconnect on bad token
  private clientId: string;
  private serverUrl: string;
  private token: string;

  constructor(clientId: string, serverUrl: string, token: string) {
    this.clientId = clientId;
    this.serverUrl = serverUrl;
    this.token = token;
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;
    this.clearReconnectTimeout();
    this.authFailed = false;
    await this.setStatus("connecting");

    const url = `${this.serverUrl}/ws/${this.clientId}`;
    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error("[Ariadne WS] Failed to create WebSocket:", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (this.destroyed) { this.ws?.close(); return; }
      // Send AUTH as first message — do NOT mark connected yet
      this.ws!.send(JSON.stringify({ type: "AUTH", token: this.token }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.type === "AUTH_OK") {
          console.log("[Ariadne WS] Authenticated, connected to", url);
          this.reconnectDelay = WS_RECONNECT_BASE;
          this.setStatus("connected");
          this.startPing();
          return;
        }

        if (data.type === "AUTH_FAIL") {
          console.error("[Ariadne WS] Auth failed — check your token in the popup");
          this.authFailed = true;
          this.setStatus("error");
          // ws.onclose will fire next; authFailed flag prevents reconnect
          return;
        }

        if (data.type === "PONG") return;

        if (this.messageHandler) {
          this.messageHandler(data as Command);
        }
      } catch (err) {
        console.error("[Ariadne WS] Failed to parse message:", err);
      }
    };

    this.ws.onerror = (event) => {
      console.error("[Ariadne WS] Error:", event);
    };

    this.ws.onclose = (event) => {
      console.log("[Ariadne WS] Closed:", event.code, event.reason);
      this.stopPing();
      if (!this.destroyed && !this.authFailed) {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      }
    };
  }

  sendResponse(response: Response): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    } else {
      console.warn("[Ariadne WS] Cannot send response: WebSocket not open");
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  destroy(): void {
    this.destroyed = true;
    this.clearReconnectTimeout();
    this.stopPing();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  async updateServerUrl(newUrl: string): Promise<void> {
    if (newUrl === this.serverUrl) return;
    this.serverUrl = newUrl;
    await chrome.storage.local.set({ [STORAGE_KEY_SERVER_URL]: newUrl });
    this.destroy();
    this.destroyed = false;
    await this.connect();
  }

  async updateClientName(newName: string): Promise<void> {
    if (newName === this.clientId) return;
    this.clientId = newName;
    await chrome.storage.local.set({ [STORAGE_KEY_CLIENT_NAME]: newName });
    this.destroy();
    this.destroyed = false;
    await this.connect();
  }

  async updateToken(newToken: string): Promise<void> {
    if (newToken === this.token) return;
    this.token = newToken;
    await chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: newToken });
    this.destroy();
    this.destroyed = false;
    await this.connect();
  }

  getClientName(): string {
    return this.clientId;
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "PING" }));
      }
    }, WS_PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.authFailed) return;
    const delay = this.reconnectDelay;
    console.log(`[Ariadne WS] Reconnecting in ${delay}ms`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
    this.reconnectDelay = Math.min(
      delay * WS_RECONNECT_MULTIPLIER,
      WS_RECONNECT_MAX,
    );
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private async setStatus(status: ConnectionStatus): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY_CONNECTION_STATUS]: status });
  }
}

// Singleton instance
let instance: AriadneWebSocket | null = null;

export async function getWebSocket(): Promise<AriadneWebSocket> {
  if (!instance) {
    const stored = await chrome.storage.local.get([
      STORAGE_KEY_SERVER_URL,
      STORAGE_KEY_CLIENT_NAME,
      STORAGE_KEY_TOKEN,
    ]);
    const serverUrl = stored[STORAGE_KEY_SERVER_URL] ?? DEFAULT_SERVER_URL;
    const clientId = stored[STORAGE_KEY_CLIENT_NAME] ?? DEFAULT_CLIENT_NAME;
    const token = stored[STORAGE_KEY_TOKEN] ?? "";
    instance = new AriadneWebSocket(clientId, serverUrl, token);
  }
  return instance;
}

export function destroyWebSocket(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

export { AriadneWebSocket };
