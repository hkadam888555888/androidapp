import type {
  CurriculumConcept,
  DailyTask,
  EstimationProfile,
  PlannerOverride,
  Roadmap,
  RoadmapTask,
  TaskDefinition,
  TimePatternProfile,
} from '../entities/models';
import { calculatePace, detectRepeatedSkips, summarizeOverrides } from './adaptationService';

export type AnalyticsPeriod = 'week' | 'month' | 'year';

export interface AnalyticsWindow { from: string; to: string; label: string; }

export interface AnalyticsSummary {
  from: string;
  to: string;
  completed: number;
  partial: number;
  skipped: number;
  unreported: number;
  reported: number;
  completionRate: number;
  plannedMinutes: number;
  actualMinutes: number;
  actualVsPlannedPercent: number;
  roadmapMinutes: number;
  habitMinutes: number;
  externalMinutes: number;
  activeDays: number;
  productiveDays: number;
}

export interface RoadmapAnalytics {
  id: string;
  title: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  progressPercent: number;
  estimatedRemainingMinutes: number;
  completedMinutes: number;
  actualMinutes: number;
  targetDate?: string;
  paceStatus: 'AHEAD' | 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
  projectedCompletionDate?: string;
}

export interface MilestoneAnalytics {
  id: string;
  roadmapId: string;
  roadmapTitle: string;
  title: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  estimatedRemainingMinutes: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface SubjectAnalytics {
  key: string;
  label: string;
  totalTasks: number;
  completedTasks: number;
  partialTasks: number;
  skippedTasks: number;
  reportedTasks: number;
  completionRate: number;
  plannedMinutes: number;
  actualMinutes: number;
  averageActualMinutes: number;
  estimateDeltaPercent: number;
}

export interface WorkloadPoint {
  date: string;
  plannedMinutes: number;
  actualMinutes: number;
  completedMinutes: number;
  completedTasks: number;
  reportedTasks: number;
  loadPercent: number;
}

export interface AdaptationAnalytics {
  estimationProfileCount: number;
  highConfidenceProfiles: number;
  mediumConfidenceProfiles: number;
  lowConfidenceProfiles: number;
  learnedEstimateDeltaPercent: number;
  overrideCounts: Record<string, number>;
  repeatedSkipCount: number;
  repeatedSkipTaskCount: number;
  timingProfileCount: number;
  strongestTimePatterns: Array<{ scopeKey: string; daypart: string; successRatePercent: number; samples: number }>;
}

export interface AnalyticsReport {
  window: AnalyticsWindow;
  summary: AnalyticsSummary;
  roadmaps: RoadmapAnalytics[];
  milestones: MilestoneAnalytics[];
  subjects: SubjectAnalytics[];
  workload: WorkloadPoint[];
  adaptation: AdaptationAnalytics;
  previousSummary?: AnalyticsSummary;
}

function parseDate(date: string): Date { return new Date(`${date.slice(0, 10)}T12:00:00`); }
function iso(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function isAnalyticsTask(task: DailyTask): boolean { return task.status !== 'cancelled' && task.status !== 'rescheduled'; }
function addDays(date: string, days: number): string { const d = parseDate(date); d.setDate(d.getDate() + days); return iso(d); }
function startOfWeek(date: string): string { const d = parseDate(date); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); return iso(d); }
function startOfMonth(date: string): string { const d = parseDate(date); d.setDate(1); return iso(d); }
function startOfYear(date: string): string { const d = parseDate(date); d.setMonth(0, 1); return iso(d); }
function clampPercent(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
function safePercent(numerator: number, denominator: number): number { return denominator > 0 ? clampPercent((numerator / denominator) * 100) : 0; }

export function getAnalyticsWindow(today: string, period: AnalyticsPeriod): AnalyticsWindow {
  const anchor = today.slice(0, 10);
  if (period === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6), label: 'This week' };
  }
  if (period === 'month') {
    const from = startOfMonth(anchor);
    const d = parseDate(from); d.setMonth(d.getMonth() + 1); d.setDate(0);
    return { from, to: iso(d), label: 'This month' };
  }
  const from = startOfYear(anchor);
  return { from, to: `${anchor.slice(0, 4)}-12-31`, label: 'This year' };
}

function previousWindow(window: AnalyticsWindow): AnalyticsWindow {
  if (window.label === 'This week') {
    const from = addDays(window.from, -7);
    return { from, to: addDays(from, 6), label: 'Previous week' };
  }
  if (window.label === 'This month') {
    const end = addDays(window.from, -1);
    const from = startOfMonth(end);
    return { from, to: end, label: 'Previous month' };
  }
  const year = Number(window.from.slice(0, 4)) - 1;
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: 'Previous year' };
}

function inWindow(date: string, window: AnalyticsWindow): boolean { return date >= window.from && date <= window.to; }

function createSummary(dailyTasks: DailyTask[], window: AnalyticsWindow): AnalyticsSummary {
  const rows = dailyTasks.filter((task) => isAnalyticsTask(task) && inWindow(task.date, window));
  const completed = rows.filter((t) => t.status === 'completed').length;
  const partial = rows.filter((t) => t.status === 'partial').length;
  const skipped = rows.filter((t) => t.status === 'skipped').length;
  const unreported = rows.filter((t) => t.status === 'unreported' || t.status === 'planned').length;
  const reported = completed + partial + skipped;
  const plannedMinutes = rows.reduce((sum, task) => sum + Math.max(0, task.plannedMinutes), 0);
  const actualMinutes = rows.reduce((sum, task) => sum + Math.max(0, task.actualDurationMinutes ?? 0), 0);
  const productive = rows.filter((t) => t.status === 'completed' || t.status === 'partial');
  const roadmapMinutes = rows.filter((t) => t.kind === 'roadmap').reduce((sum, t) => sum + t.plannedMinutes, 0);
  const habitMinutes = rows.filter((t) => t.kind === 'habit').reduce((sum, t) => sum + t.plannedMinutes, 0);
  const externalMinutes = rows.filter((t) => t.kind === 'urgent' || t.kind === 'admin').reduce((sum, t) => sum + t.plannedMinutes, 0);
  const activeDates = new Set(rows.map((t) => t.date));
  const productiveDates = new Set(productive.map((t) => t.date));
  return {
    from: window.from, to: window.to, completed, partial, skipped, unreported, reported,
    completionRate: safePercent(completed + partial * 0.5, reported), plannedMinutes, actualMinutes,
    actualVsPlannedPercent: plannedMinutes ? Math.round((actualMinutes / plannedMinutes) * 100) : 0,
    roadmapMinutes, habitMinutes, externalMinutes,
    activeDays: activeDates.size, productiveDays: productiveDates.size,
  };
}

function getTaskDefinitionMap(taskDefinitions: TaskDefinition[]): Map<string, TaskDefinition> {
  return new Map(taskDefinitions.map((task) => [task.id, task]));
}

function createRoadmapAnalytics(
  roadmaps: Roadmap[], roadmapTasks: RoadmapTask[], dailyTasks: DailyTask[], today: string, fallbackCapacity: number,
): RoadmapAnalytics[] {
  return roadmaps.filter((roadmap) => roadmap.active).map((roadmap) => {
    const tasks = roadmapTasks.filter((task) => task.roadmapId === roadmap.id && task.active !== false);
    const completedTasks = tasks.filter((task) => task.completedOverall).length;
    const remaining = tasks.filter((task) => !task.completedOverall);
    const remainingMinutes = remaining.reduce((sum, task) => sum + task.estimatedMinutes, 0);
    const relevantDaily = dailyTasks.filter((task) => isAnalyticsTask(task) && task.sourceTaskId && tasks.some((candidate) => candidate.id === task.sourceTaskId));
    const actualMinutes = relevantDaily.reduce((sum, task) => sum + (task.actualDurationMinutes ?? 0), 0);
    const completedMinutes = relevantDaily.filter((task) => task.status === 'completed' || task.status === 'partial').reduce((sum, task) => sum + (task.actualDurationMinutes ?? task.plannedMinutes), 0);
    const pace = calculatePace(roadmap, roadmapTasks, dailyTasks, today, fallbackCapacity);
    return {
      id: roadmap.id, title: roadmap.title, totalTasks: tasks.length, completedTasks, remainingTasks: remaining.length,
      progressPercent: safePercent(completedTasks, tasks.length), estimatedRemainingMinutes: remainingMinutes,
      completedMinutes, actualMinutes, targetDate: roadmap.targetDate?.slice(0, 10),
      paceStatus: pace.paceStatus, projectedCompletionDate: pace.projectedCompletionDate,
    };
  });
}

function createMilestoneAnalytics(
  roadmaps: Roadmap[], concepts: CurriculumConcept[], definitions: TaskDefinition[], roadmapTasks: RoadmapTask[],
): MilestoneAnalytics[] {
  const roadmapById = new Map(roadmaps.map((roadmap) => [roadmap.id, roadmap]));
  const definitionsByConcept = new Map<string, TaskDefinition[]>();
  for (const definition of definitions) {
    const list = definitionsByConcept.get(definition.conceptId) ?? [];
    list.push(definition);
    definitionsByConcept.set(definition.conceptId, list);
  }
  const roadmapTaskById = new Map(roadmapTasks.map((task) => [task.id, task]));
  return concepts.filter((concept) => concept.nodeType === 'milestone' || concept.nodeType === 'project').map((concept) => {
    const relatedDefinitions = definitionsByConcept.get(concept.id) ?? [];
    const relatedTasks = relatedDefinitions.map((definition) => roadmapTaskById.get(definition.id)).filter((task): task is RoadmapTask => Boolean(task && task.active !== false));
    const completedTasks = relatedTasks.filter((task) => task.completedOverall).length;
    const remainingMinutes = relatedTasks.filter((task) => !task.completedOverall).reduce((sum, task) => sum + task.estimatedMinutes, 0);
    const totalTasks = relatedTasks.length;
    const status: MilestoneAnalytics['status'] = completedTasks === 0 ? 'NOT_STARTED' : completedTasks === totalTasks && totalTasks > 0 ? 'COMPLETED' : 'IN_PROGRESS';
    return {
      id: concept.id, roadmapId: concept.roadmapId, roadmapTitle: roadmapById.get(concept.roadmapId)?.title ?? 'Unknown roadmap',
      title: concept.title, totalTasks, completedTasks, progressPercent: safePercent(completedTasks, totalTasks), estimatedRemainingMinutes: remainingMinutes, status,
    };
  }).filter((item) => item.totalTasks > 0);
}

function createSubjectAnalytics(roadmapTasks: RoadmapTask[], dailyTasks: DailyTask[], window: AnalyticsWindow): SubjectAnalytics[] {
  const taskById = new Map(roadmapTasks.map((task) => [task.id, task]));
  const buckets = new Map<string, { roadmapTaskIds: Set<string>; completed: number; partial: number; skipped: number; planned: number; actual: number }>();
  for (const dailyTask of dailyTasks) {
    if (!isAnalyticsTask(dailyTask) || !inWindow(dailyTask.date, window) || !dailyTask.sourceTaskId) continue;
    const source = taskById.get(dailyTask.sourceTaskId); if (!source) continue;
    const key = source.category?.trim() || 'Uncategorized';
    const bucket = buckets.get(key) ?? { roadmapTaskIds: new Set<string>(), completed: 0, partial: 0, skipped: 0, planned: 0, actual: 0 };
    bucket.roadmapTaskIds.add(source.id);
    bucket.planned += Math.max(0, dailyTask.plannedMinutes);
    bucket.actual += Math.max(0, dailyTask.actualDurationMinutes ?? 0);
    if (dailyTask.status === 'completed') bucket.completed += 1;
    if (dailyTask.status === 'partial') bucket.partial += 1;
    if (dailyTask.status === 'skipped') bucket.skipped += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()].map(([key, bucket]) => {
    const reported = bucket.completed + bucket.partial + bucket.skipped;
    return {
      key, label: key, totalTasks: bucket.roadmapTaskIds.size, completedTasks: bucket.completed,
      partialTasks: bucket.partial, skippedTasks: bucket.skipped, reportedTasks: reported,
      completionRate: safePercent(bucket.completed + bucket.partial * 0.5, reported), plannedMinutes: bucket.planned,
      actualMinutes: bucket.actual, averageActualMinutes: reported ? Math.round(bucket.actual / reported) : 0,
      estimateDeltaPercent: bucket.planned ? Math.round(((bucket.actual - bucket.planned) / bucket.planned) * 100) : 0,
    };
  }).sort((a, b) => b.plannedMinutes - a.plannedMinutes);
}

function createWorkload(dailyTasks: DailyTask[], window: AnalyticsWindow): WorkloadPoint[] {
  const points: WorkloadPoint[] = [];
  for (let date = window.from; date <= window.to; date = addDays(date, 1)) {
    const rows = dailyTasks.filter((task) => task.date === date && isAnalyticsTask(task));
    const plannedMinutes = rows.reduce((sum, task) => sum + task.plannedMinutes, 0);
    const actualMinutes = rows.reduce((sum, task) => sum + (task.actualDurationMinutes ?? 0), 0);
    const completedRows = rows.filter((task) => task.status === 'completed' || task.status === 'partial');
    const reportedTasks = rows.filter((task) => task.status === 'completed' || task.status === 'partial' || task.status === 'skipped').length;
    points.push({
      date, plannedMinutes, actualMinutes,
      completedMinutes: completedRows.reduce((sum, task) => sum + (task.actualDurationMinutes ?? task.plannedMinutes), 0),
      completedTasks: completedRows.length, reportedTasks,
      loadPercent: plannedMinutes ? clampPercent(Math.round((actualMinutes / plannedMinutes) * 100)) : 0,
    });
  }
  return points;
}

function createAdaptationAnalytics(estimationProfiles: EstimationProfile[], timePatterns: TimePatternProfile[], overrides: PlannerOverride[], dailyTasks: DailyTask[]): AdaptationAnalytics {
  const deltaValues = estimationProfiles.filter((profile) => profile.originalEstimateMinutes > 0).map((profile) => ((profile.learnedEstimateMinutes - profile.originalEstimateMinutes) / profile.originalEstimateMinutes) * 100);
  const repeated = detectRepeatedSkips(dailyTasks);
  const strongestTimePatterns = timePatterns.filter((profile) => profile.preferredDaypart).sort((a, b) => {
    const sampleA = a.morningSamples + a.afternoonSamples + a.eveningSamples;
    const sampleB = b.morningSamples + b.afternoonSamples + b.eveningSamples;
    return sampleB - sampleA;
  }).slice(0, 6).map((profile) => {
    const daypart = profile.preferredDaypart!;
    const rate = daypart === 'morning' ? profile.morningSuccessRate : daypart === 'afternoon' ? profile.afternoonSuccessRate : profile.eveningSuccessRate;
    const samples = daypart === 'morning' ? profile.morningSamples : daypart === 'afternoon' ? profile.afternoonSamples : profile.eveningSamples;
    return { scopeKey: profile.scopeKey, daypart, successRatePercent: Math.round(rate * 100), samples };
  });
  return {
    estimationProfileCount: estimationProfiles.length,
    highConfidenceProfiles: estimationProfiles.filter((p) => p.confidence === 'high').length,
    mediumConfidenceProfiles: estimationProfiles.filter((p) => p.confidence === 'medium').length,
    lowConfidenceProfiles: estimationProfiles.filter((p) => p.confidence === 'low').length,
    learnedEstimateDeltaPercent: deltaValues.length ? Math.round(deltaValues.reduce((a, b) => a + b, 0) / deltaValues.length) : 0,
    overrideCounts: summarizeOverrides(overrides), repeatedSkipCount: repeated.reduce((sum, item) => sum + item.skips, 0),
    repeatedSkipTaskCount: repeated.length, timingProfileCount: timePatterns.length, strongestTimePatterns,
  };
}

export function buildAnalyticsReport(args: {
  today: string;
  period: AnalyticsPeriod;
  roadmaps: Roadmap[];
  roadmapTasks: RoadmapTask[];
  concepts: CurriculumConcept[];
  taskDefinitions: TaskDefinition[];
  dailyTasks: DailyTask[];
  estimationProfiles: EstimationProfile[];
  timePatternProfiles: TimePatternProfile[];
  plannerOverrides: PlannerOverride[];
  fallbackDailyCapacity: number;
}): AnalyticsReport {
  const window = getAnalyticsWindow(args.today, args.period);
  const previous = previousWindow(window);
  return {
    window,
    summary: createSummary(args.dailyTasks, window),
    previousSummary: createSummary(args.dailyTasks, previous),
    roadmaps: createRoadmapAnalytics(args.roadmaps, args.roadmapTasks, args.dailyTasks, args.today, args.fallbackDailyCapacity),
    milestones: createMilestoneAnalytics(args.roadmaps, args.concepts, args.taskDefinitions, args.roadmapTasks),
    subjects: createSubjectAnalytics(args.roadmapTasks, args.dailyTasks, window),
    workload: createWorkload(args.dailyTasks, window),
    adaptation: createAdaptationAnalytics(args.estimationProfiles, args.timePatternProfiles, args.plannerOverrides, args.dailyTasks),
  };
}
