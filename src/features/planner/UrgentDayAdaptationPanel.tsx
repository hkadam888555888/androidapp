import { useState } from 'react';
import type { BusyEvent, DailyTask } from '../../domain/entities/models';
import type { PlannedSlot, PlanningBuildResult } from '../../domain/engine/planner';
import { appStore, useAppStore } from '../../application/appStore';
import { generateAndPersistPlan } from '../../application/planService';
import { buildDailyPlanDetailed } from '../../domain/engine/planner';
import { createId } from '../../lib/id';

interface UrgentDayAdaptationPanelProps {
  date: string;
  onCancel: () => void;
  onApplied: (message: string) => void;
}

function hasMatchingSlot(task: DailyTask, slots: PlannedSlot[]): boolean {
  return slots.some((slot) => {
    if (task.sourceTaskId || slot.sourceTaskId) return Boolean(task.sourceTaskId && slot.sourceTaskId === task.sourceTaskId);
    if (task.sourceExternalTaskId || slot.sourceExternalTaskId) return Boolean(task.sourceExternalTaskId && slot.sourceExternalTaskId === task.sourceExternalTaskId);
    if (task.sourceHabitId || slot.sourceHabitId) return Boolean(task.sourceHabitId && slot.sourceHabitId === task.sourceHabitId);
    return task.title === slot.title;
  });
}

export function UrgentDayAdaptationPanel({ date, onCancel, onApplied }: UrgentDayAdaptationPanelProps) {
  const state = useAppStore();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('15:00');
  const [end, setEnd] = useState('16:00');
  const [proposal, setProposal] = useState<BusyEvent | null>(null);
  const [preview, setPreview] = useState<PlanningBuildResult | null>(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);

  function previewAdaptation() {
    setError('');
    if (!title.trim()) {
      setError('Describe what changed today before previewing the plan.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/u.test(end) || end <= start) {
      setError('Choose a valid time range. The end must be later than the start.');
      return;
    }
    if (!state.preferences) {
      setError('Your routine settings have not loaded. Refresh and try again.');
      return;
    }

    const busyEvent: BusyEvent = {
      id: createId('busy-preview'),
      date,
      title: title.trim(),
      window: { start, end },
      priority: 'high',
      blocksPlanning: true,
      fixed: true,
    };

    try {
      const result = buildDailyPlanDetailed({
        date,
        roadmaps: state.roadmaps,
        roadmapTasks: state.roadmapTasks,
        externalTasks: state.externalTasks,
        habits: state.habits,
        habitLogs: state.habitLogs,
        waterLogs: state.waterLogs,
        exerciseLogs: state.exerciseLogs,
        busyEvents: [...state.busyEvents, busyEvent],
        preferences: state.preferences,
        plannerSettings: state.plannerSettings,
        estimationProfiles: state.estimationProfiles,
        timePatternProfiles: state.timePatternProfiles,
        plannerOverrides: state.plannerOverrides,
        remainingTasks: state.dailyTasks.filter((task) => task.date < date && (task.status === 'planned' || task.status === 'rescheduled')),
      });
      setProposal(busyEvent);
      setPreview(result);
    } catch (cause) {
      setProposal(null);
      setPreview(null);
      setError(cause instanceof Error ? cause.message : 'Could not preview the proposed changes.');
    }
  }

  async function applyAdaptation() {
    if (!proposal || !preview || applying) return;
    setApplying(true);
    setError('');
    let saved = false;
    try {
      await appStore.saveBusyEvent(proposal);
      saved = true;
      const result = await generateAndPersistPlan(date);
      onApplied(`Applied “${proposal.title}” and regenerated today’s plan. ${result.tasks.length} task(s) remain scheduled.`);
    } catch (cause) {
      setError(saved
        ? `The interruption was saved, but plan regeneration failed: ${cause instanceof Error ? cause.message : 'unknown error'}. Use Generate today to retry.`
        : cause instanceof Error ? cause.message : 'Could not apply the proposed changes.');
    } finally {
      setApplying(false);
    }
  }

  const affectedTasks = preview
    ? state.dailyTasks.filter((task) => task.date === date && task.status === 'planned' && !hasMatchingSlot(task, preview.slots))
    : [];

  return (
    <article className="card adaptation-panel" aria-labelledby="adaptation-panel-title">
      <div className="card-heading adaptation-panel-heading">
        <div>
          <span className="eyebrow">Plan change · preview first</span>
          <h2 id="adaptation-panel-title">Adapt today</h2>
          <p className="muted small-copy">Add a real interruption, review the proposed schedule, then choose whether to apply it. Previewing does not write to your plan.</p>
        </div>
        <button type="button" className="button secondary" onClick={onCancel}>Close</button>
      </div>

      {!preview && <>
        <div className="form-row adaptation-form-row">
          <label>What changed today?
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Unexpected assignment, appointment, travel…" />
          </label>
          <label>Start time
            <input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>End time
            <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </div>
        <div className="adaptation-actions">
          <button type="button" className="button primary" onClick={previewAdaptation}>Preview changes</button>
          <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
        </div>
      </>}

      {error && <div className="issue adaptation-error" role="alert">{error}</div>}

      {preview && proposal && <>
        <div className="notice-bar adaptation-notice">
          <strong>Preview only — nothing has been saved yet.</strong>
          <span>The proposed block “{proposal.title}” removes {proposal.window.start}–{proposal.window.end} from usable time. Review the new schedule before applying it.</span>
        </div>
        <div className="adaptation-summary">
          <div><span>Proposed blocks</span><strong>{preview.slots.length}</strong></div>
          <div><span>Minutes scheduled</span><strong>{preview.slots.reduce((sum, slot) => sum + slot.plannedMinutes, 0)}</strong></div>
          <div><span>Not selected</span><strong>{affectedTasks.length}</strong></div>
        </div>
        <div className="adaptation-preview-list" aria-label="Proposed schedule">
          <h3>Proposed schedule</h3>
          {preview.slots.length === 0
            ? <p className="muted small-copy">No eligible tasks fit the remaining windows. You can edit or cancel this proposal; the current plan has not changed.</p>
            : preview.slots.map((slot) => <div className="adaptation-slot" key={slot.taskId + ':' + slot.start}>
                <time>{slot.start}–{slot.end}</time>
                <div><strong>{slot.title}</strong><span>{slot.plannedMinutes} min · {slot.priority}</span></div>
              </div>)}
        </div>
        {affectedTasks.length > 0 && <div className="adaptation-affected">
          <h3>Not selected in this preview</h3>
          <p className="muted small-copy">These tasks would not fit in the simulated plan. They remain unchanged until you apply the proposal.</p>
          {affectedTasks.map((task) => <div className="adaptation-affected-task" key={task.id}><strong>{task.title}</strong><span>{task.plannedMinutes} min · currently planned</span></div>)}
        </div>}
        {preview.warnings.length > 0 && <div className="issue-list adaptation-warnings">{preview.warnings.map((warning, index) => <div className="issue" key={index}><strong>Planner note</strong><span>{warning}</span></div>)}</div>}
        <div className="adaptation-actions">
          <button type="button" className="button primary" onClick={() => void applyAdaptation()} disabled={applying}>{applying ? 'Applying and regenerating…' : 'Apply adaptation'}</button>
          <button type="button" className="button secondary" onClick={() => { setProposal(null); setPreview(null); setError(''); }}>Edit proposal</button>
          <button type="button" className="button secondary" onClick={onCancel} disabled={applying}>Cancel adaptation</button>
        </div>
      </>}
    </article>
  );
}
