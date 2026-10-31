import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { NotificationRecord } from '../entities/models';

export function isNativeLocalNotificationsPlatform(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

export function browserNotificationSupported(): boolean {
  return isNativeLocalNotificationsPlatform()
    || (typeof window !== 'undefined' && 'Notification' in window && typeof window.Notification === 'function');
}

export async function currentNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (isNativeLocalNotificationsPlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'default';
    } catch {
      return 'denied';
    }
  }
  if (!browserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (isNativeLocalNotificationsPlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      const status = current.display === 'granted' ? current : await LocalNotifications.requestPermissions();
      return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'default';
    } catch {
      return 'denied';
    }
  }
  if (!browserNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export function localNotificationNumericId(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2_147_483_647 || 1;
}

export async function scheduleNativeNotifications(records: NotificationRecord[], now = new Date()): Promise<number> {
  if (!isNativeLocalNotificationsPlatform()) return 0;
  const permission = await currentNotificationPermission();
  if (permission !== 'granted') throw new Error('Allow notifications in Android settings before scheduling device reminders.');

  const seen = new Set<number>();
  const notifications = records.flatMap((record) => {
    const at = new Date(record.scheduledAt);
    const numericId = localNotificationNumericId(record.id);
    if (record.deliveredAt || !record.id || !record.title.trim() || !Number.isFinite(at.getTime()) || at.getTime() <= now.getTime() + 1_000 || seen.has(numericId)) return [];
    seen.add(numericId);
    return [{
      id: numericId,
      title: record.title.slice(0, 160),
      body: record.body.slice(0, 1_000),
      schedule: { at },
      // Inexact alarms avoid unexpectedly sending users to Android's exact-alarm settings.
      // Android may defer delivery while the device is in battery-saving modes.
      isExactNotification: false,
    }];
  });
  if (notifications.length === 0) return 0;

  await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) });
  const result = await LocalNotifications.schedule({ notifications });
  return result.notifications.length;
}

export async function cancelNativeNotifications(records: NotificationRecord[]): Promise<void> {
  if (!isNativeLocalNotificationsPlatform() || records.length === 0) return;
  const ids = Array.from(new Set(records.map((record) => localNotificationNumericId(record.id))));
  await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
}

export function deliverDueNotifications(notifications: NotificationRecord[], now = new Date()): NotificationRecord[] {
  if (isNativeLocalNotificationsPlatform()) return notifications;
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
      return record;
    }
  });
}
