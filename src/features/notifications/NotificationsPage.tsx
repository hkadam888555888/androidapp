import { useEffect, useMemo, useState } from 'react';
import { appStore, useAppStore, getCurrentDate } from '../../application/appStore';
import { previousISO } from '../../application/date';
import {
  browserNotificationSupported,
  cancelNativeNotifications,
  currentNotificationPermission,
  isNativeLocalNotificationsPlatform,
  requestBrowserNotificationPermission,
  scheduleNativeNotifications,
} from '../../domain/services/notificationService';
import { isHabitDue } from '../../domain/services/habitEngine';
import type { NotificationRecord } from '../../domain/entities/models';

export function NotificationsPage() {
  const state = useAppStore();
  const [notice, setNotice] = useState('');
  const nativeDelivery = isNativeLocalNotificationsPlatform();
  const supported = browserNotificationSupported();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(supported ? 'default' : 'unsupported');
  const date = getCurrentDate();

  useEffect(() => {
    let active = true;
    void currentNotificationPermission().then((value) => { if (active) setPermission(value); });
    return () => { active = false; };
  }, []);

  const todayTasks = state.dailyTasks.filter((task) => task.date === date && task.plannedWindow);
  const reviewPending = state.dailyTasks.some((task) => task.date === previousISO(date) && task.status === 'unreported');
  const scheduled = useMemo(
    () => state.notifications.filter((item) => item.scheduledAt.slice(0, 10) === date).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [state.notifications, date],
  );

  async function toggleDelivery() {
    if (!state.preferences) return;
    if (state.preferences.notificationsEnabled) {
      try {
        if (nativeDelivery) await cancelNativeNotifications(state.notifications);
        await appStore.savePreferences({ ...state.preferences, notificationsEnabled: false });
        setNotice('Reminder delivery paused. Saved reminder records remain on this device.');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not pause reminder delivery.');
      }
      return;
    }

    const result = await requestBrowserNotificationPermission();
    setPermission(result);
    if (result !== 'granted') {
      setNotice(result === 'denied' ? 'Notification permission was denied; reminder records remain saved locally.' : 'This device or browser does not support notifications.');
      return;
    }

    try {
      if (nativeDelivery) {
        const count = await scheduleNativeNotifications(state.notifications);
        await appStore.savePreferences({ ...state.preferences, notificationsEnabled: true });
        setNotice('Android scheduled ' + count + ' future reminders on this device. Battery-saving modes may delay inexact alarms.');
      } else {
        await appStore.savePreferences({ ...state.preferences, notificationsEnabled: true });
        setNotice('Browser delivery enabled. It works while the app is open; the web build has no background push service.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Permission was granted, but reminder scheduling failed.');
    }
  }

  async function generateReminders() {
    let generated = 0;
    const newRecords: NotificationRecord[] = [];
    async function save(record: NotificationRecord) {
      await appStore.saveNotification(record);
      newRecords.push(record);
      generated += 1;
    }

    try {
      for (const task of todayTasks) {
        const scheduledAt = date + 'T' + task.plannedWindow!.start + ':00';
        await save({ id: 'notify:start:' + task.id, type: 'task_starting', title: 'Task starting', body: task.title, scheduledAt, linkedEntityId: task.id });
      }
      for (const habit of state.habits.filter((item) => item.active && isHabitDue(item, date))) {
        const type = habit.kind === 'exercise' ? 'exercise_reminder' : habit.kind === 'water' ? 'water_reminder' : 'task_reminder';
        for (const time of habit.reminderTimes) {
          await save({ id: 'notify:habit:' + habit.id + ':' + date + ':' + time, type, title: habit.name + ' reminder', body: 'Target: ' + habit.targetValue + ' ' + habit.unit, scheduledAt: date + 'T' + time + ':00', linkedEntityId: habit.id });
        }
      }
      if (reviewPending) {
        await save({ id: 'notify:review:' + date, type: 'review_reminder', title: 'Daily review required', body: 'Resolve yesterday’s unreported tasks before the next plan finalizes.', scheduledAt: date + 'T21:30:00' });
      }

      if (nativeDelivery && state.preferences?.notificationsEnabled) {
        const count = await scheduleNativeNotifications(newRecords);
        setNotice('Generated ' + generated + ' local records and scheduled ' + count + ' future Android reminders. Battery-saving modes may delay inexact alarms.');
      } else {
        setNotice('Generated ' + generated + ' local reminder records, including recurring habit reminders.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not generate or schedule the reminders.');
    }
  }

  return <section className="page">
    <header className="page-header">
      <div>
        <p className="eyebrow">Reminders</p>
        <h1>Notifications</h1>
        <p className="muted">
          {nativeDelivery
            ? 'Android schedules local device reminders that can fire while this app is closed. Permission is required; battery-saving modes may delay inexact alarms. No push server is used.'
            : 'Browser notifications are advisory and only fire while this app is open and permission is granted. The web build has no background push service.'}
        </p>
      </div>
      <div className="header-actions">
        <span className={'pill ' + (permission === 'granted' && state.preferences?.notificationsEnabled ? 'success-pill' : '')}>
          {permission === 'unsupported' ? 'Unsupported' : state.preferences?.notificationsEnabled ? 'Delivery enabled' : permission === 'granted' ? 'Permission granted · paused' : 'Permission needed'}
        </span>
        <button className={'button ' + (state.preferences?.notificationsEnabled ? 'secondary' : 'primary')} onClick={() => void toggleDelivery()} disabled={permission === 'unsupported' && !state.preferences?.notificationsEnabled}>
          {state.preferences?.notificationsEnabled ? (nativeDelivery ? 'Pause device reminders' : 'Pause delivery') : (nativeDelivery ? 'Enable device reminders' : 'Enable browser delivery')}
        </button>
        <button className="button secondary" onClick={() => void generateReminders()}>{scheduled.length ? 'Refresh reminders' : 'Generate reminders'}</button>
      </div>
    </header>
    {notice && <div className="notice-bar" role="status">{notice}</div>}
    <div className="card notification-list">
      <div className="card-heading">
        <div><span className="eyebrow">Today</span><h2>Scheduled reminders</h2></div>
        <span className="pill">{scheduled.length}</span>
      </div>
      {scheduled.length === 0
        ? <div className="timeline-empty">No reminder records generated yet.</div>
        : scheduled.map((item) => <div className="setting-row" key={item.id}>
          <div><strong>{item.title}</strong><span>{new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.body}</span></div>
          <span className="pill">{item.type}</span>
        </div>)}
    </div>
  </section>;
}
