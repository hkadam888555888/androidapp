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
  it('keeps later roadmap topics locked behind the previous topic practice task', () => {
    const compiled = compileCurriculum([
      node('roadmap-1:node:1', 'AI/ML Roadmap', 'subject', 0, 0),
      node('roadmap-1:node:2', 'Python', 'module', 1, 1, 'roadmap-1:node:1'),
      node('roadmap-1:node:3', 'Variables', 'concept', 2, 2, 'roadmap-1:node:2'),
      node('roadmap-1:node:4', 'Functions', 'concept', 2, 3, 'roadmap-1:node:2'),
    ]);

    const variablesPractice = compiled.tasks.find((task) => task.title === 'Practice Variables');
    const functionsUnderstand = compiled.tasks.find((task) => task.title === 'Understand Functions');
    expect(variablesPractice).toBeDefined();
    expect(functionsUnderstand?.dependencyIds).toContain(variablesPractice!.id);
    expect(functionsUnderstand?.dependencyIds).toHaveLength(1);
  });

  it('orders a parent-project checkpoint after the contained learning work', () => {
    const compiled = compileCurriculum([
      node('roadmap-1:node:1', 'AI/ML Roadmap', 'subject', 0, 0),
      node('roadmap-1:node:2', 'Build a prediction project', 'project', 1, 1, 'roadmap-1:node:1'),
      node('roadmap-1:node:3', 'Train a baseline model', 'concept', 2, 2, 'roadmap-1:node:2'),
    ]);

    const practice = compiled.tasks.find((task) => task.title === 'Practice Train a baseline model');
    const checkpoint = compiled.tasks.find((task) => task.title === 'Checkpoint: Build a prediction project');
    expect(compiled.tasks.indexOf(checkpoint!)).toBeGreaterThan(compiled.tasks.indexOf(practice!));
    expect(checkpoint?.dependencyIds).toContain(practice!.id);
  });

  it('does not couple prerequisite chains across separate roadmaps', () => {
    const compiled = compileCurriculum([
      node('roadmap-a:node:1', 'Python roadmap', 'subject', 0, 0),
      node('roadmap-a:node:2', 'Variables', 'concept', 1, 1, 'roadmap-a:node:1'),
      { ...node('roadmap-b:node:1', 'Math roadmap', 'subject', 0, 0), roadmapId: 'roadmap-b' },
      { ...node('roadmap-b:node:2', 'Probability', 'concept', 1, 1, 'roadmap-b:node:1'), roadmapId: 'roadmap-b' },
    ]);

    const variables = compiled.tasks.find((task) => task.title === 'Understand Variables');
    const probability = compiled.tasks.find((task) => task.title === 'Understand Probability');
    expect(variables?.dependencyIds).toEqual([]);
    expect(probability?.dependencyIds).toEqual([]);
  });

});
