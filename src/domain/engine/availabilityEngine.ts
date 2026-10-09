import type { AvailabilityInput, TimeWindow } from '../entities/models';

export function computeOpenWindows(input: AvailabilityInput): TimeWindow[] {
  const allowed = normalizeWindows(input.studyWindows);
  const blocked = normalizeWindows([
    ...(input.fixedWindows ?? []),
    ...(input.blockedWindows ?? []),
    ...(input.busyWindows ?? []),
    ...(input.reservedHabitWindows ?? []),
    { start: '00:00', end: input.wakeTime },
    { start: input.sleepTime, end: '24:00' },
  ]);
  return subtractWindows(allowed, blocked);
}

export function subtractWindows(base: TimeWindow[], blocked: TimeWindow[]): TimeWindow[] {
  let result = normalizeWindows(base);
  for (const block of normalizeWindows(blocked)) {
    const next: TimeWindow[] = [];
    for (const window of result) {
      const ws = toMinutes(window.start);
      const we = toMinutes(window.end);
      const bs = toMinutes(block.start);
      const be = toMinutes(block.end);
      if (be <= ws || bs >= we) { next.push(window); continue; }
      if (bs > ws) next.push({ start: window.start, end: fromMinutes(Math.min(bs, we)) });
      if (be < we) next.push({ start: fromMinutes(Math.max(be, ws)), end: window.end });
    }
    result = next;
  }
  return result.filter((window) => toMinutes(window.end) > toMinutes(window.start));
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time: ${time}`);
  }
  return hours * 60 + minutes;
}

export function fromMinutes(total: number): string {
  const normalized = Math.max(0, Math.min(24 * 60, total));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function normalizeWindows(windows: TimeWindow[]): TimeWindow[] {
  return [...windows]
    .filter((window) => toMinutes(window.end) > toMinutes(window.start))
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}
