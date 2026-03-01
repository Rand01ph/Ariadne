// Ariadne Extension Constants

export const WS_PING_INTERVAL = 15_000; // 15 seconds
export const WS_RECONNECT_BASE = 1_000; // 1 second initial backoff
export const WS_RECONNECT_MAX = 60_000; // 60 second max backoff
export const WS_RECONNECT_MULTIPLIER = 2;

export const ALARM_NAME = "ariadne-keepalive";
export const ALARM_PERIOD_MINUTES = 0.5; // 30 seconds

export const GROUP_NAME = "🤖 Ariadne Agent";
export const GROUP_COLOR_IDLE: chrome.tabGroups.ColorEnum = "blue";
export const GROUP_COLOR_ACTIVE: chrome.tabGroups.ColorEnum = "yellow";

export const BADGE_TEXT = "AI";
export const BADGE_COLOR_ACTIVE = "#F59E0B"; // amber
export const BADGE_COLOR_ERROR = "#EF4444"; // red

export const STORAGE_KEY_SERVER_URL = "ariadne_server_url";
export const STORAGE_KEY_CONNECTION_STATUS = "ariadne_connection_status";
export const STORAGE_KEY_GROUP_ID = "ariadne_group_id";
export const STORAGE_KEY_CLIENT_NAME = "ariadne_client_name";
export const STORAGE_KEY_TOKEN = "ariadne_token";

export const DEFAULT_SERVER_URL = "ws://localhost:8000";
export const DEFAULT_CLIENT_NAME = "my-browser";

export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error";
