import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflow = (await readFile(new URL('../../../.github/workflows/repair-build.yml', import.meta.url), 'utf8')).replace(/\r\n/gu, '\n');

describe('manual verification workflow security policy', () => {
  it('uses read-only repository permissions', () => {
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toMatch(/^\s*(?:contents|actions):\s*write\s*$/mu);
    expect(workflow).not.toMatch(/^\s*permissions:\s*write-all\s*$/mu);
  });

  it('cannot push to a branch or trigger other workflows', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/^\s*push:/mu);
    expect(workflow).not.toMatch(/\bgit\s+push\b/u);
    expect(workflow).not.toMatch(/\/actions\/workflows\/[^/\s]+\/dispatches/u);
    expect(workflow).not.toMatch(/\bcurl\b/u);
  });

  it('does not contain deployment steps', () => {
    expect(workflow).not.toMatch(/^\s*uses:\s*[^\n]*deploy/imu);
    expect(workflow).not.toMatch(/^\s*environment:\s*production\s*$/imu);
  });
});
