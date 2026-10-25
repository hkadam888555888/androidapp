import { describe, expect, it } from 'vitest';
import { compileCurriculum } from './curriculumCompiler';
import { parseRoadmap } from './roadmapParser';

describe('curriculum compiler progression', () => {
  it('does not generate tasks for structural headings and gates later nodes', () => {
    const parsed = parseRoadmap('# Roadmap\n## Python\n### Variables\n### Functions', 'scope');
    const compiled = compileCurriculum(parsed.nodes);
    expect(compiled.tasks.map((task) => task.title)).not.toContain('Understand Roadmap');
    expect(compiled.tasks.map((task) => task.title)).not.toContain('Understand Python');
    expect(compiled.tasks[2].dependencyIds).toContain(compiled.tasks[1].id);
  });
});
