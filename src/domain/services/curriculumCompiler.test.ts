import { describe, expect, it } from 'vitest';
import { compileCurriculum } from './curriculumCompiler';
import { parseRoadmap } from './roadmapParser';

describe('curriculum compiler progression', () => {
  it('creates task shapes suited to programming, mathematics, and data topics', () => {
    const parsed = parseRoadmap('# Roadmap\n## Python\n### Variables\n### Functions\n## Mathematics\n### Probability\n## Data\n### Pandas', 'scope');
    const compiled = compileCurriculum(parsed.nodes);
    const titles = compiled.tasks.map((task) => task.title);
    expect(titles.some((title) => title.includes('Implement Variables'))).toBe(true);
    expect(titles.some((title) => title.includes('Test and debug Variables'))).toBe(true);
    expect(titles.some((title) => title.includes('Solve progressive problems on Probability'))).toBe(true);
    expect(titles.some((title) => title.includes('Build a mini analysis using Pandas'))).toBe(true);
  });

  it('keeps learning/practice dependencies within one concept', () => {
    const parsed = parseRoadmap('# Roadmap\n## Python\n### Variables\n### Functions', 'scope');
    const compiled = compileCurriculum(parsed.nodes);
    const variables = compiled.tasks.filter((task) => task.title.includes('Variables'));
    const functions = compiled.tasks.filter((task) => task.title.includes('Functions'));
    expect(variables).toHaveLength(2);
    expect(functions).toHaveLength(2);
    expect(variables[1].dependencyIds).toContain(variables[0].id);
    expect(functions[0].dependencyIds).toEqual([]);
  });

  it('does not generate schedulable work for structural headings', () => {
    const parsed = parseRoadmap('# Roadmap\n## Python\n### Variables', 'scope');
    const compiled = compileCurriculum(parsed.nodes);
    expect(compiled.tasks.some((task) => task.title.includes('Roadmap'))).toBe(false);
    expect(compiled.tasks.some((task) => task.title.includes('Python'))).toBe(false);
  });
});
