import type { BusyEvent, ISODate } from '../domain/entities/models';
import { fromMinutes, toMinutes } from '../domain/engine/availabilityEngine';
import { todayISO } from './date';

/**
 * Prevent same-day plans from placing work in a study window that has already
 * elapsed. Future dates remain unchanged because their full schedule is usable.
 */
export function includeElapsedTimeBlock(
  date: ISODate,
  busyEvents: BusyEvent[],
  wakeTime: string,
  now = new Date(),
): BusyEvent[] {
  if (date !== todayISO(now)) return busyEvents;

  const nowMinutes = now.getHours() * 60
    + now.getMinutes()
    + (now.getSeconds() > 0 || now.getMilliseconds() > 0 ? 1 : 0);
  const elapsedEnd = Math.min(24 * 60, nowMinutes);
  if (elapsedEnd <= toMinutes(wakeTime)) return busyEvents;

  const elapsed: BusyEvent = {
    id: `elapsed-before-now:${date}`,
    date,
    title: 'Time elapsed before planning',
    window: { start: wakeTime, end: fromMinutes(elapsedEnd) },
    priority: 'low',
    blocksPlanning: true,
    fixed: true,
  };
  return [...busyEvents, elapsed];
}
