export type ID = string;
export type ISODate = string;
export type Minutes = number;

export type TaskStatus =
  | 'planned'
  | 'completed'
  | 'partial'
  | 'skipped'
  | 'rescheduled'
  | 'cancelled'
  | 'unreported';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskKind = 'roadmap' | 'habit' | 'urgent' | 'admin';
export type HabitKind = 'exercise' | 'water' | 'custom';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'very_hard';
export type DependencyType = 'hard' | 'soft' | 'suggested';
export type RoadmapNodeType = 'subject' | 'module' | 'concept' | 'skill' | 'milestone' | 'project' | 'review_area' | 'unknown';
export type ParseMarker = 'heading' | 'bullet' | 'numbered' | 'tree' | 'plain';
export type PlannerMode = 'normal' | 'busy' | 'exam';
export type ExternalTaskCategory = 'PERSONAL' | 'COLLEGE' | 'WORK' | 'URGENT';

export interface TimeWindow {
  start: string;
  end: string;
}

export interface UserPreferences {
  id: ID;
  timezone: string;
  wakeTime: string;
  sleepTime: string;
  defaultStudyWindows: TimeWindow[];
  notificationLeadMinutes: number;
  maxStudyMinutesPerDay?: number;
  maxCognitiveMinutesPerDay?: number;
  maxDeepWorkSessions?: number;
  maxContinuousFocusMinutes?: number;
  minimumBreakMinutes?: number;
  bufferPercentage?: number;
  /** Set only after the first-run setup is completed or explicitly skipped. */
  onboardingCompleted?: boolean;
  /** Browser notification delivery is optional and only runs while the app is open. */
  notificationsEnabled?: boolean;
}

export interface PlannerSettings {
  id: ID;
  activeMode: PlannerMode;
  modeActiveUntil?: ISODate;
  busyCapacityMinutes: number;
  examCapacityMinutes: number;
  examRoadmapIds: ID[];
}

export interface Roadmap {
  id: ID;
  title: string;
  sourceText: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  priority?: TaskPriority;
  targetDate?: ISODate;
  capacitySharePercentage?: number;
}

export interface RoadmapTask {
  id: ID;
  roadmapId: ID;
  title: string;
  description?: string;
  objective?: string;
  completionCriteria?: string;
  taskType?: TaskDefinition['type'];
  estimatedMinutes: Minutes;
  priority: TaskPriority;
  category?: string;
  order: number;
  dependencyIds: ID[];
  completedOverall: boolean;
  dueDate?: ISODate;
  difficulty?: Difficulty;
  carryOverCount?: number;
  availableFrom?: ISODate;
  availableUntil?: ISODate;
  manuallyBlocked?: boolean;
  active?: boolean;
  splittable?: boolean;
}

export interface ExternalTask {
  id: ID;
  title: string;
  description?: string;
  category: ExternalTaskCategory;
  estimatedMinutes: Minutes;
  priority: TaskPriority;
  dueDate?: ISODate;
  availableFrom?: ISODate;
  availableUntil?: ISODate;
  preferredWindow?: TimeWindow;
  fixedWindow?: TimeWindow;
  status: TaskStatus;
  active: boolean;
  carryOverCount?: number;
  splittable?: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type HabitRecurrence = 'daily' | 'weekly' | 'custom';
export type HabitStreakPolicy = 'strict' | 'target_or_partial' | 'minimum_value';
export type HabitOccurrenceStatus = 'due' | 'completed' | 'partial' | 'skipped' | 'unreported' | 'not_due';

export interface Habit {
  id: ID;
  name: string;
  kind: HabitKind;
  targetValue: number;
  unit: string;
  minimumValue?: number;
  active: boolean;
  preferredWindows: TimeWindow[];
  reminderTimes: string[];
  frequencyDays: number[];
  recurrence?: HabitRecurrence;
  streakPolicy?: HabitStreakPolicy;
  allowPartial?: boolean;
  carryOverAllowed?: boolean;
  priority?: TaskPriority;
  activeFrom?: ISODate;
  activeUntil?: ISODate;
}

export interface HabitLog {
  id: ID;
  habitId: ID;
  date: ISODate;
  status: HabitOccurrenceStatus;
  value: number;
  targetValue: number;
  minimumValue?: number;
  note?: string;
  recordedAt: string;
}

export interface HabitOccurrence {
  id: ID;
  habitId: ID;
  date: ISODate;
  status: HabitOccurrenceStatus;
  targetValue: number;
  minimumValue?: number;
  scheduledMinutes: number;
  preferredWindows: TimeWindow[];
  streakContribution: number;
  carryOverEligible: boolean;
  reason: string;
}

export interface BusyEvent {
  id: ID;
  date: ISODate;
  title: string;
  window: TimeWindow;
  priority: TaskPriority;
  blocksPlanning: boolean;
  fixed?: boolean;
}

export interface DailyTask {
  id: ID;
  sourceTaskId?: ID;
  sourceHabitId?: ID;
  sourceExternalTaskId?: ID;
  date: ISODate;
  title: string;
  kind: TaskKind;
  plannedWindow?: TimeWindow;
  plannedMinutes: Minutes;
  priority: TaskPriority;
  status: TaskStatus;
  resultReportedAt?: string;
  skipReason?: string;
  rescheduledTo?: ISODate;
  rescheduledFrom?: ISODate;
  actualDurationMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  resultNote?: string;
  energy?: 'low' | 'medium' | 'high';
}

export interface WaterLog {
  id: ID;
  date: ISODate;
  amountMl: number;
  recordedAt: string;
}

export interface ExerciseLog {
  id: ID;
  date: ISODate;
  completed: boolean;
  durationMinutes?: number;
  exerciseType?: string;
  recordedAt: string;
}

export type PlannerDecisionReasonCode =
  | 'DEADLINE_URGENCY'
  | 'DEADLINE_PROTECTION'
  | 'DEPENDENCY_READY'
  | 'UNLOCK_VALUE'
  | 'CARRY_OVER'
  | 'PREFERRED_TIME'
  | 'FITS_WINDOW'
  | 'HIGH_PRIORITY'
  | 'CAPACITY_LIMIT'
  | 'BLOCKED'
  | 'CONFLICT'
  | 'SELECTED'
  | 'ROADMAP_PRIORITY'
  | 'ROADMAP_SHARE'
  | 'MODE_BUSY'
  | 'EXAM_FOCUS'
  | 'EXTERNAL_PRIORITY'
  | 'FIXED_EXTERNAL';

export interface PlannerDecision {
  id: ID;
  planId: ID;
  candidateId: ID;
  selected: boolean;
  score: number;
  reasonCodes: PlannerDecisionReasonCode[];
  constraintResults: Record<string, boolean>;
  rejectedReason?: string;
  createdAt: string;
}

export interface DayPlan {
  id: ID;
  date: ISODate;
  generatedAt: string;
  version: number;
  state: 'draft' | 'ready_for_review' | 'final' | 'superseded';
  taskIds: ID[];
  lockedUntilReview: boolean;
  mode?: PlannerMode;
  reason?: string;
}

export interface DailyReview {
  id: ID;
  date: ISODate;
  required: boolean;
  status?: 'blocked_pending_report' | 'ready' | 'completed';
  unresolvedTaskIds?: ID[];
  resolvedAt?: string;
  reflection?: string;
  blocker?: string;
  energy?: 'low' | 'medium' | 'high';
  estimatedMinutes?: number;
  actualMinutes?: number;
  adaptationNote?: string;
}

export interface EstimationProfile {
  id: ID;
  scopeKey: string;
  originalEstimateMinutes: number;
  sampleCount: number;
  medianActualMinutes: number;
  varianceMinutesSquared: number;
  learnedEstimateMinutes: number;
  confidence: 'low' | 'medium' | 'high';
  updatedAt: string;
}

export interface TimePatternProfile {
  id: ID;
  scopeKey: string;
  morningSuccessRate: number;
  afternoonSuccessRate: number;
  eveningSuccessRate: number;
  morningSamples: number;
  afternoonSamples: number;
  eveningSamples: number;
  preferredDaypart?: 'morning' | 'afternoon' | 'evening';
  updatedAt: string;
}

export type PlannerOverrideAction = 'move' | 'lock' | 'skip_today' | 'split' | 'merge' | 'change_duration' | 'change_priority' | 'change_deadline' | 'block_topic' | 'mark_prerequisite_satisfied' | 'add_note';

export interface PlannerOverride {
  id: ID;
  taskId: ID;
  date: ISODate;
  action: PlannerOverrideAction;
  payload: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface AdaptationSnapshot {
  id: ID;
  date: ISODate;
  roadmapId: ID;
  paceStatus: 'AHEAD' | 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
  remainingMinutes: number;
  typicalDailyCapacityMinutes: number;
  projectedCompletionDate?: ISODate;
  targetDate?: ISODate;
  message: string;
  createdAt: string;
}

export type NotificationType =
  | 'task_reminder' | 'task_starting' | 'next_task' | 'exercise_reminder' | 'water_reminder'
  | 'review_reminder' | 'deadline_reminder' | 'reschedule_notice' | 'plan_updated' | 'streak_notice';

export interface NotificationRecord {
  id: ID;
  type: NotificationType;
  title: string;
  body: string;
  scheduledAt: string;
  deliveredAt?: string;
  readAt?: string;
  linkedEntityId?: ID;
}

export type AIArtifactKind = 'roadmap_analysis' | 'node_expansion' | 'practice_set' | 'knowledge_gap' | 'decision_explanation';

export interface AIArtifact {
  id: ID;
  kind: AIArtifactKind;
  roadmapId: ID;
  sourceNodeId?: ID;
  modelName: string;
  modelVersion: string;
  promptVersion: string;
  schemaVersion: number;
  confidence: 'high' | 'medium' | 'low';
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AISettings {
  id: 'ai-settings';
  localOnly: boolean;
  cloudEnabled: boolean;
  explanationMode: 'short' | 'detailed';
  retainHistory: boolean;
  providerName: string;
  /** Local OpenAI-compatible endpoint, restricted to loopback addresses by the adapter. */
  localEndpoint?: string;
  localModel?: string;
}

export type KnowledgeGapReasonCode = 'repeated_skip' | 'repeated_partial' | 'confusion_note';

export interface KnowledgeGapSuggestion {
  id: ID;
  roadmapId: ID;
  taskId: ID;
  title: string;
  reasonCodes: KnowledgeGapReasonCode[];
  evidenceCount: number;
  suggestion: string;
  confidence: 'low' | 'medium' | 'high';
  generatedAt: string;
}

export interface AuditRecord {
  id: ID;
  at: string;
  action: string;
  entityType: string;
  entityId: ID;
  details: Record<string, string | number | boolean | null>;
}

export interface NormalizedRoadmapNode {
  id: ID;
  roadmapId: ID;
  rawLine: string;
  cleanedTitle: string;
  depth: number;
  orderIndex: number;
  parentId?: ID;
  numbering?: string;
  marker: ParseMarker;
  nodeType: RoadmapNodeType;
  confidence: 'high' | 'medium' | 'low';
  userApproved: boolean;
}

export interface RoadmapParseIssue {
  lineNumber: number;
  code: 'orphaned_child' | 'duplicate_sibling' | 'impossible_indent' | 'empty_node' | 'malformed_numbering';
  message: string;
}

export interface ParsedRoadmap {
  roadmapId: ID;
  sourceText: string;
  nodes: NormalizedRoadmapNode[];
  issues: RoadmapParseIssue[];
}

export interface DependencyEdge {
  fromTaskId: ID;
  toTaskId: ID;
  type: DependencyType;
  confidence: 'high' | 'medium' | 'low';
}

export interface CurriculumVersion {
  id: ID;
  roadmapId: ID;
  version: number;
  createdAt: string;
  sourceTextHash: string;
  status: 'draft' | 'approved' | 'superseded';
  conceptIds: ID[];
  taskDefinitionIds: ID[];
  warnings: string[];
}

export interface CurriculumConcept {
  id: ID;
  roadmapId: ID;
  sourceNodeId: ID;
  title: string;
  parentConceptId?: ID;
  nodeType: RoadmapNodeType;
  outcomes: string[];
}

export interface TaskDefinition {
  id: ID;
  roadmapId: ID;
  sourceNodeId: ID;
  conceptId: ID;
  title: string;
  objective: string;
  type: 'learn' | 'read' | 'watch' | 'practice' | 'code' | 'exercise' | 'quiz' | 'revise' | 'apply' | 'mini_project' | 'checkpoint' | 'reflection' | 'review';
  estimatedMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  difficulty: Difficulty;
  priority: TaskPriority;
  completionCriteria: string;
  dependencyIds: ID[];
  confidence: 'high' | 'medium' | 'low';
  active: boolean;
  splittable?: boolean;
}

export interface AvailabilityInput {
  date: ISODate;
  wakeTime: string;
  sleepTime: string;
  studyWindows: TimeWindow[];
  fixedWindows?: TimeWindow[];
  blockedWindows?: TimeWindow[];
  busyWindows?: TimeWindow[];
  reservedHabitWindows?: TimeWindow[];
}

export interface CapacityPolicy {
  maxStudyMinutes: number;
  maxCognitiveMinutes: number;
  maxDeepWorkSessions: number;
  maxContinuousFocusMinutes: number;
  minimumBreakMinutes: number;
  bufferPercentage: number;
}

export interface CapacityResult {
  rawStudyMinutes: number;
  bufferedStudyMinutes: number;
  effectiveStudyMinutes: number;
  maxCognitiveMinutes: number;
  maxDeepWorkSessions: number;
  maxContinuousFocusMinutes: number;
}
