import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appStore, useAppStore } from '../../application/appStore';
import type { Habit, Roadmap, TaskPriority } from '../../domain/entities/models';
import { compileCurriculum } from '../../domain/services/curriculumCompiler';
import { validateParsedRoadmap, validateTasks } from '../../domain/services/curriculumValidator';
import { parseRoadmap } from '../../domain/services/roadmapParser';
import { validateDependencyGraph } from '../../domain/engine/dependencyEngine';
import { createId } from '../../lib/id';

const STARTER_ROADMAP = `# My learning roadmap
## Foundations
### First concept to learn
### Practice the first concept
## Build something
### Small practical project`;

type Step = 0 | 1 | 2;

export function OnboardingPage() {
  const state = useAppStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [title, setTitle] = useState('My learning roadmap');
  const [roadmapText, setRoadmapText] = useState('');
  const [wakeTime, setWakeTime] = useState(state.preferences?.wakeTime ?? '06:30');
  const [sleepTime, setSleepTime] = useState(state.preferences?.sleepTime ?? '22:30');
  const [studyStart, setStudyStart] = useState('15:00');
  const [studyEnd, setStudyEnd] = useState('18:00');
  const [dailyHours, setDailyHours] = useState(3);
  const [exerciseGoal, setExerciseGoal] = useState(30);
  const [waterGoal, setWaterGoal] = useState(2500);
  const [enableExercise, setEnableExercise] = useState(true);
  const [enableWater, setEnableWater] = useState(true);
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => roadmapText.trim() ? parseRoadmap(roadmapText, 'onboarding-preview') : null, [roadmapText]);
  const validation = useMemo(() => {
    if (!parsed) return null;
    const structure = validateParsedRoadmap(parsed);
    if (!structure.valid) return { valid: false, issues: structure.issues.map((issue) => issue.message), taskCount: 0, conceptCount: 0 };
    const curriculum = compileCurriculum(parsed.nodes);
    const tasks = validateTasks(curriculum.tasks);
    const dependencies = validateDependencyGraph(curriculum.tasks.map((task, index) => ({
      id: task.id, roadmapId: task.roadmapId, title: task.title, estimatedMinutes: task.estimatedMinutes, priority: task.priority,
      order: index + 1, dependencyIds: task.dependencyIds, completedOverall: false, active: true,
    })));
    return { valid: tasks.valid && dependencies.valid, issues: [...tasks.issues.map((issue) => issue.message), ...dependencies.cycles.map((cycle) => `Dependency cycle: ${cycle.join(' → ')}`), ...dependencies.missing.map((item) => `Missing prerequisite: ${item}`)], taskCount: curriculum.tasks.length, conceptCount: curriculum.concepts.length };
  }, [parsed]);

  async function skipOnboarding() {
    if (!state.preferences) return;
    await appStore.savePreferences({ ...state.preferences, onboardingCompleted: true });
    navigate('/today');
  }

  async function finishSetup() {
    if (!state.preferences) { setError('Your local preferences have not loaded yet. Refresh the app and retry.'); return; }
    if (!title.trim()) { setError('Give your roadmap a short title.'); setStep(0); return; }
    if (!roadmapText.trim()) { setError('Paste a roadmap or load the starter outline.'); setStep(0); return; }
    if (!validation?.valid) { setError(`Please fix the roadmap structure first: ${validation?.issues.slice(0, 2).join(' ') || 'No valid tasks were generated.'}`); setStep(2); return; }
    if (studyStart >= studyEnd) { setError('Study window end must be later than its start.'); setStep(1); return; }
    if (wakeTime >= sleepTime) { setError('Wake time must be earlier than sleep time for this first-run setup.'); setStep(1); return; }
    if (dailyHours < 0.5 || dailyHours > 12) { setError('Choose between 0.5 and 12 study hours per day.'); setStep(1); return; }
    if (exerciseGoal < 0 || exerciseGoal > 240 || waterGoal < 0 || waterGoal > 10_000) { setError('Check your exercise and water targets.'); setStep(1); return; }
    setSaving(true); setError('');
    try {
      const roadmapId = createId('roadmap');
      const source = roadmapText.trim();
      const parsedRoadmap = parseRoadmap(source, roadmapId);
      const structure = validateParsedRoadmap(parsedRoadmap);
      if (!structure.valid) throw new Error(structure.issues[0]?.message ?? 'Roadmap structure is invalid.');
      const curriculum = compileCurriculum(parsedRoadmap.nodes);
      const taskValidation = validateTasks(curriculum.tasks);
      if (!taskValidation.valid) throw new Error(taskValidation.issues[0]?.message ?? 'Generated task validation failed.');
      const taskRows = curriculum.tasks.map((task, index) => ({
        id: task.id, roadmapId, title: task.title, description: task.objective, objective: task.objective,
        completionCriteria: task.completionCriteria, taskType: task.type, estimatedMinutes: task.estimatedMinutes,
        priority: task.priority, category: curriculum.concepts.find((concept) => concept.id === task.conceptId)?.title,
        order: index + 1, dependencyIds: task.dependencyIds, completedOverall: false, dueDate: undefined,
        difficulty: task.difficulty, carryOverCount: 0, active: true, splittable: task.splittable ?? false,
      }));
      const now = new Date().toISOString();
      const roadmap: Roadmap = { id: roadmapId, title: title.trim(), sourceText: source, createdAt: now, updatedAt: now, active: true, priority };
      let hash = 2166136261;
      for (let i = 0; i < source.length; i += 1) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
      const version = { id: `${roadmapId}:curriculum:v1`, roadmapId, version: 1, createdAt: now, sourceTextHash: (hash >>> 0).toString(16), status: 'approved' as const, conceptIds: curriculum.concepts.map((concept) => concept.id), taskDefinitionIds: curriculum.tasks.map((task) => task.id), warnings: [] };
      await appStore.createRoadmap(roadmap, taskRows, { version, concepts: curriculum.concepts, definitions: curriculum.tasks });
      const preferences = {
        ...state.preferences, onboardingCompleted: true, notificationsEnabled: false, wakeTime, sleepTime,
        defaultStudyWindows: [{ start: studyStart, end: studyEnd }],
        maxStudyMinutesPerDay: Math.round(dailyHours * 60), maxCognitiveMinutesPerDay: Math.round(dailyHours * 60),
        maxContinuousFocusMinutes: Math.min(90, Math.round(dailyHours * 30)), bufferPercentage: 15,
      };
      await appStore.savePreferences(preferences);
      const habits: Habit[] = [];
      if (enableExercise && exerciseGoal > 0) habits.push({ id: createId('habit'), name: 'Exercise', kind: 'exercise', targetValue: exerciseGoal, unit: 'minutes', minimumValue: Math.min(15, exerciseGoal), active: true, preferredWindows: [{ start: wakeTime, end: studyStart }], reminderTimes: [], frequencyDays: [0, 1, 2, 3, 4, 5, 6], recurrence: 'daily', streakPolicy: 'target_or_partial', allowPartial: true, carryOverAllowed: false, priority: 'high' });
      if (enableWater && waterGoal > 0) habits.push({ id: createId('habit'), name: 'Water', kind: 'water', targetValue: waterGoal, unit: 'ml', minimumValue: waterGoal, active: true, preferredWindows: [{ start: wakeTime, end: sleepTime }], reminderTimes: [], frequencyDays: [0, 1, 2, 3, 4, 5, 6], recurrence: 'daily', streakPolicy: 'strict', allowPartial: false, carryOverAllowed: false, priority: 'medium' });
      for (const habit of habits) await appStore.saveHabit(habit);
      navigate('/today');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not finish setup. Your existing local data was not intentionally changed.');
    } finally { setSaving(false); }
  }

  return <main className="onboarding-shell">
    <div className="onboarding-top"><div className="brand-mark">AR</div><span>MY ADAPTIVE ROUTINE · FIRST-RUN SETUP</span><button className="button ghost small-button" onClick={() => void skipOnboarding()}>Skip setup</button></div>
    <div className="onboarding-card card">
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of 3`}>{[0, 1, 2].map((item) => <span key={item} className={item <= step ? 'done' : ''} />)}</div>
      {step === 0 && <>
        <p className="eyebrow">Step 1 of 3 · Your learning map</p><h1>Turn your goals into a routine.</h1><p className="muted">Start with a roadmap you already have. The app converts it into manageable tasks; it does not mark anything complete for you.</p>
        <div className="setting-form"><label>Roadmap title<input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="AI/ML, DSA, College…" /></label><label>Paste your roadmap<textarea rows={9} value={roadmapText} onChange={(event) => setRoadmapText(event.target.value)} placeholder={'# AI/ML\n## Python\n### Fundamentals\n### Functions\n## Mathematics\n### Probability'} /></label></div>
        <div className="toolbar"><button className="button secondary" onClick={() => setRoadmapText(STARTER_ROADMAP)}>Load starter outline</button><span className="muted small-copy">Headings, bullets and indented outlines are supported.</span></div>
        <div className="onboarding-actions"><span className="muted small-copy">Your roadmap stays in local browser storage.</span><button className="button primary" onClick={() => { setError(''); setStep(1); }}>Next: routine</button></div>
      </>}
      {step === 1 && <>
        <p className="eyebrow">Step 2 of 3 · A realistic day</p><h1>Plan around your real life.</h1><p className="muted">These are starting settings, not rules. You can change them any time.</p>
        <div className="onboarding-form-grid"><label>Wake up<input type="time" value={wakeTime} onChange={(event) => setWakeTime(event.target.value)} /></label><label>Sleep<input type="time" value={sleepTime} onChange={(event) => setSleepTime(event.target.value)} /></label><label>Study window starts<input type="time" value={studyStart} onChange={(event) => setStudyStart(event.target.value)} /></label><label>Study window ends<input type="time" value={studyEnd} onChange={(event) => setStudyEnd(event.target.value)} /></label><label>Study capacity (hours/day)<input type="number" min="0.5" max="12" step="0.5" value={dailyHours} onChange={(event) => setDailyHours(Number(event.target.value))} /></label><label>Roadmap priority<select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div>
        <div className="onboarding-habits"><div className="card-heading"><div><span className="eyebrow">Optional habits</span><h2>Set a gentle baseline</h2></div></div><label className="setting-row"><span><strong>Exercise</strong><small>Target minutes each day</small></span><input type="checkbox" checked={enableExercise} onChange={(event) => setEnableExercise(event.target.checked)} /><input className="compact-number" aria-label="Exercise target minutes" type="number" min="0" max="240" value={exerciseGoal} onChange={(event) => setExerciseGoal(Number(event.target.value))} disabled={!enableExercise} /></label><label className="setting-row"><span><strong>Water tracking</strong><small>Daily intake target in ml</small></span><input type="checkbox" checked={enableWater} onChange={(event) => setEnableWater(event.target.checked)} /><input className="compact-number" aria-label="Water target millilitres" type="number" min="0" max="10000" step="250" value={waterGoal} onChange={(event) => setWaterGoal(Number(event.target.value))} disabled={!enableWater} /></label></div>
        <div className="onboarding-actions"><button className="button secondary" onClick={() => { setError(''); setStep(0); }}>Back</button><button className="button primary" onClick={() => { setError(''); setStep(2); }}>Next: review</button></div>
      </>}
      {step === 2 && <>
        <p className="eyebrow">Step 3 of 3 · Review before saving</p><h1>Ready to build your first plan?</h1><p className="muted">Nothing is scheduled until you generate a plan. Your first curriculum stays deterministic and can be reviewed in Roadmap.</p>
        <div className="onboarding-summary"><div><span>Roadmap</span><strong>{title.trim() || 'Untitled roadmap'}</strong></div><div><span>Roadmap structure</span><strong>{parsed?.nodes.length ?? 0} nodes</strong></div><div><span>Generated work</span><strong>{validation?.taskCount ?? 0} tasks</strong></div><div><span>Daily capacity</span><strong>{dailyHours} hours</strong></div><div><span>Study window</span><strong>{studyStart}–{studyEnd}</strong></div><div><span>Habits</span><strong>{Number(enableExercise && exerciseGoal > 0) + Number(enableWater && waterGoal > 0)} enabled</strong></div></div>
        {validation && <div className={`onboarding-validation ${validation.valid ? 'valid' : 'invalid'}`}><strong>{validation.valid ? 'Roadmap checks passed' : 'Roadmap needs attention'}</strong><span>{validation.valid ? `${validation.conceptCount} concepts and ${validation.taskCount} task definitions validated.` : validation.issues.slice(0, 3).join(' ')}</span></div>}
        <div className="onboarding-actions"><button className="button secondary" onClick={() => { setError(''); setStep(1); }}>Back</button><button className="button primary" disabled={saving || !validation?.valid} onClick={() => void finishSetup()}>{saving ? 'Saving local setup…' : 'Save setup & open Today'}</button></div>
      </>}
      {error && <div className="notice-bar" role="alert">{error}</div>}
    </div>
    <p className="onboarding-footnote">Local-first by default · No account required · AI proposals need review · Completion is always explicit</p>
  </main>;
}
