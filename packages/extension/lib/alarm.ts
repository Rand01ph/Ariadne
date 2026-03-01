import { ALARM_NAME, ALARM_PERIOD_MINUTES } from "@/constants";

/**
 * Register the Ariadne keep-alive alarm.
 * Safe to call multiple times; will only create if not already registered.
 */
export async function registerAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  }
}

/**
 * Unregister the Ariadne keep-alive alarm.
 */
export async function unregisterAlarm(): Promise<void> {
  await chrome.alarms.clear(ALARM_NAME);
}

/**
 * Check if the alarm is registered.
 */
export async function isAlarmRegistered(): Promise<boolean> {
  const alarm = await chrome.alarms.get(ALARM_NAME);
  return alarm !== undefined;
}
