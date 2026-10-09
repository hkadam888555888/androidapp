import { describe, expect, it } from 'vitest';
import type { DailyTask, Roadmap, RoadmapTask } from '../entities/models';
import { adaptiveEstimateForTask, buildEstimationProfiles, buildTimePatternProfiles, calculatePace, detectRepeatedSkips, getDaypart } from './adaptationService';

const roadmap: Roadmap = { id:'r1', title:'AI/ML', sourceText:'x', createdAt:'2026-10-01', updatedAt:'2026-10-01', active:true, priority:'high', targetDate:'2026-10-20' };
const base: RoadmapTask = { id:'t1', roadmapId:'r1', title:'Math', estimatedMinutes:60, priority:'medium', order:1, dependencyIds:[], completedOverall:false, taskType:'learn', category:'Math', active:true };
function task(date:string,status:DailyTask['status'],actual?:number, start='08:00'):DailyTask { return { id:`d:${date}:${Math.random()}`, sourceTaskId:'t1', date, title:'Math', kind:'roadmap', plannedMinutes:60, priority:'medium', status, resultReportedAt:status !== 'unreported' ? `${date}T10:00:00Z` : undefined, actualDurationMinutes:actual, plannedWindow:{start,end:'09:00'} }; }

describe('v0.7 adaptation',()=>{
  it('classifies dayparts',()=>{ expect(getDaypart('08:00')).toBe('morning'); expect(getDaypart('14:00')).toBe('afternoon'); expect(getDaypart('19:00')).toBe('evening'); });
  it('learns estimates gradually',()=>{ const rows=[task('2026-10-01','completed',90),task('2026-10-02','completed',90),task('2026-10-03','completed',90),task('2026-10-04','completed',90)]; const profiles=buildEstimationProfiles(rows,[base]); expect(profiles[0].medianActualMinutes).toBe(90); expect(profiles[0].confidence).toBe('medium'); expect(adaptiveEstimateForTask(base,profiles)).toBeGreaterThan(60); });
  it('learns a preferred daypart only after enough evidence',()=>{ const rows=[task('2026-10-01','completed',55,'08:00'),task('2026-10-02','completed',55,'08:00'),task('2026-10-03','completed',55,'08:00'),task('2026-10-04','skipped',55,'20:00')]; const p=buildTimePatternProfiles(rows); expect(p[0].preferredDaypart).toBe('morning'); });
  it('finds repeated skips',()=>{ const rows=[task('2026-10-01','skipped'),task('2026-10-02','skipped')]; expect(detectRepeatedSkips(rows)[0].skips).toBe(2); });
  it('projects pace and labels deadline risk',()=>{ const rows=Array.from({length:5},(_,i)=>task(`2026-10-0${i+1}`,'completed',60)); const snap=calculatePace(roadmap,[base],rows,'2026-10-08',60); expect(snap.remainingMinutes).toBe(60); expect(['ON_TRACK','AT_RISK','AHEAD','DELAYED']).toContain(snap.paceStatus); expect(snap.message).toContain('projected completion'); });
});
