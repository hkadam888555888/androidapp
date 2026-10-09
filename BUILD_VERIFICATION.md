# v1.0.5 Build Verification and Release Gate

**Result: NOT RELEASE-READY.** This is an improved source candidate, not a verified production build or Android release.

## Environment

- Node: `v22.16.0`
- npm: `10.9.2`
- Globally available TypeScript: `5.8.3` (the project pins TypeScript `6.0.3`)
- Project `node_modules`: absent
- `package-lock.json`: absent
- npm registry access: unavailable during prior install attempts (timeout / `EAI_AGAIN` DNS error)
- Playwright browser binaries: unavailable

## Checks that passed

- `node scripts/source-audit.mjs`: **PASS — 16 checks**, plus one explicit warning because `package-lock.json` is absent.
- Dependency-free compatibility runner: **PASS — 96 tests passed, 0 failed**. This runner uses a small shim to execute eligible existing test bodies; it is *not* the official Vitest runner and is supplementary evidence only.
- Strict TypeScript check of the selected pure domain/date/plan-instance/habit/backup modules using the globally available TypeScript compiler: **PASS**.
- TypeScript syntax/transpile scan: **PASS — 83 `.ts`/`.tsx` files, 0 diagnostics, 0 transpiler exceptions**.
- `node --check public/sw.js`, `scripts/source-audit.mjs`, and `scripts/check-bundle-size.mjs`: **PASS**.
- The final source/archive and evidence manifest are integrity-checked in the accompanying report/bundle.

## Official checks attempted but blocked

- `npm test -- --reporter=verbose`: **BLOCKED**, exits 127 because `vitest` is not installed (`vitest: not found`).
- `npm run build`: **NOT VERIFIED**, exits 1 because the project dependencies and React/Vite type packages are absent. The observed React/JSX TypeScript errors cascade from missing packages and are not treated as isolated proof of application defects.
- `npm run lint`: **BLOCKED**, exits 127 because `eslint` is not installed.
- `npm audit`: **BLOCKED**, exits 1 because npm requires a lockfile (`ENOLOCK`).
- Dependency install / lockfile generation: previously blocked by registry timeout / DNS failure. No lockfile was fabricated.
- Playwright E2E, browser IndexedDB migrations, restore/reset, offline mode, notifications, and two-tab concurrency: **NOT RUN**; package dependencies and browser binaries are unavailable.

Current dependency-free checks are valuable for source regression screening but cannot replace a dependency-backed build, official Vitest/coverage/lint/audit checks, or browser/device evidence.

## Reproducibility gate

Direct versions in `package.json` are exact, but the transitive dependency graph is **not reproducible yet** because there is no committed `package-lock.json`. On a network-enabled development machine:

```bash
npm install
npm test
npm run test:coverage
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Review and commit the generated lockfile only after the install succeeds; then verify from a clean checkout with `npm ci`, rerun all commands, and retain CI logs. Do not call the release reproducible before this gate passes.

## Browser and data-integrity gate

Run browser tests for every supported old IndexedDB schema; valid and malformed backup restore; malformed-but-JSON input; failed restore rollback; export/import round trips; delete-all/reset; timezone/DST changes; multi-tab task-report races; notification permissions; offline startup after a clean installation; and connection to an actual loopback local-model server. Confirm no data mutation happens when restore validation fails.

## Android boundary

This archive is a React/Vite web app/PWA source package. It does **not** contain a generated Capacitor/Gradle Android project or APK/AAB. Native API/target SDK, signing, back-button lifecycle, native background scheduling/notifications, TalkBack and physical-device matrix remain unverified. Browser reminders are foreground-only; no bundled model weights or native background service is included.

## Final verdict

**NOT RELEASE-READY.** Source fixes and offline checks are included. Official dependency-backed tests/build/lint/audit, Playwright, real-browser storage/migration, and Android/device checks remain outstanding.

## v1.0.5 source changes

This increment fixes empty weekly/custom habit schedules being interpreted as daily, aligns the habit partial-report persistence guard with the `minimum_value` policy, rejects invalid planning calendar dates before database access, and hardens backup semantics (numeric ranges, unique valid weekdays, estimate/minimum/date relationships, and rejection of stores that postdate the declared backup schema). No IndexedDB record shape or object store changed; schema remains v9.
