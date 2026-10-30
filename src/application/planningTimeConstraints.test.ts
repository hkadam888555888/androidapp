import { describe, expect, it } from 'vitest';
import type { BusyEvent } from '../domain/entities/models';
import { includeElapsedTimeBlock } from './planningTimeConstraints';

describe('current-day planning time constraint', () => {
  it('blocks the elapsed portion of today\'s schedule', () => {
    const now = new Date(2026, 9, 8, 16, 12, 1);
    const busy: BusyEvent[] = [{
      id: 'appointment',
      date: '2026-10-08',
      title: 'Appointment',
      window: { start: '17:00', end: '17:30' },
      priority: 'high',
      blocksPlanning: true,
    }];

    expect(includeElapsedTimeBlock('2026-10-08', busy, '06:30', now)).toEqual([
      ...busy,
      {
        id: 'elapsed-before-now:2026-10-08',
        date: '2026-10-08',
        title: 'Time elapsed before planning',
        window: { start: '06:30', end: '16:13' },
        priority: 'low',
        blocksPlanning: true,
        fixed: true,
      },
    ]);
  });

  it('leaves future plans and times before wake-up unchanged', () => {
    const busy: BusyEvent[] = [];
    expect(includeElapsedTimeBlock('2026-10-09', busy, '06:30', new Date(2026, 9, 8, 16, 0))).toBe(busy);
    expect(includeElapsedTimeBlock('2026-10-08', busy, '06:30', new Date(2026, 9, 8, 5, 30))).toBe(busy);
  });
});
