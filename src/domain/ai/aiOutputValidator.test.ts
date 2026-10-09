import { describe, expect, it } from 'vitest';
import { validateAITaskCandidates } from './aiOutputValidator';

const make = (id: string) => ({ id, roadmapId:'r', sourceNodeId:'n', conceptId:'c', title:'Practice', objective:'Apply', type:'practice' as const, estimatedMinutes:30, minMinutes:20, maxMinutes:45, difficulty:'medium' as const, priority:'medium' as const, completionCriteria:'3 examples', dependencyIds:[], confidence:'high' as const, active:true });

describe('AI output validator', () => {
  it('rejects duplicate ids', () => expect(validateAITaskCandidates([make('x'), make('x')]).valid).toBe(false));
  it('rejects unsafe granularity', () => expect(validateAITaskCandidates([{...make('x'), estimatedMinutes:120}]).valid).toBe(false));
});
