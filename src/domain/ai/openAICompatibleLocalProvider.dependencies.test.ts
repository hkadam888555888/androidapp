import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskDefinition } from '../entities/models';
import { OpenAICompatibleLocalProvider } from './openAICompatibleLocalProvider';

function task(id: string): TaskDefinition {
  return {
    id, roadmapId: 'roadmap', sourceNodeId: 'node', conceptId: 'concept', title: id, objective: 'Practice a known topic',
    type: 'practice', estimatedMinutes: 30, minMinutes: 20, maxMinutes: 45, difficulty: 'medium', priority: 'medium',
    completionCriteria: 'Complete three examples', dependencyIds: [], confidence: 'medium', active: true, splittable: false,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('local AI dependency suggestion boundary', () => {
  it('filters unknown and self edges and rejects edges that would introduce a cycle', async () => {
    const content = JSON.stringify({
      edges: [
        { fromTaskId: 'a', toTaskId: 'b', type: 'soft', confidence: 'high' },
        { fromTaskId: 'b', toTaskId: 'c', type: 'suggested', confidence: 'medium' },
        { fromTaskId: 'c', toTaskId: 'a', type: 'soft', confidence: 'low' },
        { fromTaskId: 'a', toTaskId: 'a', type: 'suggested', confidence: 'high' },
        { fromTaskId: 'unknown', toTaskId: 'a', type: 'soft', confidence: 'high' },
        { fromTaskId: 'c', toTaskId: 'd', type: 'suggested', confidence: 'low' },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleLocalProvider({
      endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
      model: 'dependency-boundary-test',
    });

    const edges = await provider.suggestDependencies([task('a'), task('b'), task('c'), task('d')]);
    expect(edges).toEqual([
      { fromTaskId: 'a', toTaskId: 'b', type: 'soft', confidence: 'high' },
      { fromTaskId: 'b', toTaskId: 'c', type: 'suggested', confidence: 'medium' },
      { fromTaskId: 'c', toTaskId: 'd', type: 'suggested', confidence: 'low' },
    ]);
  });
});
