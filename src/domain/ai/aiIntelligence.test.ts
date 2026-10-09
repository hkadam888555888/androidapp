import { describe, expect, it } from 'vitest';
import { analyzeRoadmapSemantics, detectKnowledgeGaps, expandRoadmapNodeWithValidation } from './aiIntelligence';
import { RuleBasedProvider } from './ruleBasedProvider';
import { parseRoadmap } from '../services/roadmapParser';

const provider = new RuleBasedProvider();

describe('AI intelligence boundary', () => {
  it('detects ambiguous roadmap text without mutating it', () => {
    const parsed = parseRoadmap('# Roadmap\n- Learn\n- Functions');
    const result = analyzeRoadmapSemantics(parsed);
    expect(result.ambiguousNodes).toContain('Learn');
    expect(parsed.sourceText).toContain('Functions');
  });

  it('filters expansion duplicates and keeps the result advisory', async () => {
    const result = await expandRoadmapNodeWithValidation(provider, { id: 'n1', title: 'Functions' }, {
      roadmapId: 'r1', nodeId: 'n1', nodeTitle: 'Functions', parentTitles: [], nearbyTitles: [],
      existingConceptTitles: [], existingTaskTitles: ['Practice Functions'],
    });
    expect(result.tasks.length).toBe(0);
    expect(result.warnings.some((warning) => warning.includes('Duplicate'))).toBe(true);
  });

  it('suggests knowledge review only from evidence', () => {
    const suggestions = detectKnowledgeGaps('r1', [{ id:'t1', roadmapId:'r1', title:'Arrays', estimatedMinutes:30, priority:'medium', order:1, dependencyIds:[], completedOverall:false, active:true }], [
      { sourceTaskId:'t1', status:'skipped', resultNote:'too hard' },
      { sourceTaskId:'t1', status:'skipped', resultNote:'unclear' },
    ]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].reasonCodes).toContain('repeated_skip');
  });
});
