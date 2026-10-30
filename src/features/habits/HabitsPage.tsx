import { useMemo, useState } from 'react';
import { appStore, useAppStore, getCurrentDate } from '../../application/appStore';
import { buildHabitOccurrence, habitSummary } from '../../domain/services/habitEngine';
import type { Habit, HabitStreakPolicy, HabitRecurrence } from '../../domain/entities/models';
import { createId } from '../../lib/id';

export function HabitsPage() {
  const state = useAppStore();
  const date = getCurrentDate();
  const [waterAmount, setWaterAmount] = useState(state.habits.find((h) => h.kind === 'water' && h.active)?.targetValue ? Math.min(500, state.habits.find((h) => h.kind === 'water' && h.active)!.targetValue) : 250);
  const [exerciseMinutes, setExerciseMinutes] = useState(state.habits.find((h) => h.kind === 'exercise' && h.active)?.targetValue ?? 30);
  const [notice, setNotice] = useState('');
  const [exerciseGoalDraft, setExerciseGoalDraft] = useState(30);
  const [waterGoalDraft, setWaterGoalDraft] = useState(2500);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'water' | 'exercise'; id: string } | null>(null);
  const waterHabit = state.habits.find((h) => h.kind === 'water' && h.active);
  const exerciseHabit = state.habits.find((h) => h.kind === 'exercise' && h.active);
  const waterTarget = waterHabit?.targetValue ?? 0;
  const exerciseTarget = exerciseHabit?.targetValue ?? 0;
  const waterToday = useMemo(() => state.waterLogs.filter((x) => x.date === date).reduce((s, x) => s + x.amountMl, 0), [state.waterLogs, date]);
  const exerciseToday = useMemo(() => state.exerciseLogs.filter((x) => x.date === date).reduce((s, x) => s + (x.durationMinutes ?? 0), 0), [state.exerciseLogs, date]);
  const habitCards = state.habits.filter((h) => h.active).map((habit) => ({ habit, occurrence: buildHabitOccurrence(habit, date, state.habitLogs, state.waterLogs, state.exerciseLogs), summary: habitSummary(habit, `${date.slice(0,4)}-01-01`, date, state.habitLogs, state.waterLogs, state.exerciseLogs) }));
  const recentWater = state.waterLogs.slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 10);
  const recentExercise = state.exerciseLogs.slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 10);
  const exerciseStatus = exerciseTarget <= 0 ? 'No target configured' : exerciseToday >= exerciseTarget ? 'Target reached' : exerciseToday > 0 ? 'In progress' : 'Not started';

  async function logWater(amount: number) { try { await appStore.logWater(date, amount); setNotice(`Logged +${amount} ml.`); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not log water.'); } }
  async function logExercise() { try { await appStore.logExercise(date, exerciseMinutes); setNotice(`Logged ${exerciseMinutes} minutes of exercise.`); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not log exercise.'); } }
  async function updateHabit(habit: typeof state.habits[number], patch: Partial<typeof habit>) { try { await appStore.saveHabit({ ...habit, ...patch }); setNotice(`${habit.name} settings saved.`); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save habit settings.'); } }

  async function createTarget(kind: 'exercise' | 'water') {
    const targetValue = kind === 'exercise' ? exerciseGoalDraft : waterGoalDraft;
    if (!Number.isFinite(targetValue) || targetValue <= 0) { setNotice('Enter a target greater than zero.'); return; }
    const habit: Habit = {
      id: createId('habit'), name: kind === 'exercise' ? 'Exercise' : 'Water', kind,
      targetValue, unit: kind === 'exercise' ? 'minutes' : 'ml',
      minimumValue: kind === 'exercise' ? Math.max(1, Math.round(targetValue * 0.5)) : targetValue,
      active: true, preferredWindows: [{ start: '06:00', end: '08:00' }], reminderTimes: [],
      frequencyDays: [0, 1, 2, 3, 4, 5, 6], recurrence: 'daily',
      streakPolicy: kind === 'exercise' ? 'target_or_partial' : 'strict',
      allowPartial: kind === 'exercise', carryOverAllowed: false, priority: kind === 'exercise' ? 'high' : 'medium',
    };
    try { await appStore.saveHabit(habit); setNotice(`${habit.name} target created.`); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not create habit target.'); }
  }

  async function removeEntry() {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === 'water') await appStore.deleteWaterLog(pendingDelete.id);
      else await appStore.deleteExerciseLog(pendingDelete.id);
      setNotice('Entry removed and recorded in the local audit history.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not remove entry.'); }
    finally { setPendingDelete(null); }
  }

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">v0.6 consistency engine</p><h1>Habits</h1></div></header>
    {notice && <div className="notice-bar">{notice}</div>}
    <div className="stats-grid"><article className="card stat-card"><span>Exercise today</span><strong>{exerciseToday} min</strong><small>Target {exerciseTarget} min</small></article><article className="card stat-card"><span>Water today</span><strong>{waterToday} ml</strong><small>Target {waterTarget} ml</small></article><article className="card stat-card"><span>Active habits</span><strong>{state.habits.filter((h) => h.active).length}</strong><small>Each habit follows its own recurrence</small></article><article className="card stat-card"><span>Habit logs</span><strong>{state.habitLogs.length + state.waterLogs.length + state.exerciseLogs.length}</strong><small>Explicitly recorded locally</small></article></div>
    <div className="habit-v06-grid">{habitCards.map(({ habit, occurrence, summary }) => <article className="card" key={habit.id}>
      <div className="card-heading"><div><span className="eyebrow">{habit.kind}</span><h2>{habit.name}</h2></div><span className={`pill ${occurrence.status === 'completed' ? 'success-pill' : occurrence.status === 'unreported' ? 'warning' : ''}`}>{occurrence.status.replace('_',' ')}</span></div>
      <div className="habit-meta"><span>Target <strong>{habit.targetValue} {habit.unit}</strong></span><span>Minimum <strong>{occurrence.minimumValue} {habit.unit}</strong></span><span>Recurrence <strong>{habit.recurrence ?? 'custom'}</strong></span><span>Streak <strong>{summary.current}d</strong></span></div>
      <div className="progress-track"><span style={{ width: `${Math.min(100, summary.adherenceRate)}%` }} /></div><p className="muted small-copy">{summary.adherenceRate}% weighted adherence this year · {summary.completed} complete · {summary.partial} partial · {summary.skipped} skipped · {summary.unreported} unreported</p>
      <div className="card-heading" style={{ marginTop: 10 }}><span className="muted small-copy">Pause this habit without deleting its logs or streak history.</span><button className="button secondary small-button" onClick={() => void updateHabit(habit, { active: false })}>Pause habit</button></div>
      <div className="habit-config">
        <label>Recurrence<select value={habit.recurrence ?? 'custom'} onChange={(e) => updateHabit(habit, { recurrence: e.target.value as HabitRecurrence })}><option value="daily">Daily</option><option value="weekly">Weekly days</option><option value="custom">Custom days</option></select></label>
        <label>Minimum value<input type="number" min="0" max={habit.targetValue} value={habit.minimumValue ?? Math.round(habit.targetValue * 0.5)} onChange={(e) => updateHabit(habit, { minimumValue: Number(e.target.value) })} /></label>
        <label>Streak policy<select value={habit.streakPolicy ?? 'strict'} onChange={(e) => updateHabit(habit, { streakPolicy: e.target.value as HabitStreakPolicy })}><option value="strict">Strict target</option><option value="target_or_partial">Target or partial</option><option value="minimum_value">Minimum value</option></select></label>
        <label className="setting-row"><span>Allow partial<small>Counts as reported; streak depends on policy.</small></span><input type="checkbox" checked={Boolean(habit.allowPartial)} onChange={(e) => updateHabit(habit, { allowPartial: e.target.checked })} /></label>
        <div className="habit-days"><span className="eyebrow">Due days</span><div className="day-chip-list">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, day) => <button key={label} type="button" className={`day-chip ${habit.frequencyDays.includes(day) ? 'active' : ''}`} onClick={() => updateHabit(habit, { frequencyDays: habit.frequencyDays.includes(day) ? habit.frequencyDays.filter((x) => x !== day) : [...habit.frequencyDays, day].sort() })}>{label}</button>)}</div></div>
      </div>
    </article>)}</div>

    <div className="content-grid">
      <article className="card"><div className="card-heading"><div><span className="eyebrow">Exercise</span><h2>Today's session</h2></div><span className="pill">{exerciseStatus}</span></div><div className="form-row"><label>Minutes<input type="number" min="1" value={exerciseMinutes} onChange={(e) => setExerciseMinutes(Number(e.target.value))} /></label><div className="info-box"><strong>{exerciseTarget > 0 ? `Minimum: ${exerciseHabit?.minimumValue ?? Math.max(1, Math.round(exerciseTarget * 0.5))} min` : 'No exercise target set yet'}</strong><span>Partial completion is recorded when enabled and the minimum is reached.</span></div></div><button className="button primary" onClick={logExercise}>Log exercise</button></article>
      <article className="card"><div className="card-heading"><div><span className="eyebrow">Water</span><h2>Today's intake</h2></div><span className="pill">{waterToday}/{waterTarget} ml</span></div><div className="water-buttons"><button className="button" onClick={() => logWater(250)}>+250</button><button className="button" onClick={() => logWater(500)}>+500</button><button className="button" onClick={() => logWater(750)}>+750</button></div><div className="form-row"><label>Custom ml<input type="number" min="1" value={waterAmount} onChange={(e) => setWaterAmount(Number(e.target.value))} /></label><div className="toolbar"><button className="button primary" onClick={() => logWater(waterAmount)}>Log custom</button></div></div></article>
    {state.habits.some((habit) => !habit.active) && <article className="card">
      <div className="card-heading"><div><span className="eyebrow">Paused</span><h2>Paused habits</h2></div><span className="pill">{state.habits.filter((habit) => !habit.active).length}</span></div>
      {state.habits.filter((habit) => !habit.active).map((habit) => <div className="setting-row" key={habit.id}><div><strong>{habit.name}</strong><span>{habit.targetValue} {habit.unit} · {habit.recurrence ?? 'custom'}</span></div><button className="button secondary small-button" onClick={() => void updateHabit(habit, { active: true })}>Resume</button></div>)}
    </article>}
    <div className="content-grid">
      {!exerciseHabit && <article className="card"><div className="card-heading"><div><span className="eyebrow">Configure</span><h2>Exercise target</h2></div></div><p className="muted small-copy">You can record exercise without a target. Add one to track progress and streaks.</p><div className="form-row"><label>Target minutes<input type="number" min="1" max="240" value={exerciseGoalDraft} onChange={(e) => setExerciseGoalDraft(Number(e.target.value))} /></label><button className="button primary" onClick={() => void createTarget('exercise')}>Create exercise target</button></div></article>}
      {!waterHabit && <article className="card"><div className="card-heading"><div><span className="eyebrow">Configure</span><h2>Water target</h2></div></div><p className="muted small-copy">Water entries are always recorded. Add a target to see daily progress.</p><div className="form-row"><label>Target millilitres<input type="number" min="1" max="10000" step="250" value={waterGoalDraft} onChange={(e) => setWaterGoalDraft(Number(e.target.value))} /></label><button className="button primary" onClick={() => void createTarget('water')}>Create water target</button></div></article>}
    </div>

    <article className="card habit-history">
      <div className="card-heading"><div><span className="eyebrow">Recent records</span><h2>Water and exercise history</h2></div><span className="pill">{recentWater.length + recentExercise.length} recent entries</span></div>
      {recentWater.length === 0 && recentExercise.length === 0 ? <div className="empty-state compact"><h3>No entries yet</h3><p>Your logged water and exercise sessions will appear here.</p></div> : <div className="analysis-stack">
        {recentExercise.map((entry) => <div className="setting-row" key={entry.id}><div><strong>Exercise · {entry.durationMinutes ?? 0} min</strong><span>{new Date(entry.recordedAt).toLocaleString()} · {entry.exerciseType ?? 'Exercise'}</span></div><button className="button secondary small-button" onClick={() => setPendingDelete({ kind: 'exercise', id: entry.id })}>Remove</button></div>)}
        {recentWater.map((entry) => <div className="setting-row" key={entry.id}><div><strong>Water · {entry.amountMl} ml</strong><span>{new Date(entry.recordedAt).toLocaleString()}</span></div><button className="button secondary small-button" onClick={() => setPendingDelete({ kind: 'water', id: entry.id })}>Remove</button></div>)}
      </div>}
      {pendingDelete && <div className="notice-bar" role="alertdialog" aria-label="Confirm log removal"><strong>Remove this entry?</strong><p className="small-copy">This correction is recorded in the local audit history. An exercise entry tied to a reported task cannot be removed.</p><div className="toolbar"><button className="button secondary" onClick={() => setPendingDelete(null)}>Keep entry</button><button className="button danger" onClick={() => void removeEntry()}>Confirm remove</button></div></div>}
    </article>

    </div>
  </section>;
}
