import type {
  AIArtifact,
  AISettings,
  CurriculumConcept,
  DailyTask,
  KnowledgeGapSuggestion,
  ParsedRoadmap,
  RoadmapTask,
  TaskDefinition,
} from '../entities/models';
import { analyzeRoadmapSemantics, detectKnowledgeGaps, expandRoadmapNodeWithValidation, toAIArtifact } from './aiIntelligence';
import type { AIProvider } from './aiProvider';
import { getAIProvider } from './aiProviderFactory';

export interface AIServiceContext {
  provider?: AIProvider;
  settings?: AISettings;
}

export async function analyzeRoadmapWithAI(sourceText: string, roadmapId: string, context: AIServiceContext = {}) {
  const provider = context.provider ?? getAIProvider(context.settings);
  const parsed: ParsedRoadmap = await provider.parseRoadmap(sourceText);
  const analysis = analyzeRoadmapSemantics(parsed);
  const artifact = toAIArtifact({
    kind: 'roadmap_analysis', roadmapId, modelName: provider.name, modelVersion: provider.version,
    promptVersion: provider.promptVersion, confidence: analysis.confidence,
    payload: analysis as unknown as Record<string, unknown>,
  });
  return { parsed, analysis, artifact };
}

export async function expandNodeWithAI(
  roadmapId: string,
  nodeId: string,
  nodeTitle: string,
  existingConceptTitles: string[],
  existingTaskTitles: string[],
  parentTitles: string[] = [],
  nearbyTitles: string[] = [],
  context: AIServiceContext = {},
) {
  const provider = context.provider ?? getAIProvider(context.settings);
  const result = await expandRoadmapNodeWithValidation(provider, { id: nodeId, title: nodeTitle }, {
    roadmapId, nodeId, nodeTitle, parentTitles, nearbyTitles, existingConceptTitles, existingTaskTitles,
  });
  const artifact = toAIArtifact({
    kind: 'node_expansion', roadmapId, sourceNodeId: nodeId, modelName: provider.name, modelVersion: provider.version,
    promptVersion: provider.promptVersion, confidence: result.confidence,
    payload: { nodeTitle, parentTitles, nearbyTitles, concepts: result.concepts, tasks: result.tasks, dependencySuggestions: result.dependencySuggestions, warnings: result.warnings },
  });
  return { ...result, artifact };
}

export async function generatePracticeWithAI(roadmapId: string, nodeId: string, conceptTitle: string, context: AIServiceContext = {}) {
  const provider = context.provider ?? getAIProvider(context.settings);
  const prompts = await provider.generatePractice({ conceptTitle });
  const artifact = toAIArtifact({
    kind: 'practice_set', roadmapId, sourceNodeId: nodeId, modelName: provider.name, modelVersion: provider.version,
    promptVersion: provider.promptVersion, confidence: 'medium',
    payload: { conceptTitle, prompts },
  });
  return { prompts, artifact };
}

export function generateKnowledgeGapSuggestions(roadmapId: string, tasks: RoadmapTask[], dailyTasks: DailyTask[], provider: AIProvider = getAIProvider()) {
  const suggestions = detectKnowledgeGaps(roadmapId, tasks, dailyTasks);
  const artifact = toAIArtifact({
    kind: 'knowledge_gap', roadmapId, modelName: provider.name, modelVersion: provider.version,
    promptVersion: provider.promptVersion, confidence: suggestions.length ? 'medium' : 'high',
    payload: { suggestions },
  });
  return { suggestions, artifact };
}

export async function explainPlannerDecisionWithAI(roadmapId: string, decision: string, facts: string[], context: AIServiceContext = {}) {
  const provider = context.provider ?? getAIProvider(context.settings);
  const explanation = await provider.explainDecision({ decision, facts });
  const artifact = toAIArtifact({
    kind: 'decision_explanation', roadmapId, modelName: provider.name, modelVersion: provider.version,
    promptVersion: provider.promptVersion, confidence: 'high', payload: { decision, facts, explanation },
  });
  return { explanation, artifact };
}

export function mergeGeneratedCurriculum(existing: { concepts: CurriculumConcept[]; tasks: TaskDefinition[] }, generated: { concepts: CurriculumConcept[]; tasks: TaskDefinition[] }) {
  const conceptKeys = new Set(existing.concepts.map((c) => c.title.trim().toLocaleLowerCase()));
  const taskKeys = new Set(existing.tasks.map((t) => t.title.trim().toLocaleLowerCase()));
  return {
    concepts: [...existing.concepts, ...generated.concepts.filter((c) => !conceptKeys.has(c.title.trim().toLocaleLowerCase()))],
    tasks: [...existing.tasks, ...generated.tasks.filter((t) => !taskKeys.has(t.title.trim().toLocaleLowerCase()))],
  };
}

export function knowledgeGapText(suggestions: KnowledgeGapSuggestion[]): string {
  if (!suggestions.length) return 'No evidence-based knowledge-gap suggestions right now.';
  return suggestions.slice(0, 3).map((suggestion) => suggestion.suggestion).join(' ');
}
