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


type TaskDraft = Pick<TaskDefinition, 'title' | 'objective' | 'type' | 'estimatedMinutes' | 'minMinutes' | 'maxMinutes' | 'completionCriteria'>;

interface TopicBlueprint {
  learning: TaskDraft;
  practice: TaskDraft;
}

// Give common roadmap topics a concrete first exercise and a meaningful
// follow-up. Unknown topics still use the safe category-level fallback below.
function topicBlueprint(title: string, pattern: LearningPattern, contextTitles: string[]): TopicBlueprint | undefined {
  const topic = title.toLocaleLowerCase().replace(/[_-]+/gu, ' ').trim();
  const context = contextTitles.join(' ').toLocaleLowerCase();
  const pair = (learning: TaskDraft, practice: TaskDraft): TopicBlueprint => ({ learning, practice });

  if (pattern === 'data') {
    if (/\bnumpy\b/u.test(context) && /\b(arrays?|ndarray|broadcasting|vectorization|axes?)\b/u.test(topic)) {
      return pair(
        { title: 'Inspect NumPy array shape, dtype, and axes', objective: 'Create a small NumPy array, inspect its shape and dtype, identify what each axis represents, and predict the result of one reshape or axis operation before running it.', type: 'apply', estimatedMinutes: 35, minMinutes: 20, maxMinutes: 50, completionCriteria: 'A runnable example shows the array, shape, dtype, axis meaning, and the verified result of one shape or axis operation.' },
        { title: 'Solve an array task with broadcasting and vectorization', objective: 'Build two compatible arrays, predict their broadcasted shape, apply one vectorized calculation, and compare it with a short loop-based version on a small input.', type: 'apply', estimatedMinutes: 45, minMinutes: 30, maxMinutes: 65, completionCriteria: 'The broadcast shape is explained, both implementations agree on test data, and an incompatible-shape case is identified.' },
      );
    }

    if (/\b(pandas|dataframe|tabular data)\b/u.test(topic)) {
      return pair(
        { title: 'Inspect a DataFrame before analysis', objective: 'Load a small table and use shape, columns, dtypes, info, and head to establish its size, field names, data types, non-null counts, and first visible records. Explain what each inspection reveals.', type: 'apply', estimatedMinutes: 30, minMinutes: 20, maxMinutes: 45, completionCriteria: 'A short inspection note reports row and column counts, names, important dtypes, non-null counts, and one data-quality question.' },
        { title: 'Check a DataFrame before using it', objective: 'Inspect duplicates, unexpected categories, numeric ranges, and missingness in the same table. Choose one issue to investigate and show how it could affect a later calculation or model.', type: 'apply', estimatedMinutes: 40, minMinutes: 25, maxMinutes: 55, completionCriteria: 'A repeatable check reports at least two data-quality observations and explains the risk of one issue.' },
      );
    }

    if (/\b(missing values?|null values?|nan|imputation|missing data)\b/u.test(topic)) {
      return pair(
        { title: 'Map missing values and their impact', objective: 'Measure missing counts and percentages by column, inspect whether missingness clusters by row or group, and distinguish an unknown value from zero or not applicable.', type: 'apply', estimatedMinutes: 35, minMinutes: 25, maxMinutes: 50, completionCriteria: 'A missingness summary reports counts and percentages and identifies which fields need investigation before modelling.' },
        { title: 'Compare safe ways to handle missing data', objective: 'Compare leaving, dropping, and filling missing values for one selected column. Explain what information each choice can remove or invent, then validate the resulting row count and dtype.', type: 'apply', estimatedMinutes: 45, minMinutes: 30, maxMinutes: 65, completionCriteria: 'At least two handling strategies are compared, the chosen rule is justified, and row count/dtype checks pass.' },
      );
    }

    if (/\b(groupby|grouping|aggregation|aggregate|pivot table)\b/u.test(topic)) {
      return pair(
        { title: 'Understand split–apply–combine with groupby', objective: 'Group a dataset by one categorical column, calculate count and mean for a numeric column, and explain what each output row represents.', type: 'apply', estimatedMinutes: 35, minMinutes: 25, maxMinutes: 50, completionCriteria: 'A grouped result contains the expected groups and correctly labelled aggregate columns.' },
        { title: 'Compare groupby aggregation and transformation', objective: 'Use agg and transform on the same grouping, compare their output shapes, and verify that transform returns values aligned to the original rows.', type: 'apply', estimatedMinutes: 45, minMinutes: 30, maxMinutes: 65, completionCriteria: 'The difference in output shape and row alignment between aggregation and transformation is demonstrated with a checked example.' },
      );
    }

    if (/\b(loc|iloc|indexing|selection|filtering|boolean indexing)\b/u.test(topic)) {
      return pair(
        { title: 'Select rows by labels and positions', objective: 'Use loc for label-based selection and iloc for position-based selection. Predict the selected rows and columns before executing each expression.', type: 'apply', estimatedMinutes: 30, minMinutes: 20, maxMinutes: 45, completionCriteria: 'A side-by-side example correctly explains label selection versus positional selection, including inclusive label slices.' },
        { title: 'Build and debug a boolean DataFrame filter', objective: 'Create a boolean condition, inspect its index and dtype, apply it to rows, and select columns using valid label or positional indexing. Test a mask with no matches and one with a missing value.', type: 'apply', estimatedMinutes: 45, minMinutes: 30, maxMinutes: 65, completionCriteria: 'The filter returns intended rows, mask alignment is checked, and empty/missing-value edge cases are handled.' },
      );
    }

    if (/\b(eda|exploratory data analysis)\b/u.test(topic)) {
      return pair(
        { title: 'Profile a dataset for an EDA question', objective: 'State a question, inspect dimensions and types, quantify missingness and duplicates, summarize numeric columns, and inspect important categorical columns.', type: 'apply', estimatedMinutes: 40, minMinutes: 25, maxMinutes: 60, completionCriteria: 'A compact EDA profile includes the question, shape, dtypes, missingness, duplicates, numeric summaries, and categorical counts.' },
        { title: 'Turn EDA findings into a modelling decision', objective: 'Choose two findings from the profile and explain how each affects cleaning, feature selection, leakage risk, or evaluation. Support each decision with a measured value or plot.', type: 'apply', estimatedMinutes: 50, minMinutes: 35, maxMinutes: 75, completionCriteria: 'Two evidence-backed preparation decisions are recorded with the supporting statistic or visualization.' },
      );
    }

    if (/\b(charts?|plotting|visualization|matplotlib|seaborn)\b/u.test(topic)) {
      return pair(
        { title: 'Choose a chart that answers a data question', objective: 'Write one question, identify whether the variables are categorical or numeric, choose a chart that fits those types, and label axes and units.', type: 'apply', estimatedMinutes: 30, minMinutes: 20, maxMinutes: 45, completionCriteria: 'A labelled chart answers the stated question and uses a chart type suited to the variable types.' },
        { title: 'Improve and critique a data visualization', objective: 'Add a useful title, readable scale, units, and appropriate legend. Check for misleading axes and clutter, then write the finding without claiming causation from correlation.', type: 'apply', estimatedMinutes: 40, minMinutes: 25, maxMinutes: 60, completionCriteria: 'The revised chart is readable, not misleading, and includes an evidence-based interpretation.' },
      );
    }

    if (/\b(explain|interpret|communicate|finding|limitations?)\b/u.test(topic) && /\b(visualization|matplotlib|seaborn|chart|plot)\b/u.test(context)) {
      return pair(
        { title: 'Describe what the chart actually shows', objective: 'Write two observations grounded in visible values or patterns. Separate observation from explanation and avoid inferring causation from a chart alone.', type: 'apply', estimatedMinutes: 25, minMinutes: 15, maxMinutes: 40, completionCriteria: 'Two observations cite visible evidence and do not make unsupported causal claims.' },
        { title: 'Explain a finding and its limitations', objective: 'Summarize the main pattern, quantify one comparison, and state a limitation such as sample size, missing data, scale choice, or confounding.', type: 'apply', estimatedMinutes: 35, minMinutes: 20, maxMinutes: 50, completionCriteria: 'A concise interpretation includes one quantified finding and one relevant limitation.' },
      );
    }

    if (/\b(regression|linear regression|classification|model evaluation|machine learning)\b/u.test(topic)) {
      return pair(
        { title: 'Build a baseline model for ' + title, objective: 'Define the target and input features, create a train/test split before fitting, train the simplest suitable baseline, and record the metric that matches the problem type.', type: 'apply', estimatedMinutes: 45, minMinutes: 30, maxMinutes: 65, completionCriteria: 'A reproducible baseline has a clear target, leakage-safe split, fitted model, and correctly selected evaluation metric.' },
        { title: 'Evaluate and challenge the ' + title + ' baseline', objective: 'Compare predictions with actual values, inspect residuals or a confusion matrix as appropriate, test a simple baseline comparator, and explain one limitation of the evaluation.', type: 'apply', estimatedMinutes: 55, minMinutes: 35, maxMinutes: 80, completionCriteria: 'Evaluation includes a baseline comparison, one diagnostic, and a limitation tied to the data or metric.' },
      );
    }
  }

  if (pattern === 'programming') {
    if (/\b(variables?|data types?|type conversion|casting)\b/u.test(topic)) {
      return pair(
        { title: 'Trace variable values and data types', objective: 'Create variables of different types, inspect their types, convert one value safely, and trace how reassignment changes the value.', type: 'code', estimatedMinutes: 25, minMinutes: 15, maxMinutes: 40, completionCriteria: 'A runnable example prints values and types before and after conversion and explains the result.' },
        { title: 'Test variable operations with valid and invalid inputs', objective: 'Perform a small operation and check normal, boundary, and incompatible-type inputs. Handle the invalid case intentionally.', type: 'code', estimatedMinutes: 35, minMinutes: 20, maxMinutes: 50, completionCriteria: 'Three cases are tested, including an invalid input, and the failure is handled intentionally.' },
      );
    }

    if (/\b(functions?|methods?|parameters?|arguments?|return values?)\b/u.test(topic)) {
      return pair(
        { title: 'Design a function contract for ' + title, objective: 'Define what the function receives, what it returns, and what assumptions it makes. Implement a small function with meaningful parameter names and an explicit return value.', type: 'code', estimatedMinutes: 35, minMinutes: 20, maxMinutes: 50, completionCriteria: 'A callable function has a clear input/output contract and at least one worked example.' },
        { title: 'Test function behaviour and edge cases', objective: 'Test normal, boundary, and invalid inputs; distinguish printing from returning; and correct one failure discovered by the tests.', type: 'code', estimatedMinutes: 40, minMinutes: 25, maxMinutes: 60, completionCriteria: 'At least three input cases pass, return values are asserted, and one edge case is explained.' },
      );
    }

    if (/\b(loops?|iteration|while loop|for loop)\b/u.test(topic)) {
      return pair(
        { title: 'Trace loop state and termination', objective: 'Write a for loop and a while loop for a small problem, record how the loop variable changes, and explain the condition that makes each loop stop.', type: 'code', estimatedMinutes: 30, minMinutes: 20, maxMinutes: 45, completionCriteria: 'Both loop traces show initialization, updates, termination, and final output.' },
        { title: 'Test loop boundaries and empty inputs', objective: 'Run the loop solution with an empty sequence, one item, several items, and a boundary value. Detect and fix an off-by-one or non-terminating case if present.', type: 'code', estimatedMinutes: 40, minMinutes: 25, maxMinutes: 60, completionCriteria: 'The solution handles empty, single-item, and boundary inputs without off-by-one or termination errors.' },
      );
    }
  }

  if (pattern === 'mathematics') {
    if (/\b(probability|conditional probability|bayes)\b/u.test(topic)) {
      return pair(
        { title: 'Define events and calculate a probability', objective: 'Write the sample space, define the events, identify whether outcomes are equally likely, and calculate one probability with the assumptions stated.', type: 'exercise', estimatedMinutes: 35, minMinutes: 20, maxMinutes: 50, completionCriteria: 'A worked solution defines the sample space and events and gives a probability between zero and one with its assumptions.' },
        { title: 'Solve conditional probability problems', objective: 'Solve problems using conditional probability and, where relevant, Bayes theorem. Draw a table or tree and compare the result with an intuitive estimate.', type: 'exercise', estimatedMinutes: 45, minMinutes: 30, maxMinutes: 65, completionCriteria: 'At least four problems are solved with working shown and conditional events clearly distinguished.' },
      );
    }

    if (/\b(statistics|descriptive statistics|mean|median|variance|standard deviation|distribution)\b/u.test(topic)) {
      return pair(
        { title: 'Explain centre and spread in a dataset', objective: 'Calculate mean, median, range, variance, and standard deviation for a small dataset and explain how an outlier changes the summary.', type: 'exercise', estimatedMinutes: 35, minMinutes: 20, maxMinutes: 50, completionCriteria: 'Summary statistics are calculated correctly and the effect of an outlier is explained.' },
        { title: 'Choose a statistical summary for a real question', objective: 'Compare two distributions, choose a robust measure where appropriate, and explain what the summary does not reveal about the underlying data.', type: 'exercise', estimatedMinutes: 45, minMinutes: 30, maxMinutes: 65, completionCriteria: 'A comparison uses appropriate measures of centre and spread and explains at least one limitation.' },
      );
    }
  }

  return undefined;
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
  const blueprint = topicBlueprint(base, pattern, contextTitles);
  if (blueprint) {
    return [blueprint.learning, blueprint.practice].map((template, index) => ({
      ...template,
      id: concept.id + ':task:' + (orderIndex + 1) + '-' + (index + 1),
      roadmapId: concept.roadmapId,
      sourceNodeId: concept.sourceNodeId,
      conceptId: concept.id,
      difficulty,
      priority,
      dependencyIds: index === 0 ? [] : [concept.id + ':task:' + (orderIndex + 1) + '-' + index],
      confidence: 'high',
      active: true,
      splittable: template.estimatedMinutes >= 45,
    }));
  }


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
