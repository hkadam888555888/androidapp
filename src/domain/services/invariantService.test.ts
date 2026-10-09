import { describe, expect, it } from 'vitest';
import { evaluateInvariants } from './invariantService';

describe('invariant service', () => {
  it('rejects completed instances without evidence timestamps', () => {
    const report = evaluateInvariants([{ id:'d', date:'2026-10-08', title:'Task', kind:'roadmap', plannedMinutes:30, priority:'medium', status:'completed' }], []);
    expect(report.ok).toBe(false);
  });
  it('accepts explicit completed instances with evidence', () => {
    const report = evaluateInvariants([{ id:'d', date:'2026-10-08', title:'Task', kind:'roadmap', plannedMinutes:30, priority:'medium', status:'completed', resultReportedAt:'2026-10-08T10:00:00Z' }], []);
    expect(report.ok).toBe(true);
  });
});
