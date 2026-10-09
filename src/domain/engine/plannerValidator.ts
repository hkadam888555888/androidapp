import type { PlannedSlot } from './planner';
import { toMinutes } from './availabilityEngine';
import type { TimeWindow } from '../entities/models';

export interface PlanValidationIssue { code: 'overlap' | 'availability' | 'capacity' | 'invalid_time'; message: string; }

export function validatePlan(slots: PlannedSlot[], openWindows: TimeWindow[], capacityMinutes?: number): { valid: boolean; issues: PlanValidationIssue[] } {
  const issues: PlanValidationIssue[] = [];
  const ordered = [...slots].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  let total = 0;
  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i];
    const start = toMinutes(current.start);
    const end = toMinutes(current.end);
    if (end <= start) issues.push({ code: 'invalid_time', message: `Invalid slot ${current.taskId}: ${current.start}-${current.end}.` });
    const fits = openWindows.some((window) => start >= toMinutes(window.start) && end <= toMinutes(window.end));
    if (!fits) issues.push({ code: 'availability', message: `Slot ${current.taskId} is outside an open window.` });
    total += Math.max(0, end - start);
    const previous = ordered[i - 1];
    if (previous && toMinutes(previous.end) > start) issues.push({ code: 'overlap', message: `Slots ${previous.taskId} and ${current.taskId} overlap.` });
  }
  if (capacityMinutes !== undefined && total > capacityMinutes) issues.push({ code: 'capacity', message: `Planned ${total} minutes exceeds capacity ${capacityMinutes}.` });
  return { valid: issues.length === 0, issues };
}
