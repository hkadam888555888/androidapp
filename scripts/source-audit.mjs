import { readFile, access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const read = (file) => readFile(file, 'utf8');
const failures = [];
const warnings = [];
const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push(`PASS ${name}`);
  } catch (error) {
    failures.push(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const pkg = JSON.parse(await read('package.json'));
const index = await read('index.html');
const taskState = await read('src/domain/policies/taskState.ts');
const store = await read('src/application/appStore.ts');
const planService = await read('src/application/planService.ts');
const habitEngine = await read('src/domain/services/habitEngine.ts');
const backupValidation = await read('src/application/backupValidation.ts');
const worker = await read('public/sw.js');
const vite = await read('vite.config.ts');

await check('app version and schema remain consistent', async () => {
  const schema = await read('src/data/db/schema.ts');
  assert(pkg.version === '1.0.5', `package version is ${pkg.version}`);
  assert(schema.includes("APP_VERSION = '1.0.5'"), 'APP_VERSION does not match package version');
  assert(schema.includes('DB_VERSION = 9'), 'expected additive patch to retain schema version 9');
});
await check('all declared dependency versions are exact', async () => {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const unpinned = Object.entries(all).filter(([, version]) => typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version));
  assert(unpinned.length === 0, `un-pinned packages: ${unpinned.map(([name]) => name).join(', ')}`);
  assert(pkg.devDependencies.typescript.startsWith('6.0.'), 'TypeScript version must remain compatible with typescript-eslint 8.71.x peer range (<6.1.0).');
});
await check('habit scheduling and partial-result policy handle edge cases', async () => {
  assert(habitEngine.includes('Array.isArray(habit.frequencyDays) ? habit.frequencyDays'), 'empty configured recurrence can fall back to every day');
  assert(habitEngine.includes('export function canReportHabitPartial'), 'habit partial-result policy helper is missing');
  assert(store.includes('canReportHabitPartial(habit)'), 'partial reporting does not use the shared habit policy');
  assert(planService.includes('isValidISODate(date)'), 'plan generation does not reject invalid calendar dates');
});
await check('backup validation enforces domain-level numeric and cross-field rules', async () => {
  assert(backupValidation.includes("frequencyDays: 'weekdayArray'"), 'habit weekdays are not constrained to unique values 0–6');
  assert(backupValidation.includes("value: 'nonNegativeNumber', targetValue: 'positiveNumber'"), 'habit logs allow invalid value/target numbers');
  assert(backupValidation.includes("morningSuccessRate: 'unitInterval'"), 'time-pattern rates are not limited to 0–1');
  assert(backupValidation.includes('validateSemanticFields(store, row)'), 'cross-field backup validation is missing');
});
await check('reported history and terminal task states are guarded', async () => {
  assert(taskState.includes('export function assertTaskCanBeReported'), 'domain report guard is missing');
  assert(store.includes('assertTaskCanBeReported(task)'), 'AppStore does not call the report guard');
  assert(planService.includes('reconcilePlanTasks'), 'regenerated plan reconciliation is missing');
  assert(planService.includes("db.transaction(['dailyTasks', 'dayPlans'"), 'plan generation does not lock persisted task and plan rows');
  assert(planService.includes("tx.objectStore('dailyTasks').getAll()"), 'plan generation does not read authoritative persisted tasks');
  assert(store.includes('const task = await taskStore.get(taskId)'), 'task result does not re-read persisted state before reporting');
});
await check('backup rows and required stores validate before destructive restore', async () => {
  const importStart = store.indexOf('async importBackup(');
  const validateAt = store.indexOf('validateBackupPayload(value)', importStart);
  const openDbAt = store.indexOf('const db = await getDatabase()', importStart);
  const validator = await read('src/application/backupValidation.ts');
  assert(validateAt >= 0 && openDbAt > validateAt, 'database transaction can begin before complete backup validation');
  assert(validator.includes('const missing = BACKUP_STORES.filter'), 'backup does not verify required store completeness by schema version');
  assert(validator.includes('const futureStores = (provided as BackupStore[]).filter'), 'backup accepts stores that postdate its declared schema');
  assert(validator.includes('const definition = fields[store]'), 'backup row field schemas are missing');
  assert(validator.includes('duplicate ID'), 'duplicate record IDs are not rejected');
});

await check('related settings are persisted in one transaction', async () => {
  assert(store.includes('saveSettingsBundle'), 'settings bundle method is missing');
  assert(store.includes("db.transaction(['preferences', 'plannerSettings', 'aiSettings', 'audits'], 'readwrite')"), 'settings transaction does not cover all stores');
});
await check('local AI settings reject unsafe endpoint configuration', async () => {
  assert(store.includes('normalizeLocalEndpoint(settings.localEndpoint'), 'AI settings normalization does not validate endpoint');
  assert(store.includes('safeLoadedAISettings(finalAISettings)'), 'loaded/imported AI settings are not sanitized');
});
await check('CSP, mobile safe-area viewport and web manifest are declared', async () => {
  assert(index.includes('Content-Security-Policy'), 'CSP meta is missing');
  assert(index.includes('viewport-fit=cover'), 'safe-area viewport support is missing');
  assert(index.includes('/manifest.webmanifest'), 'manifest link is missing');
  const manifest = JSON.parse(await read('public/manifest.webmanifest'));
  assert(manifest.icons?.some((icon) => icon.sizes === '192x192'), '192px icon is missing from manifest');
  assert(manifest.icons?.some((icon) => icon.sizes === '512x512'), '512px icon is missing from manifest');
});
await check('service worker precaches production startup assets and avoids cross-origin caching', async () => {
  assert(worker.includes("fetch('/', { cache: 'reload' })"), 'worker does not fetch the app shell at install');
  assert(worker.includes("url.pathname.startsWith('/assets/')"), 'production JS/CSS asset discovery is missing');
  assert(worker.includes('if (url.origin !== self.location.origin) return;'), 'cross-origin cache boundary is missing');
});
await check('privacy notice exists and is reachable in the app', async () => {
  await access('PRIVACY_POLICY.md', constants.R_OK);
  await access('src/features/settings/PrivacyPage.tsx', constants.R_OK);
  assert((await read('src/app/App.tsx')).includes('path="/privacy"'), 'privacy route is missing');
  assert((await read('src/features/settings/SettingsPage.tsx')).includes('to="/privacy"'), 'settings link to privacy notice is missing');
});
await check('release verification and bundle-budget checks are wired', async () => {
  assert(pkg.scripts.build.includes('check-bundle-size.mjs'), 'bundle budget is not part of build');
  assert(pkg.scripts['test:coverage'], 'coverage command missing');
  assert(vite.includes('thresholds: { lines: 25, functions: 15, branches: 10, statements: 25 }'), 'coverage thresholds are missing');
  assert((await read('src/vite-env.d.ts')).includes('vite/client'), 'Vite import-meta ambient types are missing');
  const budgetScript = await read('scripts/check-bundle-size.mjs');
  assert(budgetScript.includes('totals.js === 0 || totals.css === 0'), 'bundle budget does not reject missing JS/CSS output');
  await access('scripts/check-bundle-size.mjs', constants.R_OK);
});
for (const icon of ['public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/icon-512-maskable.png']) {
  await check(`icon asset exists: ${path.basename(icon)}`, async () => {
    const info = await stat(icon);
    assert(info.size > 512, `icon appears too small (${info.size} bytes)`);
  });
}
await check('CI setup does not enable npm caching without a lockfile', async () => {
  let hasLockfile = true;
  try { await access('package-lock.json', constants.R_OK); } catch { hasLockfile = false; }
  const workflow = await read('.github/workflows/verify.yml');
  if (!hasLockfile) assert(!/^\s*cache:\s*npm\s*$/mu.test(workflow), 'npm cache is enabled but package-lock.json is absent');
});

try { await access('package-lock.json', constants.R_OK); }
catch { warnings.push('package-lock.json is absent; run npm install on a network-enabled machine and commit the generated lockfile before calling builds reproducible.'); }

console.log(checks.join('\n'));
if (warnings.length) console.warn(warnings.map((warning) => `WARN ${warning}`).join('\n'));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Source audit: ${checks.length} checks passed; ${warnings.length} warning(s).`);
}
