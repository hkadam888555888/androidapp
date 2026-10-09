import type { ISODate } from '../domain/entities/models';

/** Format the device's local calendar date. Never round-trip a local date through UTC. */
export function localISODate(date: Date): ISODate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): ISODate {
  return localISODate(new Date());
}

export function isoToLabel(date: ISODate): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const value = new Date(year, month - 1, day, 12, 0, 0);
  return value.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function previousISO(date: ISODate): ISODate {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const previous = new Date(year, month - 1, day, 12, 0, 0);
  previous.setDate(previous.getDate() - 1);
  return localISODate(previous);
}

/** Strictly validate an ISO calendar date without timezone-dependent parsing. */
export function isValidISODate(value: string): value is ISODate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}
