import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, CheckCircle2, Command, Droplets, Gauge, HeartPulse, Map, Search, Settings, ShieldCheck, Sparkles, X } from 'lucide-react';
import { getCurrentDate, useAppStore } from '../../application/appStore';

interface QuickActionsDialogProps {
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  returnFocusRef?: { current: HTMLElement | null };
}

const routeActions = [
  { path: '/today', title: 'Today', detail: 'Your agenda and next task', icon: Gauge, terms: 'home dashboard day' },
  { path: '/planner', title: 'Plan', detail: 'Time windows and plan adaptation', icon: Sparkles, terms: 'planner schedule adapt urgent conflict' },
  { path: '/roadmap', title: 'Roadmap', detail: 'Roadmaps, curriculum and practice', icon: Map, terms: 'learn learning curriculum topics' },
  { path: '/habits', title: 'Habits', detail: 'Water, movement and habit logs', icon: HeartPulse, terms: 'habit water exercise health' },
  { path: '/statistics', title: 'Progress', detail: 'Trends and analytics', icon: Activity, terms: 'progress statistics analytics trends' },
  { path: '/review', title: 'Review', detail: 'Resolve unreported tasks', icon: CheckCircle2, terms: 'review history reflection' },
  { path: '/calendar', title: 'Calendar', detail: 'Browse tasks by day', icon: CalendarDays, terms: 'date month day history' },
  { path: '/notifications', title: 'Alerts', detail: 'Reminder preferences and records', icon: Droplets, terms: 'notifications reminders alerts' },
  { path: '/settings', title: 'Settings', detail: 'Planning, local AI and data backup', icon: Settings, terms: 'preferences configuration backup restore' },
  { path: '/privacy', title: 'Privacy', detail: 'Local storage and data handling', icon: ShieldCheck, terms: 'privacy local data indexeddb' },
] as const;

export function QuickActionsDialog({ onClose, onOpenTask, returnFocusRef }: QuickActionsDialogProps) {
  const state = useAppStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const onCloseRef = useRef(onClose);
  const returnFocusRefRef = useRef(returnFocusRef);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { returnFocusRefRef.current = returnFocusRef; }, [returnFocusRef]);
  const normalized = query.trim().toLocaleLowerCase();
  const todayTasks = useMemo(
    () => state.dailyTasks.filter((task) => task.date === getCurrentDate() && task.status === 'planned'),
    [state.dailyTasks],
  );
  const routeMatches = useMemo(
    () => routeActions.filter((action) => !normalized || (action.title + ' ' + action.detail + ' ' + action.terms).toLocaleLowerCase().includes(normalized)),
    [normalized],
  );
  const taskMatches = useMemo(
    () => todayTasks.filter((task) => !normalized || task.title.toLocaleLowerCase().includes(normalized)).slice(0, 6),
    [todayTasks, normalized],
  );
  const roadmapMatches = useMemo(
    () => state.roadmaps.filter((roadmap) => !normalized || roadmap.title.toLocaleLowerCase().includes(normalized)).slice(0, 5),
    [state.roadmaps, normalized],
  );
  const habitMatches = useMemo(
    () => state.habits.filter((habit) => habit.active && (!normalized || habit.name.toLocaleLowerCase().includes(normalized) || habit.kind.includes(normalized))).slice(0, 5),
    [state.habits, normalized],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeDialog: HTMLElement = dialog;
    const previousFocus = previousFocusRef.current;
    const getFocusable = () => Array.from(activeDialog.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');

    inputRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
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

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const requestedTarget = returnFocusRefRef.current?.current;
      const target = requestedTarget?.isConnected ? requestedTarget : previousFocus;
      if (target?.isConnected) target.focus();
    };
  }, []);

  function openRoute(path: string) {
    navigate(path);
    onClose();
  }

  return (
    <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-title" tabIndex={-1}>
        <h2 id="command-title" className="sr-only">Search and quick actions</h2>
        <div className="command-search-row">
          <Search size={19} aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, roadmaps or open a page…" aria-label="Search tasks, roadmaps, habits and pages" autoComplete="off" />
          <button type="button" className="button secondary command-close" onClick={onClose} aria-label="Close search"><X size={17} /></button>
        </div>
        <div className="command-results">
          {!normalized && <div className="command-section-label">Go to</div>}
          {routeMatches.slice(0, normalized ? 6 : 5).map((action) => {
            const Icon = action.icon;
            return <button className="command-result" type="button" key={action.path} onClick={() => openRoute(action.path)}>
              <span className="command-result-icon"><Icon size={17} aria-hidden="true" /></span>
              <span className="command-result-copy"><strong>{action.title}</strong><span>{action.detail}</span></span>
              {!normalized && <span className="command-result-hint">Open page</span>}
            </button>;
          })}
          {normalized && taskMatches.length > 0 && <>
            <div className="command-section-label">Today's planned tasks</div>
            {taskMatches.map((task) => <button className="command-result" type="button" key={task.id} onClick={() => onOpenTask(task.id)}>
              <span className="command-result-icon"><CheckCircle2 size={17} aria-hidden="true" /></span>
              <span className="command-result-copy"><strong>{task.title}</strong><span>{task.plannedMinutes} min · {task.kind}</span></span>
              <span className="command-result-hint">{task.plannedWindow?.start ?? 'Planned'}</span>
            </button>)}
          </>}
          {normalized && roadmapMatches.length > 0 && <>
            <div className="command-section-label">Roadmaps</div>
            {roadmapMatches.map((roadmap) => <button className="command-result" type="button" key={roadmap.id} onClick={() => openRoute('/roadmap')}>
              <span className="command-result-icon"><Map size={17} aria-hidden="true" /></span>
              <span className="command-result-copy"><strong>{roadmap.title}</strong><span>{roadmap.active ? 'Active roadmap' : 'Saved roadmap'}</span></span>
              <span className="command-result-hint">Roadmap</span>
            </button>)}
          </>}
          {normalized && habitMatches.length > 0 && <>
            <div className="command-section-label">Habits</div>
            {habitMatches.map((habit) => <button className="command-result" type="button" key={habit.id} onClick={() => openRoute('/habits')}>
              <span className="command-result-icon"><HeartPulse size={17} aria-hidden="true" /></span>
              <span className="command-result-copy"><strong>{habit.name}</strong><span>{habit.kind} · target {habit.targetValue} {habit.unit}</span></span>
              <span className="command-result-hint">Habit</span>
            </button>)}
          </>}
          {normalized && routeMatches.length === 0 && taskMatches.length === 0 && roadmapMatches.length === 0 && habitMatches.length === 0 && <div className="command-empty">No matches for “{query}”. Try a page name, task title, roadmap or habit.</div>}
        </div>
        <div className="command-footer"><span><Command size={13} aria-hidden="true" /> Search stays local to this device</span><span><kbd>Esc</kbd> to close</span></div>
      </section>
    </div>
  );
}
