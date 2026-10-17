# Zero-Friction User Experience & Roadmap Intelligence Architecture

**Status:** Architecture proposal  
**Scope:** My Adaptive Routine  
**Decision principle:** The user gets a useful routine; the app owns import, interpretation, validation, recovery, scheduling, persistence, and testing.

## 1. Product promise

A person who has never used a planning or AI app should be able to open My Adaptive Routine, import a plain-text learning roadmap, and start a usable daily plan without configuring a model, choosing a parsing method, manually creating tasks, or completing a technical checklist.

The app must automate routine work without hiding meaningful uncertainty. Ask the user only when an important decision cannot be inferred safely. Uncertain non-critical content must be preserved and available for optional review rather than silently discarded or used to block the plan.

This is a target architecture, not a claim that every proposed component is already implemented or that import accuracy has been proven.

## 2. User experience contract

### First use

1. The home screen presents one primary action: **Add my roadmap**.
2. The user chooses a TXT file, pastes text, or tries a sample. No formatting tutorial, account, AI setting, or upfront configuration wizard is required.
3. The app prepares the plan and, if work takes long enough to notice, shows simple progress: “Reading your roadmap”, “Organizing topics”, and “Checking the plan”.
4. The result screen shows a short summary and one primary action: **Start today**.
5. The user lands on a focused Today screen with the next task, a time estimate, and obvious Done and Skip actions.

A sensible default should make planning possible even when users provide no preferences. Initial proposal: 30 minutes per learning day and one flexible day each week. Show this as an editable default, not a mandatory setup question.

### Everyday use

- Keep primary navigation small: **Today**, **Roadmap**, and **Progress**. Secondary options live under More or Settings.
- Tasks use plain language and one obvious next action.
- Completing a task persists progress immediately.
- Missing a day must not create a wall of overdue tasks, shame the user, or break the app. The scheduler redistributes work automatically.
- Users may undo a mistaken completion or edit tasks later, but neither should be required for a usable routine.
- Notifications, calendar permissions, account creation, cloud sync, and sharing are optional. Do not request permissions before the user has experienced value.
- Never mark a task complete without an explicit user action.

### Errors and uncertainty

- Never expose stack traces, schema errors, model jargon, or blank screens.
- Recover automatically when possible. Otherwise offer one clear remedy: **Try again**, **Paste the text instead**, or **Keep what was imported**.
- Preserve unclear sections and continue processing the rest of the roadmap.
- Keep uncertain content in an optional review area. Do not block the plan unless the ambiguity is essential to its correctness.
- Retain the original text and a recoverable draft until the generated plan has been saved successfully or the user explicitly discards it.

## 3. Target architecture

The existing repository already has TypeScript/React/Vite, Zod validation, IndexedDB persistence, application and domain layers, and roadmap/planner/task feature areas. Extend these boundaries incrementally; do not replace the stack or create parallel stores.

User interface → application use cases → text input adapter → normalization and segmentation → hierarchy extraction and specialized ML adapter → canonical roadmap representation → task compiler → prerequisite graph → coverage and safety validation → bounded automatic repair if needed → adaptive scheduler → IndexedDB repositories → Today/Roadmap/Progress.

The fallback path must allow the deterministic parser to continue when the model is absent, slow, or fails. The UI should not need to know which path was used.

### Layer responsibilities

| Layer | Responsibility | User should configure it? |
|---|---|---|
| UI and feature screens | Import, progress, Today, Roadmap, task actions, accessible errors | No technical configuration |
| Application use cases | Coordinate import, generation, completion, undo, restore, and replanning | No |
| Input adapters | Read a TXT file or pasted text safely | No |
| Roadmap extraction | Identify sections, topics, subtopics, exercises, projects, goals, and prerequisites | No |
| ML adapter | Return structured predictions with confidence and version metadata | No |
| Deterministic fallback | Handle common outline styles without model inference | No |
| Task compiler | Produce actionable tasks with observable completion criteria | No |
| Validator and coverage ledger | Check completeness, provenance, duplicates, dependencies, and unsupported additions | No |
| Scheduler | Fit tasks into time and rebalance completed, skipped, or busy days | No |
| Data repositories | Persist source, plans, preferences, events, and revisions locally | No |
| CI and evaluation | Test correctness, usability, accessibility, responsiveness, and model quality | Never |

## 4. Roadmap-to-task pipeline

### Stage A — Safe input and source preservation

Accept a TXT file or pasted text. Handle empty files, repeated imports, unusual line endings, long files, and malformed sections defensively. Keep an immutable snapshot of the imported text, checksum, import timestamp, and draft status. Never overwrite an existing roadmap merely because another file has the same name.

### Stage B — Normalize without destroying meaning

Normalize line endings and harmless whitespace while preserving meaningful indentation, numbering, bullets, original phrases, and source positions. Do not aggressively rewrite subject-specific terms or silently discard text.

### Stage C — Build a canonical roadmap representation

Every extracted node should have a stable ID, parent ID, type, original source phrase, normalized title, source span or line range, confidence, extraction origin, child order, and dependency edges.

Node types should include section, topic, subtopic, exercise, project, learning goal, note, and unresolved text. Reuse existing domain entities and database conventions where possible; do not add duplicate types without inspecting current definitions.

Every generated task must trace back to one or more source nodes. Task instructions generated by the model must be distinguishable from statements that appeared in the user's roadmap.

### Stage D — Specialized machine-learning model

Use a compact, specialized model to recognize meaning and structure across differently formatted roadmaps. It can classify text segments, recover hierarchy where numbering is inconsistent, identify goals/exercises/projects, suggest prerequisite links, and help write task instructions and completion criteria.

The model must return constrained structured fields, not an unrestricted essay. A model prediction is not trusted until it passes schema and domain validation.

Train using labelled examples of varied roadmaps paired with verified structured outputs. Split evaluation data by original roadmap, not individual lines, to prevent near-duplicate leakage. Keep a version, model card, limitations, and measured evaluation results for every candidate.

**Runtime strategy:** prioritize on-device inference and privacy. Keep the model asset separate from the initial JavaScript bundle; load a versioned compact model only through a compatible runtime. Choose a format only after measuring model size, download size, cold start, Android memory, latency, and accuracy on target hardware. If the model cannot be loaded or downloaded, continue with a deterministic parser rather than failing. Core roadmap processing should not require paid API keys or mandatory cloud inference.

The deterministic fallback is not presented as equally intelligent as a trained model. Its job is to preserve structure for common outlines and keep the app useful when ML is unavailable.

### Stage E — Task compiler

Create actionable task templates based on each node's type:

- Concept: understand the idea, inspect an example, explain it in one's own words.
- Coding skill: run an example, modify it, solve a small exercise, verify output.
- Exercise: attempt the stated exercise and record the result.
- Project: break a large outcome into meaningful, ordered milestones.
- Review topic: retrieve previously learned material and check understanding.

Tasks should be small enough to schedule and contain a clear completion criterion. The compiler can suggest a useful activity, but must not imply that inferred details were explicitly written in the roadmap.

### Stage F — Dependency graph

Use explicit source order and clear prerequisite wording first. Infer additional dependencies only when evidence supports them. Detect cycles, self-dependencies, duplicate nodes, and invalid references. If ordering is uncertain, preserve the source order rather than invent a complex graph.

### Stage G — Coverage ledger, validation, and automatic repair

For every meaningful source span, record whether it was:
- mapped to one or more roadmap nodes and tasks;
- preserved as a non-task note;
- preserved as unresolved text for optional review; or
- treated as repeated boilerplate by an explainable rule.

Validate schema fields, source coverage, node-to-task coverage, duplicate tasks, dependency references, dependency cycles, plausible time estimates, unsupported topics without provenance, vague tasks, and import idempotency.

If validation fails, attempt a small bounded number of targeted repair passes (for example, two). Never retry indefinitely. If an issue remains, preserve the source span and create a clearly labelled safe fallback when possible. Only the affected section should be flagged; do not discard or block the rest of a valid roadmap.

Confidence is per segment, not one misleading score for the whole roadmap. Low confidence means preserve, fallback, or optional review—not fabricated certainty.

## 5. Adaptive routine engine

The scheduler should be deterministic and independently testable. ML can suggest difficulty or activity type; it must not control completion state or silently rewrite progress.

Inputs include ordered tasks, prerequisites, duration estimates, optional availability and preferred days, completion/skip/undo events, the current date, optional deadlines, and a busy-day signal.

Rules:
- Use transparent defaults when availability is not provided.
- Prioritize prerequisites and the next useful task.
- Never schedule a dependent task before its required prerequisite unless the dependency is explicitly optional.
- Recompute future work after completion, skip, a busy day, or changed availability.
- Spread unfinished work forward rather than accumulating a large overdue pile.
- Preserve completed history and user choices during replanning.
- Do not punish a missed day or infer completion.
- Save replans as new revisions so the previous plan can be recovered if persistence fails.
- If a deadline is unrealistic, explain it simply and suggest a feasible adjustment rather than secretly increasing the user's time budget.

## 6. Storage, privacy, and recovery

Reuse the existing IndexedDB/data-repository layer and schema migration discipline. Core usage should not require an account or a server.

Persist the original roadmap text and checksum, parsed representation, extraction metadata, current plan and revision, task completion/skip/undo events, user preferences, and model version metadata.

Save a newly generated plan using a transaction where supported or a draft/commit pattern. An interrupted generation must not leave half a plan as the active routine. Stable IDs and idempotency checks prevent duplicate tasks after retries. Validate restored data before it replaces live state.

Do not transmit roadmap contents for inference, analytics, or debugging by default. Avoid putting source text in crash logs. Any future sync or external processing must be an explicit opt-in with a plain-language privacy explanation. Downloading a model asset is separate from transmitting the user's roadmap.

## 7. Fit with the current repository

The current codebase contains application services, domain AI/engine areas, feature folders for roadmap/planner/tasks, Zod validation, and IndexedDB persistence. Potential additions, to be aligned with existing names after inspecting each relevant file:

- Roadmap feature UI: file picker, paste input, simple progress, success summary, optional unresolved-content review.
- Application import service: draft lifecycle and pipeline orchestration.
- Domain model adapter: a versioned interface for structured model predictions.
- Roadmap extraction pipeline: normalization, hierarchy extraction, task compilation, and bounded repair.
- Coverage validator: provenance, completeness, duplicate checks, and graph integrity.
- Routine re-planner: deterministic adaptive rescheduling use case.
- Roadmap repository: persist source, intermediate representation, plan revisions, and metadata through existing database abstractions.
- Roadmap fixtures: diverse anonymized inputs and expected structured outputs.

These names are boundaries to consider, not an instruction to duplicate an existing service or bypass the current app store. Inspect current files before coding and integrate incrementally.

## 8. Automated quality, not user-run checks

The user should not become the app's QA team. CI and developer tooling should automatically run:

- Type checking and lint;
- unit tests for parsing, coverage, dependencies, validation, scheduling, storage, and recovery;
- property/fuzz tests for malformed and unusually long text;
- regression fixtures for previously failed imports;
- held-out model evaluation;
- end-to-end import-to-first-task, completion, skip, undo, and replan journeys;
- reload, migration, backup/restore, and interrupted-generation checks;
- keyboard, screen-reader labelling, contrast, touch-target, and responsive checks;
- browser and Android-compatible runtime checks;
- performance, storage, bundle, and model-memory budgets.

Mandatory release checks should block a release when they fail. Never ask an ordinary user to run the checks.

### Proposed release gates

- 100% schema validity for accepted generated plans.
- 100% accounting for meaningful source spans in the held-out test set: mapped, explicitly classified as non-task content, or preserved for review.
- No loss of imported source text through retries, edits, or recovery.
- No invalid dependency cycles in accepted plans.
- No automatic task completion or lost event history after replanning.
- Measured and published quality, hallucination, import-time, memory, and accessibility results before declaring the model ready.

These are acceptance criteria to verify, not results already achieved.

## 9. Incremental delivery plan

### Phase A — Simplify the user path
Build the one-action import screen, TXT/paste adapter, understandable progress, recoverable drafts, one success summary, and Start today. Keep current plan/task persistence intact.

### Phase B — Make extraction reliable
Define/reuse the canonical roadmap schema and provenance ledger. Add deterministic outline parsing, diverse fixtures, coverage validation, duplicate prevention, bounded recovery, and regression tests.

### Phase C — Add the specialized model
Label a varied training/evaluation dataset. Benchmark compact on-device candidates against unseen roadmaps and target Android hardware. Integrate only behind the model adapter and preserve the fallback. Measure size, cold start, RAM, latency, coverage, and failure modes.

### Phase D — Automate daily adaptation
Connect validated tasks to the existing scheduler. Automatically rebalance completed, skipped, and busy days while preserving history and undo.

### Phase E — Prove the complete experience
Test empty, malformed, long, and repeated imports; offline operation; interrupted generation; restore; small screens; assistive technology; and everyday task actions. Fix release-blocking failures before labelling the version ready. Documentation alone is not implementation evidence.

## 10. Acceptance journey

A non-technical first-time user can open the app without an account or setup wizard, import a roadmap without changing its format, wait while the app processes and checks it, start a usable task without manually reviewing every generated item, track completion with one clear action, return the next day to a sensible updated routine, and recover from a confusing section without losing the rest of the roadmap.

**North star:** one simple user action in; a useful, validated, adaptable routine out. The app owns the complexity, and only genuinely necessary choices reach the user.
