import type {
  AdaptationSnapshot,
  DailyTask,
  EstimationProfile,
  ISODate,
  PlannerOverride,
  Roadmap,
  RoadmapTask,
  TimePatternProfile,
  TaskDefinition,
} from '../entities/models';

export type PaceStatus = 'AHEAD' | 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
export type Daypart = 'morning' | 'afternoon' | 'evening';

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function variance(values: number[], center: number): number {
  if (values.length < 2) return 0;
  return values.reduce((sum, value) => sum + ((value - center) ** 2), 0) / (values.length - 1);
}

function confidenceForSamples(sampleCount: number): EstimationProfile['confidence'] {
  if (sampleCount >= 10) return 'high';
  if (sampleCount >= 3) return 'medium';
  return 'low';
}

export function getDaypart(time: string): Daypart {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

export function estimateScopeKey(roadmapTask: RoadmapTask | undefined, task: DailyTask): string {
  return roadmapTask
    ? `${roadmapTask.roadmapId}:${roadmapTask.taskType ?? 'unknown'}:${roadmapTask.category ?? 'uncategorized'}`
    : `${task.kind}:${task.title.trim().toLowerCase()}`;
}

export function buildEstimationProfiles(
  dailyTasks: DailyTask[],
  roadmapTasks: RoadmapTask[],
): EstimationProfile[] {
  const roadmapTaskById = new Map(roadmapTasks.map((task) => [task.id, task]));
  const buckets = new Map<string, { original: number[]; actual: number[] }>();

  for (const task of dailyTasks) {
    if (task.status === 'cancelled' || task.status === 'rescheduled') continue;
    if (!task.actualDurationMinutes || task.actualDurationMinutes <= 0) continue;
    if (!task.sourceTaskId && task.kind !== 'roadmap') continue;
    const source = task.sourceTaskId ? roadmapTaskById.get(task.sourceTaskId) : undefined;
    const key = estimateScopeKey(source, task);
    const bucket = buckets.get(key) ?? { original: [], actual: [] };
    bucket.original.push(Math.max(1, source?.estimatedMinutes ?? task.plannedMinutes));
    bucket.actual.push(Math.max(1, task.actualDurationMinutes));
    buckets.set(key, bucket);
  }

  return [...buckets.entries()].map(([scopeKey, bucket]) => {
    const originalEstimateMinutes = Math.round(median(bucket.original));
    const medianActualMinutes = Math.round(median(bucket.actual));
    const sampleCount = bucket.actual.length;
    const confidence = confidenceForSamples(sampleCount);
    const adaptationWeight = Math.min(0.75, sampleCount / 12 * 0.75);
    const learnedEstimateMinutes = Math.max(1, Math.round(originalEstimateMinutes * (1 - adaptationWeight) + medianActualMinutes * adaptationWeight));
    return {
      id: `estimate:${scopeKey}`,
      scopeKey,
      originalEstimateMinutes,
      sampleCount,
      medianActualMinutes,
      varianceMinutesSquared: Math.round(variance(bucket.actual, medianActualMinutes)),
      learnedEstimateMinutes,
      confidence,
      updatedAt: new Date().toISOString(),
    } satisfies EstimationProfile;
  });
}

export function buildTimePatternProfiles(dailyTasks: DailyTask[]): TimePatternProfile[] {
  const buckets = new Map<string, { counts: Record<Daypart, number>; success: Record<Daypart, number> }>();
  for (const task of dailyTasks) {
    if (!task.plannedWindow || !task.resultReportedAt) continue;
    if (!['completed', 'partial', 'skipped'].includes(task.status)) continue;
    const scopeKey = task.sourceTaskId ? `task:${task.sourceTaskId}` : `kind:${task.kind}`;
    const daypart = getDaypart(task.plannedWindow.start);
    const bucket = buckets.get(scopeKey) ?? { counts: { morning: 0, afternoon: 0, evening: 0 }, success: { morning: 0, afternoon: 0, evening: 0 } };
    bucket.counts[daypart] += 1;
    bucket.success[daypart] += task.status === 'completed' ? 1 : task.status === 'partial' ? 0.5 : 0;
    buckets.set(scopeKey, bucket);
  }

  return [...buckets.entries()].map(([scopeKey, bucket]) => {
    const rates = (Object.keys(bucket.counts) as Daypart[]).map((daypart) => ({
      daypart,
      samples: bucket.counts[daypart],
      rate: bucket.counts[daypart] ? bucket.success[daypart] / bucket.counts[daypart] : 0,
    })).filter((entry) => entry.samples > 0);
    rates.sort((a, b) => b.rate - a.rate || b.samples - a.samples);
    const strongest = rates[0];
    return {
      id: `pattern:${scopeKey}`,
      scopeKey,
      morningSuccessRate: bucket.counts.morning ? bucket.success.morning / bucket.counts.morning : 0,
      afternoonSuccessRate: bucket.counts.afternoon ? bucket.success.afternoon / bucket.counts.afternoon : 0,
      eveningSuccessRate: bucket.counts.evening ? bucket.success.evening / bucket.counts.evening : 0,
      morningSamples: bucket.counts.morning,
      afternoonSamples: bucket.counts.afternoon,
      eveningSamples: bucket.counts.evening,
      preferredDaypart: strongest && strongest.samples >= 3 ? strongest.daypart : undefined,
      updatedAt: new Date().toISOString(),
    } satisfies TimePatternProfile;
  });
}

function medianDailyCapacity(tasks: DailyTask[], fromDate: ISODate, toDate: ISODate): number {
  const byDate = new Map<string, number>();
  for (const task of tasks) {
    if (task.date < fromDate || task.date > toDate) continue;
    if (!['roadmap', 'habit'].includes(task.kind)) continue;
    if (!task.plannedMinutes) continue;
    byDate.set(task.date, (byDate.get(task.date) ?? 0) + task.plannedMinutes);
  }
  return Math.round(median([...byDate.values()].filter((value) => value > 0)));
}

export function calculatePace(
  roadmap: Roadmap,
  roadmapTasks: RoadmapTask[],
  dailyTasks: DailyTask[],
  today: ISODate,
  fallbackDailyCapacity: number,
): AdaptationSnapshot {
  const active = roadmapTasks.filter((task) => task.roadmapId === roadmap.id && task.active !== false && !task.completedOverall);
  const remainingMinutes = active.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const recentFrom = new Date(`${today}T12:00:00`);
  recentFrom.setDate(recentFrom.getDate() - 13);
  const recentFromISO = `${recentFrom.getFullYear()}-${String(recentFrom.getMonth() + 1).padStart(2, '0')}-${String(recentFrom.getDate()).padStart(2, '0')}`;
  const typicalCapacity = medianDailyCapacity(dailyTasks, recentFromISO, today) || Math.max(1, fallbackDailyCapacity);
  const projectedDays = Math.max(0, Math.ceil(remainingMinutes / typicalCapacity));
  const projectedCompletionDate = new Date(`${today}T12:00:00`);
  projectedCompletionDate.setDate(projectedCompletionDate.getDate() + projectedDays);
  const projected = `${projectedCompletionDate.getFullYear()}-${String(projectedCompletionDate.getMonth() + 1).padStart(2, '0')}-${String(projectedCompletionDate.getDate()).padStart(2, '0')}`;

  let status: PaceStatus;
  if (remainingMinutes === 0) status = 'AHEAD';
  else if (roadmap.targetDate && roadmap.targetDate.slice(0, 10) < today) status = 'DELAYED';
  else if (roadmap.targetDate && projected > roadmap.targetDate.slice(0, 10)) status = 'AT_RISK';
  else if (roadmap.targetDate) {
    const target = new Date(`${roadmap.targetDate.slice(0,10)}T12:00:00`).getTime();
    const projection = projectedCompletionDate.getTime();
    const marginDays = Math.max(0, Math.round((target - projection) / 86_400_000));
    status = marginDays >= 7 ? 'AHEAD' : 'ON_TRACK';
  } else {
    status = projectedDays <= 14 ? 'ON_TRACK' : 'AT_RISK';
  }

  return {
    id: `adapt:${roadmap.id}:${today}`,
    date: today,
    roadmapId: roadmap.id,
    paceStatus: status,
    remainingMinutes,
    typicalDailyCapacityMinutes: typicalCapacity,
    projectedCompletionDate: projected,
    targetDate: roadmap.targetDate?.slice(0, 10),
    message: remainingMinutes === 0
      ? 'No remaining active estimated workload.'
      : `At your recent pace, projected completion is around ${projected}.`,
    createdAt: new Date().toISOString(),
  } satisfies AdaptationSnapshot;
}

export function detectRepeatedSkips(tasks: DailyTask[], threshold = 2): Array<{ sourceTaskId: string; title: string; skips: number; suggestion: string }> {
  const grouped = new Map<string, DailyTask[]>();
  for (const task of tasks) {
    if (!task.sourceTaskId || task.status !== 'skipped') continue;
    const list = grouped.get(task.sourceTaskId) ?? [];
    list.push(task);
    grouped.set(task.sourceTaskId, list);
  }
  return [...grouped.entries()].filter(([, list]) => list.length >= threshold).map(([sourceTaskId, list]) => ({
    sourceTaskId,
    title: list.at(-1)?.title ?? sourceTaskId,
    skips: list.length,
    suggestion: (list.at(-1)?.plannedMinutes ?? 0) >= 60
      ? 'This task has been skipped repeatedly. Consider splitting it into smaller sessions.'
      : 'This task has been skipped repeatedly. Consider moving it, reducing scope, or changing its priority.',
  }));
}

export function summarizeOverrides(overrides: PlannerOverride[]): Record<string, number> {
  return overrides.reduce<Record<string, number>>((counts, override) => {
    counts[override.action] = (counts[override.action] ?? 0) + 1;
    return counts;
  }, {});
}

export function adaptiveEstimateForTask(task: RoadmapTask, profiles: EstimationProfile[]): number {
  const key = `${task.roadmapId}:${task.taskType ?? 'unknown'}:${task.category ?? 'uncategorized'}`;
  const profile = profiles.find((candidate) => candidate.scopeKey === key);
  if (!profile || profile.confidence === 'low') return task.estimatedMinutes;
  return Math.max(1, Math.min(task.estimatedMinutes * 2, profile.learnedEstimateMinutes));
}
