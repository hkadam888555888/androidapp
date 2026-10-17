# Specialized Roadmap-to-Tasks AI — Production Specification

**Product:** My Adaptive Routine  
**Single responsibility:** Convert plain-text learning roadmaps into structured, source-grounded, actionable learning tasks.  
**Status:** Proposed specification; not yet implemented, trained, or production-certified.

## 1. Non-negotiable scope

This AI has one job only: roadmap text in, structured learning plan out.

It is not a general chatbot, tutor, calendar assistant, code generator, or completion tracker. The deterministic scheduler owns scheduling; explicit user actions own task completion.

Initial supported input: UTF-8 plain-text TXT files and pasted text. The system should handle headings, nested bullets, numbered outlines, mixed indentation, long roadmaps, imperfect grammar, and partly malformed sections. Uncertain spans must be preserved, not silently discarded.

## 2. Production design: model inside a verified pipeline

1. **Input guard:** apply reasonable size and processing limits; preserve exact source text and checksum.
2. **Normalization:** normalize harmless whitespace without losing meaningful indentation, order, numbering, or source offsets.
3. **Segmentation:** identify headings, list items, topic boundaries, exercises, projects, and hierarchy.
4. **Specialized model:** predict structured roadmap nodes, relationships, task candidates, and confidence.
5. **Schema and domain validation:** reject malformed output and validate source spans, IDs, types, relationships, and allowed fields.
6. **Task compiler:** create concise actionable tasks with measurable completion criteria and source provenance.
7. **Coverage validator:** account for every meaningful source span; detect omissions, duplicates, unsupported additions, invalid references, dependency cycles, and vague tasks.
8. **Bounded repair:** run a small fixed number of targeted repair attempts; never retry indefinitely.
9. **Safe fallback:** preserve uncertain text and create a clearly labelled review item where possible. Keep valid sections usable.
10. **Versioned output:** return structured JSON validated against the app schema; the UI and scheduler must never parse free-form model prose.

The model proposes an interpretation. The verifier decides whether it is acceptable.

## 3. Output contract

Reuse existing domain types wherever possible. Every roadmap node should retain a stable ID, parent ID, kind, original source text, normalized label, source offsets or line range, extraction origin, confidence, model/pipeline version, child order, dependency references, and linked task IDs.

Node kinds: section, topic, subtopic, exercise, project, goal, note, unresolved.

Every task should contain a stable ID, title, plain-language instructions, task kind, completion criterion, source node IDs, estimated duration or range, supported prerequisite IDs, origin (source-derived or generated guidance), and validation status.

Do not present inferred suggestions as if they appeared in the original roadmap. Do not invent mandatory topics, deadlines, or prerequisites without evidence. Schema changes must be versioned and migration-tested.

## 4. Model strategy

Do not start by training a large model from scratch. First build a deterministic baseline and a trusted evaluation set. Then benchmark compact pretrained candidates adapted for structured extraction and task generation.

Compare:
- **Hierarchical extraction:** compact encoder for segment/node classification plus deterministic hierarchy reconstruction.
- **Compact text-to-structure model:** small pretrained text-to-text model fine-tuned to emit the canonical structure.
- **Hybrid candidate:** encoder-based classification plus a compact generation component for task wording.

Choose the smallest approach that meets measured quality and target-device constraints. These are candidates, not assumptions. Benchmark on the intended Android runtime and development laptop. Keep the model behind a versioned adapter so it can be replaced without rewriting the UI or scheduler.

Prefer offline/on-device inference for roadmap privacy. Keep model assets separate from the initial JavaScript bundle. Choose runtime and quantization only after measuring asset size, cold start, RAM, latency, battery/storage impact, and accuracy. If the model cannot load, continue with a deterministic fallback. Core processing must not require paid API keys or sending roadmap text to a third party.

## 5. Training data and leakage prevention

Create a documented, appropriately licensed dataset of varied roadmaps paired with human-verified structures and tasks. Include clean outlines, inconsistent indentation, mixed list styles, technical and non-technical subjects, exercises, projects, explicit prerequisites, long files, repeated content, vague sections, incomplete endings, misleading formatting, boilerplate, and empty/malformed inputs.

Annotators mark source spans, hierarchy, node kind, task links, inferred fields, and unresolved spans. Define annotation guidance and resolve disagreements before marking examples as gold data.

Split by original roadmap/source, author, or template where possible—not by individual line—to prevent near-duplicate leakage. Keep a frozen held-out set that is not used for training, rule tuning, or model selection. Record data provenance and permissions. Do not train on private user roadmaps without separate, informed consent.

## 6. Evaluation protocol

Evaluate the complete pipeline, not just training loss.

Required metrics:
- Source-span accounting/coverage and omission rate
- Hierarchy and parent-child relation precision, recall, and F1
- Node-kind classification quality
- Task-to-source traceability
- Duplicate task rate
- Unsupported-topic and hallucinated-requirement rate
- Task actionability and completion-criterion quality, using a defined human-review rubric
- Dependency quality and cycle rate
- Schema validity
- Safe handling of uncertain or malformed input
- Repeatability for the same version and input
- Import latency, peak memory, model asset size, cold start, and battery/storage impact on target devices

Report results overall and by input difficulty/format. Automated string similarity alone cannot prove usefulness. Evaluate on unseen roadmaps and keep every discovered failure in a regression suite.

## 7. Proposed release gates

These are requirements to measure, not claims of current performance:

- 100% schema validity for plans accepted by the app.
- 100% meaningful-source-span accounting in the release test corpus: mapped to a node/task, explicitly classified as non-task content, or preserved as unresolved.
- Zero silent source-text loss during import, repair, retry, persistence, and restore tests.
- Zero invalid dependency cycles in accepted output.
- Zero duplicate tasks caused by retrying the same import.
- Zero automatic task completion.
- Zero roadmap-text network transmission in offline/local mode.
- No release-blocking crash, data loss, or security defect in supported flows.
- Numeric thresholds for semantic quality, omission, hallucination, latency, and peak memory must be chosen after measuring a baseline and documented with evidence before release.

100% schema validity does not mean 100% semantic accuracy. Semantic quality must be measured separately.

## 8. Reliability, privacy, and versioning

Keep the source immutable and checksummed. Make imports idempotent and plan generation recoverable after interruption. Validate output before committing it to the active plan. Preserve plan revisions and task history during updates. Do not transmit roadmap text in crash logs or analytics by default. Version the model, tokenizer, preprocessing, output schema, task compiler, dataset, and evaluation together. Add migration tests for schema changes. Roll back a model release if regression gates fail; retain a known-good version/fallback. Use synthetic fixtures for CI and avoid logging raw roadmaps.

## 9. Implementation sequence

**Phase 1 — Contract and baseline:** inspect current domain models/services, define or reuse a canonical output contract, build deterministic parsing fixtures, and measure failure modes.

**Phase 2 — Validator first:** implement provenance, coverage, schema validation, duplicate/dependency checks, bounded repair, and safe partial failure. This gives every model a safety boundary.

**Phase 3 — Dataset and benchmark:** create documented gold examples, annotation guidance, frozen holdout data, and automated evaluation.

**Phase 4 — Model comparison:** benchmark compact candidates against the baseline. Select on semantic quality, reliability, target-device feasibility, license, and offline privacy—not parameter count or hype.

**Phase 5 — Integration:** connect through an adapter to the existing application/domain/data layers. Keep scheduling and completion logic deterministic.

**Phase 6 — Production hardening:** regression, fuzz, end-to-end, interrupted-storage, offline, low-memory, accessibility, Android-runtime, and performance tests. Stage releases and retain a fallback.

## 10. Definition of done

The AI is ready for production consideration only when it:
1. Solves the defined task on held-out roadmaps with documented results.
2. Preserves source text and accounts for every meaningful section.
3. Produces valid, traceable, actionable tasks or safely flags uncertainty.
4. Runs within an agreed mobile resource budget or has a documented supported fallback.
5. Does not require paid APIs or transmit roadmap content in local mode.
6. Passes mandatory app, persistence, privacy, accessibility, and regression gates.
7. Has reproducible model/data versions, a model card, known limitations, and a rollback path.

**Production-grade means evidence-backed reliability and safe failure—not simply a large model or a successful demo.**


## 11. Pet-style AI companion — interaction layer, not a second AI mission

### Goal

Offer an optional, expressive creature companion that makes daily progress updates feel friendly and approachable. Think “desktop-pet charm” adapted for a mobile routine app: a small animated character on the Today screen, with a compact/minimizable presence where the platform supports it. This is a UX feature, not a reason to turn the specialized roadmap model into a general chatbot.

### User-controlled task updates

Users must always retain the direct task controls. The pet provides an equally understandable alternate route:

1. It may ask about the current task, for example, “Did you finish this one today?”
2. It presents task-specific **Done**, **Not yet**, **Skip**, and **Change today's plan** actions.
3. A deliberate tap or unambiguous, deliberate text/voice instruction is routed to an existing typed application use case.
4. If the target task or intent is ambiguous, the pet asks one brief clarification and changes nothing until resolved.
5. The same task event, persistence, re-planning, and undo rules apply regardless of whether the update came from the normal UI or the pet. Preserve an event source such as `manual` or `pet` for diagnostics and history where appropriate.

The pet must not auto-complete or skip tasks based on elapsed time, inactivity, app usage, sentiment, opening a task, guessed intent, or calendar inference. A supportive reminder is not evidence of completion. Never use guilt, shame, or manipulative streak pressure.

### Architecture boundary

The pet is a presentation and interaction adapter around existing application use cases. It is not a separate planner or persistence store. Its progress summaries read saved app state; its buttons and resolved commands call the same validated task-result and rescheduling flows as the standard UI.

The dedicated roadmap model remains narrowly scoped to converting plain-text roadmaps into structured tasks. Do not use it as an unrestricted companion/chat model. Prefer deterministic contextual prompts and typed intents. If a separate speech recognizer or intent component is added later, it must return a supported intent plus a verified task reference; invalid or uncertain results must not mutate task state.

### Comfort, accessibility, and platform behavior

- The pet is optional and can be hidden in settings without affecting any core feature.
- Do not require Android overlay permission or a persistent background service for the default in-app pet.
- Do not keep the microphone listening in the background. Voice use must be an explicit opt-in interaction with a visible activation state.
- Support reduced motion, sound-off, screen readers, text scaling, sufficient contrast, large touch targets, and small displays.
- Keep the character away from critical controls and never force animation or dialogue before a user can update a task.
- Avoid external network transmission of roadmap content or private task notes by default.

### Required tests

Verify manual and pet updates result in equivalent state; the intended task is always targeted; ambiguous commands make no change; duplicate actions are idempotent or safely prevented; undo, restart, and replanning preserve history; voice denial and disabled-voice paths work; reduced-motion and no-sound settings are respected; assistive technology can operate every action; and the pet can be hidden while the app remains fully usable.

**Release rule:** the pet is an optional enhancement. It must never weaken explicit user consent, privacy, deterministic scheduling, or task-history integrity.
