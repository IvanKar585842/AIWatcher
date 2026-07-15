/**
 * Client-side read state for notifications and important alerts.
 * Persists in localStorage so unread badges/popups clear while history remains.
 */

export const READ_NOTIFICATIONS_KEY = "watchflow-read-notifications";
export const LEGACY_READ_NOTIFICATIONS_KEY = "WatchFlowing-read-notifications";
export const READ_IMPORTANT_CHANGES_KEY = "watchflow-read-important-changes";
export const READ_STATE_EVENT = "watchflow-read-state-changed";

function readJsonSet(key: string, legacyKey?: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw =
      localStorage.getItem(key) ??
      (legacyKey ? localStorage.getItem(legacyKey) : null) ??
      "[]";
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeJsonSet(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent(READ_STATE_EVENT));
}

export function getReadNotificationIds(): Set<string> {
  return readJsonSet(READ_NOTIFICATIONS_KEY, LEGACY_READ_NOTIFICATIONS_KEY);
}

export function markNotificationRead(id: string): Set<string> {
  const ids = getReadNotificationIds();
  ids.add(id);
  writeJsonSet(READ_NOTIFICATIONS_KEY, ids);
  return ids;
}

export function markNotificationsRead(idsToMark: string[]): Set<string> {
  const ids = getReadNotificationIds();
  for (const id of idsToMark) ids.add(id);
  writeJsonSet(READ_NOTIFICATIONS_KEY, ids);
  return ids;
}

export function getReadImportantChangeIds(): Set<string> {
  return readJsonSet(READ_IMPORTANT_CHANGES_KEY);
}

export function markImportantChangesRead(changeIds: string[]): Set<string> {
  const ids = getReadImportantChangeIds();
  for (const id of changeIds) ids.add(id);
  writeJsonSet(READ_IMPORTANT_CHANGES_KEY, ids);
  return ids;
}

/** Mark alert as read for badges, Important Alert banner, and notification list. */
export function markAlertOpened(options: {
  changeId?: string | null;
  notificationId?: string | null;
}) {
  if (options.notificationId) markNotificationRead(options.notificationId);
  if (options.changeId) markImportantChangesRead([options.changeId]);
}
