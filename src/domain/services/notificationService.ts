import type { NotificationRecord } from '../entities/models';

export function browserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && typeof window.Notification === 'function';
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!browserNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export function deliverDueNotifications(notifications: NotificationRecord[], now = new Date()): NotificationRecord[] {
  if (!browserNotificationSupported() || Notification.permission !== 'granted') return notifications;
  const seenTags = new Set<string>();
  return notifications.map((record) => {
    const scheduled = new Date(record.scheduledAt).getTime();
    if (record.deliveredAt || !record.id || !record.title.trim() || !Number.isFinite(scheduled) || scheduled > now.getTime() || seenTags.has(record.id)) return record;
    seenTags.add(record.id);
    try {
      new Notification(record.title.slice(0, 160), { body: record.body.slice(0, 1000), tag: record.id });
      return { ...record, deliveredAt: now.toISOString() };
    } catch {
      // Keep the record pending; constructor failures must not be recorded as successful delivery.
      return record;
    }
  });
}
