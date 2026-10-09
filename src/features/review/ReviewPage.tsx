import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { appStore, useAppStore, getCurrentDate } from '../../application/appStore';
import { previousISO } from '../../application/date';
import { buildDailyReview } from '../../domain/services/reviewService';
import { calculatePace, detectRepeatedSkips } from '../../domain/services/adaptationService';
import type { DailyTask } from '../../domain/entities/models';

export function ReviewPage() {
  const state = useAppStore();
  const [notice, setNotice] = useState('');
  const [energy, setEnergy] = useState<'low' | 'medium' | 'high' | ''>('');
  const [reflection, setReflection] = useState('');
  const [blocker, setBlocker] = useState('');
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const targetDate = previousISO(getCurrentDate());
  const tasks = useMemo(() => state.dailyTasks.filter((task) => task.date === targetDate), [state.dailyTasks, targetDate]);
  const unresolved = tasks.filter((task) => task.status === 'unreported' || task.status === 'planned');
  const review = buildDailyReview(state.dailyTasks, targetDate);
  const repeatedSkips = detectRepeatedSkips(state.dailyTasks);
  const activeRoadmaps = state.roadmaps.filter((roadmap) => roadmap.active);
  const pace = state.preferences ? activeRoadmaps.map((roadmap) => calculatePace(roadmap, state.roadmapTasks, state.dailyTasks, getCurrentDate(), state.preferences!.maxStudyMinutesPerDay ?? 180)) : [];

  async function resolve(task: DailyTask, result: 'completed' | 'partial' | 'skipped') {
    try {
      const actual = actuals[task.id] ? Number(actuals[task.id]) : undefined;
      if (actual !== undefined && (!Number.isFinite(actual) || actual <= 0)) throw new Error('Actual duration must be greater than zero.');
      await appStore.reportTask(task.id, result, result === 'skipped' ? 'Reported during daily review' : undefined, actual, energy || undefined);
      setNotice('Result recorded. The historical task remains explicit and auditable.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not record result.'); }
  }

  async function completeReview() {
    const snapshot = appStore.getSnapshot();
    const next = buildDailyReview(snapshot.dailyTasks, targetDate);
    if (next.required) { setNotice('Resolve every unreported task before closing the review.'); return; }
    const estimatedMinutes = snapshot.dailyTasks.filter((task) => task.date === targetDate).reduce((sum, task) => sum + task.plannedMinutes, 0);
    const actualMinutes = snapshot.dailyTasks.filter((task) => task.date === targetDate).reduce((sum, task) => sum + (task.actualDurationMinutes ?? 0), 0);
    const completedReview = { ...next, required: false, status: 'completed' as const, resolvedAt: new Date().toISOString(), reflection: reflection.trim() || undefined, blocker: blocker.trim() || undefined, energy: energy || undefined, estimatedMinutes, actualMinutes, adaptationNote: repeatedSkips.length ? `${repeatedSkips.length} repeated-skip pattern(s) detected for future adaptation.` : 'No repeated-skip pattern detected in the current history.' };
    await appStore.saveDailyReview(completedReview);
    const learned = await appStore.rebuildAdaptationModel();
    for (const roadmap of state.roadmaps.filter((candidate) => candidate.active)) {
      if (!state.preferences) continue;
      const snap = calculatePace(roadmap, appStore.getSnapshot().roadmapTasks, appStore.getSnapshot().dailyTasks, getCurrentDate(), state.preferences.maxStudyMinutesPerDay ?? 180);
      await appStore.saveAdaptationSnapshot(snap);
    }
    setNotice(`Review closed. Learned estimates updated for ${learned.estimationProfiles.length} scope(s); time-pattern profiles updated for ${learned.timePatternProfiles.length} scope(s).`);
  }

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">Adaptation checkpoint</p><h1>Daily Review</h1><p className="muted">Report what actually happened. The system uses explicit results to learn duration, timing patterns, pace, and repeated friction.</p></div><Link className="button secondary" to="/today">Back to Today</Link></header>
    {notice && <div className="notice-bar">{notice}</div>}

    <div className="settings-grid">
      <article className="card"><div className="card-heading"><div><span className="eyebrow">{targetDate}</span><h2>Results</h2></div><span className={unresolved.length ? 'pill warning' : 'pill success-pill'}>{unresolved.length ? `${unresolved.length} unresolved` : 'All reported'}</span></div>
        {tasks.length === 0 && <div className="empty-state compact"><h3>No task instances for this day</h3><p>There is nothing to falsely infer.</p></div>}
        {tasks.length > 0 && <div className="review-stack">{tasks.map((task) => <div className="review-task" key={task.id}><div className="review-task-main"><strong>{task.title}</strong><span>{task.plannedMinutes} min planned · {task.status}</span><label>Actual minutes<input type="number" min="1" value={actuals[task.id] ?? (task.actualDurationMinutes ?? '')} onChange={(e) => setActuals({ ...actuals, [task.id]: e.target.value })} /></label></div><div className="review-actions">{task.status === 'unreported' || task.status === 'planned' ? <><button className="button success" onClick={() => resolve(task, 'completed')}>Completed</button><button className="button secondary" onClick={() => resolve(task, 'partial')}>Partial</button><button className="button danger" onClick={() => resolve(task, 'skipped')}>Skipped</button></> : <span className="pill">{task.status}</span>}</div></div>)}</div>}
        <div className="setting-form review-reflection"><label>Energy (optional)<select value={energy} onChange={(e) => setEnergy(e.target.value as typeof energy)}><option value="">Not reported</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Reflection<textarea rows={3} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="What helped or hurt the plan today?" /></label><label>Blocker / friction<textarea rows={2} value={blocker} onChange={(e) => setBlocker(e.target.value)} placeholder="Optional: too large, travel, interruption, unclear task…" /></label></div>
        <div className="review-footer"><span className="muted">Review state: {review.required ? 'BLOCKED_PENDING_REPORT' : state.dailyReviews.find((r) => r.date === targetDate)?.status ?? 'READY'}</span><button className="button primary" onClick={completeReview} disabled={review.required}>Close review & adapt</button></div>
      </article>

      <aside className="card"><span className="eyebrow">Learning loop</span><h2>What changes next</h2><div className="checklist"><span>✓ Actual duration updates learned estimates</span><span>✓ Repeated results reveal usable time windows</span><span>✓ Pace is a projection, not a promise</span><span>✓ Past outcomes remain unchanged</span></div>{pace.length > 0 && <div className="adaptation-pace-list" style={{ marginTop: 14 }}>{pace.map((item) => <div className="info-box" key={item.id}><strong>{item.paceStatus} · {activeRoadmaps.find((r) => r.id === item.roadmapId)?.title}</strong><span>{item.message}</span><span>{item.remainingMinutes} min remaining · typical {item.typicalDailyCapacityMinutes} min/day</span></div>)}</div>}</aside>
    </div>

    {repeatedSkips.length > 0 && <article className="card adaptation-card"><div className="card-heading"><div><span className="eyebrow">Adaptive signal</span><h2>Repeated skips detected</h2></div><span className="pill warning">{repeatedSkips.length}</span></div><div className="issue-list">{repeatedSkips.map((item) => <div className="issue" key={item.sourceTaskId}><strong>{item.skips} skips</strong><span>{item.title} — {item.suggestion}</span></div>)}</div></article>}
  </section>;
}
