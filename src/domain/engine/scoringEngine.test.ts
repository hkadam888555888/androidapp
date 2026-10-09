import { describe, expect, it } from 'vitest';
import { scoreRoadmapTask } from './scoringEngine';

describe('scoring engine', () => {
  it('boosts near deadlines and unlock value without changing task identity', () => {
    const task = { id:'a', roadmapId:'r', title:'A', estimatedMinutes:30, priority:'medium' as const, order:1, dependencyIds:[], completedOverall:false, dueDate:'2026-10-09T00:00:00Z', carryOverCount:1 };
    const other = { ...task, id:'b', dependencyIds:['a'] };
    const result = scoreRoadmapTask({ task, allTasks:[task,other], today:'2026-10-08' });
    expect(result.value).toBeGreaterThan(50);
    expect(result.factors.some((x) => x.includes('deadline'))).toBe(true);
    expect(result.factors.some((x) => x.includes('unlocks'))).toBe(true);
  });
});
