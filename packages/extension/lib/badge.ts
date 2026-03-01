import {
  BADGE_TEXT,
  BADGE_COLOR_ACTIVE,
  BADGE_COLOR_ERROR,
  GROUP_COLOR_ACTIVE,
  GROUP_COLOR_IDLE,
} from "@/constants";

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
