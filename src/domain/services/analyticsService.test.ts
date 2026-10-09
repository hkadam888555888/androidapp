import { describe, expect, it } from 'vitest';
import type { CurriculumConcept, DailyTask, Roadmap, RoadmapTask, TaskDefinition } from '../entities/models';
import { buildAnalyticsReport, getAnalyticsWindow } from './analyticsService';

const roadmap: Roadmap = { id:'r1', title:'AI/ML', sourceText:'AI/ML', createdAt:'2026-01-01', updatedAt:'2026-01-01', active:true, priority:'high', targetDate:'2026-12-31' };
const milestone: CurriculumConcept = { id:'c1', roadmapId:'r1', sourceNodeId:'n1', title:'NumPy Milestone', parentConceptId:undefined, nodeType:'milestone', outcomes:[] };
const defs: TaskDefinition[] = [
  { id:'t1', roadmapId:'r1', sourceNodeId:'n1', conceptId:'c1', title:'Learn', objective:'x', type:'learn', estimatedMinutes:30, minMinutes:20, maxMinutes:45, difficulty:'easy', priority:'high', completionCriteria:'x', dependencyIds:[], confidence:'high', active:true },
  { id:'t2', roadmapId:'r1', sourceNodeId:'n1', conceptId:'c1', title:'Practice', objective:'x', type:'practice', estimatedMinutes:45, minMinutes:30, maxMinutes:60, difficulty:'medium', priority:'high', completionCriteria:'x', dependencyIds:['t1'], confidence:'high', active:true },
];
const roadmapTasks: RoadmapTask[] = defs.map((d, i) => ({ id:d.id, roadmapId:'r1', title:d.title, estimatedMinutes:d.estimatedMinutes, priority:d.priority, category:'NumPy', order:i+1, dependencyIds:d.dependencyIds, completedOverall:i===0, taskType:d.type, active:true }));
const dt = (id:string,date:string,status:DailyTask['status'],minutes:number):DailyTask => ({ id, sourceTaskId:id === 'd2' ? 't2' : 't1', date, title:id, kind:'roadmap', plannedMinutes:30, priority:'high', status, actualDurationMinutes:minutes, resultReportedAt:status==='unreported' ? undefined : `${date}T21:00:00Z` });

describe('v0.8 analytics', () => {
  it('creates calendar windows for week/month/year', () => {
    expect(getAnalyticsWindow('2026-10-08','week')).toEqual({ from:'2026-10-05', to:'2026-10-11', label:'This week' });
    expect(getAnalyticsWindow('2026-10-08','month').from).toBe('2026-10-01');
    expect(getAnalyticsWindow('2026-10-08','year').to).toBe('2026-12-31');
  });

  it('reports completion, workload and previous-period comparison', () => {
    const report = buildAnalyticsReport({ today:'2026-10-08', period:'week', roadmaps:[roadmap], roadmapTasks, concepts:[milestone], taskDefinitions:defs, dailyTasks:[dt('d1','2026-10-06','completed',40), dt('d2','2026-10-07','partial',20)], estimationProfiles:[], timePatternProfiles:[], plannerOverrides:[], fallbackDailyCapacity:180 });
    expect(report.summary.completed).toBe(1);
    expect(report.summary.partial).toBe(1);
    expect(report.summary.completionRate).toBe(75);
    expect(report.summary.actualMinutes).toBe(60);
    expect(report.previousSummary).toBeDefined();
  });

  it('derives milestone progress from task definitions', () => {
    const report = buildAnalyticsReport({ today:'2026-10-08', period:'month', roadmaps:[roadmap], roadmapTasks, concepts:[milestone], taskDefinitions:defs, dailyTasks:[], estimationProfiles:[], timePatternProfiles:[], plannerOverrides:[], fallbackDailyCapacity:180 });
    expect(report.milestones[0].totalTasks).toBe(2);
    expect(report.milestones[0].completedTasks).toBe(1);
    expect(report.milestones[0].progressPercent).toBe(50);
  });

  it('groups subject performance by roadmap task category', () => {
    const report = buildAnalyticsReport({ today:'2026-10-08', period:'week', roadmaps:[roadmap], roadmapTasks, concepts:[milestone], taskDefinitions:defs, dailyTasks:[dt('d1','2026-10-06','completed',40), dt('d2','2026-10-07','skipped',0)], estimationProfiles:[], timePatternProfiles:[], plannerOverrides:[], fallbackDailyCapacity:180 });
    expect(report.subjects[0].label).toBe('NumPy');
    expect(report.subjects[0].completedTasks).toBe(1);
    expect(report.subjects[0].skippedTasks).toBe(1);
  });
});
