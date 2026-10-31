import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NotificationRecord } from '../entities/models';
import { browserNotificationSupported, deliverDueNotifications, requestBrowserNotificationPermission } from './notificationService';

const record = (id: string, scheduledAt: string): NotificationRecord => ({
  id,
  type: 'task_reminder',
  title: 'Routine reminder',
  body: 'Review the next task',
  scheduledAt,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Arena notification delivery safety', () => {
  it('reports unsupported without prompting or pretending delivery happened', async () => {
    vi.stubGlobal('window', {});
    expect(browserNotificationSupported()).toBe(false);
    await expect(requestBrowserNotificationPermission()).resolves.toBe('unsupported');
    expect(deliverDueNotifications([record('due', '2026-01-01T09:00:00')], new Date('2026-01-01T10:00:00'))[0]).not.toHaveProperty('deliveredAt');
  });

  it('keeps a due reminder pending when permission is denied', () => {
    class DeniedNotification {
      static permission: NotificationPermission = 'denied';
      constructor() { throw new Error('Constructor must not run without permission'); }
    }
    vi.stubGlobal('window', { Notification: DeniedNotification });
    vi.stubGlobal('Notification', DeniedNotification);
    const due = record('denied', '2026-01-01T09:00:00');
    expect(browserNotificationSupported()).toBe(true);
    expect(deliverDueNotifications([due], new Date('2026-01-01T10:00:00'))).toEqual([due]);
  });

  it('does not persist delivery if the browser notification constructor throws', () => {
    class ThrowingNotification {
      static permission: NotificationPermission = 'granted';
      constructor() { throw new Error('Platform notification unavailable'); }
    }
    vi.stubGlobal('window', { Notification: ThrowingNotification });
    vi.stubGlobal('Notification', ThrowingNotification);
    const due = record('constructor-failure', '2026-01-01T09:00:00');
    expect(deliverDueNotifications([due], new Date('2026-01-01T10:00:00'))).toEqual([due]);
  });

  it('delivers only due undelivered records and leaves future or already-delivered records alone', () => {
    const shown: Array<{ title: string; options?: NotificationOptions }> = [];
    class WorkingNotification {
      static permission: NotificationPermission = 'granted';
      constructor(title: string, options?: NotificationOptions) { shown.push({ title, options }); }
    }
    vi.stubGlobal('window', { Notification: WorkingNotification });
    vi.stubGlobal('Notification', WorkingNotification);
    const due = record('due', '2026-01-01T09:00:00');
    const future = record('future', '2026-01-01T12:00:00');
    const delivered = { ...record('already-delivered', '2026-01-01T08:00:00'), deliveredAt: '2026-01-01T08:01:00.000Z' };

    const output = deliverDueNotifications([due, future, delivered], new Date('2026-01-01T10:00:00'));
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe('Routine reminder');
    expect(output[0].deliveredAt).toBe('2026-01-01T10:00:00.000Z');
    expect(output[1]).toEqual(future);
    expect(output[2]).toEqual(delivered);
  });
});
