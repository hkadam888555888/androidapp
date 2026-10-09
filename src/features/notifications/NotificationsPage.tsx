import { useMemo, useState } from 'react';
import { appStore, useAppStore, getCurrentDate } from '../../application/appStore';
import { previousISO } from '../../application/date';
import { browserNotificationSupported, requestBrowserNotificationPermission } from '../../domain/services/notificationService';
import { isHabitDue } from '../../domain/services/habitEngine';

export function NotificationsPage() {
  const state = useAppStore();
  const [notice, setNotice] = useState('');
  const supported = browserNotificationSupported();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(supported ? Notification.permission : 'unsupported');
  const date = getCurrentDate();
  const todayTasks = state.dailyTasks.filter((t)=>t.date===date && t.plannedWindow);
  const reviewPending = state.dailyTasks.some((t)=>t.date===previousISO(date) && t.status==='unreported');
  const scheduled = useMemo(()=>state.notifications.filter((n)=>n.scheduledAt.slice(0,10)===date).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)),[state.notifications,date]);

  async function toggleBrowserNotifications() {
    if (state.preferences?.notificationsEnabled) {
      if (state.preferences) await appStore.savePreferences({ ...state.preferences, notificationsEnabled: false });
      setNotice('Browser delivery paused. Reminder records stay saved locally.');
      return;
    }
    const result = await requestBrowserNotificationPermission();
    setPermission(result);
    if (result === 'granted' && state.preferences) {
      await appStore.savePreferences({ ...state.preferences, notificationsEnabled: true });
      setNotice('Browser delivery enabled. It runs while this app is open; background delivery is not provided by this build.');
    } else {
      setNotice(result === 'denied' ? 'Browser notifications were denied; reminder records still work locally.' : 'This browser does not support notifications.');
    }
  }

  async function generateReminders() {
    let generated = 0;
    for (const task of todayTasks) {
      const scheduledAt = `${date}T${task.plannedWindow!.start}:00`;
      await appStore.saveNotification({ id:`notify:start:${task.id}`, type:'task_starting', title:'Task starting', body:task.title, scheduledAt, linkedEntityId:task.id });
      generated += 1;
    }
    for (const habit of state.habits.filter((item) => item.active && isHabitDue(item, date))) {
      const type = habit.kind === 'exercise' ? 'exercise_reminder' : habit.kind === 'water' ? 'water_reminder' : 'task_reminder';
      for (const time of habit.reminderTimes) {
        await appStore.saveNotification({ id:`notify:habit:${habit.id}:${date}:${time}`, type, title:`${habit.name} reminder`, body:`Target: ${habit.targetValue} ${habit.unit}`, scheduledAt:`${date}T${time}:00`, linkedEntityId:habit.id });
        generated += 1;
      }
    }
    if (reviewPending) { await appStore.saveNotification({ id:`notify:review:${date}`, type:'review_reminder', title:'Daily review required', body:'Resolve yesterday’s unreported tasks before the next plan finalizes.', scheduledAt:`${date}T21:30:00` }); generated += 1; }
    setNotice(`Generated ${generated} local reminder records, including recurring habit reminders.`);
  }

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">Reminders</p><h1>Notifications</h1><p className="muted">Notifications are advisory only and never mutate task status. Browser delivery works only while this app is open and permission is granted; there is no background push service in this build.</p></div><div className="header-actions"><span className={`pill ${permission === 'granted' && state.preferences?.notificationsEnabled ? 'success-pill' : ''}`}>{permission === 'unsupported' ? 'Unsupported' : state.preferences?.notificationsEnabled ? 'Delivery enabled' : permission === 'granted' ? 'Permission granted · paused' : 'Permission needed'}</span><button className={`button ${state.preferences?.notificationsEnabled ? 'secondary' : 'primary'}`} onClick={toggleBrowserNotifications} disabled={permission === 'unsupported' && !state.preferences?.notificationsEnabled}>{state.preferences?.notificationsEnabled ? 'Pause delivery' : 'Enable browser delivery'}</button><button className="button secondary" onClick={generateReminders}>{scheduled.length ? 'Refresh reminders' : 'Generate reminders'}</button></div></header>
    {notice&&<div className="notice-bar">{notice}</div>}
    <div className="card notification-list"><div className="card-heading"><div><span className="eyebrow">Today</span><h2>Scheduled reminders</h2></div><span className="pill">{scheduled.length}</span></div>{scheduled.length===0?<div className="timeline-empty">No reminder records generated yet.</div>:scheduled.map((n)=><div className="setting-row" key={n.id}><div><strong>{n.title}</strong><span>{new Date(n.scheduledAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · {n.body}</span></div><span className="pill">{n.type}</span></div>)}</div>
  </section>;
}
