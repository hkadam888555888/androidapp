import type { CurriculumConcept, Difficulty, TaskDefinition, TaskPriority } from '../entities/models';

type LearningPattern = 'programming' | 'mathematics' | 'data' | 'project' | 'general';

function classifyTopic(
  title: string,
  nodeType: CurriculumConcept['nodeType'],
  contextTitles: string[],
): LearningPattern {
  if (nodeType === 'project' || nodeType === 'milestone') return 'project';

  // A leaf such as "Arrays" is ambiguous by itself. Its nearest section
  // (NumPy, Python, Mathematics, etc.) is the stronger signal.
  for (const context of [...contextTitles].reverse()) {
    const section = context.toLocaleLowerCase();
    if (/\b(numpy|pandas|data(?!\s+structures?)|data analysis|data science|dataset|eda|visualization|data cleaning|dataframe|feature engineering|machine learning|deep learning|scikit-learn|sklearn|pytorch|tensorflow)\b/u.test(section)) return 'data';
    if (/\b(mathematics|math|probability|statistics|calculus|linear algebra|discrete math)\b/u.test(section)) return 'mathematics';
    if (/\b(python|java|javascript|typescript|programming|software|coding|sql|data structures)\b/u.test(section)) return 'programming';
  }

  const topic = title.toLocaleLowerCase();
  if (/\b(python|java|javascript|typescript|programming|code|coding|variables?|functions?|loops?|arrays?|classes?|objects?|algorithms?|data structures?|recursion|sql)\b/u.test(topic)) return 'programming';
  if (/\b(probability|statistics|calculus|linear algebra|matrix|matrices|derivative|integral|differentiation|optimization|discrete math|permutation|combination|regression)\b/u.test(topic)) return 'mathematics';
  if (/\b(pandas|numpy|dataset|data analysis|eda|visualization|data cleaning|dataframe|machine learning|deep learning|feature engineering|scikit-learn|sklearn|pytorch|tensorflow)\b/u.test(topic)) return 'data';
  return 'general';
}

export function generateTasksForConcept(
  concept: CurriculumConcept,
  orderIndex: number,
  contextTitles: string[] = [],
): TaskDefinition[] {
  const base = concept.title.trim();
  const pattern = classifyTopic(base, concept.nodeType, contextTitles);
  const priority: TaskPriority = pattern === 'project' ? 'high' : 'medium';
  const difficulty: Difficulty = pattern === 'project' ? 'very_hard' : concept.nodeType === 'concept' || concept.nodeType === 'skill' ? 'medium' : 'easy';

  const learningTask = pattern === 'programming'
    ? { title: `Implement ${base} in a small program`, objective: `Write a small, runnable example that uses ${base}; explain the input, output, and the role of each important line.`, type: 'code' as const, estimatedMinutes: 40, minMinutes: 25, maxMinutes: 60, completionCriteria: `A runnable example demonstrates ${base}, and you can explain its output.` }
    : pattern === 'mathematics'
      ? { title: `Derive and explain ${base}`, objective: `Work through the core definitions, assumptions, and one derivation involving ${base}.`, type: 'exercise' as const, estimatedMinutes: 40, minMinutes: 25, maxMinutes: 60, completionCriteria: `Show a correct step-by-step derivation or worked explanation of ${base}.` }
      : pattern === 'data'
        ? { title: `Explore ${base} with a small dataset`, objective: `Inspect a small example dataset and identify how ${base} is represented, used, and validated.`, type: 'apply' as const, estimatedMinutes: 40, minMinutes: 25, maxMinutes: 60, completionCriteria: `Produce a short, reproducible example using ${base} and explain one finding.` }
        : pattern === 'project'
          ? { title: `Define the deliverable for ${base}`, objective: `Turn ${base} into a small, testable scope with a user-visible deliverable and acceptance criteria.`, type: 'mini_project' as const, estimatedMinutes: 35, minMinutes: 20, maxMinutes: 50, completionCriteria: `A short scope, concrete deliverable, and acceptance checklist are written.` }
          : { title: `Explain ${base} using a worked example`, objective: `Build a correct mental model of ${base}, then connect the definition to a concrete example and its limits.`, type: 'learn' as const, estimatedMinutes: 30, minMinutes: 20, maxMinutes: 45, completionCriteria: `Explain ${base} in your own words and complete one correct worked example.` };

  const practiceTask = pattern === 'programming'
    ? { title: `Test and debug ${base}`, objective: `Extend the example with normal, boundary, and invalid inputs; inspect and fix any incorrect behaviour.`, type: 'code' as const, estimatedMinutes: 45, minMinutes: 30, maxMinutes: 65, completionCriteria: `Three test cases pass, including a boundary case, and one possible failure is explained.` }
    : pattern === 'mathematics'
      ? { title: `Solve progressive problems on ${base}`, objective: `Solve a short set of problems that move from direct application to a less familiar situation.`, type: 'exercise' as const, estimatedMinutes: 45, minMinutes: 30, maxMinutes: 65, completionCriteria: `At least four problems are solved with working shown and errors corrected.` }
      : pattern === 'data'
        ? { title: `Build a mini analysis using ${base}`, objective: `Apply ${base} to a small dataset and communicate the result with a table, chart, or concise finding.`, type: 'apply' as const, estimatedMinutes: 50, minMinutes: 30, maxMinutes: 75, completionCriteria: `A reproducible analysis produces one labelled output and a written conclusion.` }
        : pattern === 'project'
          ? { title: `Build and verify ${base}`, objective: `Create the smallest useful version of ${base}; validate it against the acceptance checklist.`, type: 'mini_project' as const, estimatedMinutes: 60, minMinutes: 40, maxMinutes: 90, completionCriteria: `A working artifact satisfies the agreed acceptance checklist and includes a short test or demonstration.` }
          : { title: `Apply ${base} to a new problem`, objective: `Use ${base} in a different example, compare your approach with the worked example, and note the trade-offs.`, type: 'practice' as const, estimatedMinutes: 40, minMinutes: 25, maxMinutes: 60, completionCriteria: `Complete two new applications of ${base} and explain why the approach works.` };

  const templates: Array<{ title: string; objective: string; type: TaskDefinition['type']; estimatedMinutes: number; minMinutes: number; maxMinutes: number; completionCriteria: string }> = [learningTask, practiceTask];
  if (pattern === 'project') {
    templates.push({ title: `Review the ${base} milestone`, objective: `Check the completed artifact against scope, quality, and acceptance criteria; record remaining gaps.`, type: 'checkpoint', estimatedMinutes: 25, minMinutes: 15, maxMinutes: 40, completionCriteria: `The artifact is reviewed against every acceptance criterion and remaining gaps are recorded.` });
  }

  return templates.map((template, index) => ({
    ...template,
    id: `${concept.id}:task:${orderIndex + 1}-${index + 1}`,
    roadmapId: concept.roadmapId,
    sourceNodeId: concept.sourceNodeId,
    conceptId: concept.id,
    difficulty,
    priority,
    dependencyIds: index === 0 ? [] : [`${concept.id}:task:${orderIndex + 1}-${index}`],
    confidence: 'medium',
    active: true,
    splittable: pattern === 'project' || template.estimatedMinutes >= 45,
  }));
}
