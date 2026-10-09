import type { Habit, PlannerSettings, Roadmap, RoadmapTask, UserPreferences } from '../../domain/entities/models';

export const SAMPLE_ROADMAP: Roadmap = {
  id: 'sample-roadmap',
  title: 'Example AI / ML Roadmap',
  sourceText: 'Python → NumPy/Pandas → Statistics → Linear Algebra → Machine Learning → Deep Learning',
  createdAt: '2026-10-08T00:00:00.000Z',
  updatedAt: '2026-10-08T00:00:00.000Z',
  active: true,
  priority: 'high',
  capacitySharePercentage: 60,
};

export const SAMPLE_ROADMAP_TASKS: RoadmapTask[] = [
  {
    id: 'sample-python', roadmapId: SAMPLE_ROADMAP.id, title: 'Revise Python foundations',
    estimatedMinutes: 60, priority: 'high', category: 'Python', order: 1, dependencyIds: [], completedOverall: false,
  },
  {
    id: 'sample-pandas', roadmapId: SAMPLE_ROADMAP.id, title: 'Practice Pandas groupby and joins',
    estimatedMinutes: 75, priority: 'high', category: 'Data', order: 2, dependencyIds: ['sample-python'], completedOverall: false,
  },
  {
    id: 'sample-stats', roadmapId: SAMPLE_ROADMAP.id, title: 'Study probability distributions',
    estimatedMinutes: 60, priority: 'medium', category: 'Math', order: 3, dependencyIds: [], completedOverall: false,
  },
];

export const SAMPLE_HABITS: Habit[] = [
  {
    id: 'habit-exercise', name: 'Exercise', kind: 'exercise', targetValue: 45, unit: 'minutes', active: true,
    preferredWindows: [{ start: '05:00', end: '07:00' }], reminderTimes: ['05:15'], frequencyDays: [0,1,2,3,4,5,6], recurrence: 'daily', minimumValue: 20, streakPolicy: 'target_or_partial', allowPartial: true, carryOverAllowed: false, priority: 'high',
  },
  {
    id: 'habit-water', name: 'Water', kind: 'water', targetValue: 2500, unit: 'ml', active: true,
    preferredWindows: [{ start: '07:00', end: '21:30' }], reminderTimes: ['09:00','12:00','15:00','18:00','20:30'], frequencyDays: [0,1,2,3,4,5,6], recurrence: 'daily', minimumValue: 2500, streakPolicy: 'strict', allowPartial: false, carryOverAllowed: false, priority: 'medium',
  },
];

export const SAMPLE_PREFERENCES: UserPreferences = {
  id: 'preferences', timezone: 'Asia/Kolkata', wakeTime: '05:00', sleepTime: '22:00',
  defaultStudyWindows: [
    { start: '08:00', end: '10:00' },
    { start: '14:00', end: '16:00' },
    { start: '19:00', end: '21:00' },
  ],
  notificationLeadMinutes: 15,
  onboardingCompleted: false,
  notificationsEnabled: false,
};

export const SAMPLE_PLANNER_SETTINGS: PlannerSettings = {
  id: 'planner-settings',
  activeMode: 'normal',
  busyCapacityMinutes: 120,
  examCapacityMinutes: 180,
  examRoadmapIds: ['sample-roadmap'],
};
