import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const read = (file) => readFile(file, 'utf8');
const [repair, verify, apk, index, worker, localAI, aiIntelligence, backup, store, factory, settings, app, privacy, packageText] = await Promise.all([
  read('.github/workflows/repair-build.yml'), read('.github/workflows/verify.yml'), read('.github/workflows/android-apk.yml'),
  read('index.html'), read('public/sw.js'), read('src/domain/ai/openAICompatibleLocalProvider.ts'),
  read('src/domain/ai/aiIntelligence.ts'), read('src/application/backupValidation.ts'), read('src/application/appStore.ts'),
  read('src/domain/ai/aiProviderFactory.ts'), read('src/features/settings/SettingsPage.tsx'), read('src/app/App.tsx'),
  read('PRIVACY_POLICY.md'), read('package.json'),
]);
const pkg = JSON.parse(packageText);
const checks = [];
const check = (name, condition) => checks.push({ name, pass: Boolean(condition) });
let lockfilePresent = true;
try { await access('package-lock.json', constants.R_OK); } catch { lockfilePresent = false; }

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!/\.(?:ts|tsx|js|html|mjs)$/u.test(entry.name)) return [];
    return [[full, await readFile(full, 'utf8')]];
  }))).flat();
}
const sourceFiles = (await Promise.all(['src', 'public'].map(walk))).flat();
const sourceText = sourceFiles.map(([, content]) => content).join('\n');

// 01–10: workflow authority boundaries.
check('01 Manual verification is dispatch-only', repair.includes('on:\n  workflow_dispatch:') && !/^\s*push:/mu.test(repair) && !/^\s*pull_request:/mu.test(repair));
check('02 Manual verification grants contents:read', repair.includes('permissions:\n  contents: read'));
check('03 Manual verification grants no repository write permissions', !/\b(?:contents|actions):\s*write\b/u.test(repair) && !/permissions:\s*write-all/u.test(repair));
check('04 Manual verification cannot push Git refs', !/\bgit\s+push\b/u.test(repair));
check('05 Manual verification has no raw curl command', !/\bcurl\b/u.test(repair));
check('06 Manual verification cannot dispatch another workflow via API', !/\/actions\/workflows\/[^/\s]+\/dispatches/u.test(repair));
check('07 Manual verification has no direct main ref write', !/HEAD:main|origin\s+main/u.test(repair));
check('08 Manual verification has no deployment step or production environment', !/^\s*uses:\s*[^\n]*deploy/imu.test(repair) && !/^\s*environment:\s*production\s*$/imu.test(repair));
check('09 Source verifier uses read-only repository permissions', verify.includes('permissions:\n  contents: read'));
check('10 APK workflow uses read-only permissions and locked install', apk.includes('permissions:\n  contents: read') && apk.includes('run: npm ci'));

// 11–20: browser security policy.
check('11 CSP restricts default content to same-origin', index.includes("default-src 'self'"));
check('12 CSP restricts base-uri to same-origin', index.includes("base-uri 'self'"));
check('13 CSP restricts form-action to same-origin', index.includes("form-action 'self'"));
check('14 CSP blocks object/embed content', index.includes("object-src 'none'"));
check('15 CSP restricts scripts to same-origin', index.includes("script-src 'self'"));
check('16 CSP does not allow unsafe-eval', !index.includes("'unsafe-eval'"));
check('17 CSP limits local model connections to loopback hosts', ["http://127.0.0.1:*","http://localhost:*","http://[::1]:*","https://127.0.0.1:*","https://localhost:*","https://[::1]:*"].every((host) => index.includes(host)));
check('18 CSP restricts workers to same-origin', index.includes("worker-src 'self'"));
check('19 CSP restricts manifests to same-origin', index.includes("manifest-src 'self'"));
check('20 Referrer policy disables referrer disclosure', index.includes('<meta name="referrer" content="no-referrer" />'));

// 21–40: service-worker isolation and cache policy.
check('21 Service worker ignores non-GET requests', worker.includes("if (request.method !== 'GET') return;"));
check('22 Service worker skips cross-origin requests', worker.includes('if (url.origin !== self.location.origin) return;'));
check('23 Non-allow-listed requests are not runtime cached', worker.includes('if (!isStaticAsset) return;'));
check('24 Manifest is explicitly allow-listed', worker.includes("url.pathname === '/manifest.webmanifest'"));
check('25 Icon assets are explicitly allow-listed', worker.includes("url.pathname.startsWith('/icons/')"));
check('26 Build assets are explicitly allow-listed', worker.includes("url.pathname.startsWith('/assets/')"));
check('27 Runtime cache writes require successful basic responses', worker.includes("response.ok && response.type === 'basic'"));
check('28 Navigation requests use a distinct policy branch', worker.includes("if (request.mode === 'navigate')"));
check('29 App-shell cache writes require the root path', worker.includes("url.pathname === '/'"));
check('30 App-shell cache writes require HTML content type', worker.includes("contentType.toLowerCase().includes('text/html')"));
check('31 Root HTML is the only response cached as app shell', /if \(response\.ok && url\.pathname === '\/' && contentType\.toLowerCase\(\)\.includes\('text\/html'\)\) \{[\s\S]{0,180}await cache\.put\('\/', response\.clone\(\)\);/u.test(worker));
check('32 Install fetch reloads the current app shell', worker.includes("fetch('/', { cache: 'reload' })"));
check('33 Install fails if shell fetch is not successful', worker.includes('if (!response.ok) throw new Error'));
check('34 Activation removes older app-shell cache versions', worker.includes("key.startsWith('my-adaptive-routine-shell-') && key !== CACHE_NAME"));
check('35 Install activates the new worker', worker.includes('await self.skipWaiting()'));
check('36 Activation claims clients', worker.includes('self.clients.claim()'));
check('37 Precache set includes the web manifest', worker.includes("'/manifest.webmanifest'"));
check('38 Precache set includes the 192px icon', worker.includes("'/icons/icon-192.png'"));
check('39 Precache set includes both 512px icons', worker.includes("'/icons/icon-512.png'") && worker.includes("'/icons/icon-512-maskable.png'"));
check('40 Development and Vite source endpoints bypass runtime cache', worker.includes("url.pathname.startsWith('/src/')") && worker.includes("url.pathname.includes('/@vite/')"));

// 41–60: local model endpoint and response validation.
check('41 Local endpoint uses the URL parser', localAI.includes('url = new URL(value)'));
check('42 Local hostname is normalized before checks', localAI.includes('url.hostname.toLowerCase()'));
check('43 Localhost is an allowed endpoint host', localAI.includes("hostname === 'localhost'"));
check('44 IPv4 loopback is an allowed endpoint host', localAI.includes("hostname === '127.0.0.1'"));
check('45 IPv6 loopback is an allowed endpoint host', localAI.includes("hostname === '::1'"));
check('46 Only HTTP and HTTPS protocols are accepted', localAI.includes("!['http:', 'https:'].includes(url.protocol)"));
check('47 Embedded credentials and query parameters are rejected', localAI.includes('url.username || url.password || url.search'));
check('48 Endpoint is normalized to the chat-completions path', localAI.includes("url.pathname.endsWith('/chat/completions')"));
check('49 URL fragments are stripped before use', localAI.includes("url.hash = ''"));
check('50 Local model identifier length is bounded', localAI.includes('.slice(0, 160)'));
check('51 Request timeout has a 120-second upper cap', localAI.includes('Math.min(120_000,'));
check('52 Request timeout has a 2-second lower cap', localAI.includes('Math.max(2_000,'));
check('53 Model requests use AbortController', localAI.includes('new AbortController()'));
check('54 Timeout aborts in-flight requests', localAI.includes('setTimeout(() => controller.abort(), this.timeoutMs)'));
check('55 Timeout timer is cleared in finally', localAI.includes('clearTimeout(timeoutId)'));
check('56 Non-success model HTTP responses are rejected', localAI.includes('if (!response.ok) throw new Error'));
check('57 Model text response is bounded to 100 KB', localAI.includes('content.length > 100_000'));
check('58 Invalid JSON is handled as a controlled error', localAI.includes('Local model response was not valid JSON. No changes were applied.'));
check('59 Parsed model envelope rejects arrays', localAI.includes("typeof parsed !== 'object' || Array.isArray(parsed)"));
check('60 Model requests send JSON and no authorization header', localAI.includes("headers: { 'Content-Type': 'application/json' }") && !localAI.includes("'Authorization':"));

// 61–70: model output is bounded before becoming app data.
check('61 Concept proposals are capped at five', aiIntelligence.includes('asArray(output.concepts).slice(0, 5)'));
check('62 Task proposals are capped at eight', aiIntelligence.includes('asArray(output.tasks).slice(0, 8)'));
check('63 Task type is validated against an allow-list', aiIntelligence.includes('TASK_TYPES.has(rawType)'));
check('64 Difficulty is validated against an allow-list', aiIntelligence.includes('DIFFICULTIES.has(rawDifficulty)'));
check('65 Priority is validated against an allow-list', aiIntelligence.includes('PRIORITIES.has(rawPriority)'));
check('66 Model-suggested duration is clamped to 15–90 minutes', aiIntelligence.includes('clamp(Math.round(asNumber(item.estimatedMinutes, 30) / 5) * 5, 15, 90)'));
check('67 Model confidence is clamped to 0–1', aiIntelligence.includes('clamp(asNumber(output.confidence, 0.65), 0, 1)'));
check('68 Dependency suggestions build a set of known task IDs', aiIntelligence.includes('const known = new Set(tasks.map((task) => task.id))'));
check('69 Dependency suggestions reject unknown task IDs', aiIntelligence.includes('!known.has(fromTaskId) || !known.has(toTaskId)'));
check('70 Dependency suggestions reject self-links', aiIntelligence.includes('fromTaskId === toTaskId'));

// 71–90: imported backup validation.
check('71 Backup validator requires plain records', backup.includes('function isPlainRecord(value: unknown)'));
check('72 Prototype-pollution keys are blocked', backup.includes("new Set(['__proto__', 'prototype', 'constructor'])"));
check('73 Recursive JSON depth is bounded', backup.includes('if (depth > 64) return false'));
check('74 JSON string fields are bounded', backup.includes('value.length <= 1_000_000'));
check('75 JSON arrays are bounded', backup.includes('value.length <= 10_000'));
check('76 JSON object entry counts are bounded', backup.includes('entries.length <= 10_000'));
check('77 Numeric values must be finite', backup.includes("typeof value === 'number' && Number.isFinite(value)"));
check('78 Weekday arrays enforce range and uniqueness', backup.includes('item >= 0 && item <= 6') && backup.includes('new Set(value).size === value.length'));
check('79 ISO dates require strict format and round-trip validity', backup.includes('value') && /\\d\{4\}-\\d\{2\}-\\d\{2\}/u.test(backup) && backup.includes("date.toISOString().slice(0, 10) === value"));
check('80 Backup schema versions reject versions below two', backup.includes('schemaVersion < 2'));
check('81 Backup schema versions reject versions above nine', backup.includes('schemaVersion > 9'));
check('82 Unknown backup stores are rejected', backup.includes('const unknown = provided.filter((store) => !allowed.has(store))'));
check('83 Required stores are checked for the backup schema', backup.includes('const missing = BACKUP_STORES.filter'));
check('84 Stores newer than the declared schema are rejected', backup.includes('const futureStores ='));
check('85 Total backup records are capped at 100000', backup.includes('totalRows.value > 100_000'));
check('86 Duplicate IDs within a store are rejected', backup.includes('if (seen.has(row.id))'));
check('87 Record identifiers are bounded to 256 characters', backup.includes('row.id.length > 256'));
check('88 Every required field is type-validated', backup.includes('Object.entries(definition.required)'));
check('89 Present optional fields are type-validated', backup.includes('Object.entries(definition.optional ?? {})'));
check('90 Cross-field domain semantics are validated', backup.includes('validateSemanticFields(store, row)'));

// 91–100: persistence, destructive actions, UI sinks, and package integrity.
const importStart = store.indexOf('async importBackup(');
const validateAt = store.indexOf('validateBackupPayload(value)', importStart);
const openDbAt = store.indexOf('const db = await getDatabase()', importStart);
check('91 Complete backup validation precedes database access', importStart >= 0 && validateAt >= 0 && openDbAt > validateAt);
check('92 Related preferences and AI settings save atomically', store.includes("db.transaction(['preferences', 'plannerSettings', 'aiSettings', 'audits'], 'readwrite')"));
check('93 AI settings normalization forces local-only mode', store.includes('localOnly: true, cloudEnabled: false'));
check('94 Loaded AI settings pass through safe sanitization', store.includes('safeLoadedAISettings(finalAISettings)'));
check('95 Local-data deletion requires exact DELETE confirmation', settings.includes("disabled={deleteConfirmation !== 'DELETE'}") && settings.includes('Type DELETE to confirm'));
check('96 Notification delivery stops unless explicitly enabled', app.includes('if (stateNow.preferences?.notificationsEnabled !== true) return;'));
check('97 Privacy page is routed and linked from settings', app.includes('path="/privacy"') && settings.includes('to="/privacy"'));
check('98 Privacy notice documents browser-local storage and cloud AI disabled', privacy.includes('IndexedDB database on the browser') && privacy.includes('Cloud AI is disabled'));
check('99 Source excludes dangerous HTML sinks and dynamic code execution', !/dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|document\.write\s*\(/u.test(sourceText));
const allDependencies = { ...pkg.dependencies, ...pkg.devDependencies };
const hasTelemetrySdk = Object.keys(allDependencies).some((name) => /^(?:@sentry\/|posthog-js$|mixpanel-browser$|segment$|@segment\/|@amplitude\/)/u.test(name));
check('100 Dependencies are exactly pinned, lockfile exists, and known telemetry SDKs are absent', lockfilePresent && !hasTelemetrySdk && Object.values(allDependencies).every((version) => typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)));

for (const [index, result] of checks.entries()) {
  console.log(\`\${result.pass ? 'PASS' : 'FAIL'} [\${String(index + 1).padStart(3, '0')}/100] \${result.name}\`);
}
const failures = checks.filter((result) => !result.pass);
console.log(\`Arena Security 100: \${checks.length - failures.length}/\${checks.length} checks passed.\`);
if (checks.length !== 100) {
  console.error(\`Expected exactly 100 checks, but defined \${checks.length}.\`);
  process.exitCode = 1;
}
if (failures.length) process.exitCode = 1;
