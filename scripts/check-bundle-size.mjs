import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const root = path.resolve('dist/assets');
const files = await readdir(root, { withFileTypes: true }).catch(() => []);
if (!files.length) {
  console.error('Bundle-size check failed: dist/assets is missing or empty.');
  process.exit(1);
}

const budgets = { js: 500 * 1024, css: 100 * 1024 };
const totals = { js: 0, css: 0 };
for (const file of files) {
  if (!file.isFile()) continue;
  const ext = path.extname(file.name);
  const kind = ext === '.js' ? 'js' : ext === '.css' ? 'css' : undefined;
  if (!kind) continue;
  const content = await readFile(path.join(root, file.name));
  totals[kind] += gzipSync(content).length;
}

let failed = false;
if (totals.js === 0 || totals.css === 0) {
  console.error('Bundle-size check failed: expected at least one production JavaScript bundle and one CSS bundle.');
  failed = true;
}
for (const kind of ['js', 'css']) {
  const kb = (totals[kind] / 1024).toFixed(1);
  console.log(`${kind.toUpperCase()} gzip total: ${kb} KiB / ${(budgets[kind] / 1024).toFixed(0)} KiB`);
  if (totals[kind] > budgets[kind]) {
    console.error(`${kind.toUpperCase()} bundle exceeded its gzip budget.`);
    failed = true;
  }
}
if (failed) process.exit(1);
