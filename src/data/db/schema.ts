import type {
  AdaptationSnapshot, AuditRecord, BusyEvent, CurriculumConcept, CurriculumVersion, DailyReview, DailyTask, DayPlan, EstimationProfile, ExerciseLog,
  ExternalTask, Habit, HabitLog, PlannerDecision, PlannerOverride, PlannerSettings, Roadmap, RoadmapTask, TaskDefinition, TimePatternProfile, UserPreferences, WaterLog, AIArtifact, AISettings,
} from '../../domain/entities/models';

export interface AppMeta {
  id: 'meta';
  schemaVersion: number;
  appVersion: string;
  updatedAt: string;
}

export interface AppDatabaseSchema {
  meta: AppMeta;
  curriculumVersions: CurriculumVersion;
  curriculumConcepts: CurriculumConcept;
  taskDefinitions: TaskDefinition;
  roadmaps: Roadmap;
  roadmapTasks: RoadmapTask;
  externalTasks: ExternalTask;
  habits: Habit;
  habitLogs: HabitLog;
  busyEvents: BusyEvent;
  dailyTasks: DailyTask;
  waterLogs: WaterLog;
  exerciseLogs: ExerciseLog;
  dayPlans: DayPlan;
  dailyReviews: DailyReview;
  preferences: UserPreferences;
  plannerSettings: PlannerSettings;
  notifications: import('../../domain/entities/models').NotificationRecord;
  plannerDecisions: PlannerDecision;
  estimationProfiles: EstimationProfile;
  timePatternProfiles: TimePatternProfile;
  plannerOverrides: PlannerOverride;
  adaptationSnapshots: AdaptationSnapshot;
  aiArtifacts: AIArtifact;
  aiSettings: AISettings;
  audits: AuditRecord;
}

export const DB_NAME = 'my-adaptive-routine';
export const DB_VERSION = 9;
export const APP_VERSION = '1.0.5';
