import { ALARM_NAME, STORAGE_KEY_SERVER_URL, STORAGE_KEY_CLIENT_NAME, STORAGE_KEY_TOKEN, DEFAULT_SERVER_URL, DEFAULT_CLIENT_NAME } from "@/constants";
import { registerAlarm } from "@/lib/alarm";
import { getWebSocket } from "@/lib/websocket";
import {
  ensureAriadneGroup,
  moveTabToAriadneGroup,
} from "@/lib/tab-gate";
import {
  setBadgeActive,
  clearBadge,
  setBadgeError,
  setGroupColorActive,
  setGroupColorIdle,
  setConnectionIcon,
} from "@/lib/badge";
import type { Command, Response, ContentScriptReadResult } from "@/types/protocol";

async function init(): Promise<void> {
  await registerAlarm();

  // Set initial icon based on stored status + token
  const stored = await chrome.storage.local.get(["ariadne_connection_status", "ariadne_token"]);
  setConnectionIcon(stored.ariadne_connection_status ?? "disconnected", !!stored.ariadne_token);

  const ws = await getWebSocket();
  ws.setMessageHandler(handleCommand);
  if (!ws.isConnected()) {
    await ws.connect();
  }
}

async function handleCommand(command: Command): Promise<void> {
  if (command.type === "CMD_BROWSE") {
    await handleBrowse(command);
  }
}

async function handleBrowse(command: Command): Promise<void> {
  const { url, action, screenshot: wantScreenshot, selector } = command.payload;
  const ws = await getWebSocket();

  let tab: chrome.tabs.Tab | null = null;
  let groupId: number | null = null;

  try {
    groupId = await ensureAriadneGroup();
    setGroupColorActive(groupId);

    const existingTabs = await chrome.tabs.query({ groupId });
    if (existingTabs.length > 0 && existingTabs[0].id) {
      tab = existingTabs[0];
      await chrome.tabs.update(tab.id!, { url, active: false });
    } else {
      tab = await chrome.tabs.create({ url, active: false });
      await moveTabToAriadneGroup(tab.id!);
    }

    setBadgeActive(tab.id);
    await waitForTabComplete(tab.id!);
    tab = await chrome.tabs.get(tab.id!);

    let contentResult: ContentScriptReadResult | null = null;
    let screenshotDataUrl: string | undefined;

    if (action === "read" || action === "highlight") {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: contentScriptMain,
        args: [action, selector ?? null],
      });
      contentResult = results[0]?.result as ContentScriptReadResult ?? null;
    }

    if (wantScreenshot) {
      try {
        const tabInfo = await chrome.tabs.get(tab.id!);
        screenshotDataUrl = await chrome.tabs.captureVisibleTab(tabInfo.windowId, {
          format: "jpeg",
          quality: 80,
        });
      } catch (err) {
        console.warn("[Ariadne BG] Screenshot failed:", err);
      }
    }

    const response: Response = {
      cmd_id: command.cmd_id,
      type: "RESP_RESULT",
      success: true,
      data: {
        title: contentResult?.title ?? tab.title,
        markdown: contentResult?.markdown,
        screenshot: screenshotDataUrl,
        url: tab.url ?? url,
      },
    };

    ws.sendResponse(response);
    clearBadge(tab.id);
    if (groupId !== null) setGroupColorIdle(groupId);
  } catch (err) {
    console.error("[Ariadne BG] CMD_BROWSE error:", err);
    if (tab?.id) setBadgeError(tab.id);

    const errResponse: Response = {
      cmd_id: command.cmd_id,
      type: "RESP_RESULT",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
    ws.sendResponse(errResponse);
    if (groupId !== null) setGroupColorIdle(groupId);
  }
}

function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout after 30s"));
    }, 30_000);

    function listener(
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

/**
 * Injected into page via chrome.scripting.executeScript — no imports allowed.
 */
function contentScriptMain(
  action: string,
  selector: string | null
): { type: string; title?: string; markdown?: string; url: string } {
  if (action === "highlight" && selector) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      el.style.outline = "3px solid red";
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  return {
    type: "CONTENT_READ_RESULT",
    title: document.title,
    markdown: document.body?.innerText?.slice(0, 50000) ?? "",
    url: location.href,
  };
}

export default defineBackground({
  type: "module",
  main() {
    console.log("[Ariadne BG] Service Worker started");

    // Update icon whenever connection status or token changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!("ariadne_connection_status" in changes) && !("ariadne_token" in changes)) return;
      chrome.storage.local.get(["ariadne_connection_status", "ariadne_token"]).then((stored) => {
        setConnectionIcon(stored.ariadne_connection_status ?? "disconnected", !!stored.ariadne_token);
      });
    });

    // Keep-alive alarm (synchronous registration required for MV3)
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME) {
        getWebSocket().then((ws) => {
          if (!ws.isConnected()) ws.connect();
        });
      }
    });

    // Handle messages from popup
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_STATUS") {
        chrome.storage.local
          .get(["ariadne_connection_status", "ariadne_server_url", "ariadne_client_name", "ariadne_token"])
          .then((data) => {
            const token: string = data.ariadne_token ?? "";
            sendResponse({
              status: data.ariadne_connection_status ?? "disconnected",
              serverUrl: data.ariadne_server_url ?? DEFAULT_SERVER_URL,
              clientName: data.ariadne_client_name ?? DEFAULT_CLIENT_NAME,
              // Return masked token so popup can show hint without exposing full value
              tokenHint: token ? token.slice(0, 20) + "...[hidden]" : "",
            });
          });
        return true;
      }

      if (message.type === "RECONNECT") {
        getWebSocket().then((ws) => {
          ws.reconnect().then(() => sendResponse({ ok: true }));
        });
        return true;
      }

      if (message.type === "SET_SERVER_URL") {
        const newUrl: string = message.url;
        chrome.storage.local.set({ [STORAGE_KEY_SERVER_URL]: newUrl }).then(() => {
          getWebSocket().then((ws) => {
            ws.updateServerUrl(newUrl).then(() => sendResponse({ ok: true }));
          });
        });
        return true;
      }

      if (message.type === "SET_CLIENT_NAME") {
        const newName: string = message.name;
        chrome.storage.local.set({ [STORAGE_KEY_CLIENT_NAME]: newName }).then(() => {
          getWebSocket().then((ws) => {
            ws.updateClientName(newName).then(() => sendResponse({ ok: true }));
          });
        });
        return true;
      }

      if (message.type === "SET_TOKEN") {
        const newToken: string = message.token;
        chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: newToken }).then(() => {
          getWebSocket().then((ws) => {
            ws.updateToken(newToken).then(() => sendResponse({ ok: true }));
          });
        });
        return true;
      }

      return false;
    });

    // Initialize WebSocket connection
    init().catch(console.error);
  },
});
