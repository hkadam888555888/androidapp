import { useMemo, useState } from 'react';
import { compileCurriculum } from '../../domain/services/curriculumCompiler';
import { parseRoadmap } from '../../domain/services/roadmapParser';
import { validateParsedRoadmap, validateTasks } from '../../domain/services/curriculumValidator';
import { diffCurriculum } from '../../domain/services/curriculumDiff';
import { createId } from '../../lib/id';
import { appStore, useAppStore } from '../../application/appStore';
import type { CurriculumVersion, Roadmap, TaskPriority } from '../../domain/entities/models';
import { analyzeRoadmapWithAI, expandNodeWithAI, generateKnowledgeGapSuggestions, generatePracticeWithAI } from '../../domain/ai/aiService';
import { getAIProvider } from '../../domain/ai/aiProviderFactory';

const EXAMPLE_ROADMAP = `# AI/ML ROADMAP
## Python
    - Fundamentals
      - Variables and data types
      - Functions
      - OOP
## NumPy
    - Arrays
    - Indexing
    - Broadcasting
    - Vectorization
## Pandas
    - Series
    - DataFrames
    - Cleaning
    - GroupBy
## Mathematics
    - Probability
    - Statistics
    - Linear Algebra
    - Calculus
## Machine Learning
    - Regression
    - Classification
    - Feature Engineering
    - Model Evaluation`;

function simpleHash(input: string): string { let h = 2166136261; for (let i = 0; i < input.length; i += 1) h = Math.imul(h ^ input.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }

export function RoadmapPage() {
  const app = useAppStore();
  const initialRoadmap = app.roadmaps.find((roadmap) => roadmap.active) ?? app.roadmaps[0];
  const [selectedRoadmapId, setSelectedRoadmapId] = useState(initialRoadmap?.id ?? '');
  const selectedRoadmap = app.roadmaps.find((roadmap) => roadmap.id === selectedRoadmapId);
  const [source, setSource] = useState(selectedRoadmap?.sourceText || EXAMPLE_ROADMAP);
  const [title, setTitle] = useState(selectedRoadmap?.title || 'My AI / ML Roadmap');
  const [priority, setPriority] = useState<TaskPriority>(selectedRoadmap?.priority ?? 'high');
  const [share, setShare] = useState(selectedRoadmap?.capacitySharePercentage === undefined ? '' : String(selectedRoadmap.capacitySharePercentage));
  const [targetDate, setTargetDate] = useState(selectedRoadmap?.targetDate?.slice(0, 10) ?? '');
  const [analyzed, setAnalyzed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<Awaited<ReturnType<typeof analyzeRoadmapWithAI>>['analysis'] | null>(null);
  const [aiExpansion, setAiExpansion] = useState<Awaited<ReturnType<typeof expandNodeWithAI>> | null>(null);
  const [aiPractice, setAiPractice] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  const roadmapIdForDraft = selectedRoadmapId || 'live-roadmap';
  const result = useMemo(() => {
    if (!analyzed || !source.trim()) return null;
    const parsed = parseRoadmap(source, roadmapIdForDraft);
    const structure = validateParsedRoadmap(parsed);
    const curriculum = structure.valid ? compileCurriculum(parsed.nodes) : { concepts: [], tasks: [] };
    const taskValidation = structure.valid ? validateTasks(curriculum.tasks) : { valid: false, issues: [] };
    return { parsed, structure, curriculum, taskValidation };
  }, [source, analyzed, roadmapIdForDraft]);

  const previousApproved = useMemo(() => app.curriculumVersions
    .filter((version) => version.roadmapId === roadmapIdForDraft && version.status === 'approved')
    .sort((a, b) => b.version - a.version)[0], [app.curriculumVersions, roadmapIdForDraft]);

  const curriculumDiff = useMemo(() => {
    if (!result || !result.structure.valid || !result.taskValidation.valid || !previousApproved) return null;
    const oldConcepts = app.curriculumConcepts.filter((concept) => previousApproved.conceptIds.includes(concept.id));
    const oldTasks = app.taskDefinitions.filter((task) => previousApproved.taskDefinitionIds.includes(task.id));
    return diffCurriculum(oldConcepts, oldTasks, result.curriculum.concepts, result.curriculum.tasks);
  }, [app.curriculumConcepts, app.taskDefinitions, previousApproved, result]);

  function openRoadmap(roadmap: Roadmap) {
    setSelectedRoadmapId(roadmap.id);
    setSource(roadmap.sourceText);
    setTitle(roadmap.title);
    setPriority(roadmap.priority ?? 'medium');
    setShare(roadmap.capacitySharePercentage === undefined ? '' : String(roadmap.capacitySharePercentage));
    setTargetDate(roadmap.targetDate?.slice(0, 10) ?? '');
    setAnalyzed(false);
    setSavedMessage('');
  }

  function startNewRoadmap() {
    setSelectedRoadmapId('');
    setSource('');
    setTitle('New roadmap');
    setPriority('medium');
    setShare('');
    setTargetDate('');
    setAnalyzed(false);
    setSavedMessage('');
  }

  async function toggleActive(roadmap: Roadmap) {
    try {
      await appStore.updateRoadmap({ ...roadmap, active: !roadmap.active, updatedAt: new Date().toISOString() });
      setSavedMessage(`${roadmap.title} is now ${roadmap.active ? 'inactive' : 'active'}.`);
    } catch (error) { setSavedMessage(error instanceof Error ? error.message : 'Could not update roadmap.'); }
  }

  async function runSemanticAI() {
    if (!source.trim()) { setAiMessage('Add roadmap text before running AI analysis.'); return; }
    setAiBusy(true); setAiMessage('Analyzing roadmap semantics…');
    try {
      const result = await analyzeRoadmapWithAI(source, roadmapIdForDraft, { settings: app.aiSettings });
      setAiAnalysis(result.analysis);
      await appStore.saveAIArtifact(result.artifact);
      setAiMessage('Analysis complete. AI suggestions stay advisory until you approve changes.');
    } catch (error) { setAiMessage(error instanceof Error ? error.message : 'AI analysis failed.'); }
    finally { setAiBusy(false); }
  }

  async function runNodeExpansion() {
    const node = result?.parsed.nodes.find((candidate) => candidate.id === selectedNodeId) ?? result?.parsed.nodes[0];
    if (!node || !result) { setAiMessage('Analyze the roadmap first, then choose a node to expand.'); return; }
    setSelectedNodeId(node.id);
    setAiBusy(true); setAiMessage(`Building a bounded proposal for “${node.cleanedTitle}”…`);
    try {
      const parentTitles = node.parentId ? [result.parsed.nodes.find((candidate) => candidate.id === node.parentId)?.cleanedTitle ?? ''] : [];
      const nearbyTitles = result.parsed.nodes.filter((candidate) => Math.abs(candidate.orderIndex - node.orderIndex) <= 2 && candidate.id !== node.id).map((candidate) => candidate.cleanedTitle);
      const expanded = await expandNodeWithAI(roadmapIdForDraft, node.id, node.cleanedTitle, result.curriculum.concepts.map((c) => c.title), result.curriculum.tasks.map((t) => t.title), parentTitles.filter(Boolean), nearbyTitles, { settings: app.aiSettings });
      setAiExpansion(expanded);
      const practice = await generatePracticeWithAI(roadmapIdForDraft, node.id, node.cleanedTitle, { settings: app.aiSettings });
      setAiPractice(practice.prompts);
      await appStore.saveAIArtifact(expanded.artifact);
      await appStore.saveAIArtifact(practice.artifact);
      setAiMessage(`Proposal ready: ${expanded.tasks.length} task candidate(s), ${expanded.practiceSuggestions.length} practice idea(s). Nothing was added to the active curriculum.`);
    } catch (error) { setAiMessage(error instanceof Error ? error.message : 'AI expansion failed.'); }
    finally { setAiBusy(false); }
  }

  async function approveAIExpansion() {
    if (!aiExpansion || !result?.structure.valid || !result.taskValidation.valid || !selectedRoadmap) { setAiMessage('Select an existing roadmap and generate a validated proposal first.'); return; }
    setAiBusy(true); setAiMessage('Approving the validated AI proposal into a new curriculum version…');
    try {
      const currentVersion = app.curriculumVersions.filter((v) => v.roadmapId === selectedRoadmap.id && v.status === 'approved').sort((a, b) => b.version - a.version)[0];
      const existingConcepts = currentVersion ? app.curriculumConcepts.filter((c) => currentVersion.conceptIds.includes(c.id)) : [];
      const existingDefinitions = currentVersion ? app.taskDefinitions.filter((t) => currentVersion.taskDefinitionIds.includes(t.id)) : [];
      const existingConceptTitles = new Set(existingConcepts.map((c) => c.title.trim().toLocaleLowerCase()));
      const conceptMap = new Map<string, string>();
      const approvedNewConcepts = aiExpansion.concepts.filter((concept) => {
        const key = concept.title.trim().toLocaleLowerCase();
        if (existingConceptTitles.has(key)) return false;
        const newId = `${selectedRoadmap.id}:ai:${concept.sourceNodeId}:concept`;
        conceptMap.set(concept.id, newId);
        return true;
      }).map((concept) => ({ ...concept, id: conceptMap.get(concept.id) ?? concept.id, roadmapId: selectedRoadmap.id }));
      const taskIdMap = new Map(aiExpansion.tasks.map((task) => [task.id, `${selectedRoadmap.id}:ai:${task.sourceNodeId}:task:${task.id.split(':').at(-1)}`]));
      const approvedNewDefinitions = aiExpansion.tasks.map((task) => ({
        ...task,
        id: taskIdMap.get(task.id) ?? task.id,
        roadmapId: selectedRoadmap.id,
        conceptId: conceptMap.get(task.conceptId) ?? existingConcepts.find((c) => c.title.trim().toLocaleLowerCase() === aiExpansion.concepts.find((candidate) => candidate.id === task.conceptId)?.title.trim().toLocaleLowerCase())?.id ?? task.conceptId,
        dependencyIds: task.dependencyIds.map((dependencyId) => taskIdMap.get(dependencyId) ?? dependencyId),
      }));
      const mergedConcepts = [...existingConcepts, ...approvedNewConcepts].filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index);
      const mergedDefinitions = [...existingDefinitions, ...approvedNewDefinitions].filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index);
      const existingRoadmapTasks = app.roadmapTasks.filter((task) => task.roadmapId === selectedRoadmap.id);
      const addedRoadmapTasks = approvedNewDefinitions.map((task, index) => ({
        id: task.id, roadmapId: selectedRoadmap.id, title: task.title, description: task.objective, objective: task.objective, completionCriteria: task.completionCriteria, taskType: task.type, estimatedMinutes: task.estimatedMinutes, priority: task.priority, category: mergedConcepts.find((c) => c.id === task.conceptId)?.title, order: existingRoadmapTasks.length + index + 1, dependencyIds: task.dependencyIds, completedOverall: false, difficulty: task.difficulty, carryOverCount: 0, active: true, splittable: task.splittable ?? false,
      }));
      const versionNumber = Math.max(0, ...app.curriculumVersions.filter((v) => v.roadmapId === selectedRoadmap.id).map((v) => v.version)) + 1;
      const now = new Date().toISOString();
      const approvedVersion: CurriculumVersion = {
        id: `${selectedRoadmap.id}:curriculum:v${versionNumber}`, roadmapId: selectedRoadmap.id, version: versionNumber, createdAt: now, sourceTextHash: simpleHash(selectedRoadmap.sourceText), status: 'approved', conceptIds: mergedConcepts.map((c) => c.id), taskDefinitionIds: mergedDefinitions.map((t) => t.id), warnings: aiExpansion.warnings,
      };
      await appStore.createRoadmap(selectedRoadmap, [...existingRoadmapTasks, ...addedRoadmapTasks], { version: approvedVersion, concepts: mergedConcepts, definitions: mergedDefinitions });
      setAiMessage(`Approved ${addedRoadmapTasks.length} AI task candidate(s) as curriculum v${versionNumber}. History was preserved and the planner can now consider the new work.`);
    } catch (error) { setAiMessage(error instanceof Error ? error.message : 'AI approval failed.'); }
    finally { setAiBusy(false); }
  }

  async function runKnowledgeGaps() {
    const roadmap = app.roadmaps.find((candidate) => candidate.id === roadmapIdForDraft);
    if (!roadmap) return;
    const output = generateKnowledgeGapSuggestions(roadmap.id, app.roadmapTasks, app.dailyTasks, getAIProvider(app.aiSettings));
    setAiMessage(output.suggestions.length ? output.suggestions.map((x) => x.suggestion).slice(0, 3).join(' ') : 'No evidence-based knowledge-gap suggestions right now.');
    await appStore.saveAIArtifact(output.artifact);
  }

  async function saveRoadmap() {
    if (!result?.structure.valid || !result.taskValidation.valid) return;
    const shareValue = share.trim() === '' ? undefined : Number(share);
    if (shareValue !== undefined && (!Number.isFinite(shareValue) || shareValue < 0 || shareValue > 100)) { setSavedMessage('Capacity share must be blank or between 0 and 100%.'); return; }
    setSaving(true);
    setSavedMessage('');
    try {
      const now = new Date().toISOString();
      const roadmapId = selectedRoadmapId || createId('roadmap');
      const roadmap: Roadmap = {
        id: roadmapId,
        title: title.trim() || 'Untitled roadmap',
        sourceText: source,
        createdAt: app.roadmaps.find((r) => r.id === roadmapId)?.createdAt ?? now,
        updatedAt: now,
        active: selectedRoadmap?.active ?? true,
        priority,
        capacitySharePercentage: shareValue,
        targetDate: targetDate || undefined,
      };
      const tasks = result.curriculum.tasks.map((task, index) => ({
        id: task.id,
        roadmapId,
        title: task.title,
        description: task.objective,
        objective: task.objective,
        completionCriteria: task.completionCriteria,
        taskType: task.type,
        estimatedMinutes: task.estimatedMinutes,
        priority: task.priority,
        category: result.curriculum.concepts.find((c) => c.id === task.conceptId)?.title,
        order: index + 1,
        dependencyIds: task.dependencyIds,
        completedOverall: false,
        difficulty: task.difficulty,
        carryOverCount: 0,
        active: true,
        splittable: task.splittable ?? false,
      }));
      const previousVersions = app.curriculumVersions.filter((v) => v.roadmapId === roadmapId);
      const versionNumber = Math.max(0, ...previousVersions.map((v) => v.version)) + 1;
      const fingerprint = simpleHash(source);
      const curriculumVersion: CurriculumVersion = {
        id: `${roadmapId}:curriculum:v${versionNumber}`,
        roadmapId,
        version: versionNumber,
        createdAt: now,
        sourceTextHash: fingerprint,
        status: 'approved',
        conceptIds: result.curriculum.concepts.map((c) => c.id),
        taskDefinitionIds: result.curriculum.tasks.map((t) => t.id),
        warnings: [],
      };
      await appStore.createRoadmap(roadmap, tasks, { version: curriculumVersion, concepts: result.curriculum.concepts, definitions: result.curriculum.tasks });
      setSelectedRoadmapId(roadmapId);
      setSavedMessage(`Saved ${tasks.length} tasks. ${roadmap.active ? 'This roadmap is active in the global planner.' : 'This roadmap remains inactive until you enable it.'}`);
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : 'Could not save roadmap.');
    } finally { setSaving(false); }
  }

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">Multi-roadmap source of truth</p><h1>Roadmap</h1><p className="muted">Keep multiple learning tracks active. The planner merges their eligible work into one global capacity pool.</p></div><div className="header-actions"><button className="button secondary" onClick={startNewRoadmap}>+ New roadmap</button><button className="button secondary" onClick={() => { setSource(EXAMPLE_ROADMAP); setAnalyzed(false); }}>Load example</button></div></header>

    {(aiMessage || aiAnalysis || aiExpansion) && <div className="notice-bar">{aiMessage}</div>}

    <article className="card ai-workbench"><div className="card-heading"><div><span className="eyebrow">v0.9 AI layer</span><h2>Bounded AI workbench</h2></div><span className="pill">{app.aiSettings?.providerName ?? 'RuleBasedProvider'}</span></div><p className="muted small-copy">AI can analyze, expand, and suggest practice, but it cannot mark completion, rewrite history, bypass validation, or silently change the active curriculum.</p><div className="toolbar"><button className="button primary" onClick={() => void runSemanticAI()} disabled={aiBusy}>{aiBusy ? 'Working…' : 'Analyze roadmap'}</button><select value={selectedNodeId} onChange={(e) => setSelectedNodeId(e.target.value)} disabled={!result?.parsed.nodes.length}><option value="">Choose a node</option>{result?.parsed.nodes.map((node) => <option key={node.id} value={node.id}>{'· '.repeat(node.depth)}{node.cleanedTitle}</option>)}</select><button className="button secondary" onClick={() => void runNodeExpansion()} disabled={aiBusy || !result}>Expand node</button><button className="button secondary" onClick={() => void approveAIExpansion()} disabled={aiBusy || !aiExpansion || !selectedRoadmap}>Approve proposal</button><button className="button secondary" onClick={() => void runKnowledgeGaps()} disabled={aiBusy}>Find knowledge gaps</button></div>{aiAnalysis && <div className="analysis-metrics"><span><strong>{aiAnalysis.nodeCount}</strong> nodes</span><span><strong>{aiAnalysis.ambiguousNodes.length}</strong> ambiguous</span><span><strong>{aiAnalysis.projectLikeNodes}</strong> projects</span><span><strong>{aiAnalysis.milestoneLikeNodes}</strong> milestones</span></div>}{aiAnalysis?.suggestions.length ? <div className="issue-list">{aiAnalysis.suggestions.map((item, i) => <div className="issue" key={i}><strong>AI suggestion</strong><span>{item}</span></div>)}</div> : null}{aiExpansion && <div className="task-preview-grid" style={{ marginTop: 14 }}>{aiExpansion.tasks.slice(0, 8).map((task) => <div className="task-preview" key={task.id}><span className="eyebrow">AI proposal · {task.type} · {task.estimatedMinutes} min · {task.confidence}</span><strong>{task.title}</strong><span>{task.objective}</span><small>Done when: {task.completionCriteria}</small></div>)}</div>}{(aiPractice.length > 0 || aiExpansion?.practiceSuggestions.length) && <div className="analysis-stack" style={{ marginTop: 14 }}><span className="eyebrow">Practice suggestions</span>{[...aiPractice, ...(aiExpansion?.practiceSuggestions ?? [])].filter((value, index, all) => all.indexOf(value) === index).map((item, i) => <div className="setting-row" key={`${item}-${i}`}><strong>{item}</strong><span className="pill">OPTIONAL</span></div>)}</div>}{aiExpansion?.warnings.length ? <div className="issue-list" style={{ marginTop: 14 }}>{aiExpansion.warnings.map((item, i) => <div className="issue" key={i}><strong>Validation</strong><span>{item}</span></div>)}</div> : null}</article>

    <article className="card roadmap-list-card"><div className="card-heading"><div><span className="eyebrow">Global planner inputs</span><h2>Roadmap portfolio</h2></div><span className="pill">{app.roadmaps.filter((roadmap) => roadmap.active).length} active</span></div>
      {app.roadmaps.length === 0 ? <div className="empty-state compact"><h3>No saved roadmaps</h3><p>Create your first roadmap below.</p></div> : <div className="roadmap-portfolio">{app.roadmaps.map((roadmap) => <div className={`portfolio-item ${roadmap.active ? 'active' : ''}`} key={roadmap.id}><button className="portfolio-main" onClick={() => openRoadmap(roadmap)}><strong>{roadmap.title}</strong><span>{roadmap.priority ?? 'medium'} priority · {roadmap.capacitySharePercentage === undefined ? 'flexible share' : `${roadmap.capacitySharePercentage}% share`}</span></button><div className="portfolio-actions"><span className={`pill ${roadmap.active ? 'success-pill' : ''}`}>{roadmap.active ? 'ACTIVE' : 'INACTIVE'}</span><button className="button secondary small-button" onClick={() => void toggleActive(roadmap)}>{roadmap.active ? 'Disable' : 'Enable'}</button></div></div>)}</div>}
    </article>

    <article className="card roadmap-import-card"><div className="form-row"><label>Roadmap name<input value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>Roadmap priority<select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div>
      <div className="form-row"><label>Optional capacity share %<input type="number" min="0" max="100" value={share} onChange={(e) => setShare(e.target.value)} placeholder="Leave blank for flexible allocation" /></label><label>Roadmap target date (optional)<input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label></div>
      <div className="info-box"><strong>Soft share, not a wall</strong><span>An urgent or deadline-protected task may borrow global capacity when its roadmap share is already full.</span></div>
      <textarea className="roadmap-input" value={source} onChange={(event) => { setSource(event.target.value); setAnalyzed(false); }} placeholder="Paste your roadmap here…" aria-label="Roadmap source text" />
      <div className="toolbar"><button className="button primary" onClick={() => setAnalyzed(true)} disabled={!source.trim()}>Analyze roadmap</button><button className="button secondary" onClick={saveRoadmap} disabled={!result?.structure.valid || !result.taskValidation.valid || saving}>{saving ? 'Approving…' : previousApproved ? 'Approve & use version' : 'Approve & use roadmap'}</button>{savedMessage && <span className="muted">{savedMessage}</span>}</div>
    </article>

    <div className="roadmap-grid"><article className="card"><div className="card-heading"><div><span className="eyebrow">Structure</span><h2>Analysis result</h2></div><span className={result?.structure.valid ? 'pill success-pill' : 'pill'}>{result ? (result.structure.valid ? 'Validated' : 'Needs review') : 'Not analyzed'}</span></div>{!result ? <div className="empty-state compact"><h3>Ready for analysis</h3><p>Headings, bullets, numbered outlines, indentation, and Unicode trees are supported.</p></div> : <div className="analysis-stack"><div className="analysis-metrics"><span><strong>{result.parsed.nodes.length}</strong> nodes</span><span><strong>{result.curriculum.concepts.length}</strong> concepts</span><span><strong>{result.curriculum.tasks.length}</strong> tasks</span><span><strong>{result.parsed.issues.length + result.taskValidation.issues.length}</strong> issues</span></div>{(result.parsed.issues.length + result.taskValidation.issues.length) > 0 && <div className="issue-list">{[...result.parsed.issues.map((i) => ({ code: i.code, message: i.message })), ...result.taskValidation.issues].map((issue, i) => <div key={`${issue.code}-${i}`} className="issue"><strong>{issue.code}</strong><span>{issue.message}</span></div>)}</div>}<div className="roadmap-tree">{result.parsed.nodes.map((node) => <div key={node.id} className="tree-row" style={{ paddingLeft: `${node.depth * 18}px` }}><span className="tree-marker">{node.depth === 0 ? '◆' : '└'}</span><span>{node.cleanedTitle}</span><small>{node.nodeType}</small></div>)}</div></div>}</article>
      <article className="card"><span className="eyebrow">Trust boundary</span><h2>What becomes schedulable</h2><div className="trust-chain"><span>Raw roadmap</span><b>→</b><span>Validated nodes</span><b>→</b><span>Compiled tasks</span><b>→</b><span>Global planner</span></div><p className="muted small-copy">Each roadmap keeps its own curriculum and history, but active roadmap work can compete in the shared planning pool.</p></article></div>

    {result?.structure.valid && result.taskValidation.valid && <article className="card roadmap-output"><div className="card-heading"><div><span className="eyebrow">Compiled learning work</span><h2>Generated tasks</h2></div><span className="pill">Ready for planner · v{Math.max(0, ...app.curriculumVersions.filter((v) => v.roadmapId === roadmapIdForDraft).map((v) => v.version), 0)}</span></div><div className="task-preview-grid">{result.curriculum.tasks.slice(0, 18).map((task) => <div key={task.id} className="task-preview"><span className="eyebrow">{task.type} · {task.estimatedMinutes} min · {task.difficulty}</span><strong>{task.title}</strong><span>{task.objective}</span><small>Done when: {task.completionCriteria}</small></div>)}</div></article>}
    {result?.structure.valid && result.taskValidation.valid && curriculumDiff && <article className="card curriculum-diff-card"><div className="card-heading"><div><span className="eyebrow">Version review</span><h2>Changes since v{previousApproved?.version}</h2></div><span className={curriculumDiff.added.length || curriculumDiff.removed.length || curriculumDiff.changed.length ? 'pill warning' : 'pill success-pill'}>{curriculumDiff.added.length + curriculumDiff.removed.length + curriculumDiff.changed.length ? `${curriculumDiff.added.length + curriculumDiff.removed.length + curriculumDiff.changed.length} change(s)` : 'No changes'}</span></div><div className="analysis-metrics"><span><strong>+{curriculumDiff.added.length}</strong> added</span><span><strong>−{curriculumDiff.removed.length}</strong> removed</span><span><strong>~{curriculumDiff.changed.length}</strong> changed</span><span><strong>{curriculumDiff.unchangedConcepts + curriculumDiff.unchangedTasks}</strong> unchanged</span></div>{curriculumDiff.added.length + curriculumDiff.removed.length + curriculumDiff.changed.length > 0 ? <div className="diff-list">{[...curriculumDiff.added, ...curriculumDiff.changed, ...curriculumDiff.removed].slice(0, 20).map((item, index) => <div key={`${item.kind}-${item.id}-${index}`} className={`diff-item ${item.kind}`}><span className="pill">{item.kind}</span><div><strong>{item.title}</strong><span>{item.entity} · {item.detail}</span></div></div>)}</div> : <p className="muted small-copy">The proposed curriculum matches the latest approved version. Approving it again will create a new version only when you explicitly save.</p>}</article>}
  </section>;
}
