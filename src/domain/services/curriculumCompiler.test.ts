import { describe, expect, it } from 'vitest';
import type { NormalizedRoadmapNode, RoadmapNodeType } from '../entities/models';
import { compileCurriculum } from './curriculumCompiler';

function node(
  id: string,
  title: string,
  nodeType: RoadmapNodeType,
  depth: number,
  orderIndex: number,
  parentId?: string,
): NormalizedRoadmapNode {
  return {
    id,
    roadmapId: 'roadmap-1',
    rawLine: title,
    cleanedTitle: title,
    depth,
    orderIndex,
    parentId,
    marker: depth === 0 ? 'heading' : 'bullet',
    nodeType,
    confidence: 'high',
    userApproved: false,
  };
}

describe('curriculum compiler task scope', () => {
  it('keeps parent nodes as context but generates learning tasks only for actionable leaves', () => {
    const compiled = compileCurriculum([
      node('roadmap-1:node:1', 'AI/ML Roadmap', 'subject', 0, 0),
      node('roadmap-1:node:2', 'Python', 'module', 1, 1, 'roadmap-1:node:1'),
      node('roadmap-1:node:3', 'Fundamentals', 'concept', 2, 2, 'roadmap-1:node:2'),
      node('roadmap-1:node:4', 'Variables', 'concept', 3, 3, 'roadmap-1:node:3'),
    ]);

    expect(compiled.concepts).toHaveLength(4);
    expect(compiled.tasks.length).toBeGreaterThan(0);
    expect(new Set(compiled.tasks.map((task) => task.sourceNodeId))).toEqual(new Set(['roadmap-1:node:4']));
    expect(compiled.tasks.map((task) => task.title)).toEqual(['Understand Variables', 'Practice Variables']);
  });

  it('retains one checkpoint for a parent project without duplicating generic lessons for the project', () => {
    const compiled = compileCurriculum([
      node('roadmap-1:node:1', 'AI/ML Roadmap', 'subject', 0, 0),
      node('roadmap-1:node:2', 'Build a prediction project', 'project', 1, 1, 'roadmap-1:node:1'),
      node('roadmap-1:node:3', 'Train a baseline model', 'concept', 2, 2, 'roadmap-1:node:2'),
    ]);

    expect(compiled.tasks.filter((task) => task.sourceNodeId === 'roadmap-1:node:2').map((task) => task.title))
      .toEqual(['Checkpoint: Build a prediction project']);
    expect(compiled.tasks.some((task) => task.title === 'Understand Build a prediction project')).toBe(false);
    expect(compiled.tasks.some((task) => task.title === 'Understand Train a baseline model')).toBe(true);
  });

  it('does not convert a bare roadmap title into a schedulable task', () => {
    const compiled = compileCurriculum([
      node('roadmap-1:node:1', 'My learning roadmap', 'subject', 0, 0),
    ]);

    expect(compiled.concepts).toHaveLength(1);
    expect(compiled.tasks).toHaveLength(0);
  });
});
