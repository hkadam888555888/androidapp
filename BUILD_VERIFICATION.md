# v1.0.5 Build Verification and Release Gate

**Result: NOT RELEASE-READY.** This is an improved source candidate, not a verified production build or Android release.

> **Scope note (2026-10-31):** The environment and check results in the historical sections below describe earlier snapshots, not a live verification of every later commit. The consolidated candidate is `product/complete-first-run-2026-10-30` (PR #11). Its web dependencies are locked in `package-lock.json` (lockfile v3). The Android APK workflow now pins Node `22.16.0` and direct Capacitor packages `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android` to `8.5.2`; `@capacitor/local-notifications` remains locked at `8.3.1`. The workflow checks those direct versions and uploads `npm ls --all --json` output with the APK. The Android project is still generated during CI, and the resolved transitive native dependency graph is recorded per run rather than committed as a second lockfile.

## Historical environment snapshot (earlier offline source archive)

- Node: `v22.16.0`
- npm: `10.9.2`
- Globally available TypeScript: `5.8.3` (the project pins TypeScript `6.0.3`)
- Project `node_modules`: absent
- `package-lock.json`: absent
- npm registry access: unavailable during prior install attempts (timeout / `EAI_AGAIN` DNS error)
- Playwright browser binaries: unavailable

## Historical checks that passed on that snapshot

- `node scripts/source-audit.mjs`: **PASS — 16 checks**, plus one explicit warning because `package-lock.json` is absent.
- Dependency-free compatibility runner: **PASS — 96 tests passed, 0 failed**. This runner uses a small shim to execute eligible existing test bodies; it is *not* the official Vitest runner and is supplementary evidence only.
- Strict TypeScript check of the selected pure domain/date/plan-instance/habit/backup modules using the globally available TypeScript compiler: **PASS**.
- TypeScript syntax/transpile scan: **PASS — 83 `.ts`/`.tsx` files, 0 diagnostics, 0 transpiler exceptions**.
- `node --check public/sw.js`, `scripts/source-audit.mjs`, and `scripts/check-bundle-size.mjs`: **PASS**.
- The final source/archive and evidence manifest are integrity-checked in the accompanying report/bundle.

## Historical official checks attempted but blocked

- `npm test -- --reporter=verbose`: **BLOCKED**, exits 127 because `vitest` is not installed (`vitest: not found`).
- `npm run build`: **NOT VERIFIED**, exits 1 because the project dependencies and React/Vite type packages are absent. The observed React/JSX TypeScript errors cascade from missing packages and are not treated as isolated proof of application defects.
- `npm run lint`: **BLOCKED**, exits 127 because `eslint` is not installed.
- `npm audit`: **BLOCKED**, exits 1 because npm requires a lockfile (`ENOLOCK`).
- Dependency install / lockfile generation: previously blocked by registry timeout / DNS failure. No lockfile was fabricated.
- Playwright E2E, browser IndexedDB migrations, restore/reset, offline mode, notifications, and two-tab concurrency: **NOT RUN**; package dependencies and browser binaries are unavailable.

Current dependency-free checks are valuable for source regression screening but cannot replace a dependency-backed build, official Vitest/coverage/lint/audit checks, or browser/device evidence.

## Reproducibility gate (consolidated PR #11 candidate)

The current candidate includes a committed `package-lock.json` (lockfile v3), and the direct web dependencies in `package.json` are exact versions. This locks the web dependency graph for `npm ci`; it does not prove that the current candidate's tests or build passed unless the corresponding run is tied to the exact candidate.

The direct Android/Capacitor toolchain packages are now version-pinned in `.github/workflows/android-apk.yml` and verified with `npm ls`. The workflow records the complete resolved npm dependency tree as an artifact for each build. The transitive CLI dependency graph is not committed to `package-lock.json`, so exact replay of that native build requires retaining the corresponding artifact and workflow run. The generated Android project and Gradle wrapper are also not checked into the repository.

On a network-enabled development machine, run the web checks against the exact candidate:

```bash
npm ci
npm test
npm run test:coverage
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

For the Android boundary, separately pin exact Capacitor package versions and preserve the resolved dependency graph, then retain the generated `AndroidManifest.xml`, Capacitor config, FileProvider paths XML, and resolved package-version evidence as artifacts from the same exact candidate. Verify those artifacts and run supported native/device checks before claiming native reproducibility. Do not dispatch a new workflow until a verified zero-cost route is confirmed; do not call the release reproducible before the required checks pass.

## Browser and data-integrity gate

Run browser tests for every supported old IndexedDB schema; valid and malformed backup restore; malformed-but-JSON input; failed restore rollback; export/import round trips; delete-all/reset; timezone/DST changes; multi-tab task-report races; notification permissions; offline startup after a clean installation; and connection to an actual loopback local-model server. Confirm no data mutation happens when restore validation fails.

## Android boundary

This archive is a React/Vite web app/PWA source package. It does **not** contain a generated Capacitor/Gradle Android project or APK/AAB. Native API/target SDK, signing, back-button lifecycle, native background scheduling/notifications, TalkBack and physical-device matrix remain unverified. Browser reminders are foreground-only; no bundled model weights or native background service is included.

## Final verdict

**NOT RELEASE-READY.** Source fixes and offline checks are included. Official dependency-backed tests/build/lint/audit, Playwright, real-browser storage/migration, and Android/device checks remain outstanding.

## v1.0.5 source changes

This increment fixes empty weekly/custom habit schedules being interpreted as daily, aligns the habit partial-report persistence guard with the `minimum_value` policy, rejects invalid planning calendar dates before database access, and hardens backup semantics (numeric ranges, unique valid weekdays, estimate/minimum/date relationships, and rejection of stores that postdate the declared backup schema). No IndexedDB record shape or object store changed; schema remains v9.
