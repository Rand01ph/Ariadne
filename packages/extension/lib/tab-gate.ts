import {
  GROUP_NAME,
  GROUP_COLOR_IDLE,
  STORAGE_KEY_GROUP_ID,
} from "@/constants";

/**
 * Get the cached Ariadne tab group ID from storage.
 */
async function getCachedGroupId(): Promise<number | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY_GROUP_ID);
  return result[STORAGE_KEY_GROUP_ID] ?? null;
}

/**
 * Save the Ariadne tab group ID to storage.
 */
async function saveGroupId(groupId: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_GROUP_ID]: groupId });
}

/**
 * Find the existing Ariadne tab group in any window.
 */
async function findAriadneGroup(): Promise<chrome.tabGroups.TabGroup | null> {
  const cachedId = await getCachedGroupId();
  if (cachedId !== null) {
    try {
      const group = await chrome.tabGroups.get(cachedId);
      return group;
    } catch {
      // Group no longer exists, clear cache
      await chrome.storage.local.remove(STORAGE_KEY_GROUP_ID);
    }
  }

  // Fallback: search all groups by title
  const groups = await chrome.tabGroups.query({ title: GROUP_NAME });
  if (groups.length > 0) {
    await saveGroupId(groups[0].id);
    return groups[0];
  }
  return null;
}

/**
 * Get the Ariadne tab group ID, creating it if it doesn't exist.
 * Returns the group ID.
 */
export async function ensureAriadneGroup(): Promise<number> {
  const existing = await findAriadneGroup();
  if (existing) {
    return existing.id;
  }

  // Create a new tab in a new group
  let tabId: number;
  try {
    const tab = await chrome.tabs.create({ url: "about:blank", active: false });
    tabId = tab.id!;
  } catch (error) {
    // Fallback: no windows open (macOS specific behavior)
    const win = await chrome.windows.create({ url: "about:blank" });
    if (win.tabs && win.tabs.length > 0) {
      tabId = win.tabs[0].id!;
    } else {
      // If tabs are not populated in the window object immediately
      const tabs = await chrome.tabs.query({ windowId: win.id });
      tabId = tabs[0].id!;
    }
  }

  const groupId = await chrome.tabs.group({ tabIds: [tabId] });
  await chrome.tabGroups.update(groupId, {
    title: GROUP_NAME,
    color: GROUP_COLOR_IDLE,
    collapsed: false,
  });
  await saveGroupId(groupId);

  // Keep the placeholder tab — Chrome destroys empty groups automatically.
  // The first CMD_BROWSE will navigate it to the target URL.

  return groupId;
}

/**
 * Check if a tab is within the Ariadne group.
 */
export async function isTabGated(tabId: number): Promise<boolean> {
  const groupId = await getCachedGroupId();
  if (groupId === null) return false;
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.groupId === groupId;
  } catch {
    return false;
  }
}

/**
 * Get the cached Ariadne group ID (may be null).
 */
export async function getAriadneGroupId(): Promise<number | null> {
  return getCachedGroupId();
}

/**
 * Move a tab into the Ariadne group.
 */
export async function moveTabToAriadneGroup(tabId: number): Promise<void> {
  const groupId = await ensureAriadneGroup();
  await chrome.tabs.group({ tabIds: [tabId], groupId });
}
