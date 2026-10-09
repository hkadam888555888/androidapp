import { describe, expect, it } from 'vitest';
import { computeOpenWindows, subtractWindows } from './availabilityEngine';

describe('availability engine', () => {
  it('subtracts only the overlapping portion of a busy window', () => {
    expect(subtractWindows(
      [{ start: '14:00', end: '18:00' }],
      [{ start: '15:00', end: '16:00' }],
    )).toEqual([
      { start: '14:00', end: '15:00' },
      { start: '16:00', end: '18:00' },
    ]);
  });

  it('removes sleep from study windows', () => {
    expect(computeOpenWindows({
      date: '2026-10-08', wakeTime: '05:00', sleepTime: '22:00',
      studyWindows: [{ start: '20:00', end: '23:00' }],
    })).toEqual([{ start: '20:00', end: '22:00' }]);
  });
});
