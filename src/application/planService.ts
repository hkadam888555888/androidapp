import type { DailyTask, DayPlan, RoadmapTask, TaskPriority, PlannerDecision } from '../domain/entities/models';
import { buildDailyPlanDetailed, type PlannerInput, type PlannedSlot } from '../domain/engine/planner';
import { buildDailyReview } from '../domain/services/reviewService';
import { isValidISODate, previousISO } from './date';
import { reconcilePlanTasks } from './planInstances';
import { appStore } from './appStore';
import { getDatabase } from '../data/db/database';

const priorityMap: Record<TaskPriority, TaskPriority> = { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low' };

export async function generateAndPersistPlan(date: string): Promise<{ plan: DayPlan; tasks: DailyTask[]; slots: PlannedSlot[]; warnings: string[] }> {
  if (!isValidISODate(date)) throw new Error('Planning date must be a valid YYYY-MM-DD calendar date.');
  const state = appStore.getSnapshot();
  if (!state.preferences) throw new Error('Routine preferences are not configured.');

  const db = await getDatabase();
  // Acquire the relevant write lock before reading authoritative daily-task and
  // plan records. This avoids planning from a stale tab and reintroducing a
  // task that another tab has just completed/cancelled.
  const tx = db.transaction(['dailyTasks', 'dayPlans', 'dailyReviews', 'plannerDecisions', 'audits', 'roadmapTasks', 'externalTasks'], 'readwrite');
  try {
    const [persistedDailyTasks, persistedPlans, persistedRoadmapTasks, persistedExternalTasks] = await Promise.all([
      tx.objectStore('dailyTasks').getAll(),
      tx.objectStore('dayPlans').getAll(),
      tx.objectStore('roadmapTasks').getAll(),
      tx.objectStore('externalTasks').getAll(),
    ]);

    const input: PlannerInput = {
      date,
      roadmaps: state.roadmaps,
      roadmapTasks: persistedRoadmapTasks,
      externalTasks: persistedExternalTasks,
      habits: state.habits,
      habitLogs: state.habitLogs,
      waterLogs: state.waterLogs,
      exerciseLogs: state.exerciseLogs,
      busyEvents: state.busyEvents,
      preferences: state.preferences,
      plannerSettings: state.plannerSettings,
      estimationProfiles: state.estimationProfiles,
      timePatternProfiles: state.timePatternProfiles,
      plannerOverrides: state.plannerOverrides,
      remainingTasks: persistedDailyTasks.filter((task) => task.date < date && (task.status === 'planned' || task.status === 'rescheduled')),
    };

    const planning = buildDailyPlanDetailed(input);
    const slots = planning.slots;
    const taskMap = new Map<string, RoadmapTask>(persistedRoadmapTasks.map((task) => [task.id, task]));
    const externalMap = new Map(persistedExternalTasks.map((task) => [task.id, task]));
    const previousPending = input.remainingTasks;
    const version = persistedPlans.filter((plan) => plan.date === date).reduce((max, plan) => Math.max(max, plan.version), 0) + 1;
    const sourceCounts = new Map<string, number>();
    const proposedTasks: DailyTask[] = slots.map((slot) => {
      const sourceKey = slot.sourceTaskId ? `roadmap:${slot.sourceTaskId}` : slot.sourceExternalTaskId ? `external:${slot.sourceExternalTaskId}` : slot.sourceHabitId ? `habit:${slot.sourceHabitId}` : `slot:${slot.taskId}`;
      const occurrence = (sourceCounts.get(sourceKey) ?? 0) + 1;
      sourceCounts.set(sourceKey, occurrence);
      const kind = slot.sourceExternalTaskId ? (externalMap.get(slot.sourceExternalTaskId)?.category === 'URGENT' ? 'urgent' : 'admin') : slot.sourceHabitId ? 'habit' : 'roadmap';
      return {
        id: `daily:${date}:${sourceKey}:${occurrence}`,
        sourceTaskId: slot.sourceTaskId,
        sourceHabitId: slot.sourceHabitId,
        sourceExternalTaskId: slot.sourceExternalTaskId,
        date,
        title: slot.title ?? taskMap.get(slot.sourceTaskId ?? '')?.title ?? externalMap.get(slot.sourceExternalTaskId ?? '')?.title ?? slot.taskId,
        kind,
        plannedWindow: { start: slot.start, end: slot.end },
        plannedMinutes: slot.plannedMinutes,
        priority: priorityMap[slot.priority],
        status: 'planned',
      };
    });

    const currentDateTasks = persistedDailyTasks.filter((task) => task.date === date && task.status !== 'rescheduled');
    const reconciled = reconcilePlanTasks(proposedTasks, currentDateTasks, version);
    const newTasks = reconciled.tasks;
    const cancelledTasks = reconciled.cancelled;
    const replacementsBySource = (task: DailyTask): boolean => newTasks.some((candidate) =>
      (task.sourceTaskId && candidate.sourceTaskId === task.sourceTaskId) ||
      (task.sourceExternalTaskId && candidate.sourceExternalTaskId === task.sourceExternalTaskId) ||
      (task.sourceHabitId && candidate.sourceHabitId === task.sourceHabitId));
    const rescheduledPreviousIds = new Set(previousPending.filter(replacementsBySource).map((task) => task.id));

    // Reported and unreported historical instances stay visible to Daily Review;
    // only current pending rows are reconciled/cancelled.
    const retainedCurrentHistory = currentDateTasks.filter((task) =>
      task.status !== 'planned' && task.status !== 'cancelled' && !newTasks.some((candidate) => candidate.id === task.id),
    );
    const mergedForReview = [
      ...persistedDailyTasks.filter((task) => task.date !== date && !rescheduledPreviousIds.has(task.id)),
      ...retainedCurrentHistory,
      ...newTasks,
    ];
    const review = buildDailyReview(mergedForReview, date);
    const previousDate = previousISO(date);
    const priorReviewBlocked = persistedDailyTasks.some((task) => task.date === previousDate && task.status === 'unreported');
    const modeLabel = planning.mode === 'normal' ? 'Normal' : planning.mode === 'busy' ? 'Busy' : 'Exam';
    const warningText = planning.warnings.length ? ` Warnings: ${planning.warnings.join(' ')}` : '';
    const plan: DayPlan = {
      id: `plan:${date}:${version}`,
      date,
      generatedAt: new Date().toISOString(),
      version,
      state: review.required || priorReviewBlocked ? 'draft' : 'final',
      taskIds: newTasks.map((task) => task.id),
      lockedUntilReview: review.required || priorReviewBlocked,
      mode: planning.mode,
      reason: priorReviewBlocked
        ? `Draft because the previous day still contains an unreported required result. Mode: ${modeLabel}.`
        : review.required
          ? `Draft because a required review is still unresolved. Mode: ${modeLabel}.`
          : `Generated from ${modeLabel.toLowerCase()} capacity, global roadmap allocation, external work, habits, dependencies, and current constraints.${warningText}`,
    };
    const decisions: PlannerDecision[] = planning.decisions.map((decision, index) => ({
      ...decision,
      id: `decision:${plan.id}:${index + 1}`,
      planId: plan.id,
    }));

    for (const oldPlan of persistedPlans.filter((candidate) => candidate.date === date && candidate.state !== 'superseded')) {
      await tx.objectStore('dayPlans').put({ ...oldPlan, state: 'superseded', lockedUntilReview: false });
    }
    for (const oldTask of previousPending) {
      if (!rescheduledPreviousIds.has(oldTask.id)) continue;
      await tx.objectStore('dailyTasks').put({ ...oldTask, status: 'rescheduled', rescheduledTo: date });
    }
    for (const task of cancelledTasks) await tx.objectStore('dailyTasks').put(task);
    for (const task of newTasks) await tx.objectStore('dailyTasks').put(task);
    await tx.objectStore('dayPlans').put(plan);
    await tx.objectStore('dailyReviews').put(review);
    for (const decision of decisions) await tx.objectStore('plannerDecisions').put(decision);

    // Increment carry-over on the latest persisted source rows, not stale React state.
    const roadmapTaskUpdates = new Map<string, RoadmapTask>();
    const externalTaskUpdates = new Map<string, typeof persistedExternalTasks[number]>();
    for (const oldTask of previousPending.filter((task) => rescheduledPreviousIds.has(task.id))) {
      if (oldTask.sourceTaskId) {
        const source = roadmapTaskUpdates.get(oldTask.sourceTaskId) ?? persistedRoadmapTasks.find((task) => task.id === oldTask.sourceTaskId);
        if (source) roadmapTaskUpdates.set(source.id, { ...source, carryOverCount: (source.carryOverCount ?? 0) + 1 });
      }
      if (oldTask.sourceExternalTaskId) {
        const source = externalTaskUpdates.get(oldTask.sourceExternalTaskId) ?? persistedExternalTasks.find((task) => task.id === oldTask.sourceExternalTaskId);
        if (source) externalTaskUpdates.set(source.id, { ...source, carryOverCount: (source.carryOverCount ?? 0) + 1, updatedAt: new Date().toISOString() });
      }
    }
    for (const source of roadmapTaskUpdates.values()) await tx.objectStore('roadmapTasks').put(source);
    for (const source of externalTaskUpdates.values()) await tx.objectStore('externalTasks').put(source);

    const audit = {
      id: `audit:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(), action: 'plan.generated', entityType: 'dayPlan', entityId: plan.id,
      details: { date, taskCount: newTasks.length, version, draft: plan.state === 'draft', mode: planning.mode, warningCount: planning.warnings.length },
    };
    await tx.objectStore('audits').put(audit);
    await tx.done;

    await appStore.reload();
    const refreshed = appStore.getSnapshot();
    return { plan, tasks: refreshed.dailyTasks.filter((task) => task.date === date && task.status !== 'cancelled' && task.status !== 'rescheduled'), slots, warnings: planning.warnings };
  } catch (error) {
    try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
    try { await tx.done; } catch { /* Consume the aborted transaction result. */ }
    throw error;
  }
}
