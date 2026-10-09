import { useSyncExternalStore } from 'react';
import type {
  AdaptationSnapshot, AuditRecord, BusyEvent, CurriculumConcept, CurriculumVersion, DailyReview, DailyTask, DayPlan, EstimationProfile, ExerciseLog, ExternalTask,
  Habit, HabitLog, ID, NotificationRecord, PlannerDecision, PlannerOverride, PlannerSettings, PlannerOverrideAction, Roadmap, RoadmapTask, TaskDefinition, TimePatternProfile, UserPreferences, WaterLog, AIArtifact, AISettings,
} from '../domain/entities/models';
import { getDatabase } from '../data/db/database';
import { APP_VERSION, DB_VERSION } from '../data/db/schema';
import { IndexedDbRepository } from '../data/repositories/indexedDbRepository';
import { SAMPLE_PLANNER_SETTINGS, SAMPLE_PREFERENCES } from '../data/seed/sampleData';
import { assertTaskCanBeReported, closeUnreportedTask, markCompleted, markPartial, markSkipped } from '../domain/policies/taskState';
import { buildDailyReview } from '../domain/services/reviewService';
import { canReportHabitPartial, evaluateHabitOutcome } from '../domain/services/habitEngine';
import { isValidISODate, todayISO } from './date';
import { buildEstimationProfiles, buildTimePatternProfiles } from '../domain/services/adaptationService';
import { normalizeLocalEndpoint } from '../domain/ai/openAICompatibleLocalProvider';
import { BACKUP_STORES, validateBackupPayload } from './backupValidation';

export interface AppState {
  ready: boolean;
  error?: string;
  roadmaps: Roadmap[];
  curriculumVersions: CurriculumVersion[];
  curriculumConcepts: CurriculumConcept[];
  taskDefinitions: TaskDefinition[];
  roadmapTasks: RoadmapTask[];
  externalTasks: ExternalTask[];
  habits: Habit[];
  habitLogs: HabitLog[];
  busyEvents: BusyEvent[];
  dailyTasks: DailyTask[];
  waterLogs: WaterLog[];
  exerciseLogs: ExerciseLog[];
  dayPlans: DayPlan[];
  dailyReviews: DailyReview[];
  preferences?: UserPreferences;
  plannerSettings?: PlannerSettings;
  notifications: NotificationRecord[];
  plannerDecisions: PlannerDecision[];
  estimationProfiles: EstimationProfile[];
  timePatternProfiles: TimePatternProfile[];
  plannerOverrides: PlannerOverride[];
  adaptationSnapshots: AdaptationSnapshot[];
  aiArtifacts: AIArtifact[];
  aiSettings?: AISettings;
  audits: AuditRecord[];
}

const emptyState: AppState = {
  ready: false,
  roadmaps: [], curriculumVersions: [], curriculumConcepts: [], taskDefinitions: [], roadmapTasks: [], externalTasks: [], habits: [], habitLogs: [], busyEvents: [], dailyTasks: [],
  waterLogs: [], exerciseLogs: [], dayPlans: [], dailyReviews: [], notifications: [], plannerDecisions: [], estimationProfiles: [], timePatternProfiles: [], plannerOverrides: [], adaptationSnapshots: [], aiArtifacts: [], audits: [],
};

class AppStore {
  private state: AppState = emptyState;
  private listeners = new Set<() => void>();
  private initialized?: Promise<void>;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;
  getServerSnapshot = () => emptyState;

  reload = async () => { await this.load(); };

  initialize = async () => {
    if (this.initialized) return this.initialized;
    this.initialized = this.load().catch((error: unknown) => {
      this.setState({ ...this.state, ready: true, error: error instanceof Error ? error.message : 'Storage initialization failed.' });
    });
    return this.initialized;
  };

  async saveCurriculumVersion(version: CurriculumVersion, concepts: CurriculumConcept[], definitions: TaskDefinition[]): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction(['curriculumVersions', 'curriculumConcepts', 'taskDefinitions', 'audits'], 'readwrite');
    await tx.objectStore('curriculumVersions').put(version);
    for (const concept of concepts) await tx.objectStore('curriculumConcepts').put(concept);
    for (const definition of definitions) await tx.objectStore('taskDefinitions').put(definition);
    const audit = this.audit('curriculum.version.saved', 'curriculumVersion', version.id, { version: version.version, conceptCount: concepts.length, taskCount: definitions.length });
    await tx.objectStore('audits').put(audit);
    await tx.done;
    this.setState({
      ...this.state,
      curriculumVersions: [...this.state.curriculumVersions.filter((x) => x.id !== version.id), version],
      curriculumConcepts: [...this.state.curriculumConcepts.filter((x) => !concepts.some((c) => c.id === x.id)), ...concepts],
      taskDefinitions: [...this.state.taskDefinitions.filter((x) => !definitions.some((d) => d.id === x.id)), ...definitions],
      audits: [...this.state.audits, audit],
    });
  }

  async createRoadmap(roadmap: Roadmap, tasks: RoadmapTask[], curriculum?: { version: CurriculumVersion; concepts: CurriculumConcept[]; definitions: TaskDefinition[] }): Promise<void> {
    const db = await getDatabase();
    const existingById = new Map(this.state.roadmapTasks.filter((task) => task.roadmapId === roadmap.id).map((task) => [task.id, task]));
    const nextIds = new Set(tasks.map((task) => task.id));
    const stableTasks = tasks.map((task) => {
      const existing = existingById.get(task.id);
      return existing
        ? { ...task, completedOverall: existing.completedOverall, carryOverCount: existing.carryOverCount ?? task.carryOverCount, active: true }
        : { ...task, active: true };
    });
    const archivedTasks = this.state.roadmapTasks
      .filter((task) => task.roadmapId === roadmap.id && !nextIds.has(task.id))
      .map((task) => ({ ...task, active: false }));
    const persistedTasks = [...archivedTasks, ...stableTasks];
    const stores = ['roadmaps', 'roadmapTasks', 'audits', ...(curriculum ? ['curriculumVersions', 'curriculumConcepts', 'taskDefinitions'] : [])] as Array<'roadmaps' | 'roadmapTasks' | 'audits' | 'curriculumVersions' | 'curriculumConcepts' | 'taskDefinitions'>;
    const tx = db.transaction(stores, 'readwrite');

    // v0.5 intentionally allows multiple active roadmaps. Creating/updating one no longer deactivates the others.
    await tx.objectStore('roadmaps').put(roadmap);
    if (curriculum) {
      for (const previous of this.state.curriculumVersions.filter((version) => version.roadmapId === roadmap.id && version.status !== 'superseded')) {
        await tx.objectStore('curriculumVersions').put({ ...previous, status: 'superseded' });
      }
      await tx.objectStore('curriculumVersions').put(curriculum.version);
      for (const concept of curriculum.concepts) await tx.objectStore('curriculumConcepts').put(concept);
      for (const previousDefinition of this.state.taskDefinitions.filter((definition) => definition.roadmapId === roadmap.id && !curriculum.definitions.some((candidate) => candidate.id === definition.id))) {
        await tx.objectStore('taskDefinitions').put({ ...previousDefinition, active: false });
      }
      for (const definition of curriculum.definitions) await tx.objectStore('taskDefinitions').put({ ...definition, active: true });
    }
    for (const row of persistedTasks) await tx.objectStore('roadmapTasks').put(row);
    const audit = this.audit('roadmap.saved', 'roadmap', roadmap.id, {
      taskCount: stableTasks.length, archivedTaskCount: archivedTasks.length,
      preservedCompleted: stableTasks.filter((t) => t.completedOverall).length,
      active: roadmap.active,
      priority: roadmap.priority ?? 'medium',
      capacitySharePercentage: roadmap.capacitySharePercentage ?? null,
    });
    await tx.objectStore('audits').put(audit);
    await tx.done;

    const nextCurriculumVersions = curriculum
      ? [
          ...this.state.curriculumVersions
            .filter((version) => version.roadmapId === roadmap.id)
            .map((version) => version.id === curriculum.version.id ? curriculum.version : { ...version, status: 'superseded' as const }),
          curriculum.version,
        ].filter((version, index, all) => all.findIndex((candidate) => candidate.id === version.id) === index)
      : this.state.curriculumVersions;
    const nextConcepts = curriculum
      ? [...this.state.curriculumConcepts.filter((concept) => !curriculum.concepts.some((candidate) => candidate.id === concept.id)), ...curriculum.concepts]
      : this.state.curriculumConcepts;
    const nextDefinitions = curriculum
      ? [
          ...this.state.taskDefinitions
            .filter((definition) => definition.roadmapId === roadmap.id)
            .filter((definition) => !curriculum.definitions.some((candidate) => candidate.id === definition.id))
            .map((definition) => ({ ...definition, active: false })),
          ...this.state.taskDefinitions.filter((definition) => definition.roadmapId !== roadmap.id && !curriculum.definitions.some((candidate) => candidate.id === definition.id)),
          ...curriculum.definitions.map((definition) => ({ ...definition, active: true })),
        ]
      : this.state.taskDefinitions;
    this.setState({
      ...this.state,
      roadmaps: this.state.roadmaps.some((r) => r.id === roadmap.id) ? this.state.roadmaps.map((r) => r.id === roadmap.id ? roadmap : r) : [...this.state.roadmaps, roadmap],
      curriculumVersions: nextCurriculumVersions,
      curriculumConcepts: nextConcepts,
      taskDefinitions: nextDefinitions,
      roadmapTasks: [...this.state.roadmapTasks.filter((t) => t.roadmapId !== roadmap.id), ...persistedTasks],
      audits: [...this.state.audits, audit],
    });
  }

  async updateRoadmap(roadmap: Roadmap): Promise<void> {
    const existing = this.state.roadmaps.find((candidate) => candidate.id === roadmap.id);
    if (!existing) throw new Error('Roadmap could not be found.');
    const audit = this.audit('roadmap.updated', 'roadmap', roadmap.id, { active: roadmap.active, priority: roadmap.priority ?? 'medium', capacitySharePercentage: roadmap.capacitySharePercentage ?? null });
    const db = await getDatabase();
    const tx = db.transaction(['roadmaps', 'audits'], 'readwrite');
    await tx.objectStore('roadmaps').put(roadmap);
    await tx.objectStore('audits').put(audit);
    await tx.done;
    this.setState({ ...this.state, roadmaps: this.state.roadmaps.map((r) => r.id === roadmap.id ? roadmap : r), audits: [...this.state.audits, audit] });
  }

  async savePreferences(preferences: UserPreferences): Promise<void> {
    const repo = new IndexedDbRepository<UserPreferences, 'preferences'>(getDatabase, 'preferences');
    await repo.put(preferences);
    this.setState({ ...this.state, preferences });
  }

  async savePlannerSettings(settings: PlannerSettings): Promise<void> {
    const repo = new IndexedDbRepository<PlannerSettings, 'plannerSettings'>(getDatabase, 'plannerSettings');
    await repo.put(settings);
    this.setState({ ...this.state, plannerSettings: settings });
  }

  /** Save settings that the Settings screen edits together as one durable unit. */
  async saveSettingsBundle(preferences: UserPreferences, plannerSettings: PlannerSettings, aiSettings: AISettings): Promise<void> {
    if (preferences.maxStudyMinutesPerDay !== undefined && (!Number.isFinite(preferences.maxStudyMinutesPerDay) || preferences.maxStudyMinutesPerDay < 0)) {
      throw new Error('Daily study capacity must be a finite, non-negative number.');
    }
    if (preferences.maxContinuousFocusMinutes !== undefined && (!Number.isFinite(preferences.maxContinuousFocusMinutes) || preferences.maxContinuousFocusMinutes < 1)) {
      throw new Error('Continuous focus must be at least one minute.');
    }
    if (preferences.bufferPercentage !== undefined && (!Number.isFinite(preferences.bufferPercentage) || preferences.bufferPercentage < 0 || preferences.bufferPercentage > 90)) {
      throw new Error('Protected buffer must be between 0 and 90 percent.');
    }
    if (![plannerSettings.busyCapacityMinutes, plannerSettings.examCapacityMinutes].every((value) => Number.isFinite(value) && value >= 0)) {
      throw new Error('Busy and exam capacities must be finite, non-negative numbers.');
    }
    const normalizedAI = normalizeAISettings(aiSettings);
    const audit = this.audit('settings.updated', 'settings', 'user-settings', {
      notificationsEnabled: preferences.notificationsEnabled === true,
      activeMode: plannerSettings.activeMode,
      busyCapacityMinutes: plannerSettings.busyCapacityMinutes,
      examCapacityMinutes: plannerSettings.examCapacityMinutes,
      providerName: normalizedAI.providerName,
      localOnly: true,
      cloudEnabled: false,
    });
    const db = await getDatabase();
    const tx = db.transaction(['preferences', 'plannerSettings', 'aiSettings', 'audits'], 'readwrite');
    await tx.objectStore('preferences').put(preferences);
    await tx.objectStore('plannerSettings').put(plannerSettings);
    await tx.objectStore('aiSettings').put(normalizedAI);
    await tx.objectStore('audits').put(audit);
    await tx.done;
    this.setState({ ...this.state, preferences, plannerSettings, aiSettings: normalizedAI, audits: [...this.state.audits, audit] });
  }

  async saveBusyEvent(event: BusyEvent): Promise<void> {
    const repo = new IndexedDbRepository<BusyEvent, 'busyEvents'>(getDatabase, 'busyEvents');
    await repo.put(event);
    this.setState({ ...this.state, busyEvents: [...this.state.busyEvents.filter((x) => x.id !== event.id), event] });
  }

  async saveExternalTask(task: ExternalTask): Promise<void> {
    const repo = new IndexedDbRepository<ExternalTask, 'externalTasks'>(getDatabase, 'externalTasks');
    await repo.put(task);
    this.setState({ ...this.state, externalTasks: [...this.state.externalTasks.filter((x) => x.id !== task.id), task] });
  }

  async saveDailyPlan(plan: DayPlan, tasks: DailyTask[], review: DailyReview, decisions: PlannerDecision[] = []): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction(['dayPlans', 'dailyTasks', 'dailyReviews', 'plannerDecisions', 'audits'], 'readwrite');
    await tx.objectStore('dayPlans').put(plan);
    for (const task of tasks) await tx.objectStore('dailyTasks').put(task);
    await tx.objectStore('dailyReviews').put(review);
    for (const decision of decisions) await tx.objectStore('plannerDecisions').put(decision);
    const audit = this.audit('plan.generated', 'dayPlan', plan.id, { taskCount: tasks.length, state: plan.state, mode: plan.mode ?? 'normal' });
    await tx.objectStore('audits').put(audit);
    await tx.done;
    this.setState({
      ...this.state,
      dayPlans: [...this.state.dayPlans.filter((x) => x.id !== plan.id), plan],
      dailyTasks: [...this.state.dailyTasks.filter((x) => !tasks.some((t) => t.id === x.id)), ...tasks],
      dailyReviews: [...this.state.dailyReviews.filter((x) => x.id !== review.id), review],
      plannerDecisions: [...this.state.plannerDecisions.filter((existing) => !decisions.some((candidate) => candidate.id === existing.id)), ...decisions],
      audits: [...this.state.audits, audit],
    });
  }

  async reportTask(taskId: ID, result: 'completed' | 'partial' | 'skipped', reason?: string, actualDurationMinutes?: number, energy?: 'low' | 'medium' | 'high'): Promise<void> {
    if (actualDurationMinutes !== undefined && (!Number.isFinite(actualDurationMinutes) || Math.round(actualDurationMinutes) <= 0)) {
      throw new Error('Actual duration must round to at least 1 minute.');
    }

    const db = await getDatabase();
    const tx = db.transaction(['dailyTasks', 'roadmapTasks', 'externalTasks', 'dailyReviews', 'audits'], 'readwrite');
    try {
      const taskStore = tx.objectStore('dailyTasks');
      // Read the authoritative row inside the same read-write transaction. This
      // closes the stale-state/two-tab race that could overwrite a first result.
      const task = await taskStore.get(taskId);
      if (!task) throw new Error('Task could not be found.');
      assertTaskCanBeReported(task);

      const [allTasks, sourceTask, sourceExternal] = await Promise.all([
        taskStore.getAll(),
        task.sourceTaskId ? tx.objectStore('roadmapTasks').get(task.sourceTaskId) : Promise.resolve(undefined),
        task.sourceExternalTaskId ? tx.objectStore('externalTasks').get(task.sourceExternalTaskId) : Promise.resolve(undefined),
      ]);
      const now = new Date().toISOString();
      const baseUpdated = result === 'completed' ? markCompleted(task, now) : result === 'partial' ? markPartial(task, now) : markSkipped(task, now, reason);
      const updated: DailyTask = {
        ...baseUpdated,
        actualDurationMinutes: actualDurationMinutes === undefined ? baseUpdated.actualDurationMinutes : Math.round(actualDurationMinutes),
        completedAt: result === 'completed' ? now : baseUpdated.completedAt,
        resultNote: reason?.trim() || baseUpdated.resultNote,
        energy: energy ?? baseUpdated.energy,
      };
      const updatedRoadmapTask = result === 'completed' && sourceTask ? { ...sourceTask, completedOverall: true } : undefined;
      const updatedExternalTask = sourceExternal ? { ...sourceExternal, status: result, completedAt: result === 'completed' ? now : sourceExternal.completedAt, updatedAt: now } : undefined;
      const nextTasks = allTasks.map((candidate) => candidate.id === task.id ? updated : candidate);
      const review = buildDailyReview(nextTasks, task.date);
      const audit = this.audit(`task.${result}`, 'dailyTask', task.id, {
        from: task.status, to: updated.status, sourceTaskId: task.sourceTaskId ?? null,
        sourceExternalTaskId: task.sourceExternalTaskId ?? null,
        actualDurationMinutes: updated.actualDurationMinutes ?? null, energy: updated.energy ?? null,
      });

      await taskStore.put(updated);
      if (updatedRoadmapTask) await tx.objectStore('roadmapTasks').put(updatedRoadmapTask);
      if (updatedExternalTask) await tx.objectStore('externalTasks').put(updatedExternalTask);
      await tx.objectStore('dailyReviews').put(review);
      await tx.objectStore('audits').put(audit);
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
      try { await tx.done; } catch { /* Consume the aborted transaction result. */ }
      throw error;
    }

    await this.load();
  }

  async logWater(date: string, amountMl: number): Promise<void> {
    const roundedAmount = Math.round(amountMl);
    if (!Number.isFinite(amountMl) || roundedAmount <= 0) throw new Error('Water amount must round to at least 1 ml.');
    const entry: WaterLog = { id: `water:${date}:${Date.now()}:${Math.random().toString(16).slice(2)}`, date, amountMl: roundedAmount, recordedAt: new Date().toISOString() };
    const repo = new IndexedDbRepository<WaterLog, 'waterLogs'>(getDatabase, 'waterLogs');
    await repo.put(entry);
    this.setState({ ...this.state, waterLogs: [...this.state.waterLogs, entry] });
  }

  async logExercise(date: string, durationMinutes: number, exerciseType = 'Exercise'): Promise<void> {
    const roundedDuration = Math.round(durationMinutes);
    if (!Number.isFinite(durationMinutes) || roundedDuration <= 0) throw new Error('Exercise duration must round to at least 1 minute.');
    if (!isValidISODate(date)) throw new Error('Exercise date must be a valid YYYY-MM-DD date.');
    const recordedAt = new Date().toISOString();
    const entry: ExerciseLog = {
      id: `exercise:${date}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      date, completed: true, durationMinutes: roundedDuration, exerciseType: exerciseType.trim().slice(0, 100) || 'Exercise', recordedAt,
    };

    const db = await getDatabase();
    const tx = db.transaction(['habits', 'exerciseLogs', 'habitLogs', 'dailyTasks', 'dailyReviews', 'audits'], 'readwrite');
    try {
      const [habits, allTasks] = await Promise.all([
        tx.objectStore('habits').getAll(),
        tx.objectStore('dailyTasks').getAll(),
      ]);
      const exerciseHabit = habits.find((habit) => habit.kind === 'exercise' && habit.active);
      const habitStatus = exerciseHabit ? evaluateHabitOutcome(exerciseHabit, roundedDuration) : undefined;
      const habitLog: HabitLog | undefined = exerciseHabit ? {
        id: `habitlog:exercise:${entry.id}`, habitId: exerciseHabit.id, date,
        status: habitStatus!, value: roundedDuration, targetValue: exerciseHabit.targetValue,
        minimumValue: exerciseHabit.minimumValue, recordedAt,
      } : undefined;
      // Re-read the persisted tasks in the transaction. Logging exercise remains
      // valid, but it must not overwrite a result already reported in another tab.
      const linked = exerciseHabit ? allTasks.find((task) => task.date === date && task.sourceHabitId === exerciseHabit.id && task.kind === 'habit' && (task.status === 'planned' || task.status === 'unreported')) : undefined;
      const reported = linked && habitStatus
        ? habitStatus === 'completed' ? markCompleted(linked, recordedAt)
          : habitStatus === 'partial' ? markPartial(linked, recordedAt)
            : markSkipped(linked, recordedAt, 'Below minimum habit value.')
        : undefined;
      const nextTasks = reported ? allTasks.map((task) => task.id === linked!.id ? reported : task) : allTasks;
      const review = reported ? buildDailyReview(nextTasks, date) : undefined;
      const audit = this.audit('exercise.logged', 'exerciseLog', entry.id, {
        date, durationMinutes: roundedDuration, exerciseType: entry.exerciseType,
        habitId: exerciseHabit?.id ?? null, linkedTaskId: linked?.id ?? null, habitStatus: habitStatus ?? null,
      });

      await tx.objectStore('exerciseLogs').put(entry);
      if (habitLog) await tx.objectStore('habitLogs').put(habitLog);
      if (reported) await tx.objectStore('dailyTasks').put(reported);
      if (review) await tx.objectStore('dailyReviews').put(review);
      await tx.objectStore('audits').put(audit);
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
      try { await tx.done; } catch { /* Consume the aborted transaction result. */ }
      throw error;
    }

    await this.load();
  }

  async saveHabit(habit: Habit): Promise<void> {
    if (!Number.isFinite(habit.targetValue) || habit.targetValue <= 0) throw new Error('Habit target must be greater than zero.');
    if (habit.minimumValue !== undefined && (!Number.isFinite(habit.minimumValue) || habit.minimumValue < 0 || habit.minimumValue > habit.targetValue)) {
      throw new Error('Habit minimum must be between zero and the target.');
    }
    const audit = this.audit('habit.updated', 'habit', habit.id, { active: habit.active, recurrence: habit.recurrence ?? 'custom', targetValue: habit.targetValue, minimumValue: habit.minimumValue ?? null });
    const db = await getDatabase();
    const tx = db.transaction(['habits', 'audits'], 'readwrite');
    await tx.objectStore('habits').put(habit);
    await tx.objectStore('audits').put(audit);
    await tx.done;
    this.setState({ ...this.state, habits: [...this.state.habits.filter((x) => x.id !== habit.id), habit], audits: [...this.state.audits, audit] });
  }

  async saveHabitLog(log: HabitLog): Promise<void> {
    if (!Number.isFinite(log.value) || log.value < 0) throw new Error('Habit value must be zero or greater.');
    if (!Number.isFinite(log.targetValue) || log.targetValue <= 0) throw new Error('Habit target must be greater than zero.');
    if (log.minimumValue !== undefined && (!Number.isFinite(log.minimumValue) || log.minimumValue < 0 || log.minimumValue > log.targetValue)) {
      throw new Error('Habit minimum must be between zero and the target.');
    }
    const audit = this.audit('habit.logged', 'habitLog', log.id, { habitId: log.habitId, date: log.date, status: log.status, value: log.value });
    const db = await getDatabase();
    const tx = db.transaction(['habitLogs', 'audits'], 'readwrite');
    await tx.objectStore('habitLogs').put(log);
    await tx.objectStore('audits').put(audit);
    await tx.done;
    this.setState({ ...this.state, habitLogs: [...this.state.habitLogs.filter((x) => x.id !== log.id), log], audits: [...this.state.audits, audit] });
  }

  async reportHabitPartial(taskId: ID, value: number, targetValue: number, minimumValue?: number, note?: string): Promise<void> {
    if (!Number.isFinite(value) || value < 0) throw new Error('Habit value must be zero or greater.');
    if (!Number.isFinite(targetValue) || targetValue <= 0) throw new Error('Habit target must be greater than zero.');

    const db = await getDatabase();
    const tx = db.transaction(['habits', 'habitLogs', 'dailyTasks', 'dailyReviews', 'audits'], 'readwrite');
    try {
      const taskStore = tx.objectStore('dailyTasks');
      const task = await taskStore.get(taskId);
      if (!task?.sourceHabitId) throw new Error('This daily item is not linked to a habit.');
      assertTaskCanBeReported(task);
      const habit = await tx.objectStore('habits').get(task.sourceHabitId);
      if (!habit || !canReportHabitPartial(habit)) throw new Error('Partial completion is disabled for this habit under its current streak policy.');
      if (targetValue !== habit.targetValue) throw new Error('Habit target changed or is invalid. Refresh and try again.');

      const effectiveMinimum = habit.minimumValue ?? minimumValue ?? 0;
      if (!Number.isFinite(effectiveMinimum) || effectiveMinimum < 0 || effectiveMinimum > targetValue) {
        throw new Error('Habit minimum must be between zero and the target.');
      }
      const now = new Date().toISOString();
      const status = evaluateHabitOutcome({ ...habit, minimumValue: effectiveMinimum }, value);
      const updated = status === 'partial' ? markPartial(task, now) : status === 'completed' ? markCompleted(task, now) : markSkipped(task, now, note);
      const log: HabitLog = {
        id: `habitlog:${habit.id}:${task.date}`, habitId: habit.id, date: task.date,
        status, value, targetValue, minimumValue: effectiveMinimum, note, recordedAt: now,
      };
      const allTasks = await taskStore.getAll();
      const nextTasks = allTasks.map((candidate) => candidate.id === task.id ? updated : candidate);
      const review = buildDailyReview(nextTasks, task.date);
      const audit = this.audit('habit.partial_reported', 'dailyTask', task.id, {
        habitId: habit.id, value, targetValue, minimumValue: effectiveMinimum, status,
      });

      await tx.objectStore('habitLogs').put(log);
      await taskStore.put(updated);
      await tx.objectStore('dailyReviews').put(review);
      await tx.objectStore('audits').put(audit);
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
      try { await tx.done; } catch { /* Consume the aborted transaction result. */ }
      throw error;
    }

    await this.load();
  }

  async saveDailyReview(review: DailyReview): Promise<void> {
    const repo = new IndexedDbRepository<DailyReview, 'dailyReviews'>(getDatabase, 'dailyReviews');
    const withDerived = { ...review, estimatedMinutes: review.estimatedMinutes ?? this.state.dailyTasks.filter((task) => task.date === review.date).reduce((sum, task) => sum + task.plannedMinutes, 0), actualMinutes: review.actualMinutes ?? this.state.dailyTasks.filter((task) => task.date === review.date).reduce((sum, task) => sum + (task.actualDurationMinutes ?? 0), 0) };
    await repo.put(withDerived);
    this.setState({ ...this.state, dailyReviews: [...this.state.dailyReviews.filter((x) => x.id !== review.id), withDerived] });
  }

  async recordPlannerOverride(taskId: ID, date: string, action: PlannerOverrideAction, payload: PlannerOverride['payload'] = {}): Promise<void> {
    const override: PlannerOverride = { id: `override:${date}:${taskId}:${Date.now()}`, taskId, date, action, payload, createdAt: new Date().toISOString() };
    const audit = this.audit('planner.override', 'dailyTask', taskId, { action, date });
    const db = await getDatabase();
    const tx = db.transaction(['plannerOverrides', 'audits'], 'readwrite');
    await tx.objectStore('plannerOverrides').put(override);
    await tx.objectStore('audits').put(audit);
    await tx.done;
    this.setState({ ...this.state, plannerOverrides: [...this.state.plannerOverrides, override], audits: [...this.state.audits, audit] });
  }

  async rebuildAdaptationModel(): Promise<{ estimationProfiles: EstimationProfile[]; timePatternProfiles: TimePatternProfile[] }> {
    const estimationProfiles = buildEstimationProfiles(this.state.dailyTasks, this.state.roadmapTasks);
    const timePatternProfiles = buildTimePatternProfiles(this.state.dailyTasks);
    const db = await getDatabase();
    const tx = db.transaction(['estimationProfiles', 'timePatternProfiles'], 'readwrite');
    await tx.objectStore('estimationProfiles').clear();
    await tx.objectStore('timePatternProfiles').clear();
    for (const profile of estimationProfiles) await tx.objectStore('estimationProfiles').put(profile);
    for (const profile of timePatternProfiles) await tx.objectStore('timePatternProfiles').put(profile);
    await tx.done;
    this.setState({ ...this.state, estimationProfiles, timePatternProfiles });
    return { estimationProfiles, timePatternProfiles };
  }

  async saveAdaptationSnapshot(snapshot: AdaptationSnapshot): Promise<void> {
    const repo = new IndexedDbRepository<AdaptationSnapshot, 'adaptationSnapshots'>(getDatabase, 'adaptationSnapshots');
    await repo.put(snapshot);
    this.setState({ ...this.state, adaptationSnapshots: [...this.state.adaptationSnapshots.filter((x) => x.id !== snapshot.id), snapshot] });
  }


  async savePlannerDecisions(decisions: PlannerDecision[]): Promise<void> {
    if (decisions.length === 0) return;
    const repo = new IndexedDbRepository<PlannerDecision, 'plannerDecisions'>(getDatabase, 'plannerDecisions');
    await repo.putMany(decisions);
    this.setState({ ...this.state, plannerDecisions: [...this.state.plannerDecisions.filter((existing) => !decisions.some((candidate) => candidate.id === existing.id)), ...decisions] });
  }

  async saveNotification(notification: NotificationRecord): Promise<void> {
    const repo = new IndexedDbRepository<NotificationRecord, 'notifications'>(getDatabase, 'notifications');
    await repo.put(notification);
    this.setState({ ...this.state, notifications: [...this.state.notifications.filter((x) => x.id !== notification.id), notification] });
  }

  async markNotificationRead(id: ID): Promise<void> {
    const notification = this.state.notifications.find((x) => x.id === id);
    if (!notification) return;
    await this.saveNotification({ ...notification, readAt: new Date().toISOString() });
  }

  async saveAISettings(settings: AISettings): Promise<void> {
    const normalized = normalizeAISettings(settings);
    const audit = this.audit('ai.settings.updated', 'aiSettings', 'ai-settings', {
      providerName: normalized.providerName,
      localOnly: true,
      cloudEnabled: false,
      retainHistory: normalized.retainHistory,
    });
    const db = await getDatabase();
    const tx = db.transaction(['aiSettings', 'audits'], 'readwrite');
    await tx.objectStore('aiSettings').put(normalized);
    await tx.objectStore('audits').put(audit);
    await tx.done;
    this.setState({ ...this.state, aiSettings: normalized, audits: [...this.state.audits, audit] });
  }

  async saveAIArtifact(artifact: AIArtifact): Promise<void> {
    if (!this.state.aiSettings?.retainHistory) return;
    const repo = new IndexedDbRepository<AIArtifact, 'aiArtifacts'>(getDatabase, 'aiArtifacts');
    await repo.put(artifact);
    this.setState({ ...this.state, aiArtifacts: [...this.state.aiArtifacts.filter((x) => x.id !== artifact.id), artifact] });
  }

  async deleteAIHistory(): Promise<void> {
    const db = await getDatabase();
    await db.clear('aiArtifacts');
    this.setState({ ...this.state, aiArtifacts: [] });
  }

  async getAIArtifactCount(): Promise<number> {
    const db = await getDatabase();
    return (await db.getAllKeys('aiArtifacts')).length;
  }

  /** Clear all personal/local records while preserving only safe first-run defaults. */
  async deleteAllLocalData(): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction([...BACKUP_STORES] as Array<keyof import('../data/db/schema').AppDatabaseSchema>, 'readwrite');
    for (const store of BACKUP_STORES) await tx.objectStore(store).clear();
    const preferences = { ...SAMPLE_PREFERENCES, onboardingCompleted: false, notificationsEnabled: false };
    const plannerSettings = { ...SAMPLE_PLANNER_SETTINGS, activeMode: 'normal' as const, modeActiveUntil: undefined };
    const aiSettings: AISettings = { id: 'ai-settings', localOnly: true, cloudEnabled: false, explanationMode: 'short', retainHistory: false, providerName: 'RuleBasedProvider' };
    await tx.objectStore('preferences').put(preferences);
    await tx.objectStore('plannerSettings').put(plannerSettings);
    await tx.objectStore('aiSettings').put(aiSettings);
    await tx.done;
    this.setState({
      ...emptyState, ready: true, preferences, plannerSettings, aiSettings,
      roadmaps: [], curriculumVersions: [], curriculumConcepts: [], taskDefinitions: [], roadmapTasks: [], externalTasks: [],
      habits: [], habitLogs: [], busyEvents: [], dailyTasks: [], waterLogs: [], exerciseLogs: [], dayPlans: [], dailyReviews: [],
      notifications: [], plannerDecisions: [], estimationProfiles: [], timePatternProfiles: [], plannerOverrides: [], adaptationSnapshots: [], aiArtifacts: [], audits: [],
    });
  }

  async exportBackup(): Promise<string> {
    const db = await getDatabase();
    const tx = db.transaction([...BACKUP_STORES] as Array<keyof import('../data/db/schema').AppDatabaseSchema>, 'readonly');
    const rows = await Promise.all(BACKUP_STORES.map((store) => tx.objectStore(store).getAll()));
    await tx.done;
    const data: Record<string, unknown> = {};
    BACKUP_STORES.forEach((store, index) => { data[store] = rows[index]; });
    return JSON.stringify({ schemaVersion: DB_VERSION, exportedAt: new Date().toISOString(), appVersion: APP_VERSION, data }, null, 2);
  }

  async importBackup(serialized: string): Promise<void> {
    if (serialized.length > 5_000_000) throw new Error('Backup is too large (maximum 5 MB).');
    let value: unknown;
    try { value = JSON.parse(serialized); } catch { throw new Error('Backup is not valid JSON.'); }
    // Validate the complete snapshot, including row schemas and required stores, before any destructive write.
    const backup = validateBackupPayload(value);

    const db = await getDatabase();
    // Treat older backups as full snapshots: clear stores introduced after their schema.
    const tx = db.transaction([...BACKUP_STORES] as Array<keyof import('../data/db/schema').AppDatabaseSchema>, 'readwrite');
    for (const store of BACKUP_STORES) {
      const objectStore = tx.objectStore(store);
      await objectStore.clear();
      const rows = backup.data[store] as unknown[] | undefined;
      if (!rows) continue;
      for (const row of rows) await objectStore.put(row as never);
    }
    await tx.done;
    await this.load();
  }

  private async load(): Promise<void> {
    const db = await getDatabase();
    const [roadmaps, curriculumVersions, curriculumConcepts, taskDefinitions, roadmapTasks, externalTasks, habits, habitLogs, busyEvents, dailyTasks, waterLogs, exerciseLogs, dayPlans, dailyReviews, preferences, plannerSettings, notifications, plannerDecisions, estimationProfiles, timePatternProfiles, plannerOverrides, adaptationSnapshots, aiArtifacts, aiSettingsRows, audits] = await Promise.all([
      db.getAll('roadmaps'), db.getAll('curriculumVersions'), db.getAll('curriculumConcepts'), db.getAll('taskDefinitions'), db.getAll('roadmapTasks'), db.getAll('externalTasks'), db.getAll('habits'), db.getAll('habitLogs'), db.getAll('busyEvents'), db.getAll('dailyTasks'),
      db.getAll('waterLogs'), db.getAll('exerciseLogs'), db.getAll('dayPlans'), db.getAll('dailyReviews'), db.getAll('preferences'), db.getAll('plannerSettings'), db.getAll('notifications'), db.getAll('plannerDecisions'), db.getAll('estimationProfiles'), db.getAll('timePatternProfiles'), db.getAll('plannerOverrides'), db.getAll('adaptationSnapshots'), db.getAll('aiArtifacts'), db.getAll('aiSettings'), db.getAll('audits'),
    ]);

    const currentDate = todayISO();
    const closedTasks = dailyTasks.filter((task) => task.date < currentDate && task.status === 'planned').map(closeUnreportedTask);
    if (closedTasks.length) {
      const tx = db.transaction(['dailyTasks', 'dailyReviews'], 'readwrite');
      for (const task of closedTasks) await tx.objectStore('dailyTasks').put(task);
      const groupedDates: string[] = Array.from(new Set(closedTasks.map((task) => task.date)));
      for (const date of groupedDates) {
        const merged = dailyTasks.map((task) => closedTasks.find((closed) => closed.id === task.id) ?? task);
        await tx.objectStore('dailyReviews').put(buildDailyReview(merged, date));
      }
      await tx.done;
      for (const closed of closedTasks) {
        const index = dailyTasks.findIndex((task) => task.id === closed.id);
        if (index >= 0) dailyTasks[index] = closed;
      }
    }

    let finalPreferences = preferences[0];
    if (!finalPreferences) {
      finalPreferences = SAMPLE_PREFERENCES;
      await db.put('preferences', finalPreferences);
    }
    let finalPlannerSettings = plannerSettings[0];
    if (!finalPlannerSettings) {
      finalPlannerSettings = SAMPLE_PLANNER_SETTINGS;
      await db.put('plannerSettings', finalPlannerSettings);
    }
    let finalAISettings = aiSettingsRows[0] as AISettings | undefined;
    if (!finalAISettings) {
      finalAISettings = { id: 'ai-settings', localOnly: true, cloudEnabled: false, explanationMode: 'short', retainHistory: true, providerName: 'RuleBasedProvider' };
      await db.put('aiSettings', finalAISettings);
    } else {
      // Treat imported/old settings as untrusted. Only a normalized loopback URL can enable the local adapter.
      const normalized = safeLoadedAISettings(finalAISettings);
      if (JSON.stringify(normalized) !== JSON.stringify(finalAISettings)) {
        await db.put('aiSettings', normalized);
      }
      finalAISettings = normalized;
    }

    this.setState({
      ready: true, roadmaps, curriculumVersions, curriculumConcepts, taskDefinitions, roadmapTasks, externalTasks, habits, habitLogs, busyEvents, dailyTasks,
      waterLogs, exerciseLogs, dayPlans, dailyReviews, preferences: finalPreferences, plannerSettings: finalPlannerSettings, notifications, plannerDecisions, estimationProfiles, timePatternProfiles, plannerOverrides, adaptationSnapshots, aiArtifacts, aiSettings: finalAISettings, audits,
    });
  }

  private audit(action: string, entityType: string, entityId: ID, details: AuditRecord['details']): AuditRecord {
    return { id: `audit:${Date.now()}:${Math.random().toString(16).slice(2)}`, at: new Date().toISOString(), action, entityType, entityId, details };
  }

  private setState(state: AppState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

export const appStore = new AppStore();
export function useAppStore(): AppState { return useSyncExternalStore(appStore.subscribe, appStore.getSnapshot, appStore.getServerSnapshot); }
export async function bootstrapApp(): Promise<void> { await appStore.initialize(); }
export function getCurrentDate(): string { return todayISO(); }

function normalizeAISettings(settings: AISettings): AISettings {
  const base: AISettings = { ...settings, id: 'ai-settings', localOnly: true, cloudEnabled: false };
  if (settings.providerName !== 'OpenAICompatibleLocalProvider') {
    return { ...base, providerName: 'RuleBasedProvider', localEndpoint: undefined, localModel: undefined };
  }
  const endpoint = normalizeLocalEndpoint(settings.localEndpoint ?? 'http://127.0.0.1:1234/v1/chat/completions');
  const model = typeof settings.localModel === 'string' ? settings.localModel.trim().slice(0, 160) : '';
  if (!model) throw new Error('A local model identifier is required when using the local model adapter.');
  return { ...base, providerName: 'OpenAICompatibleLocalProvider', localEndpoint: endpoint, localModel: model };
}

function safeLoadedAISettings(settings: AISettings): AISettings {
  try {
    return normalizeAISettings(settings);
  } catch {
    return { ...settings, id: 'ai-settings', localOnly: true, cloudEnabled: false, providerName: 'RuleBasedProvider', localEndpoint: undefined, localModel: undefined };
  }
}
