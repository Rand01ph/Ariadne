// Protocol types for Ariadne Extension <-> Server communication

export type CommandType = "CMD_BROWSE";
export type ResponseType = "RESP_RESULT";
export type PingType = "PING";
export type PongType = "PONG";

export interface BrowsePayload {
  url: string;
  action: "read" | "screenshot" | "highlight";
  screenshot: boolean;
  selector?: string;
}

export interface Command {
  cmd_id: string;
  type: CommandType;
  payload: BrowsePayload;
}

export interface BrowseResultData {
  title?: string;
  markdown?: string;
  screenshot?: string; // base64 data URL
  url: string;
}

export interface Response {
  cmd_id: string;
  type: ResponseType;
  success: boolean;
  data?: BrowseResultData;
  error?: string;
}

export interface PingMessage {
  type: PingType;
}

export interface PongMessage {
  type: PongType;
}

// Messages between background and content scripts
export interface ContentScriptReadMessage {
  type: "CONTENT_READ";
  url: string;
  action: BrowsePayload["action"];
  selector?: string;
}

export interface ContentScriptReadResult {
  type: "CONTENT_READ_RESULT";
  title?: string;
  markdown?: string;
  url: string;
}

export interface CaptureScreenshotMessage {
  type: "CAPTURE_SCREENSHOT";
  tabId: number;
}

export interface CaptureScreenshotResult {
  type: "CAPTURE_SCREENSHOT_RESULT";
  dataUrl: string;
}

export type BackgroundMessage =
  | ContentScriptReadMessage
  | CaptureScreenshotMessage;

export type BackgroundMessageResult =
  | ContentScriptReadResult
  | CaptureScreenshotResult;
