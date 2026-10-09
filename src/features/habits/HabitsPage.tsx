import { useMemo, useState } from 'react';
import { appStore, useAppStore, getCurrentDate } from '../../application/appStore';
import { buildHabitOccurrence, habitSummary } from '../../domain/services/habitEngine';
import type { HabitStreakPolicy, HabitRecurrence } from '../../domain/entities/models';

export function HabitsPage() {
  const state = useAppStore();
  const date = getCurrentDate();
  const [waterAmount, setWaterAmount] = useState(250);
  const [exerciseMinutes, setExerciseMinutes] = useState(30);
  const [notice, setNotice] = useState('');
  const waterHabit = state.habits.find((h) => h.kind === 'water' && h.active);
  const exerciseHabit = state.habits.find((h) => h.kind === 'exercise' && h.active);
  const waterTarget = waterHabit?.targetValue ?? 0;
  const exerciseTarget = exerciseHabit?.targetValue ?? 0;
  const waterToday = useMemo(() => state.waterLogs.filter((x) => x.date === date).reduce((s, x) => s + x.amountMl, 0), [state.waterLogs, date]);
  const exerciseToday = useMemo(() => state.exerciseLogs.filter((x) => x.date === date).reduce((s, x) => s + (x.durationMinutes ?? 0), 0), [state.exerciseLogs, date]);
  const habitCards = state.habits.filter((h) => h.active).map((habit) => ({ habit, occurrence: buildHabitOccurrence(habit, date, state.habitLogs, state.waterLogs, state.exerciseLogs), summary: habitSummary(habit, `${date.slice(0,4)}-01-01`, date, state.habitLogs, state.waterLogs, state.exerciseLogs) }));

  async function logWater(amount: number) { try { await appStore.logWater(date, amount); setNotice(`Logged +${amount} ml.`); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not log water.'); } }
  async function logExercise() { try { await appStore.logExercise(date, exerciseMinutes); setNotice(`Logged ${exerciseMinutes} minutes of exercise.`); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not log exercise.'); } }
  async function updateHabit(habit: typeof state.habits[number], patch: Partial<typeof habit>) { try { await appStore.saveHabit({ ...habit, ...patch }); setNotice(`${habit.name} settings saved.`); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save habit settings.'); } }

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">v0.6 consistency engine</p><h1>Habits</h1><p className="muted">Recurring habits now have explicit due dates, partial completion rules, logs, adherence, and streaks. Missing data stays unreported.</p></div></header>
    {notice && <div className="notice-bar">{notice}</div>}
    <div className="stats-grid"><article className="card stat-card"><span>Exercise today</span><strong>{exerciseToday} min</strong><small>Target {exerciseTarget} min</small></article><article className="card stat-card"><span>Water today</span><strong>{waterToday} ml</strong><small>Target {waterTarget} ml</small></article><article className="card stat-card"><span>Active habits</span><strong>{state.habits.filter((h) => h.active).length}</strong><small>Each habit follows its own recurrence</small></article><article className="card stat-card"><span>Habit logs</span><strong>{state.habitLogs.length}</strong><small>Explicitly recorded locally</small></article></div>
    <div className="habit-v06-grid">{habitCards.map(({ habit, occurrence, summary }) => <article className="card" key={habit.id}>
      <div className="card-heading"><div><span className="eyebrow">{habit.kind}</span><h2>{habit.name}</h2></div><span className={`pill ${occurrence.status === 'completed' ? 'success-pill' : occurrence.status === 'unreported' ? 'warning' : ''}`}>{occurrence.status.replace('_',' ')}</span></div>
      <div className="habit-meta"><span>Target <strong>{habit.targetValue} {habit.unit}</strong></span><span>Minimum <strong>{occurrence.minimumValue} {habit.unit}</strong></span><span>Recurrence <strong>{habit.recurrence ?? 'custom'}</strong></span><span>Streak <strong>{summary.current}d</strong></span></div>
      <div className="progress-track"><span style={{ width: `${Math.min(100, summary.adherenceRate)}%` }} /></div><p className="muted small-copy">{summary.adherenceRate}% weighted adherence this year · {summary.completed} complete · {summary.partial} partial · {summary.skipped} skipped · {summary.unreported} unreported</p>
      <div className="habit-config">
        <label>Recurrence<select value={habit.recurrence ?? 'custom'} onChange={(e) => updateHabit(habit, { recurrence: e.target.value as HabitRecurrence })}><option value="daily">Daily</option><option value="weekly">Weekly days</option><option value="custom">Custom days</option></select></label>
        <label>Minimum value<input type="number" min="0" max={habit.targetValue} value={habit.minimumValue ?? Math.round(habit.targetValue * 0.5)} onChange={(e) => updateHabit(habit, { minimumValue: Number(e.target.value) })} /></label>
        <label>Streak policy<select value={habit.streakPolicy ?? 'strict'} onChange={(e) => updateHabit(habit, { streakPolicy: e.target.value as HabitStreakPolicy })}><option value="strict">Strict target</option><option value="target_or_partial">Target or partial</option><option value="minimum_value">Minimum value</option></select></label>
        <label className="setting-row"><span>Allow partial<small>Counts as reported; streak depends on policy.</small></span><input type="checkbox" checked={Boolean(habit.allowPartial)} onChange={(e) => updateHabit(habit, { allowPartial: e.target.checked })} /></label>
        <div className="habit-days"><span className="eyebrow">Due days</span><div className="day-chip-list">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, day) => <button key={label} type="button" className={`day-chip ${habit.frequencyDays.includes(day) ? 'active' : ''}`} onClick={() => updateHabit(habit, { frequencyDays: habit.frequencyDays.includes(day) ? habit.frequencyDays.filter((x) => x !== day) : [...habit.frequencyDays, day].sort() })}>{label}</button>)}</div></div>
      </div>
    </article>)}</div>

    <div className="content-grid">
      <article className="card"><div className="card-heading"><div><span className="eyebrow">Exercise</span><h2>Today's session</h2></div><span className="pill">{exerciseToday >= exerciseTarget && exerciseTarget ? 'Target reached' : 'In progress'}</span></div><div className="form-row"><label>Minutes<input type="number" min="1" value={exerciseMinutes} onChange={(e) => setExerciseMinutes(Number(e.target.value))} /></label><div className="info-box"><strong>Minimum: {exerciseHabit?.minimumValue ?? Math.round(exerciseTarget * 0.5)} min</strong><span>Partial completion is recorded when enabled and the minimum is reached.</span></div></div><button className="button primary" onClick={logExercise}>Log exercise</button></article>
      <article className="card"><div className="card-heading"><div><span className="eyebrow">Water</span><h2>Today's intake</h2></div><span className="pill">{waterToday}/{waterTarget} ml</span></div><div className="water-buttons"><button className="button" onClick={() => logWater(250)}>+250</button><button className="button" onClick={() => logWater(500)}>+500</button><button className="button" onClick={() => logWater(750)}>+750</button></div><div className="form-row"><label>Custom ml<input type="number" min="1" value={waterAmount} onChange={(e) => setWaterAmount(Number(e.target.value))} /></label><div className="toolbar"><button className="button primary" onClick={() => logWater(waterAmount)}>Log custom</button></div></div></article>
    </div>
  </section>;
}
