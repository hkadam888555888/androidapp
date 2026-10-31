import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { appStore, useAppStore } from '../../application/appStore';
import { getCurrentDate } from '../../application/appStore';
import { generateAndPersistPlan } from '../../application/planService';
import { buildDailyReview } from '../../domain/services/reviewService';
import type { DailyTask } from '../../domain/entities/models';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TaskFocusDialog } from '../tasks/TaskFocusDialog';

export function DashboardPage() {
  const state = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const date = getCurrentDate();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [focusedTask, setFocusedTask] = useState<DailyTask | null>(null);
  useEffect(() => {
    const focusTaskId = (location.state as { focusTaskId?: unknown } | null)?.focusTaskId;
    if (typeof focusTaskId !== 'string') return;
    const task = state.dailyTasks.find((item) => item.id === focusTaskId && item.date === date && item.status === 'planned');
    if (task) setFocusedTask(task);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate, state.dailyTasks, date]);

  const todayTasks = state.dailyTasks.filter((task) => task.date === date && task.status !== 'cancelled' && task.status !== 'rescheduled').sort((a, b) => (a.plannedWindow?.start ?? '').localeCompare(b.plannedWindow?.start ?? ''));
  const waterToday = state.waterLogs.filter((x) => x.date === date).reduce((sum, x) => sum + x.amountMl, 0);
  const exerciseToday = state.exerciseLogs.filter((x) => x.date === date).reduce((sum, x) => sum + (x.durationMinutes ?? 0), 0);
  const pendingReview = useMemo(() => buildDailyReview(state.dailyTasks, date), [state.dailyTasks, date]);
  const activeRoadmap = state.roadmaps.find((r) => r.active);
  const hasCurrentPlan = state.dayPlans.some((plan) => plan.date === date && plan.state !== 'superseded');
  const autoPlanAttemptedForDate = useRef<string | null>(null);

  useEffect(() => {
    if (!state.ready || !state.preferences?.onboardingCompleted || !activeRoadmap || hasCurrentPlan) return;
    if (autoPlanAttemptedForDate.current === date) return;

    autoPlanAttemptedForDate.current = date;
    setBusy(true);
    setNotice('Preparing today’s routine from your roadmap and available time…');
    void generateAndPersistPlan(date)
      .then(({ tasks }) => {
        setNotice(tasks.length
          ? `Today’s schedule is ready: ${tasks.length} block${tasks.length === 1 ? '' : 's'} planned.`
          : 'Your roadmap is saved, but no work fit today’s available time. Review your study window and capacity in Planner.');
      })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : 'Could not prepare today’s routine. Open Planner to retry.');
      })
      .finally(() => setBusy(false));
  }, [state.ready, state.preferences?.onboardingCompleted, activeRoadmap?.id, hasCurrentPlan, date]);

  const completed = todayTasks.filter((task) => task.status === 'completed').length;
  const reported = todayTasks.filter((task) => task.status === 'completed' || task.status === 'partial' || task.status === 'skipped').length;
  const progress = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0;

  async function regenerate() {
    setBusy(true); setNotice('');
    try { await generateAndPersistPlan(date); setNotice('Today’s plan regenerated from the latest local state.'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not generate a plan.'); }
    finally { setBusy(false); }
  }

  async function report(id: string, result: 'completed' | 'skipped', actualDurationMinutes?: number) {
    try { await appStore.reportTask(id, result, result === 'skipped' ? 'Skipped from Today' : undefined, actualDurationMinutes); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not report task.'); }
  }

  const currentTask = todayTasks.find((task) => task.status === 'planned');

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>Today</h1><p className="muted">{currentTask ? `Next: ${currentTask.title}` : todayTasks.length === 0 ? (activeRoadmap ? (busy ? 'Preparing today’s schedule…' : hasCurrentPlan ? 'Nothing could be scheduled with the current plan. Adjust your availability or task priorities.' : 'Your roadmap is saved. Preparing your first schedule…') : 'Start by adding a roadmap.') : pendingReview.required ? 'Your planned work is done. Review the day before moving on.' : 'Your scheduled work is finished. Check your progress or plan the next day.'}</p></div><div className="header-actions">{todayTasks.length > 0 && <button className="button secondary" onClick={regenerate} disabled={busy}>{busy ? 'Building…' : 'Regenerate plan'}</button>}{currentTask ? <button className="button primary" onClick={() => setFocusedTask(currentTask)}>Start focus</button> : todayTasks.length === 0 ? (activeRoadmap ? hasCurrentPlan ? <Link className="button primary" to="/planner">Adjust plan</Link> : <button className="button primary" onClick={regenerate} disabled={busy}>{busy ? 'Building…' : 'Generate today'}</button> : <Link className="button primary" to="/roadmap">Open roadmap</Link>) : pendingReview.required ? <Link className="button primary" to="/review">Review day</Link> : <Link className="button primary" to="/statistics">View progress</Link>}</div></header>

    {pendingReview.required && <div className="review-banner"><div><strong>Daily Review Required</strong><span>{pendingReview.unresolvedTaskIds?.length ?? 0} task(s) still need an explicit result. Nothing is assumed complete.</span></div><Link className="button primary" to="/review">Review</Link></div>}
    {notice && <div className="notice-bar">{notice}</div>}

    <div className="stats-grid">
      <article className="card stat-card"><span>Today progress</span><strong>{progress}%</strong><small>{completed}/{todayTasks.length} completed · {reported} reported</small><ProgressBar value={progress} label="Today's completed tasks" /></article>
      <article className="card stat-card"><span>Planned study</span><strong>{todayTasks.reduce((s, t) => s + t.plannedMinutes, 0)} min</strong><small>Explicitly scheduled blocks only</small></article>
      <article className="card stat-card"><span>Exercise</span><strong>{exerciseToday} min</strong><small>{(state.habits.find((h) => h.kind === 'exercise' && h.active)?.targetValue ?? 0) > 0 ? `${state.habits.find((h) => h.kind === 'exercise' && h.active)!.targetValue} min target` : 'No target configured'}</small></article>
      <article className="card stat-card"><span>Water</span><strong>{waterToday} ml</strong><small>{(state.habits.find((h) => h.kind === 'water' && h.active)?.targetValue ?? 0) > 0 ? `${state.habits.find((h) => h.kind === 'water' && h.active)!.targetValue} ml target` : 'No target configured'} · logged only</small></article>
    </div>

    <div className="content-grid">
      <article className="card large-card"><div className="card-heading"><div><span className="eyebrow">Execution</span><h2>Today's routine</h2></div><span className={todayTasks.length ? 'pill success-pill' : 'pill'}>{todayTasks.length ? `${todayTasks.length} blocks` : 'No plan'}</span></div>
        {todayTasks.length === 0 ? <div className="empty-state"><div className="empty-icon">✦</div><h3>{activeRoadmap ? (busy ? 'Preparing your day' : hasCurrentPlan ? 'Your schedule needs adjusting' : 'Preparing your first day') : 'Start with your roadmap'}</h3><p>{activeRoadmap ? (busy ? 'Using your saved roadmap and study window to build today’s schedule.' : hasCurrentPlan ? 'No schedulable blocks were produced. Review your study window, daily capacity, and task prerequisites in Planner, then adjust the plan.' : 'Your roadmap is saved. Your first schedule is being prepared automatically.') : 'Import and save a roadmap to give the planner meaningful work to schedule.'}</p></div> : <div className="timeline">{todayTasks.map((task) => <div key={task.id} className={`timeline-item ${task.status}`}><div className="timeline-time">{task.plannedWindow?.start}<span>{task.plannedWindow?.end}</span></div><div className="timeline-card"><div><strong>{task.title}</strong><span>{task.plannedMinutes} min · {task.kind}</span></div><div className="row-actions">{task.status === 'planned' ? <><button className="button secondary" onClick={() => setFocusedTask(task)}>Focus</button><button className="button success" onClick={() => report(task.id, 'completed')}>Complete</button><button className="button danger" onClick={() => report(task.id, 'skipped')}>Skip</button></> : <StatusBadge status={task.status} />}</div></div></div>)}</div>}
      </article>
      <article className="card"><div className="card-heading"><div><span className="eyebrow">Quick actions</span><h2>Reality inputs</h2></div></div><div className="quick-grid"><Link to="/planner" className="quick-action"><strong>+ Urgent work</strong><span>Add a conflict and replan.</span></Link><Link to="/habits" className="quick-action"><strong>Log exercise</strong><span>Record today explicitly.</span></Link><Link to="/habits" className="quick-action"><strong>Log water</strong><span>Track intake without guessing.</span></Link><Link to="/review" className="quick-action"><strong>Open review</strong><span>Resolve any unreported work.</span></Link></div></article>
    </div>
    {focusedTask && <TaskFocusDialog
      task={focusedTask}
      onClose={() => setFocusedTask(null)}
      onComplete={(actualDurationMinutes) => { void report(focusedTask.id, 'completed', actualDurationMinutes); setFocusedTask(null); }}
      onSkip={() => { void report(focusedTask.id, 'skipped'); setFocusedTask(null); }}
    />}
  </section>;
}
