import { describe, expect, it } from 'vitest';
import { compileCurriculum } from './curriculumCompiler';
import { parseRoadmap } from './roadmapParser';

describe('curriculum compiler', () => {
  it('compiles only terminal learning nodes, not roadmap headings or parent groups', () => {
    const parsed = parseRoadmap(
      '# AI/ML ROADMAP\n## Python\n- Fundamentals\n  - Variables and data types\n  - Functions\n## NumPy\n- Arrays',
      'compiler',
    );
    const curriculum = compileCurriculum(parsed.nodes);

    expect(curriculum.concepts.map((concept) => concept.title)).toEqual([
      'Variables and data types',
      'Functions',
      'Arrays',
    ]);
    expect(curriculum.tasks).toHaveLength(6);
    expect(curriculum.concepts.some((concept) => ['AI/ML ROADMAP', 'Python', 'Fundamentals', 'NumPy'].includes(concept.title))).toBe(false);
  });

  it('makes each roadmap topic depend on the previous topic completing', () => {
    const parsed = parseRoadmap(
      '# Roadmap\n## Python\n- Variables\n- Functions\n## NumPy\n- Arrays',
      'ordered',
    );
    const curriculum = compileCurriculum(parsed.nodes);

    const understandVariables = curriculum.tasks.find((task) => task.title === 'Understand Variables');
    const practiceVariables = curriculum.tasks.find((task) => task.title === 'Practice Variables');
    const understandFunctions = curriculum.tasks.find((task) => task.title === 'Understand Functions');
    const practiceFunctions = curriculum.tasks.find((task) => task.title === 'Practice Functions');
    const understandArrays = curriculum.tasks.find((task) => task.title === 'Understand Arrays');

    expect(understandVariables?.dependencyIds).toEqual([]);
    expect(practiceVariables?.dependencyIds).toContain(understandVariables?.id);
    expect(understandFunctions?.dependencyIds).toContain(practiceVariables?.id);
    expect(practiceFunctions?.dependencyIds).toContain(understandFunctions?.id);
    expect(understandArrays?.dependencyIds).toContain(practiceFunctions?.id);
  });
});
