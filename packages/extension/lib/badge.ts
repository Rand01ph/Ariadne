import {
  BADGE_TEXT,
  BADGE_COLOR_ACTIVE,
  BADGE_COLOR_ERROR,
  GROUP_COLOR_ACTIVE,
  GROUP_COLOR_IDLE,
  type ConnectionStatus,
} from "@/constants";

const ICON_COLORS: Record<ConnectionStatus, string> = {
  connected:    "#22c55e",
  connecting:   "#f59e0b",
  disconnected: "#ef4444",
  error:        "#ef4444",
};
const ICON_COLOR_UNCONFIGURED = "#6b7280";

function makeIconImageData(color: string, size: number): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  const r = size / 2 - 1;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

export function setConnectionIcon(status: ConnectionStatus, hasToken: boolean): void {
  const color = hasToken ? ICON_COLORS[status] : ICON_COLOR_UNCONFIGURED;
  chrome.action.setIcon({
    imageData: {
      16:  makeIconImageData(color, 16),
      32:  makeIconImageData(color, 32),
      48:  makeIconImageData(color, 48),
      128: makeIconImageData(color, 128),
    },
  });
}

/**
 * Set the browser action badge to indicate active AI operation.
 */
export function setBadgeActive(tabId?: number): void {
  chrome.action.setBadgeText({ text: BADGE_TEXT, tabId });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_ACTIVE, tabId });
}

/**
 * Clear the browser action badge.
 */
export function clearBadge(tabId?: number): void {
  chrome.action.setBadgeText({ text: "", tabId });
}

/**
 * Set badge to error state.
 */
export function setBadgeError(tabId?: number): void {
  chrome.action.setBadgeText({ text: "!", tabId });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_ERROR, tabId });
}

/**
 * Update the tab group color to indicate active operation.
 */
export async function setGroupColorActive(groupId: number): Promise<void> {
  try {
    await chrome.tabGroups.update(groupId, { color: GROUP_COLOR_ACTIVE });
  } catch {
    // Group may have been removed
  }
}

/**
 * Reset the tab group color to idle state.
 */
export async function setGroupColorIdle(groupId: number): Promise<void> {
  try {
    await chrome.tabGroups.update(groupId, { color: GROUP_COLOR_IDLE });
  } catch {
    // Group may have been removed
  }
}
