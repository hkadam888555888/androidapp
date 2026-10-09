import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { appStore, useAppStore } from '../../application/appStore';
import { getCurrentDate } from '../../application/appStore';
import { generateAndPersistPlan } from '../../application/planService';
import { buildDailyReview } from '../../domain/services/reviewService';

export function DashboardPage() {
  const state = useAppStore();
  const date = getCurrentDate();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const todayTasks = state.dailyTasks.filter((task) => task.date === date && task.status !== 'cancelled' && task.status !== 'rescheduled').sort((a, b) => (a.plannedWindow?.start ?? '').localeCompare(b.plannedWindow?.start ?? ''));
  const waterToday = state.waterLogs.filter((x) => x.date === date).reduce((sum, x) => sum + x.amountMl, 0);
  const exerciseToday = state.exerciseLogs.filter((x) => x.date === date).reduce((sum, x) => sum + (x.durationMinutes ?? 0), 0);
  const pendingReview = useMemo(() => buildDailyReview(state.dailyTasks, date), [state.dailyTasks, date]);
  const activeRoadmap = state.roadmaps.find((r) => r.active);
  const completed = todayTasks.filter((task) => task.status === 'completed').length;
  const reported = todayTasks.filter((task) => task.status === 'completed' || task.status === 'partial' || task.status === 'skipped').length;
  const progress = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0;

  async function regenerate() {
    setBusy(true); setNotice('');
    try { await generateAndPersistPlan(date); setNotice('Today’s plan regenerated from the latest local state.'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not generate a plan.'); }
    finally { setBusy(false); }
  }

  async function report(id: string, result: 'completed' | 'skipped') {
    try { await appStore.reportTask(id, result, result === 'skipped' ? 'Skipped from Today' : undefined); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not report task.'); }
  }

  const currentTask = todayTasks.find((task) => task.status === 'planned');

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>Today</h1><p className="muted">{currentTask ? `Next: ${currentTask.title}` : 'Your routine is waiting for the next explicit action.'}</p></div><div className="header-actions"><button className="button secondary" onClick={regenerate} disabled={busy}>{busy ? 'Building…' : 'Regenerate plan'}</button><Link className="button primary" to={currentTask ? '/today' : '/roadmap'}>{currentTask ? 'Start next task' : 'Add roadmap'}</Link></div></header>

    {pendingReview.required && <div className="review-banner"><div><strong>Daily Review Required</strong><span>{pendingReview.unresolvedTaskIds?.length ?? 0} task(s) still need an explicit result. Nothing is assumed complete.</span></div><Link className="button primary" to="/review">Review</Link></div>}
    {notice && <div className="notice-bar">{notice}</div>}

    <div className="stats-grid">
      <article className="card stat-card"><span>Today progress</span><strong>{progress}%</strong><small>{completed}/{todayTasks.length} completed · {reported} reported</small></article>
      <article className="card stat-card"><span>Planned study</span><strong>{todayTasks.reduce((s, t) => s + t.plannedMinutes, 0)} min</strong><small>Explicitly scheduled blocks only</small></article>
      <article className="card stat-card"><span>Exercise</span><strong>{exerciseToday} min</strong><small>{state.habits.find((h) => h.kind === 'exercise')?.targetValue ?? 0} min target</small></article>
      <article className="card stat-card"><span>Water</span><strong>{waterToday} ml</strong><small>{state.habits.find((h) => h.kind === 'water')?.targetValue ?? 0} ml target · logged only</small></article>
    </div>

    <div className="content-grid">
      <article className="card large-card"><div className="card-heading"><div><span className="eyebrow">Execution</span><h2>Today's routine</h2></div><span className={todayTasks.length ? 'pill success-pill' : 'pill'}>{todayTasks.length ? `${todayTasks.length} blocks` : 'No plan'}</span></div>
        {todayTasks.length === 0 ? <div className="empty-state"><div className="empty-icon">✦</div><h3>{activeRoadmap ? 'No routine generated yet' : 'Start with your roadmap'}</h3><p>{activeRoadmap ? 'Generate a plan from your current roadmap and available windows.' : 'Import and save your roadmap; the deterministic planner will turn it into today’s work.'}</p>{activeRoadmap ? <button className="button primary" onClick={regenerate}>Generate today</button> : <Link className="button primary" to="/roadmap">Open roadmap</Link>}</div> : <div className="timeline">{todayTasks.map((task) => <div key={task.id} className={`timeline-item ${task.status}`}><div className="timeline-time">{task.plannedWindow?.start}<span>{task.plannedWindow?.end}</span></div><div className="timeline-card"><div><strong>{task.title}</strong><span>{task.plannedMinutes} min · {task.kind}</span></div><div className="row-actions">{task.status === 'planned' ? <><button className="button success" onClick={() => report(task.id, 'completed')}>Complete</button><button className="button danger" onClick={() => report(task.id, 'skipped')}>Skip</button></> : <span className="pill">{task.status}</span>}</div></div></div>)}</div>}
      </article>
      <article className="card"><div className="card-heading"><div><span className="eyebrow">Quick actions</span><h2>Reality inputs</h2></div></div><div className="quick-grid"><Link to="/planner" className="quick-action"><strong>+ Urgent work</strong><span>Add a conflict and replan.</span></Link><Link to="/habits" className="quick-action"><strong>Log exercise</strong><span>Record today explicitly.</span></Link><Link to="/habits" className="quick-action"><strong>Log water</strong><span>Track intake without guessing.</span></Link><Link to="/review" className="quick-action"><strong>Open review</strong><span>Resolve any unreported work.</span></Link></div></article>
    </div>
  </section>;
}
