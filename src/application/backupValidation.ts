/** Validation for untrusted JSON backups. Keep this module dependency-free so it can be tested without IndexedDB. */
export const BACKUP_STORES = [
  'roadmaps', 'curriculumVersions', 'curriculumConcepts', 'taskDefinitions', 'roadmapTasks', 'externalTasks', 'habits', 'habitLogs', 'busyEvents',
  'dailyTasks', 'waterLogs', 'exerciseLogs', 'dayPlans', 'dailyReviews', 'preferences', 'plannerSettings', 'notifications', 'plannerDecisions', 'estimationProfiles', 'timePatternProfiles', 'plannerOverrides', 'adaptationSnapshots', 'aiArtifacts', 'aiSettings', 'audits',
] as const;

export type BackupStore = typeof BACKUP_STORES[number];
export interface BackupPayload {
  schemaVersion: number;
  exportedAt?: string;
  appVersion?: string;
  data: Partial<Record<BackupStore, Array<Record<string, unknown>>>>;
}

type RuleName = 'string' | 'nonEmptyString' | 'boolean' | 'number' | 'nonNegativeNumber' | 'positiveNumber' | 'integer' | 'nonNegativeInteger' | 'stringArray' | 'numberArray' | 'object' | 'record' | 'window' | 'windowArray' | 'weekdayArray' | 'unitInterval' | 'bufferPercentage' | 'isoDate' | 'time' | 'timeArray' | 'booleanRecord' | 'primitiveRecord' | 'priority' | 'taskStatus' | 'plannerMode' | 'habitKind' | 'habitOccurrence' | 'habitRecurrence' | 'streakPolicy' | 'taskKind' | 'difficulty' | 'nodeType' | 'confidence' | 'externalCategory' | 'taskType' | 'reviewStatus' | 'planState' | 'paceStatus' | 'notificationType' | 'aiArtifactKind' | 'plannerAction' | 'reviewEnergy' | 'curriculumVersionStatus' | 'explanationMode' | 'daypart' | 'percentage';
type Fields = { required: Record<string, RuleName>; optional?: Record<string, RuleName> };

const values: Partial<Record<RuleName, readonly string[]>> = {
  priority: ['low', 'medium', 'high', 'urgent'],
  taskStatus: ['planned', 'completed', 'partial', 'skipped', 'rescheduled', 'cancelled', 'unreported'],
  plannerMode: ['normal', 'busy', 'exam'],
  habitKind: ['exercise', 'water', 'custom'],
  habitOccurrence: ['due', 'completed', 'partial', 'skipped', 'unreported', 'not_due'],
  habitRecurrence: ['daily', 'weekly', 'custom'],
  streakPolicy: ['strict', 'target_or_partial', 'minimum_value'],
  taskKind: ['roadmap', 'habit', 'urgent', 'admin'],
  difficulty: ['easy', 'medium', 'hard', 'very_hard'],
  nodeType: ['subject', 'module', 'concept', 'skill', 'milestone', 'project', 'review_area', 'unknown'],
  confidence: ['high', 'medium', 'low'],
  externalCategory: ['PERSONAL', 'COLLEGE', 'WORK', 'URGENT'],
  taskType: ['learn', 'read', 'watch', 'practice', 'code', 'exercise', 'quiz', 'revise', 'apply', 'mini_project', 'checkpoint', 'reflection', 'review'],
  reviewStatus: ['blocked_pending_report', 'ready', 'completed'],
  planState: ['draft', 'ready_for_review', 'final', 'superseded'],
  paceStatus: ['AHEAD', 'ON_TRACK', 'AT_RISK', 'DELAYED'],
  notificationType: ['task_reminder', 'task_starting', 'next_task', 'exercise_reminder', 'water_reminder', 'review_reminder', 'deadline_reminder', 'reschedule_notice', 'plan_updated', 'streak_notice'],
  aiArtifactKind: ['roadmap_analysis', 'node_expansion', 'practice_set', 'knowledge_gap', 'decision_explanation'],
  plannerAction: ['move', 'lock', 'skip_today', 'split', 'merge', 'change_duration', 'change_priority', 'change_deadline', 'block_topic', 'mark_prerequisite_satisfied', 'add_note'],
  reviewEnergy: ['low', 'medium', 'high'],
  curriculumVersionStatus: ['draft', 'approved', 'superseded'],
  explanationMode: ['short', 'detailed'],
  daypart: ['morning', 'afternoon', 'evening'],
};

const commonId = { id: 'nonEmptyString' as const };
const fields: Record<BackupStore, Fields> = {
  roadmaps: { required: { ...commonId, title: 'nonEmptyString', sourceText: 'string', createdAt: 'string', updatedAt: 'string', active: 'boolean' }, optional: { priority: 'priority', targetDate: 'isoDate', capacitySharePercentage: 'percentage' } },
  curriculumVersions: { required: { ...commonId, roadmapId: 'nonEmptyString', version: 'positiveNumber', createdAt: 'string', sourceTextHash: 'string', status: 'curriculumVersionStatus', conceptIds: 'stringArray', taskDefinitionIds: 'stringArray', warnings: 'stringArray' } },
  curriculumConcepts: { required: { ...commonId, roadmapId: 'nonEmptyString', sourceNodeId: 'nonEmptyString', title: 'nonEmptyString', nodeType: 'nodeType', outcomes: 'stringArray' }, optional: { parentConceptId: 'nonEmptyString' } },
  taskDefinitions: { required: { ...commonId, roadmapId: 'nonEmptyString', sourceNodeId: 'nonEmptyString', conceptId: 'nonEmptyString', title: 'nonEmptyString', objective: 'string', type: 'taskType', estimatedMinutes: 'positiveNumber', minMinutes: 'positiveNumber', maxMinutes: 'positiveNumber', difficulty: 'difficulty', priority: 'priority', completionCriteria: 'string', dependencyIds: 'stringArray', confidence: 'confidence', active: 'boolean' }, optional: { splittable: 'boolean' } },
  roadmapTasks: { required: { ...commonId, roadmapId: 'nonEmptyString', title: 'nonEmptyString', estimatedMinutes: 'positiveNumber', priority: 'priority', order: 'nonNegativeInteger', dependencyIds: 'stringArray', completedOverall: 'boolean' }, optional: { description: 'string', objective: 'string', completionCriteria: 'string', taskType: 'taskType', category: 'string', dueDate: 'isoDate', difficulty: 'difficulty', carryOverCount: 'nonNegativeInteger', availableFrom: 'isoDate', availableUntil: 'isoDate', manuallyBlocked: 'boolean', active: 'boolean', splittable: 'boolean' } },
  externalTasks: { required: { ...commonId, title: 'nonEmptyString', category: 'externalCategory', estimatedMinutes: 'positiveNumber', priority: 'priority', status: 'taskStatus', active: 'boolean', createdAt: 'string', updatedAt: 'string' }, optional: { dueDate: 'isoDate', availableFrom: 'isoDate', availableUntil: 'isoDate', preferredWindow: 'window', fixedWindow: 'window', carryOverCount: 'nonNegativeInteger', splittable: 'boolean', completedAt: 'string' } },
  habits: { required: { ...commonId, name: 'nonEmptyString', kind: 'habitKind', targetValue: 'positiveNumber', unit: 'string', active: 'boolean', preferredWindows: 'windowArray', reminderTimes: 'timeArray', frequencyDays: 'weekdayArray' }, optional: { minimumValue: 'nonNegativeNumber', recurrence: 'habitRecurrence', streakPolicy: 'streakPolicy', allowPartial: 'boolean', carryOverAllowed: 'boolean', priority: 'priority', activeFrom: 'isoDate', activeUntil: 'isoDate' } },
  habitLogs: { required: { ...commonId, habitId: 'nonEmptyString', date: 'isoDate', status: 'habitOccurrence', value: 'nonNegativeNumber', targetValue: 'positiveNumber', recordedAt: 'string' }, optional: { minimumValue: 'nonNegativeNumber', note: 'string' } },
  busyEvents: { required: { ...commonId, date: 'isoDate', title: 'nonEmptyString', window: 'window', priority: 'priority', blocksPlanning: 'boolean' }, optional: { fixed: 'boolean' } },
  dailyTasks: { required: { ...commonId, date: 'isoDate', title: 'nonEmptyString', kind: 'taskKind', plannedMinutes: 'positiveNumber', priority: 'priority', status: 'taskStatus' }, optional: { sourceTaskId: 'nonEmptyString', sourceHabitId: 'nonEmptyString', sourceExternalTaskId: 'nonEmptyString', plannedWindow: 'window', resultReportedAt: 'string', skipReason: 'string', rescheduledTo: 'isoDate', rescheduledFrom: 'isoDate', actualDurationMinutes: 'positiveNumber', startedAt: 'string', completedAt: 'string', resultNote: 'string', energy: 'reviewEnergy' } },
  waterLogs: { required: { ...commonId, date: 'isoDate', amountMl: 'positiveNumber', recordedAt: 'string' } },
  exerciseLogs: { required: { ...commonId, date: 'isoDate', completed: 'boolean', recordedAt: 'string' }, optional: { durationMinutes: 'positiveNumber', exerciseType: 'string' } },
  dayPlans: { required: { ...commonId, date: 'isoDate', generatedAt: 'string', version: 'positiveNumber', state: 'planState', taskIds: 'stringArray', lockedUntilReview: 'boolean' }, optional: { mode: 'plannerMode', reason: 'string' } },
  dailyReviews: { required: { ...commonId, date: 'isoDate', required: 'boolean' }, optional: { status: 'reviewStatus', unresolvedTaskIds: 'stringArray', resolvedAt: 'string', reflection: 'string', blocker: 'string', energy: 'reviewEnergy', estimatedMinutes: 'nonNegativeNumber', actualMinutes: 'nonNegativeNumber', adaptationNote: 'string' } },
  preferences: { required: { ...commonId, timezone: 'nonEmptyString', wakeTime: 'time', sleepTime: 'time', defaultStudyWindows: 'windowArray', notificationLeadMinutes: 'nonNegativeNumber' }, optional: { maxStudyMinutesPerDay: 'nonNegativeNumber', maxCognitiveMinutesPerDay: 'nonNegativeNumber', maxDeepWorkSessions: 'nonNegativeInteger', maxContinuousFocusMinutes: 'positiveNumber', minimumBreakMinutes: 'nonNegativeNumber', bufferPercentage: 'bufferPercentage', onboardingCompleted: 'boolean', notificationsEnabled: 'boolean' } },
  plannerSettings: { required: { ...commonId, activeMode: 'plannerMode', busyCapacityMinutes: 'nonNegativeNumber', examCapacityMinutes: 'nonNegativeNumber', examRoadmapIds: 'stringArray' }, optional: { modeActiveUntil: 'isoDate' } },
  notifications: { required: { ...commonId, type: 'notificationType', title: 'nonEmptyString', body: 'string', scheduledAt: 'string' }, optional: { deliveredAt: 'string', readAt: 'string', linkedEntityId: 'nonEmptyString' } },
  plannerDecisions: { required: { ...commonId, planId: 'nonEmptyString', candidateId: 'nonEmptyString', selected: 'boolean', score: 'number', reasonCodes: 'stringArray', constraintResults: 'booleanRecord', createdAt: 'string' }, optional: { rejectedReason: 'string' } },
  estimationProfiles: { required: { ...commonId, scopeKey: 'nonEmptyString', originalEstimateMinutes: 'nonNegativeNumber', sampleCount: 'nonNegativeInteger', medianActualMinutes: 'nonNegativeNumber', varianceMinutesSquared: 'nonNegativeNumber', learnedEstimateMinutes: 'nonNegativeNumber', confidence: 'confidence', updatedAt: 'string' } },
  timePatternProfiles: { required: { ...commonId, scopeKey: 'nonEmptyString', morningSuccessRate: 'unitInterval', afternoonSuccessRate: 'unitInterval', eveningSuccessRate: 'unitInterval', morningSamples: 'nonNegativeInteger', afternoonSamples: 'nonNegativeInteger', eveningSamples: 'nonNegativeInteger', updatedAt: 'string' }, optional: { preferredDaypart: 'daypart' } },
  plannerOverrides: { required: { ...commonId, taskId: 'nonEmptyString', date: 'isoDate', action: 'plannerAction', payload: 'primitiveRecord', createdAt: 'string' } },
  adaptationSnapshots: { required: { ...commonId, date: 'isoDate', roadmapId: 'nonEmptyString', paceStatus: 'paceStatus', remainingMinutes: 'nonNegativeNumber', typicalDailyCapacityMinutes: 'nonNegativeNumber', message: 'string', createdAt: 'string' }, optional: { projectedCompletionDate: 'isoDate', targetDate: 'isoDate' } },
  aiArtifacts: { required: { ...commonId, kind: 'aiArtifactKind', roadmapId: 'nonEmptyString', modelName: 'string', modelVersion: 'string', promptVersion: 'string', schemaVersion: 'positiveNumber', confidence: 'confidence', payload: 'record', createdAt: 'string' }, optional: { sourceNodeId: 'nonEmptyString' } },
  aiSettings: { required: { id: 'nonEmptyString', localOnly: 'boolean', cloudEnabled: 'boolean', explanationMode: 'explanationMode', retainHistory: 'boolean', providerName: 'nonEmptyString' }, optional: { localEndpoint: 'string', localModel: 'string' } },
  audits: { required: { ...commonId, at: 'string', action: 'nonEmptyString', entityType: 'nonEmptyString', entityId: 'nonEmptyString', details: 'primitiveRecord' } },
};

const introducedAt: Record<BackupStore, number> = {
  roadmaps: 2, curriculumVersions: 3, curriculumConcepts: 3, taskDefinitions: 3, roadmapTasks: 2, externalTasks: 5, habits: 2, habitLogs: 6, busyEvents: 2,
  dailyTasks: 2, waterLogs: 2, exerciseLogs: 2, dayPlans: 2, dailyReviews: 2, preferences: 2, plannerSettings: 5, notifications: 8, plannerDecisions: 4,
  estimationProfiles: 7, timePatternProfiles: 7, plannerOverrides: 7, adaptationSnapshots: 7, aiArtifacts: 8, aiSettings: 8, audits: 2,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/u;

function isSafeJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= 1_000_000;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 10_000 && value.every((item) => isSafeJsonValue(item, depth + 1));
  if (!isPlainRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 10_000 && entries.every(([key, item]) => !dangerousKeys.has(key) && isSafeJsonValue(item, depth + 1));
}

function isSafeRecord(value: unknown): value is Record<string, unknown> {
  return isPlainRecord(value) && isSafeJsonValue(value);
}

function validPrimitiveRecord(value: unknown): boolean {
  return isPlainRecord(value) && Object.entries(value).every(([key, item]) =>
    !dangerousKeys.has(key) && (item === null || typeof item === 'string' && item.length <= 1_000_000 || typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item)));
}

function validBooleanRecord(value: unknown): boolean {
  return isPlainRecord(value) && Object.entries(value).every(([key, item]) => !dangerousKeys.has(key) && typeof item === 'boolean');
}

function validTime(value: unknown): boolean {
  return typeof value === 'string' && timePattern.test(value);
}

function validWindow(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.start !== 'string' || typeof value.end !== 'string') return false;
  return validTime(value.start) && validTime(value.end) && value.start < value.end;
}

function validISODate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validRule(rule: RuleName, value: unknown): boolean {
  if (rule === 'percentage') return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  if (rule === 'bufferPercentage') return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 90;
  if (rule === 'unitInterval') return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  const enumValues = values[rule];
  if (enumValues) return typeof value === 'string' && enumValues.includes(value);
  switch (rule) {
    case 'string': return typeof value === 'string' && value.length <= 1_000_000;
    case 'nonEmptyString': return typeof value === 'string' && value.trim().length > 0 && value.length <= 10_000;
    case 'boolean': return typeof value === 'boolean';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'nonNegativeNumber': return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    case 'positiveNumber': return typeof value === 'number' && Number.isFinite(value) && value > 0;
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'nonNegativeInteger': return typeof value === 'number' && Number.isInteger(value) && value >= 0;
    case 'stringArray': return Array.isArray(value) && value.length <= 10_000 && value.every((item) => typeof item === 'string');
    case 'numberArray': return Array.isArray(value) && value.length <= 10_000 && value.every((item) => typeof item === 'number' && Number.isFinite(item));
    case 'weekdayArray': return Array.isArray(value) && value.length <= 7 && value.every((item) => typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 6) && new Set(value).size === value.length;
    case 'object': return isSafeRecord(value);
    case 'record': return isSafeRecord(value);
    case 'primitiveRecord': return validPrimitiveRecord(value);
    case 'booleanRecord': return validBooleanRecord(value);
    case 'window': return validWindow(value);
    case 'windowArray': return Array.isArray(value) && value.length <= 10_000 && value.every(validWindow);
    case 'time': return validTime(value);
    case 'timeArray': return Array.isArray(value) && value.length <= 10_000 && value.every(validTime);
    case 'isoDate': return validISODate(value);
    default: return false;
  }
}

function validateSemanticFields(store: BackupStore, row: Record<string, unknown>): void {
  const invalid = (message: string): never => { throw new Error(`Backup row ${String(row.id)} in ${store} ${message}.`); };
  if (store === 'taskDefinitions') {
    const min = row.minMinutes as number;
    const estimate = row.estimatedMinutes as number;
    const max = row.maxMinutes as number;
    if (min > estimate || estimate > max) invalid('must satisfy minMinutes <= estimatedMinutes <= maxMinutes');
  }
  if (store === 'habits') {
    if (row.minimumValue !== undefined && (row.minimumValue as number) > (row.targetValue as number)) invalid('has minimumValue greater than targetValue');
    if (row.activeFrom !== undefined && row.activeUntil !== undefined && String(row.activeFrom) > String(row.activeUntil)) invalid('has activeFrom after activeUntil');
  }
  if (store === 'habitLogs' && row.minimumValue !== undefined && (row.minimumValue as number) > (row.targetValue as number)) {
    invalid('has minimumValue greater than targetValue');
  }
  if ((store === 'roadmapTasks' || store === 'externalTasks') && row.availableFrom !== undefined && row.availableUntil !== undefined && String(row.availableFrom) > String(row.availableUntil)) {
    invalid('has availableFrom after availableUntil');
  }
}

function validateRows(store: BackupStore, rows: unknown, totalRows: { value: number }): asserts rows is Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) throw new Error(`Backup store ${store} must be an array.`);
  totalRows.value += rows.length;
  if (totalRows.value > 100_000) throw new Error('Backup contains too many records (maximum 100,000).');
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (!isPlainRecord(row) || !isSafeJsonValue(row) || typeof row.id !== 'string' || !row.id.trim() || row.id.length > 256) {
      throw new Error(`Backup contains an invalid or unsafe row ${index + 1} in ${store}: expected a safe record with a non-empty ID.`);
    }
    if (seen.has(row.id)) throw new Error(`Backup contains duplicate ID ${row.id} in ${store}.`);
    seen.add(row.id);
    const definition = fields[store];
    for (const [name, rule] of Object.entries(definition.required)) {
      if (!(name in row) || !validRule(rule, row[name])) throw new Error(`Backup row ${row.id} in ${store} has a missing or invalid ${name} field.`);
    }
    for (const [name, rule] of Object.entries(definition.optional ?? {})) {
      if (name in row && row[name] !== undefined && !validRule(rule, row[name])) throw new Error(`Backup row ${row.id} in ${store} has an invalid optional ${name} field.`);
    }
    validateSemanticFields(store, row);
  });
}

export function validateBackupPayload(value: unknown): BackupPayload {
  if (!isPlainRecord(value)) throw new Error('Backup is not a JSON object.');
  if (value.exportedAt !== undefined && (typeof value.exportedAt !== 'string' || value.exportedAt.length > 128)) throw new Error('Backup exportedAt metadata must be a short string.');
  if (value.appVersion !== undefined && (typeof value.appVersion !== 'string' || value.appVersion.length > 128)) throw new Error('Backup appVersion metadata must be a short string.');
  const schemaVersion = value.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 2 || schemaVersion > 9 || !isPlainRecord(value.data)) {
    throw new Error('Unsupported backup version. This build accepts schema versions 2 through 9.');
  }
  const data = value.data;
  const allowed = new Set<string>(BACKUP_STORES);
  const provided = Object.keys(data);
  const unknown = provided.filter((store) => !allowed.has(store));
  if (unknown.length) throw new Error(`Backup contains an unsupported data store: ${unknown.join(', ')}.`);
  const missing = BACKUP_STORES.filter((store) => introducedAt[store] <= schemaVersion && !Object.prototype.hasOwnProperty.call(data, store));
  if (missing.length) throw new Error(`Backup schema ${value.schemaVersion} is incomplete; missing required stores: ${missing.join(', ')}.`);
  const futureStores = (provided as BackupStore[]).filter((store) => introducedAt[store] > schemaVersion);
  if (futureStores.length) throw new Error(`Backup schema ${value.schemaVersion} cannot contain stores introduced later: ${futureStores.join(', ')}.`);

  const count = { value: 0 };
  for (const store of provided as BackupStore[]) validateRows(store, data[store], count);
  return value as unknown as BackupPayload;
}
