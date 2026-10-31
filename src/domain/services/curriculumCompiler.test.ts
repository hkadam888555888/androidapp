import { describe, expect, it } from 'vitest';
import { compileCurriculum } from './curriculumCompiler';
import { parseRoadmap } from './roadmapParser';

describe('curriculum compiler progression', () => {
  it('creates task shapes suited to programming, mathematics, and data topics', () => {
    const parsed = parseRoadmap('# Roadmap\n## Python\n### Variables\n### Functions\n## Mathematics\n### Probability\n## Data\n### Pandas', 'scope');
    const compiled = compileCurriculum(parsed.nodes);
    const titles = compiled.tasks.map((task) => task.title);
    expect(titles.some((title) => title.includes('Trace variable values and data types'))).toBe(true);
    expect(titles.some((title) => title.includes('Test variable operations with valid and invalid inputs'))).toBe(true);
    expect(titles.some((title) => title.includes('Solve progressive problems on Probability'))).toBe(true);
    expect(titles.some((title) => title.includes('Build a mini analysis using Pandas'))).toBe(true);
  });


  it('creates concrete topic-specific tasks for common data workflows', () => {
    const parsed = parseRoadmap(
      '# AI/ML roadmap\n## NumPy\n### Arrays\n## Pandas\n### Missing Values\n### GroupBy\n## Machine Learning\n### Regression',
      'playbooks',
    );
    const compiled = compileCurriculum(parsed.nodes);
    const byTitle = new Map(compiled.tasks.map((task) => [task.title, task]));

    expect(byTitle.has('Inspect NumPy array shape, dtype, and axes')).toBe(true);
    expect(byTitle.has('Solve an array task with broadcasting and vectorization')).toBe(true);
    expect(byTitle.has('Map missing values and their impact')).toBe(true);
    expect(byTitle.has('Understand split–apply–combine with groupby')).toBe(true);
    expect(byTitle.has('Build a baseline model for Regression')).toBe(true);
    expect(byTitle.get('Map missing values and their impact')?.confidence).toBe('high');
    expect(byTitle.get('Map missing values and their impact')?.dependencyIds).toEqual([]);
    expect(byTitle.get('Compare safe ways to handle missing data')?.dependencyIds)
      .toContain(byTitle.get('Map missing values and their impact')?.id);
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
  it('uses parent sections to disambiguate identical roadmap leaf titles', () => {
    const parsed = parseRoadmap(
      '# AI/ML ROADMAP\n## NumPy\n### Arrays\n## Python\n### Arrays\n### Functions\n## Mathematics\n### Functions\n## Machine Learning\n### Regression',
      'context',
    );
    const compiled = compileCurriculum(parsed.nodes);
    const titles = compiled.tasks.map((task) => task.title);

    expect(titles).toContain('Explore Arrays with a small dataset');
    expect(titles).toContain('Implement Arrays in a small program');
    expect(titles).toContain('Implement Functions in a small program');
    expect(titles).toContain('Derive and explain Functions');
    expect(titles).toContain('Explore Regression with a small dataset');
  });
});
