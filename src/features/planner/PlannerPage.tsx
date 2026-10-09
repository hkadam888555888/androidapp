import { useState } from 'react';
import { generateAndPersistPlan } from '../../application/planService';
import { appStore, useAppStore, getCurrentDate } from '../../application/appStore';
import { createId } from '../../lib/id';
import type { BusyEvent, ExternalTaskCategory, TaskPriority } from '../../domain/entities/models';
import { explainPlannerDecisionWithAI } from '../../domain/ai/aiService';

export function PlannerPage() {
  const state = useAppStore();
  const date = getCurrentDate();
  const [notice, setNotice] = useState('');
  const [building, setBuilding] = useState(false);
  const [busyOpen, setBusyOpen] = useState(false);
  const [externalOpen, setExternalOpen] = useState(false);
  const [busyForm, setBusyForm] = useState({ title: '', start: '14:00', end: '18:00', priority: 'high' as TaskPriority });
  const [aiExplanation, setAiExplanation] = useState<{ id: string; text: string } | null>(null);
  const [externalForm, setExternalForm] = useState({ title: '', category: 'PERSONAL' as ExternalTaskCategory, priority: 'medium' as TaskPriority, minutes: 30, dueDate: date, fixed: false, start: '17:00', end: '17:30' });
  const todayPlan = state.dayPlans.filter((plan) => plan.date === date).sort((a,b) => b.version - a.version)[0];
  const todayTasks = state.dailyTasks.filter((task) => task.date === date).sort((a,b) => (a.plannedWindow?.start ?? '').localeCompare(b.plannedWindow?.start ?? ''));
  const decisions = state.plannerDecisions.filter((decision) => decision.planId === todayPlan?.id);
  const selectedDecisions = decisions.filter((decision) => decision.selected);
  const rejectedDecisions = decisions.filter((decision) => !decision.selected);
  const mode = state.plannerSettings?.activeMode ?? 'normal';

  async function generate() {
    setBuilding(true); setNotice('');
    try {
      const result = await generateAndPersistPlan(date);
      setNotice(`${result.tasks.length} daily instances generated in ${result.plan.mode ?? mode} mode. ${result.warnings.length ? result.warnings.join(' ') : result.plan.state === 'draft' ? 'Draft gate active.' : 'Plan is final.'}`);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Planner failed.'); }
    finally { setBuilding(false); }
  }

  async function addBusyEvent() {
    if (!busyForm.title.trim() || busyForm.end <= busyForm.start) { setNotice('Enter a title and a valid time range.'); return; }
    const event: BusyEvent = { id: createId('busy'), date, title: busyForm.title.trim(), window: { start: busyForm.start, end: busyForm.end }, priority: busyForm.priority, blocksPlanning: true, fixed: true };
    await appStore.saveBusyEvent(event);
    setBusyOpen(false);
    setNotice('Busy event added. Regenerate the plan to account for it.');
  }

  async function addExternalTask() {
    if (!externalForm.title.trim() || !Number.isFinite(externalForm.minutes) || externalForm.minutes < 5 || externalForm.minutes > 1440) { setNotice('Enter a title and a duration from 5 to 1440 minutes.'); return; }
    if (externalForm.fixed && externalForm.end <= externalForm.start) { setNotice('Enter a valid fixed time range.'); return; }
    if (externalForm.fixed) {
      const start = Number(externalForm.start.slice(0, 2)) * 60 + Number(externalForm.start.slice(3));
      const end = Number(externalForm.end.slice(0, 2)) * 60 + Number(externalForm.end.slice(3));
      if (end - start < externalForm.minutes) { setNotice('The fixed time window is shorter than the estimated duration.'); return; }
    }
    const now = new Date().toISOString();
    await appStore.saveExternalTask({
      id: createId('external'), title: externalForm.title.trim(), category: externalForm.category, estimatedMinutes: Math.round(externalForm.minutes), priority: externalForm.priority,
      dueDate: externalForm.dueDate || undefined, fixedWindow: externalForm.fixed ? { start: externalForm.start, end: externalForm.end } : undefined,
      status: 'planned', active: true, splittable: false, createdAt: now, updatedAt: now,
    });
    setExternalOpen(false);
    setNotice('External task added to the global planner. Regenerate to schedule it.');
  }

  const pendingExternal = state.externalTasks.filter((task) => task.active && (task.status === 'planned' || task.status === 'rescheduled' || task.status === 'unreported')).sort((a,b) => b.priority.localeCompare(a.priority));
  const activeRoadmaps = state.roadmaps.filter((roadmap) => roadmap.active);
  const shareTotal = activeRoadmaps.reduce((sum, roadmap) => sum + (roadmap.capacitySharePercentage ?? 0), 0);

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">Scheduling engine</p><h1>Planner</h1><p className="muted">One global capacity pool across active roadmaps, habits, external work, busy windows, and review constraints.</p></div><div className="header-actions"><button className="button secondary" onClick={() => setExternalOpen((v) => !v)}>+ External task</button><button className="button secondary" onClick={() => setBusyOpen((v) => !v)}>Add busy block</button><button className="button primary" onClick={generate} disabled={building}>{building ? 'Building…' : 'Generate today'}</button></div></header>
    {notice && <div className="notice-bar">{notice}</div>}

    {(externalOpen || busyOpen) && <div className="settings-grid planner-input-grid">
      {externalOpen && <article className="card form-card"><div className="card-heading"><div><span className="eyebrow">Reality input</span><h2>External task</h2></div></div><div className="form-row"><label>Title<input value={externalForm.title} onChange={(e) => setExternalForm({ ...externalForm, title: e.target.value })} placeholder="College assignment / payment / shopping" /></label><label>Category<select value={externalForm.category} onChange={(e) => setExternalForm({ ...externalForm, category: e.target.value as ExternalTaskCategory })}><option value="PERSONAL">Personal</option><option value="COLLEGE">College</option><option value="WORK">Work</option><option value="URGENT">Urgent</option></select></label></div><div className="form-row"><label>Priority<select value={externalForm.priority} onChange={(e) => setExternalForm({ ...externalForm, priority: e.target.value as TaskPriority })}><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label>Estimated minutes<input type="number" min="5" max="1440" value={externalForm.minutes} onChange={(e) => setExternalForm({ ...externalForm, minutes: Number(e.target.value) })} /></label></div><div className="form-row"><label>Due date<input type="date" value={externalForm.dueDate} onChange={(e) => setExternalForm({ ...externalForm, dueDate: e.target.value })} /></label><label className="setting-row"><span><strong>Fixed time</strong><small>Use for a timed call/event that must fit exactly.</small></span><input type="checkbox" checked={externalForm.fixed} onChange={(e) => setExternalForm({ ...externalForm, fixed: e.target.checked })} /></label></div>{externalForm.fixed && <div className="form-row"><label>Start<input type="time" value={externalForm.start} onChange={(e) => setExternalForm({ ...externalForm, start: e.target.value })} /></label><label>End<input type="time" value={externalForm.end} onChange={(e) => setExternalForm({ ...externalForm, end: e.target.value })} /></label></div>}<div className="toolbar"><button className="button primary" onClick={addExternalTask}>Save external task</button></div></article>}
      {busyOpen && <article className="card form-card"><div className="card-heading"><div><span className="eyebrow">Reality input</span><h2>Busy block</h2></div></div><div className="form-row"><label>Title<input value={busyForm.title} onChange={(e) => setBusyForm({ ...busyForm, title: e.target.value })} placeholder="College / appointment / travel" /></label><label>Priority<select value={busyForm.priority} onChange={(e) => setBusyForm({ ...busyForm, priority: e.target.value as TaskPriority })}><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div><div className="form-row"><label>Start<input type="time" value={busyForm.start} onChange={(e) => setBusyForm({ ...busyForm, start: e.target.value })} /></label><label>End<input type="time" value={busyForm.end} onChange={(e) => setBusyForm({ ...busyForm, end: e.target.value })} /></label></div><div className="toolbar"><button className="button primary" onClick={addBusyEvent}>Save busy block</button></div></article>}
    </div>}

    <div className="card planner-logic"><div className="card-heading"><div><span className="eyebrow">Global planning state</span><h2>Planning constraints</h2></div><span className={`pill ${todayPlan?.state === 'final' ? 'success-pill' : ''}`}>{todayPlan ? `${todayPlan.state.toUpperCase()} · v${todayPlan.version}` : 'No plan yet'}</span></div><div className="logic-grid"><span><strong>{activeRoadmaps.length}</strong> active roadmaps</span><span><strong>{shareTotal || 0}%</strong> declared shares</span><span><strong>{mode.toUpperCase()}</strong> capacity mode</span><span>Hard dependencies</span><span>Busy blocks</span><span>Daily review gate</span></div></div>

    <div className="settings-grid"><article className="card"><div className="card-heading"><div><span className="eyebrow">Roadmap pool</span><h2>Capacity allocation</h2></div><span className="pill">{activeRoadmaps.length} active</span></div>{activeRoadmaps.length === 0 ? <p className="muted">No active roadmap work. External tasks can still be planned.</p> : activeRoadmaps.map((roadmap) => <div className="setting-row" key={roadmap.id}><div><strong>{roadmap.title}</strong><span>{roadmap.priority ?? 'medium'} priority · {roadmap.capacitySharePercentage === undefined ? 'flexible' : `${roadmap.capacitySharePercentage}% soft share`}</span></div><span className="pill">{state.roadmapTasks.filter((task) => task.roadmapId === roadmap.id && !task.completedOverall && task.active !== false).length} open</span></div>)}</article><article className="card"><div className="card-heading"><div><span className="eyebrow">External work</span><h2>Pending</h2></div><span className="pill">{pendingExternal.length}</span></div>{pendingExternal.length === 0 ? <p className="muted">No external tasks waiting.</p> : pendingExternal.slice(0, 8).map((task) => <div className="setting-row" key={task.id}><div><strong>{task.title}</strong><span>{task.category} · {task.estimatedMinutes} min{task.dueDate ? ` · due ${task.dueDate.slice(0,10)}` : ''}</span></div><span className="pill warning">{task.priority}</span></div>)}</article></div>

    <article className="card"><div className="card-heading"><div><span className="eyebrow">{date}</span><h2>Schedule preview</h2></div><span className="pill">{todayTasks.reduce((s,t) => s+t.plannedMinutes,0)} min planned</span></div>{todayTasks.length === 0 ? <div className="timeline-empty">Generate a plan after your roadmaps, mode, and external work are configured.</div> : <div className="timeline">{todayTasks.map((task) => <div className="timeline-item" key={task.id}><div className="timeline-time">{task.plannedWindow?.start}<span>{task.plannedWindow?.end}</span></div><div className="timeline-card"><div><strong>{task.title}</strong><span>{task.plannedMinutes} min · {task.kind}{task.sourceExternalTaskId ? ' · external' : ''}</span></div><div className="row-actions"><span className="pill">{task.priority}</span>{(task.sourceTaskId || task.sourceExternalTaskId) && task.status === 'planned' && <><button className="button secondary small-button" onClick={async () => { await appStore.recordPlannerOverride(task.sourceTaskId ?? task.sourceExternalTaskId!, date, 'skip_today'); setNotice('Skip-today override recorded. Regenerate to apply it.'); }}>Skip today</button><button className="button secondary small-button" onClick={async () => { await appStore.recordPlannerOverride(task.sourceTaskId ?? task.sourceExternalTaskId!, date, 'lock'); setNotice('Lock override recorded and kept in the audit trail.'); }}>Lock</button><button className="button secondary small-button" onClick={async () => { const value = window.prompt('New duration in minutes', String(task.plannedMinutes)); const minutes = Number(value); if (Number.isFinite(minutes) && minutes > 0) { await appStore.recordPlannerOverride(task.sourceTaskId ?? task.sourceExternalTaskId!, date, 'change_duration', { minutes: Math.round(minutes) }); setNotice('Duration override recorded. Regenerate to apply it.'); } }}>Duration</button><button className="button secondary small-button" onClick={async () => { const value = window.prompt('Move to date (YYYY-MM-DD)', date); if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) { await appStore.recordPlannerOverride(task.sourceTaskId ?? task.sourceExternalTaskId!, date, 'move', { targetDate: value }); setNotice(`Move override recorded for ${value}.`); } }}>Move</button></>}</div></div></div>)}</div>}</article>
    {todayPlan?.reason && <article className="card"><span className="eyebrow">Planner note</span><p className="small-copy">{todayPlan.reason}</p></article>}
    {aiExplanation && <article className="card"><div className="card-heading"><div><span className="eyebrow">Bounded AI explanation</span><h2>Grounded in planner facts</h2></div><span className="pill">AI</span></div><p className="small-copy">{aiExplanation.text}</p></article>}
    {decisions.length > 0 && <article className="card planner-decisions"><div className="card-heading"><div><span className="eyebrow">Explainability</span><h2>Why this plan looks like this</h2></div><span className="pill">{selectedDecisions.length} selected · {rejectedDecisions.length} not selected</span></div><div className="decision-list">{decisions.slice().sort((a,b) => Number(b.selected) - Number(a.selected) || b.score - a.score).slice(0, 32).map((decision) => <div className="decision-row" key={decision.id}><div><strong>{decision.candidateId.replace(/^roadmap:/, '').replace(/^habit:/, 'Habit · ').replace(/^external:/, 'External · ')}</strong><span>{decision.reasonCodes.join(' · ')}{decision.rejectedReason ? ` · ${decision.rejectedReason}` : ''}</span></div><div className="row-actions"><button className="button secondary small-button" onClick={async () => { try { const roadmapId = state.roadmapTasks.find((t) => t.id === decision.candidateId || decision.candidateId.includes(t.id))?.roadmapId ?? state.roadmaps[0]?.id ?? 'global'; const facts = [`selected=${decision.selected}`, `score=${decision.score}`, `reasonCodes=${decision.reasonCodes.join(', ')}`, ...Object.entries(decision.constraintResults).map(([key, value]) => `${key}=${value}`)]; const output = await explainPlannerDecisionWithAI(roadmapId, decision.selected ? 'Scheduled this candidate' : 'Did not schedule this candidate', facts, { settings: state.aiSettings }); await appStore.saveAIArtifact(output.artifact); setAiExplanation({ id: decision.id, text: output.explanation }); } catch (error) { setNotice(error instanceof Error ? error.message : 'AI explanation failed.'); } }}>Explain</button><span className={`pill ${decision.selected ? 'success-pill' : 'warning'}`}>{decision.selected ? `Selected · ${decision.score}` : `Not selected · ${decision.score}`}</span></div></div>)}</div></article>}
    {state.busyEvents.filter((e) => e.date === date).length > 0 && <article className="card" style={{ marginTop: 14 }}><div className="card-heading"><h2>Today's blocked windows</h2><span className="pill">{state.busyEvents.filter((e) => e.date === date).length}</span></div>{state.busyEvents.filter((e) => e.date === date).map((event) => <div className="setting-row" key={event.id}><div><strong>{event.title}</strong><span>{event.window.start}–{event.window.end}</span></div><span className="pill warning">{event.priority}</span></div>)}</article>}
  </section>;
}
