import { parseRoadmap } from '../services/roadmapParser';
import type { AIProvider } from './aiProvider';
import type { CurriculumConcept, DependencyEdge, ParsedRoadmap, TaskDefinition } from '../entities/models';

export class RuleBasedProvider implements AIProvider {
  readonly name = 'RuleBasedProvider';
  readonly version = '0.9.0';
  readonly promptVersion = 'deterministic-rule-v1';
  async parseRoadmap(input: string): Promise<ParsedRoadmap> {
    return parseRoadmap(input, 'ai-preview-roadmap');
  }

  async expandNode(node: { id: string; title: string }) {
    const concept: CurriculumConcept = { id: `${node.id}:concept`, roadmapId: 'ai-preview-roadmap', sourceNodeId: node.id, title: node.title, nodeType: 'concept', outcomes: [`Explain ${node.title}`, `Apply ${node.title}`] };
    const task: TaskDefinition = { id: `${concept.id}:task:1`, roadmapId: concept.roadmapId, sourceNodeId: node.id, conceptId: concept.id, title: `Practice ${node.title}`, objective: `Apply ${node.title} in a focused exercise.`, type: 'practice', estimatedMinutes: 30, minMinutes: 20, maxMinutes: 45, difficulty: 'medium', priority: 'medium', completionCriteria: `Complete 3 correct examples involving ${node.title}.`, dependencyIds: [], confidence: 'high', active: true };
    return { concepts: [concept], tasks: [task], warnings: [], confidence: 1 };
  }

  async generateTaskCandidates(input: { sourceNodeId: string; title: string }) {
    const result = await this.expandNode({ id: input.sourceNodeId, title: input.title });
    return result.tasks;
  }

  async suggestDependencies(tasks: TaskDefinition[]): Promise<DependencyEdge[]> {
    return tasks.slice(1).map((task, i) => ({ fromTaskId: tasks[i].id, toTaskId: task.id, type: 'soft' as const, confidence: 'high' as const }));
  }

  async generatePractice(input: { conceptTitle: string }): Promise<string[]> {
    return [`Explain ${input.conceptTitle} without notes.`, `Solve 3 small problems about ${input.conceptTitle}.`, `Build one tiny practical example using ${input.conceptTitle}.`];
  }

  async analyzeProgress(input: { completed: number; skipped: number; unreported: number }) {
    const reported = input.completed + input.skipped;
    return { summary: `${reported} reported task results and ${input.unreported} unresolved results.`, suggestedActions: input.unreported ? ['Complete daily review before finalizing the next plan.'] : ['Continue with the next ready task.'], confidence: 'high' as const };
  }

  async explainDecision(input: { decision: string; facts: string[] }): Promise<string> {
    return `${input.decision}: ${input.facts.join('; ')}.`;
  }
}
