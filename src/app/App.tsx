import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, CheckCircle2, ClipboardList, Droplets, Gauge, HeartPulse, Map, Moon, MoreHorizontal, Settings, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { OnboardingPage } from '../features/dashboard/OnboardingPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { RoadmapPage } from '../features/roadmap/RoadmapPage';
import { PlannerPage } from '../features/planner/PlannerPage';
import { HabitsPage } from '../features/habits/HabitsPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { StatisticsPage } from '../features/statistics/StatisticsPage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { PrivacyPage } from '../features/settings/PrivacyPage';
import { DiagnosticsPage } from '../features/diagnostics/DiagnosticsPage';
import { appStore, bootstrapApp, useAppStore } from '../application/appStore';
import { deliverDueNotifications } from '../domain/services/notificationService';

const primaryNav = [
  ['/today', 'Today', Gauge],
  ['/planner', 'Plan', Sparkles],
  ['/roadmap', 'Learn', Map],
  ['/habits', 'Habits', HeartPulse],
  ['/statistics', 'Progress', ClipboardList],
] as const;

const secondaryNav = [
  ['/review', 'Review', CheckCircle2],
  ['/calendar', 'Calendar', CalendarDays],
  ['/notifications', 'Alerts', Droplets],
  ['/diagnostics', 'Diagnostics', Activity],
  ['/settings', 'Settings', Settings],
  ['/privacy', 'Privacy', ShieldCheck],
] as const;

export default function App() {
  const state = useAppStore();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('mar-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Theme persistence is optional.
    }
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem('mar-theme', theme); } catch {
      // The visual preference is best-effort; app data remains in IndexedDB.
    }
  }, [theme]);

  useEffect(() => { void bootstrapApp(); }, []);
  useEffect(() => {
    const tick = async () => {
      const stateNow = appStore.getSnapshot();
      if (stateNow.preferences?.notificationsEnabled !== true) return;
      const updated = deliverDueNotifications(stateNow.notifications);
      const changed = updated.filter((n, i) => n.deliveredAt !== stateNow.notifications[i]?.deliveredAt);
      try {
        for (const notification of changed) await appStore.saveNotification(notification);
      } catch (error) {
        // A failed IndexedDB write must not be treated as a durable delivery record.
        // The next foreground tick may retry; the notification tag remains stable.
        console.warn('Reminder delivery state could not be saved; pending reminders will retry.', error);
      }
    };
    void tick();
    const id = window.setInterval(() => { void tick(); }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!state.ready) return <div className="app-loading"><div className="brand-mark">AR</div><h1>Preparing your routine</h1><p>Opening your local workspace…</p></div>;
  if (state.error) return <main className="app-error" role="alert" aria-live="assertive"><div className="app-error-card"><div className="brand-mark" aria-hidden="true">AR</div><h1>Could not open your local workspace</h1><p>{state.error}</p><p>Close other tabs running this app, then reload. Your existing database has not been deliberately erased.</p><button className="button primary" onClick={() => window.location.reload()}>Retry by reloading</button></div></main>;
  if (!state.preferences?.onboardingCompleted && state.roadmaps.length === 0) return <OnboardingPage />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">AR</div>
          <div><strong>Adaptive Routine</strong><span>Make room for what matters</span></div>
        </div>
        <nav className="nav-list primary-nav" aria-label="Primary navigation">
          {primaryNav.map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><Icon size={19} aria-hidden="true" /><span>{label}</span></NavLink>)}
          <details className="nav-more-mobile">
            <summary className="nav-item"><MoreHorizontal size={19} aria-hidden="true" /><span>More</span></summary>
            <div className="mobile-more-menu">
              {secondaryNav.map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><Icon size={18} aria-hidden="true" /><span>{label}</span></NavLink>)}
              <button type="button" className="theme-toggle mobile-theme" aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                <span>Use {theme === 'dark' ? 'light' : 'dark'} theme</span>
              </button>
            </div>
          </details>
        </nav>
        <div className="nav-divider" aria-hidden="true" />
        <nav className="nav-list secondary-nav" aria-label="Secondary navigation">
          {secondaryNav.map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><Icon size={18} aria-hidden="true" /><span>{label}</span></NavLink>)}
        </nav>
        <button type="button" className="theme-toggle desktop-theme" aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          <span>Use {theme === 'dark' ? 'light' : 'dark'} theme</span>
        </button>
        <div className="sidebar-note"><span className="status-dot" /><span>{state.error ? 'Storage needs attention' : 'Your data stays on this device'}</span></div>
      </aside>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <main id="main-content" className="main-content"><Routes>
        <Route path="/" element={<DashboardPage />} /><Route path="/today" element={<DashboardPage />} />
        <Route path="/review" element={<ReviewPage />} /><Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/planner" element={<PlannerPage />} /><Route path="/habits" element={<HabitsPage />} />
        <Route path="/calendar" element={<CalendarPage />} /><Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} /><Route path="/diagnostics" element={<DiagnosticsPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/privacy" element={<PrivacyPage />} />
      </Routes></main>
    </div>
  );
}

void appStore;
