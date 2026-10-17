# Arena Security Run Plan — My Adaptive Routine

**Target:** `https://github.com/hkadam888555888/androidapp`  
**Baseline:** `main` at `f812973aca63ca7401ef1b3e8db204193bcc3444`  
**Candidate branch:** `security/arena-worker-001-ci-guardrails`  
**Run date:** 2026-10-17  
**Current verdict:** `NOT GRADED` — this is an initial scoped review, not a complete audit or release approval.

## Authorization and safe scope

The repository owner requested security testing of this project. This run is limited to its source, GitHub workflow/configuration and available CI evidence. No production endpoint, external target, real user data, destructive operation, brute force, load flood, or deployment is in scope. Findings and code changes stay on a non-default branch and go through human review. Do not merge, release, or deploy automatically.

The project source is a React/Vite PWA. The Android workflow creates a Capacitor Android project during CI and builds a debug APK; a native Android project is not checked into the current source tree. Android-manifest, signing, native lifecycle, and physical-device checks remain separate work items.

## Rules for every worker

1. Read the shared [Security by Design Playbook](https://github.com/hkadam888555888/ai-conversation-hub/blob/feat/security-by-design-knowledge/tests/security/SECURITY_BY_DESIGN_PLAYBOOK.md), this run plan, the Hub checklist, and all existing findings before starting.
2. Work only on the assigned focus for the worker, but also try safe bypass variations against previous fixes. Use source evidence, unit tests, CI, or controlled local/staging tests; never label a hypothesis as a reproduced issue.
3. For a confirmed issue, preserve a stable `SEC-###` ID, record evidence immediately in the central Hub checklist, create/update the product issue, add a negative regression test, patch on a dedicated branch, and record the exact commit/test results.
4. Use `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, or `NOT APPLICABLE` accurately. If a test did not execute, do not claim it passed. Never store secret values or personal data in reports.
5. The later independent retest must retry the original path and reasonable variants. A proposed fix is `FIXED—AWAITING RETEST), not closed.
6. Any unresolved confirmed Critical/High issue, failed mandatory check, missing evidence, or missing human approval prevents a READY decision.

## 100-run assignment ledger

Every status below means the worker's assigned checks have not run unless an evidence link is explicitly recorded. Workers 002–100 are not simulated or counted as completed. Each later worker must revisit earlier fixes as well as its new focus.

| Worker | Assigned primary focus | Status |
|---:|---|---|
| 001 | CI/CD permissions, direct-to-main writes, workflow dispatch and review bypass | **Candidate Verify PASS; APK job FAIL at temporary Capacitor install; independent retest pending** — [SEC-001](findings/SEC-001-CI-WORKFLOW-DIRECT-PUSH.md) |
| 002 | Secrets accidentally committed in current tracked files | NOT RUN |
| 003 | Secret exposure in Git history and old blobs | NOT RUN |
| 004 | Secrets or private configuration embedded in public JS/CSS bundles | NOT RUN |
| 005 | Lockfile presence, integrity and dependency graph reproducibility | NOT RUN |
| 006 | Dependency vulnerability scanning and unsupported dependency versions | NOT RUN |
| 007 | Third-party GitHub Actions pinning and supply-chain risks | NOT RUN |
| 008 | Workflow triggers and trust boundaries for push, PR, dispatch and fork events | NOT RUN |
| 009 | Workflow token permissions, environment secrets and privilege escalation paths | NOT RUN |
| 010 | APK artifact contents, upload visibility, retention and accidental signing material | NOT RUN |
| 011 | Content Security Policy completeness and limits of meta-delivered CSP | NOT RUN |
| 012 | Script execution, unsafe inline code and CSP regressions | NOT RUN |
| 013 | React raw HTML sinks and cross-site scripting paths | NOT RUN |
| 014 | Unsafe redirects, navigation targets and external URL handling | NOT RUN |
| 015 | Untrusted links, new-window behavior and opener/referrer leakage | NOT RUN |
| 016 | Referrer policy and privacy-relevant response metadata | NOT RUN |
| 017 | Framing/clickjacking risks for destructive UI actions | NOT RUN |
| 018 | Same-origin and cross-origin browser request assumptions | NOT RUN |
| 019 | Service-worker cache boundaries for user data and responses | NOT RUN |
| 020 | Service-worker install, update, stale shell and cache-poisoning behavior | NOT RUN |
| 021 | IndexedDB schema upgrades and recovery from interrupted migrations | NOT RUN |
| 022 | Oversized or adversarial backup-file parsing | NOT RUN |
| 023 | Required-store and schema-version validation for imports | NOT RUN |
| 024 | Prototype-sensitive keys and object-shape attacks in backups | NOT RUN |
| 025 | Deeply nested input and validation resource-exhaustion bounds | NOT RUN |
| 026 | Duplicate identifiers and conflicting imported rows | NOT RUN |
| 027 | Broken or cross-record references in imported data | NOT RUN |
| 028 | Enum, number, string, date and cross-field backup validation | NOT RUN |
| 029 | Atomicity and rollback when backup restore fails halfway | NOT RUN |
| 030 | User confirmation and integrity around destructive restore | NOT RUN |
| 031 | Exported backup privacy, filename handling and unintended sharing | NOT RUN |
| 032 | Delete-all behavior across IndexedDB, caches and persisted settings | NOT RUN |
| 033 | Audit record contents, tampering and sensitive-data leakage | NOT RUN |
| 034 | AI-artifact retention and private roadmap/progress exposure | NOT RUN |
| 035 | AI settings sanitized on load, import and persistence | NOT RUN |
| 036 | Provider selection fallback and invalid-configuration handling | NOT RUN |
| 037 | Local model endpoint allowlisting and loopback-only boundary | NOT RUN |
| 038 | URL parser edge cases, IPv6 loopback and hostname normalization | NOT RUN |
| 039 | Endpoint schemes, embedded credentials, fragments, query tokens and ports | NOT RUN |
| 040 | CSP connect-src and allowed loopback origins/ports | NOT RUN |
| 041 | Fetch credential, redirect and response-origin behavior | NOT RUN |
| 042 | Local model timeouts, cancellation and failure cleanup | NOT RUN |
| 043 | Excessively large local-model responses and memory pressure | NOT RUN |
| 044 | Malformed or unexpected JSON returned by the model | NOT RUN |
| 045 | AI-generated output rendering and HTML/script safety | NOT RUN |
| 046 | Prompt-injection text placed in roadmap titles or source material | NOT RUN |
| 047 | Instruction-like model output and unsupported external links | NOT RUN |
| 048 | AI schema validation and attempts to modify authoritative task state | NOT RUN |
| 049 | Unknown task IDs and invalid dependency suggestions | NOT RUN |
| 050 | Dependency graph cycles, self-links and planner integrity | NOT RUN |
| 051 | Task reporting validates inputs and preserves completion semantics | NOT RUN |
| 052 | Illegal or repeated terminal-state transitions | NOT RUN |
| 053 | Duplicate report submission and replay-like user actions | NOT RUN |
| 054 | Concurrent updates across two tabs and IndexedDB transaction races | NOT RUN |
| 055 | Calendar validation, timezone changes and daylight-saving boundaries | NOT RUN |
| 056 | Notification schedule validation and invalid timestamps | NOT RUN |
| 057 | Planner capacity, deadline and priority constraints | NOT RUN |
| 058 | Habit minimum/target rules, recurring schedules and log validation | NOT RUN |
| 059 | Explicit complete/skip behavior and unintended state mutation | NOT RUN |
| 060 | Notification permission denial, constructor exceptions and status accuracy | NOT RUN |
| 061 | Error-boundary messages and sensitive technical-detail exposure | NOT RUN |
| 062 | Console messages, diagnostic views and log redaction | NOT RUN |
| 063 | Browser origin boundary for local IndexedDB data | NOT RUN |
| 064 | Personal data in backups, screenshots and user-shared diagnostics | NOT RUN |
| 065 | Authentication/backend applicability; verify no server-side trust is assumed | NOT RUN |
| 066 | Storage quota limits and oversized user-controlled records | NOT RUN |
| 067 | Roadmap parser robustness against malformed or unusually large input | NOT RUN |
| 068 | Unicode control characters, bidi text and normalization edge cases | NOT RUN |
| 069 | Markdown/text presentation and any unsafe rendering conversions | NOT RUN |
| 070 | Attribute, CSS and URL-context injection paths | NOT RUN |
| 071 | Dependency lifecycle scripts and install-time code execution | NOT RUN |
| 072 | Unneeded direct dependencies and exposed attack surface | NOT RUN |
| 073 | Clean-checkout `npm ci` and lockfile consistency | NOT RUN |
| 074 | Release documentation accuracy against actual repository/CI evidence | NOT RUN |
| 075 | Build-time environment variables exposed in client artifacts | NOT RUN |
| 076 | Production source maps and unintended source disclosure | NOT RUN |
| 077 | Action version pinning and runner/runtime deprecation warnings | NOT RUN |
| 078 | Capacitor dependency version range and non-locked Android build inputs | NOT RUN |
| 079 | Gradle wrapper, Android toolchain and generated-project supply chain | NOT RUN |
| 080 | Generated Android manifest exported components and component permissions | NOT RUN |
| 081 | Android cleartext traffic and network security policy | NOT RUN |
| 082 | App-signing keys, keystore passwords and release signing workflow | NOT RUN |
| 083 | Android backup rules and extraction of locally stored data | NOT RUN |
| 084 | Capacitor WebView origin, JavaScript and file-access settings | NOT RUN |
| 085 | Deep links, intents and untrusted external app input | NOT RUN |
| 086 | Target SDK, native permissions and platform-specific behavior | NOT RUN |
| 087 | Screen privacy and exposure of personal routine/progress details | NOT RUN |
| 088 | Background/closed-app behavior and accuracy of notification promises | NOT RUN |
| 089 | API-key entry/storage surfaces; confirm the app never asks for cloud secrets | NOT RUN |
| 090 | Local model server CORS and browser-to-loopback trust assumptions | NOT RUN |
| 091 | Debug APK artifact access, retention and release-candidate integrity | NOT RUN |
| 092 | Branch protection/ruleset status and alternate direct-write paths | NOT RUN |
| 093 | Fork pull-request isolation and untrusted contribution boundaries | NOT RUN |
| 094 | Dependabot/security advisory and update-policy coverage | NOT RUN |
| 095 | Secret scanning and push-protection settings | NOT RUN |
| 096 | Public repository contents versus private user data and configuration | NOT RUN |
| 097 | CI logs, artifacts and failure output redaction | NOT RUN |
| 098 | Independent retest of SEC-001, plus bypass attempts and regression check | NOT RUN |
| 099 | Full candidate suite: source audit, lint, unit tests, build and E2E where available | NOT RUN |
| 100 | Final residual-risk review, evidence completeness and human-owned GO/NO-GO | NOT RUN |

## Initial CI evidence observed

The main-branch Verify run [37968141061](https://github.com/hkadam888555888/androidapp/actions/runs/37968141061) completed source audit and `npm ci`, but failed at lint with 10 errors and 1 warning; unit tests and production build were skipped. Its install output reported 0 dependency vulnerabilities. The Android APK workflow [37970479906](https://github.com/hkadam888555888/androidapp/actions/runs/37970479906) succeeded for the same baseline SHA. These are historical main-branch results, not evidence for the proposed fix branch. Candidate PR #3 run [39012583195](https://github.com/hkadam888555888/androidapp/actions/runs/39012583195) passed all 17 source-audit checks, lint with 0 errors and 1 warning, all 96 Vitest tests across 23 files, and the production web build plus bundle-size gates at candidate head `6996bcf852a2a3193bd6ae8e079dd554cc77fc7b`. The separate Android APK run [39012583171](https://github.com/hkadam888555888/androidapp/actions/runs/39012583171) failed while installing temporary Capacitor packages with `Cannot read properties of null (reading 'edgesOut')`; Android generation and APK assembly were skipped. These are candidate test results; the APK artifact was not produced.

**Current gate:** NOT GRADED. The candidate Verify workflow passed, but the Android APK job failed at the temporary Capacitor dependency-install step, so no APK was produced. SEC-001 remains FIXED—AWAITING RETEST until Worker 098 independently challenges the direct-write path on the reviewed candidate. Workers 002–100 remain NOT RUN. The `main` branch is still reported unprotected; the owner must separately configure required pull requests/reviews and status checks.
