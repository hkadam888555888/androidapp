import { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, CheckCircle2, ClipboardList, Droplets, Gauge, HeartPulse, Map, Moon, MoreHorizontal, Search, Settings, ShieldCheck, Sparkles, Sun, X } from 'lucide-react';
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
import { deliverDueNotifications, isNativeLocalNotificationsPlatform } from '../domain/services/notificationService';
import { QuickActionsDialog } from '../components/overlays/QuickActionsDialog';


/*
 * My Adaptive Routine — app-shell experience layer.
 * Kept in App.tsx by request; all data and feature behavior remain in their
 * existing feature/application modules.
 */
const appExperienceStyles = String.raw\`
.app-shell {
  position: relative;
  isolation: isolate;
  overflow-x: clip;
}
.app-shell::before,
.app-shell::after {
  content: "";
  position: fixed;
  inset: -18vh -12vw;
  z-index: 0;
  pointer-events: none;
  border-radius: 50%;
  will-change: opacity, transform;
}
.app-shell::before {
  background:
    radial-gradient(ellipse at 15% 18%, rgba(83, 153, 143, .23), transparent 35%),
    radial-gradient(ellipse at 78% 20%, rgba(100, 118, 167, .19), transparent 34%),
    radial-gradient(ellipse at 62% 88%, rgba(188, 150, 111, .12), transparent 32%);
  filter: blur(58px) saturate(112%);
  animation: marAmbientBreath 19s ease-in-out infinite;
}
.app-shell::after {
  inset: -22vh -16vw;
  background:
    radial-gradient(ellipse at 82% 62%, rgba(82, 160, 165, .15), transparent 31%),
    radial-gradient(ellipse at 24% 78%, rgba(132, 116, 159, .11), transparent 30%);
  filter: blur(72px);
  animation: marAmbientDrift 27s ease-in-out infinite;
}
.app-shell > .sidebar { z-index: 80; }
.app-shell > .main-content {
  position: relative;
  z-index: 1;
  min-width: 0;
}
.app-mobile-topbar { display: none; }

@keyframes marAmbientBreath {
  0%, 100% { opacity: .25; transform: translate3d(-1.1%, -.7%, 0) scale(.96); }
  50% { opacity: .49; transform: translate3d(1.2%, .9%, 0) scale(1.045); }
}
@keyframes marAmbientDrift {
  0%, 100% { opacity: .22; transform: translate3d(1.2%, -1%, 0) scale(.97); }
  50% { opacity: .39; transform: translate3d(-1.4%, 1.2%, 0) scale(1.04); }
}
@keyframes marHeroBreath {
  0%, 100% { opacity: .42; transform: scale(.92) translate3d(0, 0, 0); }
  50% { opacity: .82; transform: scale(1.08) translate3d(-5px, 7px, 0); }
}
@keyframes marRiseIn {
  from { opacity: 0; transform: translateY(9px); }
  to { opacity: 1; transform: translateY(0); }
}

/* The existing Today page remains data-driven; this layer changes its atmosphere. */
.main-content[data-current-path="/today"] .page,
.main-content[data-current-path="/"] .page {
  max-width: 1120px;
}
.main-content[data-current-path="/today"] .page-header,
.main-content[data-current-path="/"] .page-header {
  align-items: flex-end;
  margin-bottom: 25px;
  animation: marRiseIn .55s ease both;
}
.main-content[data-current-path="/today"] .page-header h1,
.main-content[data-current-path="/"] .page-header h1 {
  font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  font-size: clamp(42px, 5.3vw, 62px);
  font-weight: 600;
  letter-spacing: -.055em;
  line-height: .98;
}
.main-content[data-current-path="/today"] .page-header .muted,
.main-content[data-current-path="/"] .page-header .muted {
  max-width: 43rem;
  font-size: 14px;
  line-height: 1.65;
}
.main-content[data-current-path="/today"] .next-session,
.main-content[data-current-path="/"] .next-session {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 205px;
  padding: clamp(22px, 3.4vw, 34px);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-left: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 26px;
  background:
    radial-gradient(ellipse at 92% 6%, rgba(117, 190, 176, .19), transparent 34%),
    radial-gradient(ellipse at 3% 100%, rgba(190, 157, 119, .12), transparent 34%),
    linear-gradient(118deg,
      color-mix(in srgb, var(--surface) 88%, #315d58),
      color-mix(in srgb, var(--surface) 96%, #233b4c) 62%,
      color-mix(in srgb, var(--surface) 91%, #5b526b));
  box-shadow: 0 20px 58px rgba(12, 24, 31, .13), inset 0 1px 0 rgba(255,255,255,.08);
  animation: marRiseIn .65s .04s ease both;
}
.main-content[data-current-path="/today"] .next-session::before,
.main-content[data-current-path="/"] .next-session::before {
  content: "";
  position: absolute;
  z-index: -1;
  width: min(27rem, 78vw);
  aspect-ratio: 1;
  right: -8rem;
  top: -15rem;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(127, 211, 191, .36), rgba(105, 174, 181, .12) 43%, transparent 70%);
  filter: blur(12px);
  animation: marHeroBreath 14s ease-in-out infinite;
  pointer-events: none;
}
.main-content[data-current-path="/today"] .next-session-copy,
.main-content[data-current-path="/today"] .next-session-actions,
.main-content[data-current-path="/"] .next-session-copy,
.main-content[data-current-path="/"] .next-session-actions {
  position: relative;
  z-index: 1;
}
.main-content[data-current-path="/today"] .next-session-kicker,
.main-content[data-current-path="/"] .next-session-kicker {
  color: color-mix(in srgb, var(--accent) 82%, #85c6b5);
}
.main-content[data-current-path="/today"] .next-session-indicator,
.main-content[data-current-path="/"] .next-session-indicator {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 12%, transparent),
              0 0 15px color-mix(in srgb, var(--success) 52%, transparent);
}
.main-content[data-current-path="/today"] .next-session h2,
.main-content[data-current-path="/"] .next-session h2 {
  max-width: 46rem;
  font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  font-size: clamp(26px, 3.1vw, 36px);
  font-weight: 600;
  letter-spacing: -.035em;
}
.main-content[data-current-path="/today"] .next-session p,
.main-content[data-current-path="/"] .next-session p {
  font-size: 13px;
  line-height: 1.6;
}
.main-content[data-current-path="/today"] .next-session .button.primary,
.main-content[data-current-path="/"] .next-session .button.primary {
  box-shadow: 0 7px 22px color-mix(in srgb, var(--accent) 20%, transparent);
  transition: transform .22s ease, box-shadow .22s ease, filter .22s ease;
}
.main-content[data-current-path="/today"] .next-session .button.primary:hover,
.main-content[data-current-path="/"] .next-session .button.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--accent) 28%, transparent);
  filter: brightness(1.04);
}
.main-content[data-current-path="/today"] .stats-grid,
.main-content[data-current-path="/"] .stats-grid {
  gap: 13px;
}
.main-content[data-current-path="/today"] .stat-card,
.main-content[data-current-path="/"] .stat-card {
  position: relative;
  overflow: hidden;
  min-width: 0;
  padding: 18px;
  border-radius: 20px;
  border-color: color-mix(in srgb, var(--border) 78%, var(--accent));
  background: linear-gradient(145deg, color-mix(in srgb, var(--surface) 94%, #789d96), var(--surface) 72%);
  box-shadow: 0 12px 34px rgba(12, 24, 31, .07);
  animation: marRiseIn .55s ease both;
  transition: transform .24s ease, border-color .24s ease, box-shadow .24s ease;
}
.main-content[data-current-path="/today"] .stat-card:nth-child(2),
.main-content[data-current-path="/"] .stat-card:nth-child(2) { animation-delay: .05s; }
.main-content[data-current-path="/today"] .stat-card:nth-child(3),
.main-content[data-current-path="/"] .stat-card:nth-child(3) { animation-delay: .1s; }
.main-content[data-current-path="/today"] .stat-card:nth-child(4),
.main-content[data-current-path="/"] .stat-card:nth-child(4) { animation-delay: .15s; }
.main-content[data-current-path="/today"] .stat-card:hover,
.main-content[data-current-path="/"] .stat-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
  box-shadow: 0 17px 38px rgba(12, 24, 31, .10);
}
.main-content[data-current-path="/today"] .stat-card strong,
.main-content[data-current-path="/"] .stat-card strong {
  font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  font-size: clamp(25px, 2.6vw, 32px);
  letter-spacing: -.035em;
  font-variant-numeric: tabular-nums;
}
.main-content[data-current-path="/today"] .content-grid > .card,
.main-content[data-current-path="/"] .content-grid > .card {
  border-radius: 22px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  box-shadow: 0 16px 42px rgba(12, 24, 31, .07);
  backdrop-filter: blur(10px);
}
.main-content[data-current-path="/today"] .timeline-card,
.main-content[data-current-path="/"] .timeline-card {
  border-radius: 15px;
  transition: transform .2s ease, border-color .2s ease, background .2s ease;
}
.main-content[data-current-path="/today"] .timeline-card:hover,
.main-content[data-current-path="/"] .timeline-card:hover {
  transform: translateX(3px);
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
}
.main-content[data-current-path="/today"] .quick-action,
.main-content[data-current-path="/"] .quick-action {
  border-radius: 14px;
  transition: transform .2s ease, border-color .2s ease, background .2s ease;
}
.main-content[data-current-path="/today"] .quick-action:hover,
.main-content[data-current-path="/"] .quick-action:hover {
  transform: translateY(-2px);
  background: color-mix(in srgb, var(--surface-2) 80%, var(--accent) 5%);
}

/* Keep the mobile experience focused: four daily destinations and a separate More menu. */
.app-mobile-topbar {
  display: none;
}
@media (max-width: 760px) {
  .app-mobile-topbar {
    display: flex;
    position: relative;
    z-index: 2;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 3px 1px 13px;
    margin-bottom: 2px;
  }
  .app-mobile-brand {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
    color: var(--text);
    font-size: 13px;
    font-weight: 750;
    letter-spacing: -.015em;
  }
  .app-mobile-brand .brand-mark {
    width: 31px;
    height: 31px;
    flex: 0 0 31px;
    border-radius: 10px;
    font-size: 11px;
  }
  .app-mobile-more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 13px;
    color: var(--text);
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    box-shadow: 0 5px 18px rgba(12, 24, 31, .06);
    backdrop-filter: blur(14px);
  }
  .sidebar .primary-nav {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    width: 100%;
  }
  .sidebar .primary-nav .nav-item {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 4px;
    min-width: 0;
    min-height: 58px;
    padding: 6px 3px;
    border-radius: 13px;
    font-size: 10px;
    line-height: 1.1;
    white-space: nowrap;
  }
  .sidebar .primary-nav .nav-item span {
    display: block !important;
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    font-size: 10px;
  }
  .sidebar .primary-nav .nav-item svg { width: 18px; height: 18px; }
  .sidebar .primary-nav .nav-item.active {
    color: var(--accent-2);
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  }
  .main-content { padding-top: 15px; }
  .main-content[data-current-path="/today"] .page-header,
  .main-content[data-current-path="/"] .page-header { gap: 9px; }
  .main-content[data-current-path="/today"] .page-header h1,
  .main-content[data-current-path="/"] .page-header h1 { font-size: clamp(42px, 12vw, 54px); }
  .main-content[data-current-path="/today"] .next-session,
  .main-content[data-current-path="/"] .next-session {
    min-height: 0;
    padding: 22px 18px;
    border-radius: 22px;
  }
  .main-content[data-current-path="/today"] .next-session-actions,
  .main-content[data-current-path="/"] .next-session-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
  }
  .main-content[data-current-path="/today"] .next-session-actions .button,
  .main-content[data-current-path="/"] .next-session-actions .button { width: 100%; }
  .main-content[data-current-path="/today"] .stats-grid,
  .main-content[data-current-path="/"] .stats-grid { gap: 9px; }
  .main-content[data-current-path="/today"] .stat-card,
  .main-content[data-current-path="/"] .stat-card { padding: 13px; border-radius: 16px; }
  .main-content[data-current-path="/today"] .content-grid > .card,
  .main-content[data-current-path="/"] .content-grid > .card { padding: 16px; border-radius: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .app-shell::before,
  .app-shell::after,
  .main-content[data-current-path="/today"] .next-session::before,
  .main-content[data-current-path="/"] .next-session::before {
    animation: none !important;
    opacity: .24 !important;
    transform: none !important;
  }
  .main-content[data-current-path="/today"] .page-header,
  .main-content[data-current-path="/"] .page-header,
  .main-content[data-current-path="/today"] .next-session,
  .main-content[data-current-path="/"] .next-session,
  .main-content[data-current-path="/today"] .stat-card,
  .main-content[data-current-path="/"] .stat-card {
    animation: none !important;
  }
  .main-content[data-current-path="/today"] .stat-card,
  .main-content[data-current-path="/"] .stat-card,
  .main-content[data-current-path="/today"] .timeline-card,
  .main-content[data-current-path="/"] .timeline-card,
  .main-content[data-current-path="/today"] .quick-action,
  .main-content[data-current-path="/"] .quick-action {
    transition: none !important;
  }
}
\`;

const primaryNav = [
  ['/today', 'Today', Gauge],
  ['/planner', 'Plan', Sparkles],
  ['/roadmap', 'Roadmap', Map],
  ['/habits', 'Habits', HeartPulse],
] as const;

const secondaryNav = [
  ['/statistics', 'Progress', ClipboardList],
  ['/review', 'Review', CheckCircle2],
  ['/calendar', 'Calendar', CalendarDays],
  ['/notifications', 'Alerts', Droplets],
  ['/diagnostics', 'Diagnostics', Activity],
  ['/settings', 'Settings', Settings],
  ['/privacy', 'Privacy', ShieldCheck],
] as const;

export default function App() {
  const state = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const quickActionsReturnFocusRef = useRef<HTMLElement | null>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuDialogRef = useRef<HTMLElement | null>(null);
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E1617' : '#F7F9F8');
    try { window.localStorage.setItem('mar-theme', theme); } catch {
      // The visual preference is best-effort; app data remains in IndexedDB.
    }
  }, [theme]);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!quickActionsOpen) {
          quickActionsReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }
        setQuickActionsOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setQuickActionsOpen(false);
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [quickActionsOpen]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const dialog = mobileMenuDialogRef.current;
    const trigger = mobileMenuTriggerRef.current;
    if (!dialog) return;
    const activeDialog: HTMLElement = dialog;

    const getFocusable = () => Array.from(activeDialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');

    const focusable = getFocusable();
    (focusable[0] ?? activeDialog).focus();

    function trapTab(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        activeDialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const focusIsOutside = !activeDialog.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || focusIsOutside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || focusIsOutside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', trapTab);
    return () => {
      document.removeEventListener('keydown', trapTab);
      trigger?.focus();
    };
  }, [mobileMenuOpen]);


  useEffect(() => { void bootstrapApp(); }, []);
  useEffect(() => {
    const tick = async () => {
      const stateNow = appStore.getSnapshot();
      if (stateNow.preferences?.notificationsEnabled !== true || isNativeLocalNotificationsPlatform()) return;
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
      <style>{appExperienceStyles}</style>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">AR</div>
          <div><strong>Adaptive Routine</strong><span>Make room for what matters</span></div>
        </div>
        <button type="button" className="quick-search-launcher" onClick={(event) => { quickActionsReturnFocusRef.current = event.currentTarget; setQuickActionsOpen(true); }} aria-keyshortcuts="Control+K Meta+K">
          <Search size={17} aria-hidden="true" /><span>Search your routine</span><kbd>Ctrl K</kbd>
        </button>
        <nav className="nav-list primary-nav" aria-label="Primary navigation">
          {primaryNav.map(([to, label, Icon]) => <NavLink key={to} to={to} aria-label={label} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><Icon size={19} aria-hidden="true" /><span>{label}</span></NavLink>)}
        </nav>
        <div className="nav-divider" aria-hidden="true" />
        <nav className="nav-list secondary-nav" aria-label="Secondary navigation">
          {secondaryNav.map(([to, label, Icon]) => <NavLink key={to} to={to} aria-label={label} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><Icon size={18} aria-hidden="true" /><span>{label}</span></NavLink>)}
        </nav>
        <button type="button" className="theme-toggle desktop-theme" aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          <span>Use {theme === 'dark' ? 'light' : 'dark'} theme</span>
        </button>
        <div className="sidebar-note"><span className="status-dot" /><span>{state.error ? 'Storage needs attention' : 'Your data stays on this device'}</span></div>
      </aside>
      {mobileMenuOpen && <div className="mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenuOpen(false); }}>
        <section ref={mobileMenuDialogRef} id="mobile-feature-menu" className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title" tabIndex={-1}>
          <header className="mobile-menu-header">
            <div><p className="eyebrow">Navigate</p><h2 id="mobile-menu-title">All features</h2></div>
            <button type="button" className="button icon-button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X size={19} aria-hidden="true" /></button>
          </header>
          <nav className="mobile-menu-grid" aria-label="All app features">
            {([...primaryNav, ...secondaryNav] as const).map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => isActive ? 'mobile-menu-link active' : 'mobile-menu-link'}>
              <span className="mobile-menu-icon"><Icon size={19} aria-hidden="true" /></span><span>{label}</span>
            </NavLink>)}
          </nav>
          <div className="mobile-menu-tools">
            <button type="button" className="mobile-menu-tool" onClick={() => { quickActionsReturnFocusRef.current = mobileMenuTriggerRef.current; setMobileMenuOpen(false); setQuickActionsOpen(true); }}><Search size={18} aria-hidden="true" /><span>Search tasks and pages</span></button>
            <button type="button" className="mobile-menu-tool" aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              <span>Use {theme === 'dark' ? 'light' : 'dark'} theme</span>
            </button>
          </div>
        </section>
      </div>}
      <a className="skip-link" href="#main-content">Skip to content</a>
      <main id="main-content" className="main-content" data-current-path={location.pathname}>
        <div className="app-mobile-topbar">
          <div className="app-mobile-brand"><div className="brand-mark" aria-hidden="true">AR</div><span>Adaptive Routine</span></div>
          <button ref={mobileMenuTriggerRef} type="button" className="app-mobile-more" onClick={() => setMobileMenuOpen((open) => !open)} aria-haspopup="dialog" aria-expanded={mobileMenuOpen} aria-controls="mobile-feature-menu">
            <MoreHorizontal size={17} aria-hidden="true" /><span>More</span>
          </button>
        </div>
        <Routes>
        <Route path="/" element={<DashboardPage />} /><Route path="/today" element={<DashboardPage />} />
        <Route path="/review" element={<ReviewPage />} /><Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/planner" element={<PlannerPage />} /><Route path="/habits" element={<HabitsPage />} />
        <Route path="/calendar" element={<CalendarPage />} /><Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} /><Route path="/diagnostics" element={<DiagnosticsPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/privacy" element={<PrivacyPage />} />
      </Routes></main>
      {quickActionsOpen && <QuickActionsDialog
        onClose={() => setQuickActionsOpen(false)}
        onOpenTask={(taskId) => {
          setQuickActionsOpen(false);
          navigate('/today', { state: { focusTaskId: taskId } });
        }}
        returnFocusRef={quickActionsReturnFocusRef}
      />}
    </div>
  );
}

void appStore;
