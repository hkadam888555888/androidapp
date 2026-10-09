import type { ParsedRoadmap, CurriculumConcept, TaskDefinition, DependencyEdge } from '../entities/models';

export interface TaskCandidateInput { sourceNodeId: string; title: string; context?: string; }
export interface ProgressAnalysis { summary: string; suggestedActions: string[]; confidence: 'high' | 'medium' | 'low'; }
export interface AIProvider {
  readonly name: string;
  readonly version: string;
  readonly promptVersion: string;
  parseRoadmap(input: string): Promise<ParsedRoadmap>;
  expandNode(node: { id: string; title: string }): Promise<{ concepts: CurriculumConcept[]; tasks: TaskDefinition[]; warnings: string[]; confidence: number }>;
  generateTaskCandidates(input: TaskCandidateInput): Promise<TaskDefinition[]>;
  suggestDependencies(tasks: TaskDefinition[]): Promise<DependencyEdge[]>;
  generatePractice(input: { conceptTitle: string }): Promise<string[]>;
  analyzeProgress(input: { completed: number; skipped: number; unreported: number }): Promise<ProgressAnalysis>;
  explainDecision(input: { decision: string; facts: string[] }): Promise<string>;
}

