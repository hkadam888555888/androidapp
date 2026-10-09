import { describe, expect, it } from 'vitest';
import { readyTaskIds, validateDependencyGraph } from './dependencyEngine';
import type { RoadmapTask } from '../entities/models';

const task = (id: string, dependencyIds: string[] = [], completedOverall = false): RoadmapTask => ({
  id, roadmapId: 'r', title: id, estimatedMinutes: 30, priority: 'medium', order: 0, dependencyIds, completedOverall,
});

describe('dependency engine', () => {
  it('keeps a dependent task blocked until its hard prerequisite is complete', () => {
    expect(readyTaskIds([task('a'), task('b', ['a'])])).toEqual(['a']);
    expect(readyTaskIds([task('a', [], true), task('b', ['a'])])).toEqual(['b']);
  });

  it('rejects cycles and self-dependencies', () => {
    expect(validateDependencyGraph([task('a', ['b']), task('b', ['a'])]).valid).toBe(false);
    expect(validateDependencyGraph([task('a', ['a'])]).valid).toBe(false);
  });

  it('reports missing dependency references', () => {
    const result = validateDependencyGraph([task('a', ['missing'])]);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('a->missing');
  });
  it('does not return archived or manually blocked tasks as READY', () => {
    expect(readyTaskIds([
      task('a'),
      { ...task('b'), active: false },
      { ...task('c'), manuallyBlocked: true },
    ])).toEqual(['a']);
  });

});
