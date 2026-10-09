import { describe, expect, it } from 'vitest';
import { parseRoadmap } from './roadmapParser';
import { validateParsedRoadmap } from './curriculumValidator';

const mixedOutline = `# AI/ML ROADMAP
## Python
    - Fundamentals
      - Functions
## NumPy
    1. Arrays
    1.1 Indexing`;

describe('roadmap parser', () => {
  it('preserves source lines and builds parent relationships', () => {
    const parsed = parseRoadmap(mixedOutline, 'r1');
    expect(parsed.nodes).toHaveLength(7);
    expect(parsed.nodes[2].parentId).toBe(parsed.nodes[1].id);
    expect(parsed.nodes[3].parentId).toBe(parsed.nodes[2].id);
    expect(parsed.nodes[6].parentId).toBe(parsed.nodes[4].id);
    expect(validateParsedRoadmap(parsed).valid).toBe(true);
  });

  it('flags duplicate siblings without deleting them', () => {
    const parsed = parseRoadmap('Python\n  - Functions\n  - Functions', 'r2');
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.issues.some((issue) => issue.code === 'duplicate_sibling')).toBe(true);
  });

  it('supports unicode tree outlines', () => {
    const parsed = parseRoadmap('AI/ML\n├── Python\n│   ├── Functions\n│   └── OOP\n└── NumPy', 'r3');
    expect(parsed.nodes.map((node) => node.depth)).toEqual([0, 0, 1, 1, 0]);
  });

  it('supports nested unicode tree prefixes and retains parent links', () => {
    const parsed = parseRoadmap('Root\n├── Level 1\n│   ├── Level 2\n│   │   └── Level 3\n└── Other', 'r5');
    expect(parsed.nodes.map((node) => node.depth)).toEqual([0, 0, 1, 2, 0]);
    expect(parsed.nodes[2].parentId).toBe(parsed.nodes[1].id);
    expect(parsed.nodes[3].parentId).toBe(parsed.nodes[2].id);
  });

  it('flags impossible indentation jumps', () => {
    const parsed = parseRoadmap('A\n      - B', 'r4');
    expect(parsed.issues.some((issue) => issue.code === 'impossible_indent')).toBe(true);
  });
});
