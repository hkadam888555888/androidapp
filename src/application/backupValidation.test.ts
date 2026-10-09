import { describe, expect, it } from 'vitest';
import { BACKUP_STORES, validateBackupPayload } from './backupValidation';

function backupFor(schemaVersion = 9) {
  const introduced: Record<string, number> = {
    roadmaps: 2, curriculumVersions: 3, curriculumConcepts: 3, taskDefinitions: 3, roadmapTasks: 2, externalTasks: 5,
    habits: 2, habitLogs: 6, busyEvents: 2, dailyTasks: 2, waterLogs: 2, exerciseLogs: 2, dayPlans: 2,
    dailyReviews: 2, preferences: 2, plannerSettings: 5, notifications: 8, plannerDecisions: 4, estimationProfiles: 7,
    timePatternProfiles: 7, plannerOverrides: 7, adaptationSnapshots: 7, aiArtifacts: 8, aiSettings: 8, audits: 2,
  };
  const data: Record<string, unknown[]> = {};
  for (const store of BACKUP_STORES) if (introduced[store] <= schemaVersion) data[store] = [];
  return { schemaVersion, exportedAt: '2026-10-09T00:00:00.000Z', appVersion: '1.0.5', data };
}

describe('backup payload validation', () => {
  it('accepts a complete current-schema empty snapshot', () => {
    expect(validateBackupPayload(backupFor())).toMatchObject({ schemaVersion: 9 });
  });

  it('accepts representative valid rows across all current stores', () => {
    const value = backupFor();
    value.data.roadmaps = [{ id: 'r1', title: 'AI/ML', sourceText: '# AI/ML', createdAt: '', updatedAt: '', active: true, capacitySharePercentage: 100 }];
    value.data.curriculumVersions = [{ id: 'cv1', roadmapId: 'r1', version: 1, createdAt: '', sourceTextHash: 'hash', status: 'approved', conceptIds: ['c1'], taskDefinitionIds: ['td1'], warnings: [] }];
    value.data.curriculumConcepts = [{ id: 'c1', roadmapId: 'r1', sourceNodeId: 'n1', title: 'Python', nodeType: 'concept', outcomes: ['Explain Python'] }];
    value.data.taskDefinitions = [{ id: 'td1', roadmapId: 'r1', sourceNodeId: 'n1', conceptId: 'c1', title: 'Learn Python', objective: 'Learn', type: 'learn', estimatedMinutes: 30, minMinutes: 20, maxMinutes: 45, difficulty: 'medium', priority: 'medium', completionCriteria: 'Explain it', dependencyIds: [], confidence: 'high', active: true }];
    value.data.roadmapTasks = [{ id: 'rt1', roadmapId: 'r1', title: 'Learn Python', estimatedMinutes: 30, priority: 'medium', order: 0, dependencyIds: [], completedOverall: false }];
    value.data.externalTasks = [{ id: 'e1', title: 'College assignment', category: 'COLLEGE', estimatedMinutes: 30, priority: 'high', status: 'planned', active: true, createdAt: '', updatedAt: '' }];
    value.data.habits = [{ id: 'h1', name: 'Exercise', kind: 'exercise', targetValue: 20, unit: 'minutes', active: true, preferredWindows: [], reminderTimes: [], frequencyDays: [1, 2, 3] }];
    value.data.habitLogs = [{ id: 'hl1', habitId: 'h1', date: '2026-10-09', status: 'completed', value: 20, targetValue: 20, recordedAt: '' }];
    value.data.busyEvents = [{ id: 'b1', date: '2026-10-09', title: 'Class', window: { start: '09:00', end: '10:00' }, priority: 'medium', blocksPlanning: true }];
    value.data.dailyTasks = [{ id: 'dt1', date: '2026-10-09', title: 'Learn Python', kind: 'roadmap', plannedMinutes: 30, priority: 'medium', status: 'planned' }];
    value.data.waterLogs = [{ id: 'wl1', date: '2026-10-09', amountMl: 250, recordedAt: '' }];
    value.data.exerciseLogs = [{ id: 'xl1', date: '2026-10-09', completed: true, recordedAt: '' }];
    value.data.dayPlans = [{ id: 'dp1', date: '2026-10-09', generatedAt: '', version: 1, state: 'final', taskIds: ['dt1'], lockedUntilReview: true }];
    value.data.dailyReviews = [{ id: 'dr1', date: '2026-10-09', required: true, status: 'ready', unresolvedTaskIds: ['dt1'] }];
    value.data.preferences = [{ id: 'prefs', timezone: 'Asia/Kolkata', wakeTime: '05:00', sleepTime: '22:00', defaultStudyWindows: [{ start: '09:00', end: '11:00' }], notificationLeadMinutes: 15 }];
    value.data.plannerSettings = [{ id: 'settings', activeMode: 'normal', busyCapacityMinutes: 60, examCapacityMinutes: 180, examRoadmapIds: [] }];
    value.data.notifications = [{ id: 'n1', type: 'task_reminder', title: 'Study', body: 'Start now', scheduledAt: '2026-10-09T09:00:00Z' }];
    value.data.plannerDecisions = [{ id: 'pd1', planId: 'dp1', candidateId: 'roadmap:rt1', selected: true, score: 1, reasonCodes: ['SELECTED'], constraintResults: { fitsWindow: true }, createdAt: '' }];
    value.data.estimationProfiles = [{ id: 'ep1', scopeKey: 'task:rt1', originalEstimateMinutes: 30, sampleCount: 1, medianActualMinutes: 25, varianceMinutesSquared: 0, learnedEstimateMinutes: 28, confidence: 'low', updatedAt: '' }];
    value.data.timePatternProfiles = [{ id: 'tp1', scopeKey: 'task:rt1', morningSuccessRate: 1, afternoonSuccessRate: 0, eveningSuccessRate: 0, morningSamples: 1, afternoonSamples: 0, eveningSamples: 0, preferredDaypart: 'morning', updatedAt: '' }];
    value.data.plannerOverrides = [{ id: 'po1', taskId: 'rt1', date: '2026-10-09', action: 'lock', payload: {}, createdAt: '' }];
    value.data.adaptationSnapshots = [{ id: 'as1', date: '2026-10-09', roadmapId: 'r1', paceStatus: 'ON_TRACK', remainingMinutes: 30, typicalDailyCapacityMinutes: 60, message: 'On track', createdAt: '' }];
    value.data.aiArtifacts = [{ id: 'aa1', kind: 'roadmap_analysis', roadmapId: 'r1', modelName: 'rules', modelVersion: '1', promptVersion: '1', schemaVersion: 1, confidence: 'high', payload: {}, createdAt: '' }];
    value.data.aiSettings = [{ id: 'ai-settings', localOnly: true, cloudEnabled: false, explanationMode: 'short', retainHistory: false, providerName: 'RuleBasedProvider' }];
    value.data.audits = [{ id: 'a1', at: '', action: 'settings.updated', entityType: 'settings', entityId: 'settings', details: {} }];
    expect(validateBackupPayload(value).schemaVersion).toBe(9);
  });

  it('rejects an incomplete current-schema snapshot before persistence can begin', () => {
    const value = backupFor();
    delete value.data.dailyTasks;
    expect(() => validateBackupPayload(value)).toThrow(/missing required stores: dailyTasks/u);
  });

  it('keeps support for an older complete schema without stores introduced later', () => {
    expect(validateBackupPayload(backupFor(2)).schemaVersion).toBe(2);
  });

  it('rejects stores that did not exist in the declared historical schema', () => {
    const value = backupFor(2);
    value.data.notifications = [];
    expect(() => validateBackupPayload(value)).toThrow(/cannot contain stores introduced later: notifications/u);
  });

  it('requires and validates the notification store for schema-8 backups', () => {
    const value = backupFor(8);
    expect(Object.prototype.hasOwnProperty.call(value.data, 'notifications')).toBe(true);
    value.data.notifications = [{ id: 'n8', type: 'task_reminder', title: 'Study', body: 'Start study', scheduledAt: '2026-10-09T09:00:00.000Z' }];
    expect(validateBackupPayload(value).schemaVersion).toBe(8);
  });

  it('rejects a record that has only an ID instead of a valid roadmap row', () => {
    const value = backupFor();
    value.data.roadmaps = [{ id: 'r1' }];
    expect(() => validateBackupPayload(value)).toThrow(/roadmaps has a missing or invalid title field/u);
  });

  it('rejects roadmap tasks that have no owning roadmap reference', () => {
    const value = backupFor();
    value.data.roadmapTasks = [{ id: 'rt1', title: 'Learn Python', estimatedMinutes: 30, priority: 'medium', order: 0, dependencyIds: [], completedOverall: false }];
    expect(() => validateBackupPayload(value)).toThrow(/roadmapTasks has a missing or invalid roadmapId field/u);
  });

  it('rejects malformed optional fields rather than silently importing them', () => {
    const value = backupFor();
    value.data.roadmapTasks = [{ id: 'rt1', roadmapId: 'r1', title: 'Learn Python', description: { html: '<script>' }, estimatedMinutes: 30, priority: 'medium', order: 0, dependencyIds: [], completedOverall: false }];
    expect(() => validateBackupPayload(value)).toThrow(/invalid optional description field/u);
  });

  it('rejects invalid preference times', () => {
    const value = backupFor();
    value.data.preferences = [{ id: 'prefs', timezone: 'Asia/Kolkata', wakeTime: '25:90', sleepTime: '22:00', defaultStudyWindows: [], notificationLeadMinutes: 15 }];
    expect(() => validateBackupPayload(value)).toThrow(/preferences has a missing or invalid wakeTime field/u);
  });

  it('rejects invalid habit reminder time strings', () => {
    const value = backupFor();
    value.data.habits = [{ id: 'h1', name: 'Exercise', kind: 'exercise', targetValue: 20, unit: 'minutes', active: true, preferredWindows: [], reminderTimes: ['9:00 AM'], frequencyDays: [1, 2, 3] }];
    expect(() => validateBackupPayload(value)).toThrow(/habits has a missing or invalid reminderTimes field/u);
  });

  it('rejects prototype-sensitive keys in nested JSON payloads', () => {
    const value = backupFor();
    value.data.aiArtifacts = [{ id: 'aa1', kind: 'roadmap_analysis', roadmapId: 'r1', modelName: 'rules', modelVersion: '1', promptVersion: '1', schemaVersion: 1, confidence: 'high', payload: JSON.parse('{\"__proto__\":{\"polluted\":true}}'), createdAt: '' }];
    expect(() => validateBackupPayload(value)).toThrow(/invalid or unsafe row/u);
  });

  it('rejects excessively deep nested JSON payloads', () => {
    const value = backupFor();
    const nested: Record<string, unknown> = {};
    let cursor = nested;
    for (let depth = 0; depth < 70; depth += 1) {
      const child: Record<string, unknown> = {};
      cursor.child = child;
      cursor = child;
    }
    value.data.aiArtifacts = [{ id: 'aa1', kind: 'roadmap_analysis', roadmapId: 'r1', modelName: 'rules', modelVersion: '1', promptVersion: '1', schemaVersion: 1, confidence: 'high', payload: nested, createdAt: '' }];
    expect(() => validateBackupPayload(value)).toThrow(/invalid or unsafe row/u);
  });

  it('rejects invalid enums before accepting imported records', () => {
    const value = backupFor();
    value.data.dailyTasks = [{ id: 'd1', date: '2026-10-09', title: 'Study', kind: 'surprise', plannedMinutes: 30, priority: 'medium', status: 'planned' }];
    expect(() => validateBackupPayload(value)).toThrow(/dailyTasks has a missing or invalid kind field/u);
  });

  it('rejects impossible dates instead of accepting calendar coercion', () => {
    const value = backupFor();
    value.data.dailyTasks = [{ id: 'd1', date: '2026-02-30', title: 'Study', kind: 'roadmap', plannedMinutes: 30, priority: 'medium', status: 'planned' }];
    expect(() => validateBackupPayload(value)).toThrow(/dailyTasks has a missing or invalid date field/u);
  });

  it('rejects negative habit values and out-of-range or duplicate weekdays', () => {
    const negativeLog = backupFor();
    negativeLog.data.habitLogs = [{ id: 'hl1', habitId: 'h1', date: '2026-10-09', status: 'completed', value: -1, targetValue: 20, recordedAt: '' }];
    expect(() => validateBackupPayload(negativeLog)).toThrow(/habitLogs has a missing or invalid value field/u);

    for (const frequencyDays of [[7], [-1], [1.5], [1, 1]]) {
      const invalidSchedule = backupFor();
      invalidSchedule.data.habits = [{ id: 'h1', name: 'Exercise', kind: 'exercise', targetValue: 20, unit: 'minutes', active: true, preferredWindows: [], reminderTimes: [], frequencyDays }];
      expect(() => validateBackupPayload(invalidSchedule)).toThrow(/habits has a missing or invalid frequencyDays field/u);
    }
  });

  it('rejects invalid quantity, duration, buffer, minimum, and availability bounds', () => {
    const badWater = backupFor();
    badWater.data.waterLogs = [{ id: 'wl1', date: '2026-10-09', amountMl: 0, recordedAt: '' }];
    expect(() => validateBackupPayload(badWater)).toThrow(/waterLogs has a missing or invalid amountMl field/u);

    const badDuration = backupFor();
    badDuration.data.exerciseLogs = [{ id: 'xl1', date: '2026-10-09', completed: true, durationMinutes: 0, recordedAt: '' }];
    expect(() => validateBackupPayload(badDuration)).toThrow(/invalid optional durationMinutes field/u);

    const badBuffer = backupFor();
    badBuffer.data.preferences = [{ id: 'prefs', timezone: 'Asia/Kolkata', wakeTime: '05:00', sleepTime: '22:00', defaultStudyWindows: [], notificationLeadMinutes: 15, bufferPercentage: 91 }];
    expect(() => validateBackupPayload(badBuffer)).toThrow(/invalid optional bufferPercentage field/u);

    const badHabit = backupFor();
    badHabit.data.habits = [{ id: 'h1', name: 'Exercise', kind: 'exercise', targetValue: 20, minimumValue: 21, unit: 'minutes', active: true, preferredWindows: [], reminderTimes: [], frequencyDays: [1], activeFrom: '2026-10-11', activeUntil: '2026-10-10' }];
    expect(() => validateBackupPayload(badHabit)).toThrow(/minimumValue greater than targetValue/u);

    const badActiveRange = backupFor();
    badActiveRange.data.habits = [{ id: 'h1', name: 'Exercise', kind: 'exercise', targetValue: 20, minimumValue: 10, unit: 'minutes', active: true, preferredWindows: [], reminderTimes: [], frequencyDays: [1], activeFrom: '2026-10-11', activeUntil: '2026-10-10' }];
    expect(() => validateBackupPayload(badActiveRange)).toThrow(/activeFrom after activeUntil/u);

    const badLogMinimum = backupFor();
    badLogMinimum.data.habitLogs = [{ id: 'hl1', habitId: 'h1', date: '2026-10-09', status: 'partial', value: 10, targetValue: 20, minimumValue: 21, recordedAt: '' }];
    expect(() => validateBackupPayload(badLogMinimum)).toThrow(/minimumValue greater than targetValue/u);

    const badAvailability = backupFor();
    badAvailability.data.externalTasks = [{ id: 'e1', title: 'Task', category: 'COLLEGE', estimatedMinutes: 30, priority: 'medium', status: 'planned', active: true, createdAt: '', updatedAt: '', availableFrom: '2026-10-11', availableUntil: '2026-10-10' }];
    expect(() => validateBackupPayload(badAvailability)).toThrow(/availableFrom after availableUntil/u);
  });

  it('rejects invalid success rates and inconsistent task estimate bounds', () => {
    const invalidRate = backupFor();
    invalidRate.data.timePatternProfiles = [{ id: 'tp1', scopeKey: 'task:t1', morningSuccessRate: 1.2, afternoonSuccessRate: 0, eveningSuccessRate: 0, morningSamples: 1, afternoonSamples: 0, eveningSamples: 0, updatedAt: '' }];
    expect(() => validateBackupPayload(invalidRate)).toThrow(/timePatternProfiles has a missing or invalid morningSuccessRate field/u);

    const invalidEstimate = backupFor();
    invalidEstimate.data.taskDefinitions = [{ id: 'td1', roadmapId: 'r1', sourceNodeId: 'n1', conceptId: 'c1', title: 'Task', objective: '', type: 'learn', estimatedMinutes: 10, minMinutes: 20, maxMinutes: 45, difficulty: 'medium', priority: 'medium', completionCriteria: '', dependencyIds: [], confidence: 'low', active: true }];
    expect(() => validateBackupPayload(invalidEstimate)).toThrow(/minMinutes <= estimatedMinutes <= maxMinutes/u);
  });

  it('rejects duplicate IDs within a store', () => {
    const row = { id: 'r1', title: 'Roadmap', sourceText: '', createdAt: '', updatedAt: '', active: true };
    const value = backupFor();
    value.data.roadmaps = [row, { ...row }];
    expect(() => validateBackupPayload(value)).toThrow(/duplicate ID r1 in roadmaps/u);
  });

  it('rejects unknown stores and malformed time windows', () => {
    const unknown = backupFor() as ReturnType<typeof backupFor> & { data: Record<string, unknown[]> };
    unknown.data.secrets = [];
    expect(() => validateBackupPayload(unknown)).toThrow(/unsupported data store/u);

    const value = backupFor();
    value.data.busyEvents = [{ id: 'b1', date: '2026-10-09', title: 'Class', window: { start: '15:00', end: '09:00' }, priority: 'medium', blocksPlanning: true }];
    expect(() => validateBackupPayload(value)).toThrow(/busyEvents has a missing or invalid window field/u);
  });
});
