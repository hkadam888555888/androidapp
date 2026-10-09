import type {
  BusyEvent,
  DailyTask,
  ExternalTask,
  Habit,
  ISODate,
  PlannerDecision,
  PlannerDecisionReasonCode,
  PlannerMode,
  PlannerSettings,
  Roadmap,
  RoadmapTask,
  TaskPriority,
  TimeWindow,
  UserPreferences,
} from '../entities/models';
import { computeOpenWindows, fromMinutes, subtractWindows, toMinutes } from './availabilityEngine';
import { calculateCapacity } from './capacityEngine';
import type { CapacityResult } from '../entities/models';
import { readyTaskIds, validateDependencyGraph } from './dependencyEngine';
import { evaluateEligibility } from './eligibilityEngine';
import { validatePlan } from './plannerValidator';
import { scoreRoadmapTask } from './scoringEngine';
import { buildHabitOccurrence } from '../services/habitEngine';
import { adaptiveEstimateForTask, getDaypart, type Daypart } from '../services/adaptationService';

export interface PlannerInput {
  date: ISODate;
  roadmaps?: Roadmap[];
  roadmapTasks: RoadmapTask[];
  externalTasks?: ExternalTask[];
  habits: Habit[];
  habitLogs?: import('../entities/models').HabitLog[];
  waterLogs?: import('../entities/models').WaterLog[];
  exerciseLogs?: import('../entities/models').ExerciseLog[];
  busyEvents: BusyEvent[];
  preferences: UserPreferences;
  plannerSettings?: PlannerSettings;
  estimationProfiles?: import('../entities/models').EstimationProfile[];
  timePatternProfiles?: import('../entities/models').TimePatternProfile[];
  plannerOverrides?: import('../entities/models').PlannerOverride[];
  remainingTasks: DailyTask[];
}

export interface PlannedCandidate {
  id: string;
  title: string;
  plannedMinutes: number;
  priority: TaskPriority;
  sourceTaskId?: string;
  sourceHabitId?: string;
  sourceExternalTaskId?: string;
  roadmapId?: string;
  taskType?: RoadmapTask['taskType'];
  category?: ExternalTask['category'];
  score: number;
  reason?: string;
  preferredWindows?: TimeWindow[];
  fixedWindow?: TimeWindow;
  splittable?: boolean;
  scope: 'study' | 'external';
}

export interface PlanningBuildResult {
  slots: PlannedSlot[];
  decisions: Omit<PlannerDecision, 'id' | 'planId'>[];
  mode: PlannerMode;
  capacity: CapacityResult;
  roadmapBudgets: Record<string, number>;
  warnings: string[];
}

export interface PlannedSlot {
  taskId: string;
  date: ISODate;
  start: string;
  end: string;
  title: string;
  plannedMinutes: number;
  priority: TaskPriority;
  sourceTaskId?: string;
  sourceHabitId?: string;
  sourceExternalTaskId?: string;
  roadmapId?: string;
  score: number;
  reason?: string;
}

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export function buildDailyPlan(input: PlannerInput): PlannedSlot[] {
  return buildDailyPlanDetailed(input).slots;
}

export function buildDailyPlanDetailed(input: PlannerInput): PlanningBuildResult {
  const dependencyScope = selectPlannerDependencyScope(input.roadmapTasks, input.roadmaps);
  const dependencyValidation = validateDependencyGraph(dependencyScope);
  if (!dependencyValidation.valid) {
    throw new Error(`Planner blocked by dependency integrity: ${dependencyValidation.missing.length} missing, ${dependencyValidation.selfDependencies.length} self, ${dependencyValidation.cycles.length} cycle(s).`);
  }

  const mode = resolvePlannerMode(input.plannerSettings, input.date);
  const activeRoadmaps = (input.roadmaps ?? []).filter((roadmap) => roadmap.active);
  const roadmapById = new Map(activeRoadmaps.map((roadmap) => [roadmap.id, roadmap]));
  const dayEvents = input.busyEvents.filter((event) => event.date === input.date && event.blocksPlanning);
  const openWindows = computeOpenWindows({
    date: input.date,
    wakeTime: input.preferences.wakeTime,
    sleepTime: input.preferences.sleepTime,
    studyWindows: input.preferences.defaultStudyWindows,
    busyWindows: dayEvents.map((event) => event.window),
  });
  const availableMinutes = openWindows.reduce((sum, window) => sum + toMinutes(window.end) - toMinutes(window.start), 0);
  const baseStudyLimit = input.preferences.maxStudyMinutesPerDay ?? availableMinutes;
  const baseCognitiveLimit = input.preferences.maxCognitiveMinutesPerDay ?? availableMinutes;
  const requestedStudyLimit = capacityLimitForMode(mode, baseStudyLimit, input.plannerSettings);
  const requestedCognitiveLimit = capacityLimitForMode(mode, baseCognitiveLimit, input.plannerSettings);
  const capacity = calculateCapacity({
    maxStudyMinutes: requestedStudyLimit,
    maxCognitiveMinutes: requestedCognitiveLimit,
    maxDeepWorkSessions: input.preferences.maxDeepWorkSessions ?? 99,
    maxContinuousFocusMinutes: input.preferences.maxContinuousFocusMinutes ?? 90,
    minimumBreakMinutes: input.preferences.minimumBreakMinutes ?? 10,
    bufferPercentage: input.preferences.bufferPercentage ?? 15,
  }, availableMinutes);

  const readyIds = new Set(readyTaskIds(input.roadmapTasks));
  const roadmapBudgets = calculateRoadmapBudgets(activeRoadmaps, capacity.effectiveStudyMinutes);
  const candidates = collectCandidates(input, readyIds, roadmapById, mode, roadmapBudgets);
  const fixedResult = placeFixedExternalCandidates(candidates, openWindows, input.date, capacity.effectiveStudyMinutes);
  let slots = fixedResult.slots;
  const remainingWindows = fixedResult.remainingWindows;
  const fixedUsed = slots.reduce((sum, slot) => sum + slot.plannedMinutes, 0);
  const flexibleBudget = Math.max(0, capacity.effectiveStudyMinutes - fixedUsed);
  const flexible = candidates.filter((candidate) => !candidate.fixedWindow && !fixedResult.handledIds.has(candidate.id));
  const packed = packCandidates(flexible, remainingWindows, input.date, flexibleBudget, capacity.maxContinuousFocusMinutes, roadmapBudgets, mode, input.plannerSettings);
  slots = [...slots, ...packed.slots].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

  const validation = validatePlan(slots, openWindows, capacity.effectiveStudyMinutes);
  if (!validation.valid) {
    slots = repairPlan(slots, openWindows, capacity.effectiveStudyMinutes);
  }
  const finalValidation = validatePlan(slots, openWindows, capacity.effectiveStudyMinutes);
  if (!finalValidation.valid) {
    throw new Error(`Planner produced an invalid plan: ${finalValidation.issues.map((issue) => issue.message).join(' ')}`);
  }

  const selectedIds = new Set(slots.map((slot) => slot.taskId));
  const decisions: PlanningBuildResult['decisions'] = [];
  const criticalWarnings: string[] = [];

  for (const candidate of candidates) {
    const selected = selectedIds.has(candidate.id);
    const reasonCodes: PlannerDecisionReasonCode[] = [];
    const roadmap = candidate.roadmapId ? roadmapById.get(candidate.roadmapId) : undefined;
    const shareBudget = candidate.roadmapId ? roadmapBudgets[candidate.roadmapId] : undefined;
    const usedByRoadmap = candidate.roadmapId ? slots.filter((slot) => slot.roadmapId === candidate.roadmapId).reduce((sum, slot) => sum + slot.plannedMinutes, 0) : 0;
    const roadmapShareSatisfied = shareBudget === undefined ? true : usedByRoadmap <= shareBudget;

    if (candidate.priority === 'urgent' || candidate.priority === 'high') reasonCodes.push('HIGH_PRIORITY');
    if (candidate.reason?.includes('deadline')) reasonCodes.push('DEADLINE_URGENCY');
    if (candidate.reason?.includes('protect deadline')) reasonCodes.push('DEADLINE_PROTECTION');
    if (candidate.reason?.includes('unlock')) reasonCodes.push('UNLOCK_VALUE');
    if (candidate.reason?.includes('carry-over')) reasonCodes.push('CARRY_OVER');
    if (candidate.preferredWindows?.length) reasonCodes.push('PREFERRED_TIME');
    if (candidate.sourceExternalTaskId) reasonCodes.push('EXTERNAL_PRIORITY');
    if (roadmap?.priority && roadmap.priority !== 'medium' && candidate.roadmapId) reasonCodes.push('ROADMAP_PRIORITY');
    if (candidate.roadmapId && shareBudget !== undefined) reasonCodes.push('ROADMAP_SHARE');
    if (mode === 'busy') reasonCodes.push('MODE_BUSY');
    if (mode === 'exam' && candidate.roadmapId && (input.plannerSettings?.examRoadmapIds ?? []).includes(candidate.roadmapId)) reasonCodes.push('EXAM_FOCUS');
    if (candidate.fixedWindow) reasonCodes.push('FIXED_EXTERNAL');
    if (selected) reasonCodes.push('SELECTED', 'FITS_WINDOW');
    else if (candidate.fixedWindow) reasonCodes.push('CONFLICT');
    else if (!roadmapShareSatisfied && !isCritical(candidate)) reasonCodes.push('CAPACITY_LIMIT');
    else reasonCodes.push('CAPACITY_LIMIT');

    decisions.push({
      candidateId: candidate.id,
      selected,
      score: candidate.score,
      reasonCodes: Array.from(new Set(reasonCodes)),
      constraintResults: {
        eligible: true,
        fitsWindow: selected,
        withinCapacity: selected,
        roadmapShare: roadmapShareSatisfied,
      },
      rejectedReason: selected
        ? undefined
        : candidate.fixedWindow
          ? 'The fixed external task could not fit without conflicting with an existing block.'
          : !roadmapShareSatisfied && !isCritical(candidate)
            ? 'The optional roadmap capacity share is full; the global pool was protected for other roadmaps.'
            : 'No remaining planning capacity or compatible window.',
      createdAt: new Date().toISOString(),
    });
  }

  for (const task of input.roadmapTasks) {
    if (task.completedOverall) continue;
    const roadmap = roadmapById.get(task.roadmapId);
    const eligibility = task.active === false ? { eligible: false, reasons: ['task is archived'] } : evaluateEligibility(task, input.date);
    const isActiveRoadmap = (input.roadmaps ?? []).length === 0 ? true : Boolean(roadmap);
    if (isActiveRoadmap && readyIds.has(task.id) && eligibility.eligible) continue;
    const reason = !isActiveRoadmap ? 'roadmap is inactive' : !eligibility.eligible ? eligibility.reasons.join('; ') : 'one or more hard prerequisites are incomplete';
    decisions.push({
      candidateId: `roadmap:${task.id}`, selected: false, score: 0, reasonCodes: ['BLOCKED'],
      constraintResults: { eligible: eligibility.eligible, activeRoadmap: isActiveRoadmap, ready: readyIds.has(task.id), fitsWindow: false, withinCapacity: false },
      rejectedReason: reason,
      createdAt: new Date().toISOString(),
    });
  }

  if (packed.unplacedCritical.length) {
    criticalWarnings.push(`${packed.unplacedCritical.length} high-impact item(s) could not fit today. Consider a busy-day reduction, a split, or moving the deadline.`);
  }
  const selectedCandidateIds = new Set(slots.map((slot) => slot.taskId));
  for (const candidate of candidates) {
    if (candidate.scope === 'study' && candidate.roadmapId && !selectedCandidateIds.has(candidate.id) && isCritical(candidate)) {
      criticalWarnings.push(`Could not schedule critical task: ${candidate.title}`);
    }
  }
  const warnings = Array.from(new Set([...packed.warnings, ...criticalWarnings]));

  return { slots, decisions, mode, capacity, roadmapBudgets, warnings };
}

function selectPlannerDependencyScope(tasks: RoadmapTask[], roadmaps: Roadmap[] | undefined): RoadmapTask[] {
  if (!roadmaps || roadmaps.length === 0) return tasks;
  const activeRoadmapIds = new Set(roadmaps.filter((roadmap) => roadmap.active).map((roadmap) => roadmap.id));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const included = new Set<string>();
  const visit = (id: string) => {
    if (included.has(id)) return;
    const task = taskById.get(id);
    if (!task) return;
    included.add(id);
    for (const depId of task.dependencyIds) visit(depId);
  };
  for (const task of tasks) if (activeRoadmapIds.has(task.roadmapId)) visit(task.id);
  return tasks.filter((task) => included.has(task.id));
}

function collectCandidates(
  input: PlannerInput,
  readyIds: Set<string>,
  roadmapById: Map<string, Roadmap>,
  mode: PlannerMode,
  roadmapBudgets: Record<string, number>,
): PlannedCandidate[] {
  const externalById = new Map((input.externalTasks ?? []).filter((task) => task.active).map((task) => [task.id, task]));
  const latestOverrides = new Map<string, import('../entities/models').PlannerOverride>();
  for (const override of (input.plannerOverrides ?? []).filter((candidate) => candidate.createdAt)) {
    const prior = latestOverrides.get(override.taskId);
    if (!prior || prior.createdAt < override.createdAt) latestOverrides.set(override.taskId, override);
  }
  const effectiveTask = (task: RoadmapTask): { duration: number; priority: TaskPriority; skip: boolean; locked: boolean; moveTarget?: string; preferredWindows?: TimeWindow[]; reason: string } => {
    const override = latestOverrides.get(task.id);
    let duration = adaptiveEstimateForTask(task, input.estimationProfiles ?? []);
    let priority = task.priority;
    let skip = false;
    let locked = false;
    let moveTarget: string | undefined;
    let reason = '';
    if (override) {
      if (override.action === 'skip_today' && override.date === input.date) skip = true;
      if (override.action === 'lock') locked = true;
      if (override.action === 'move' && typeof override.payload.targetDate === 'string') moveTarget = override.payload.targetDate;
      if (override.action === 'change_duration' && typeof override.payload.minutes === 'number' && override.payload.minutes > 0) duration = Math.round(override.payload.minutes);
      if (override.action === 'change_priority' && typeof override.payload.priority === 'string' && ['low','medium','high','urgent'].includes(override.payload.priority)) priority = override.payload.priority as TaskPriority;
      reason = `user override: ${override.action}`;
    }
    const pattern = findTaskPattern(task, input.timePatternProfiles ?? []);
    const preferredWindows = pattern?.preferredDaypart ? daypartWindows(input.preferences.defaultStudyWindows, pattern.preferredDaypart) : undefined;
    return { duration, priority, skip: skip || Boolean(moveTarget && input.date < moveTarget), locked, moveTarget, preferredWindows, reason };
  };
  const fromRemaining = input.remainingTasks
    .filter((task) => task.status === 'planned' || task.status === 'rescheduled')
    .flatMap((task) => {
      const sourceRoadmap = task.sourceTaskId ? input.roadmapTasks.find((candidate) => candidate.id === task.sourceTaskId) : undefined;
      const override = sourceRoadmap ? effectiveTask(sourceRoadmap) : undefined;
      if (override?.skip) return [];
      const sourceExternal = task.sourceExternalTaskId ? externalById.get(task.sourceExternalTaskId) : undefined;
      const base = sourceRoadmap
        ? scoreRoadmapTask({ task: sourceRoadmap, allTasks: input.roadmapTasks, today: input.date })
        : sourceExternal
          ? scoreExternalTask(sourceExternal, input.date)
          : { value: PRIORITY_RANK[task.priority] * 10, factors: ['carry-over task'] };
      const roadmap = sourceRoadmap ? roadmapById.get(sourceRoadmap.roadmapId) : undefined;
      const score = boostCandidateScore(base.value + 12, roadmap, sourceRoadmap, sourceExternal, mode, input.plannerSettings, input.timePatternProfiles, input.date, sourceRoadmap, override?.locked);
      return [{
        id: task.id,
        title: task.title,
        plannedMinutes: override?.duration ?? task.plannedMinutes,
        priority: override?.priority ?? task.priority,
        sourceTaskId: task.sourceTaskId,
        sourceHabitId: task.sourceHabitId,
        sourceExternalTaskId: task.sourceExternalTaskId,
        roadmapId: sourceRoadmap?.roadmapId,
        taskType: sourceRoadmap?.taskType,
        category: sourceExternal?.category,
        score,
        reason: `${base.factors.join(', ')}; carry-over bonus +12${roadmap?.capacitySharePercentage !== undefined ? `; roadmap share ${roadmap.capacitySharePercentage}%` : ''}${override?.reason ? `; ${override.reason}` : ''}`,
        preferredWindows: override?.preferredWindows,
        splittable: sourceRoadmap?.splittable ?? sourceExternal?.splittable ?? false,
        fixedWindow: sourceExternal?.fixedWindow,
        scope: sourceExternal ? ('external' as const) : ('study' as const),
      }];
    });
  const enforceActiveRoadmaps = (input.roadmaps ?? []).length > 0;
  const roadmap = input.roadmapTasks
    .filter((task) => task.active !== false)
    .filter((task) => !enforceActiveRoadmaps || roadmapById.has(task.roadmapId))
    .filter((task) => readyIds.has(task.id) && evaluateEligibility(task, input.date).eligible)
    .filter((task) => !fromRemaining.some((remaining) => remaining.sourceTaskId === task.id))
    .map((task) => {
      const override = effectiveTask(task);
      if (override.skip) return null as never;
      const score = scoreRoadmapTask({ task: { ...task, priority: override.priority, estimatedMinutes: override.duration }, allTasks: input.roadmapTasks, today: input.date });
      const roadmapInfo = roadmapById.get(task.roadmapId);
      const boosted = boostCandidateScore(score.value, roadmapInfo, { ...task, priority: override.priority, estimatedMinutes: override.duration }, undefined, mode, input.plannerSettings, input.timePatternProfiles, input.date, task, override.locked);
      const share = roadmapBudgets[task.roadmapId];
      const shareLabel = share !== undefined ? `; roadmap pool ${Math.round(share)}m` : '';
      const examLabel = mode === 'exam' && (input.plannerSettings?.examRoadmapIds ?? []).includes(task.roadmapId) ? '; exam focus +24' : '';
      return {
        id: `roadmap:${task.id}`,
        title: task.title,
        plannedMinutes: override.duration,
        priority: override.priority,
        sourceTaskId: task.id,
        roadmapId: task.roadmapId,
        taskType: task.taskType,
        score: boosted,
        reason: `${score.factors.join(', ')}${roadmapInfo?.priority ? `; roadmap priority ${roadmapInfo.priority}` : ''}${shareLabel}${examLabel}${override.reason ? `; ${override.reason}` : ''}${findTaskPattern(task, input.timePatternProfiles ?? [])?.preferredDaypart ? `; history suggests ${findTaskPattern(task, input.timePatternProfiles ?? [])?.preferredDaypart}` : ''}`,
        preferredWindows: override.preferredWindows,
        splittable: task.splittable ?? false,
        scope: 'study' as const,
      };
    });

  const effectiveExternal = (task: ExternalTask) => {
    const override = latestOverrides.get(task.id);
    let duration = task.estimatedMinutes;
    let priority = task.priority;
    let skip = false;
    let locked = false;
    let moveTarget: string | undefined;
    let reason = '';
    if (override) {
      if (override.action === 'skip_today' && override.date === input.date) skip = true;
      if (override.action === 'lock') locked = true;
      if (override.action === 'move' && typeof override.payload.targetDate === 'string') moveTarget = override.payload.targetDate;
      if (override.action === 'change_duration' && typeof override.payload.minutes === 'number' && override.payload.minutes > 0) duration = Math.round(override.payload.minutes);
      if (override.action === 'change_priority' && typeof override.payload.priority === 'string' && ['low','medium','high','urgent'].includes(override.payload.priority)) priority = override.payload.priority as TaskPriority;
      reason = `user override: ${override.action}`;
    }
    return { duration, priority, skip: skip || Boolean(moveTarget && input.date < moveTarget), locked, reason };
  };

  const external = (input.externalTasks ?? [])
    .filter((task) => task.active && (task.status === 'planned' || task.status === 'rescheduled' || task.status === 'unreported'))
    .filter((task) => isDateEligible(task.availableFrom, task.availableUntil, input.date))
    .filter((task) => !fromRemaining.some((remaining) => remaining.sourceExternalTaskId === task.id))
    .map((task) => {
      const override = effectiveExternal(task);
      if (override.skip) return null as never;
      const base = scoreExternalTask({ ...task, estimatedMinutes: override.duration, priority: override.priority }, input.date);
      return {
        id: `external:${task.id}`,
        title: task.title,
        plannedMinutes: override.duration,
        priority: override.priority,
        sourceExternalTaskId: task.id,
        category: task.category,
        fixedWindow: task.fixedWindow,
        preferredWindows: task.preferredWindow ? [task.preferredWindow] : undefined,
        score: base.value + (override.locked ? 100 : 0),
        reason: `${base.factors.join(', ')}${override.reason ? `; ${override.reason}` : ''}`,
        splittable: task.splittable ?? false,
        scope: 'external' as const,
      };
    });

  const habits: PlannedCandidate[] = input.habits
    .filter((habit) => habit.active && habit.kind !== 'water')
    .filter((habit) => {
      const occurrence = buildHabitOccurrence(habit, input.date, input.habitLogs ?? [], input.waterLogs ?? [], input.exerciseLogs ?? []);
      return occurrence.status === 'due' || occurrence.status === 'unreported';
    })
    .map((habit) => ({
      id: `habit:${habit.id}`,
      title: habit.name,
      plannedMinutes: Math.max(5, habit.targetValue || 30),
      priority: (habit.priority ?? (habit.kind === 'custom' ? 'medium' : 'high')) as TaskPriority,
      sourceHabitId: habit.id,
      score: (habit.kind === 'exercise' ? 64 : 35) + (habit.streakPolicy === 'strict' ? 12 : 0),
      reason: habit.kind === 'exercise' ? 'recurring exercise habit; explicit recurrence' : 'recurring habit; explicit recurrence',
      preferredWindows: habit.preferredWindows,
      splittable: false,
      scope: 'study' as const,
    }));

  return [...fromRemaining, ...external, ...roadmap, ...habits].filter((candidate): candidate is PlannedCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.title.localeCompare(b.title));
}

function scoreExternalTask(task: ExternalTask, today: ISODate): { value: number; factors: string[] } {
  const priorityValues: Record<TaskPriority, number> = { low: 12, medium: 28, high: 48, urgent: 76 };
  const factors = [`external ${task.category} priority +${priorityValues[task.priority]}`];
  let value = priorityValues[task.priority];
  if (task.dueDate) {
    const days = dateDistance(today, task.dueDate.slice(0, 10));
    const urgency = days < 0 ? 34 : days === 0 ? 32 : days === 1 ? 27 : days <= 3 ? 18 : days <= 7 ? 9 : 0;
    if (urgency) { value += urgency; factors.push(`deadline ${days < 0 ? 'overdue' : days === 0 ? 'today' : `in ${days}d`} +${urgency}`); }
    if (days <= 1) factors.push('protect deadline');
  }
  const carry = Math.min(20, (task.carryOverCount ?? 0) * 5);
  if (carry) { value += carry; factors.push(`carry-over +${carry}`); }
  const effortPenalty = Math.max(0, Math.min(12, Math.round(task.estimatedMinutes / 30) - 1));
  if (effortPenalty) { value -= effortPenalty; factors.push(`effort -${effortPenalty}`); }
  return { value, factors };
}

function boostCandidateScore(
  value: number,
  roadmap: Roadmap | undefined,
  roadmapTask: RoadmapTask | undefined,
  external: ExternalTask | undefined,
  mode: PlannerMode,
  settings: PlannerSettings | undefined,
  timePatterns?: import('../entities/models').TimePatternProfile[],
  date?: ISODate,
  patternTask?: RoadmapTask,
  locked = false,
): number {
  let score = value;
  if (roadmap?.priority === 'urgent') score += 28;
  else if (roadmap?.priority === 'high') score += 18;
  else if (roadmap?.priority === 'medium') score += 7;
  if (mode === 'busy' && roadmapTask) score -= 2;
  if (mode === 'exam' && roadmapTask) {
    if ((settings?.examRoadmapIds ?? []).includes(roadmapTask.roadmapId)) score += 24;
    if (roadmapTask.taskType === 'revise' || roadmapTask.taskType === 'review' || roadmapTask.taskType === 'checkpoint') score += 8;
    if (roadmapTask.priority === 'urgent' || roadmapTask.priority === 'high') score += 8;
  }
  if (external?.priority === 'urgent') score += 6;
  if (locked) score += 100;
  if (patternTask && date) {
    const pattern = findTaskPattern(patternTask, timePatterns ?? []);
    if (pattern?.preferredDaypart) score += 8;
  }
  return score;
}

function findTaskPattern(task: RoadmapTask | undefined, profiles: import('../entities/models').TimePatternProfile[]): import('../entities/models').TimePatternProfile | undefined {
  if (!task) return undefined;
  return profiles.find((profile) => profile.scopeKey === `task:${task.id}`);
}

function daypartWindows(windows: TimeWindow[], part: Daypart): TimeWindow[] {
  return windows.filter((window) => getDaypart(window.start) === part);
}

function placeFixedExternalCandidates(
  candidates: PlannedCandidate[],
  openWindows: TimeWindow[],
  date: ISODate,
  budgetMinutes: number,
): { slots: PlannedSlot[]; remainingWindows: TimeWindow[]; handledIds: Set<string> } {
  let queue = [...openWindows];
  let used = 0;
  const slots: PlannedSlot[] = [];
  const handledIds = new Set<string>();
  const fixed = candidates.filter((candidate) => candidate.fixedWindow).sort((a, b) => (a.fixedWindow?.start ?? '').localeCompare(b.fixedWindow?.start ?? ''));

  for (const candidate of fixed) {
    handledIds.add(candidate.id);
    const window = candidate.fixedWindow!;
    const duration = candidate.plannedMinutes;
    if (used + duration > budgetMinutes) continue;
    const fits = queue.some((available) => toMinutes(window.start) >= toMinutes(available.start) && toMinutes(window.end) <= toMinutes(available.end));
    if (!fits || toMinutes(window.end) - toMinutes(window.start) < duration) continue;
    const actualEnd = fromMinutes(toMinutes(window.start) + duration);
    if (actualEnd > window.end) continue;
    slots.push({
      taskId: candidate.id,
      date,
      start: window.start,
      end: actualEnd,
      title: candidate.title,
      plannedMinutes: duration,
      priority: candidate.priority,
      sourceTaskId: candidate.sourceTaskId,
      sourceHabitId: candidate.sourceHabitId,
      sourceExternalTaskId: candidate.sourceExternalTaskId,
      roadmapId: candidate.roadmapId,
      score: candidate.score,
      reason: candidate.reason,
    });
    used += duration;
    queue = subtractWindows(queue, [{ start: window.start, end: actualEnd }]);
  }
  return { slots, remainingWindows: queue, handledIds };
}

function packCandidates(
  candidates: PlannedCandidate[],
  windows: TimeWindow[],
  date: ISODate,
  budgetMinutes: number,
  maxFocusMinutes: number,
  roadmapBudgets: Record<string, number>,
  mode: PlannerMode,
  settings: PlannerSettings | undefined,
): { slots: PlannedSlot[]; warnings: string[]; unplacedCritical: PlannedCandidate[] } {
  const result: PlannedSlot[] = [];
  let queue = windows.map((window) => ({ ...window }));
  let used = 0;
  const usedByRoadmap: Record<string, number> = {};
  const warnings: string[] = [];
  const unplacedCritical: PlannedCandidate[] = [];

  for (const candidate of candidates) {
    if (used >= budgetMinutes) {
      if (isCritical(candidate)) unplacedCritical.push(candidate);
      continue;
    }
    if (candidate.fixedWindow) continue;
    const isCriticalCandidate = isCritical(candidate);
    const isExamFocus = mode === 'exam' && Boolean(candidate.roadmapId) && (settings?.examRoadmapIds ?? []).includes(candidate.roadmapId!);
    const roadmapBudget = candidate.roadmapId ? roadmapBudgets[candidate.roadmapId] : undefined;
    const currentRoadmapUse = candidate.roadmapId ? (usedByRoadmap[candidate.roadmapId] ?? 0) : 0;
    const shareAvailable = roadmapBudget === undefined ? true : currentRoadmapUse < roadmapBudget;
    if (!shareAvailable && !isCriticalCandidate && !isExamFocus) continue;

    const remainingBudget = budgetMinutes - used;
    const requested = candidate.splittable ? Math.min(candidate.plannedMinutes, remainingBudget) : candidate.plannedMinutes;
    const orderedQueue = candidate.preferredWindows?.length ? prioritizePreferredWindows(queue, candidate.preferredWindows) : queue;

    if (!candidate.splittable && (candidate.plannedMinutes > remainingBudget || candidate.plannedMinutes > maxFocusMinutes)) {
      if (isCriticalCandidate) unplacedCritical.push(candidate);
      continue;
    }
    if (!candidate.splittable && roadmapBudget !== undefined && candidate.roadmapId && !isCriticalCandidate && !isExamFocus && candidate.plannedMinutes > Math.max(0, roadmapBudget - currentRoadmapUse)) {
      continue;
    }

    let remaining = requested;
    for (const window of orderedQueue) {
      if (remaining <= 0 || used >= budgetMinutes) break;
      const available = toMinutes(window.end) - toMinutes(window.start);
      if (available <= 0) continue;
      if (!candidate.splittable && available < candidate.plannedMinutes) continue;
      let duration = candidate.splittable ? Math.min(remaining, available, maxFocusMinutes) : candidate.plannedMinutes;
      if (roadmapBudget !== undefined && candidate.roadmapId && !isCriticalCandidate && !isExamFocus && candidate.splittable) {
        duration = Math.min(duration, Math.max(0, roadmapBudget - currentRoadmapUse));
      }
      if (duration <= 0) continue;
      const end = fromMinutes(toMinutes(window.start) + duration);
      result.push({
        taskId: candidate.id,
        date,
        start: window.start,
        end,
        title: candidate.title,
        plannedMinutes: duration,
        priority: candidate.priority,
        sourceTaskId: candidate.sourceTaskId,
        sourceHabitId: candidate.sourceHabitId,
        sourceExternalTaskId: candidate.sourceExternalTaskId,
        roadmapId: candidate.roadmapId,
        score: candidate.score,
        reason: `${candidate.reason ?? ''}${mode === 'busy' ? '; busy-mode capacity' : mode === 'exam' && candidate.roadmapId && (settings?.examRoadmapIds ?? []).includes(candidate.roadmapId) ? '; exam-focused selection' : ''}`.replace(/^;\s*/, ''),
      });
      remaining -= duration;
      used += duration;
      if (candidate.roadmapId) usedByRoadmap[candidate.roadmapId] = (usedByRoadmap[candidate.roadmapId] ?? 0) + duration;
      queue = consumeWindow(queue, window, duration);
      if (!candidate.splittable || candidate.sourceHabitId) break;
    }

    if (remaining > 0 && isCriticalCandidate) unplacedCritical.push(candidate);
  }

  if (unplacedCritical.length && used >= budgetMinutes) warnings.push('The protected capacity limit was reached before all critical work could fit.');
  return { slots: result, warnings, unplacedCritical };
}

function prioritizePreferredWindows(open: TimeWindow[], preferred: TimeWindow[]): TimeWindow[] {
  const overlapMinutes = (a: TimeWindow, b: TimeWindow): number => {
    const start = Math.max(toMinutes(a.start), toMinutes(b.start));
    const end = Math.min(toMinutes(a.end), toMinutes(b.end));
    return Math.max(0, end - start);
  };
  return [...open].sort((a, b) => {
    const ap = preferred.reduce((sum, p) => sum + overlapMinutes(a, p), 0);
    const bp = preferred.reduce((sum, p) => sum + overlapMinutes(b, p), 0);
    return bp - ap || toMinutes(a.start) - toMinutes(b.start);
  });
}

function consumeWindow(queue: TimeWindow[], consumed: TimeWindow, duration: number): TimeWindow[] {
  return queue.flatMap((window) => {
    if (window.start !== consumed.start || window.end !== consumed.end) return [window];
    const next = fromMinutes(toMinutes(window.start) + duration);
    return next < window.end ? [{ start: next, end: window.end }] : [];
  });
}

function repairPlan(slots: PlannedSlot[], openWindows: TimeWindow[], capacityMinutes: number): PlannedSlot[] {
  let repaired = [...slots];
  for (let i = 0; i < slots.length + 2; i += 1) {
    const validation = validatePlan(repaired, openWindows, capacityMinutes);
    if (validation.valid) return repaired;
    const removable = repaired.slice().sort((a, b) => a.score - b.score || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.plannedMinutes - a.plannedMinutes)[0];
    if (!removable) return [];
    repaired = repaired.filter((slot) => slot.taskId !== removable.taskId || slot.start !== removable.start);
  }
  return repaired;
}

function calculateRoadmapBudgets(roadmaps: Roadmap[], totalMinutes: number): Record<string, number> {
  if (!roadmaps.length) return {};
  const specified = roadmaps.filter((roadmap) => roadmap.capacitySharePercentage !== undefined);
  const unspecified = roadmaps.filter((roadmap) => roadmap.capacitySharePercentage === undefined);
  const rawSpecifiedTotal = specified.reduce((sum, roadmap) => sum + clampShare(roadmap.capacitySharePercentage ?? 0), 0);
  const specifiedScale = rawSpecifiedTotal > 100 ? 100 / rawSpecifiedTotal : 1;
  const remainingPercent = Math.max(0, 100 - Math.min(100, rawSpecifiedTotal));
  const equalUnspecified = unspecified.length ? remainingPercent / unspecified.length : 0;
  return Object.fromEntries(roadmaps.map((roadmap) => {
    const percentage = roadmap.capacitySharePercentage !== undefined
      ? clampShare(roadmap.capacitySharePercentage) * specifiedScale
      : equalUnspecified;
    return [roadmap.id, Math.floor(totalMinutes * percentage / 100)];
  }));
}

function clampShare(value: number): number { return Math.max(0, Math.min(100, value)); }

function resolvePlannerMode(settings: PlannerSettings | undefined, date: ISODate): PlannerMode {
  if (!settings) return 'normal';
  if (settings.modeActiveUntil && date > settings.modeActiveUntil) return 'normal';
  return settings.activeMode;
}

function capacityLimitForMode(mode: PlannerMode, normalLimit: number, settings: PlannerSettings | undefined): number {
  if (!settings || mode === 'normal') return normalLimit;
  if (mode === 'busy') return Math.min(normalLimit, Math.max(0, settings.busyCapacityMinutes));
  return Math.min(normalLimit, Math.max(0, settings.examCapacityMinutes));
}

function isCritical(candidate: PlannedCandidate): boolean {
  if (candidate.sourceExternalTaskId) return candidate.priority === 'urgent' || candidate.reason?.includes('deadline today') === true || candidate.reason?.includes('deadline overdue') === true;
  return candidate.priority === 'urgent' || candidate.reason?.includes('deadline +40') === true || candidate.reason?.includes('deadline +45') === true;
}

function isDateEligible(from: ISODate | undefined, until: ISODate | undefined, date: ISODate): boolean {
  return (!from || date >= from.slice(0, 10)) && (!until || date <= until.slice(0, 10));
}

function dateDistance(a: string, b: string): number {
  const aa = new Date(`${a.slice(0, 10)}T12:00:00`).getTime();
  const bb = new Date(`${b.slice(0, 10)}T12:00:00`).getTime();
  return Math.round((bb - aa) / 86_400_000);
}

function dayOfWeek(date: ISODate): number {
  return new Date(`${date}T00:00:00`).getDay();
}
