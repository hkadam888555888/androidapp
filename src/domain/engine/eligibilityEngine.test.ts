import { describe, expect, it } from 'vitest';
import { evaluateEligibility } from './eligibilityEngine';

describe('eligibility engine', () => {
  const base = { id:'t1', roadmapId:'r', title:'Task', estimatedMinutes:30, priority:'medium' as const, order:1, dependencyIds:[], completedOverall:false };
  it('blocks before availability start', () => expect(evaluateEligibility({...base, availableFrom:'2026-10-10'}, '2026-10-09').eligible).toBe(false));
  it('blocks manual blockers', () => expect(evaluateEligibility({...base, manuallyBlocked:true}, '2026-10-09').eligible).toBe(false));
  it('allows a valid task', () => expect(evaluateEligibility(base, '2026-10-09').eligible).toBe(true));
});
