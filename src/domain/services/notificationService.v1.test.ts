import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverDueNotifications } from './notificationService';

describe('notification delivery safeguards', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not mark invalid schedule times as delivered', () => {
    class MockNotification { static permission = 'granted'; constructor(_title: string, _options?: NotificationOptions) {} }
    vi.stubGlobal('window', { Notification: MockNotification });
    vi.stubGlobal('Notification', MockNotification);
    const records = [{ id: 'bad-date', type: 'task_reminder' as const, title: 'Reminder', body: 'Test', scheduledAt: 'not-a-date' }];
    expect(deliverDueNotifications(records, new Date('2026-10-09T10:00:00Z'))[0].deliveredAt).toBeUndefined();
  });

  it('does not mark browser constructor failure as delivered', () => {
    class BrokenNotification { static permission = 'granted'; constructor(_title: string, _options?: NotificationOptions) { throw new Error('blocked'); } }
    vi.stubGlobal('window', { Notification: BrokenNotification });
    vi.stubGlobal('Notification', BrokenNotification);
    const records = [{ id: 'fails', type: 'task_reminder' as const, title: 'Reminder', body: 'Test', scheduledAt: '2026-10-09T09:00:00Z' }];
    expect(deliverDueNotifications(records, new Date('2026-10-09T10:00:00Z'))[0].deliveredAt).toBeUndefined();
  });
});
