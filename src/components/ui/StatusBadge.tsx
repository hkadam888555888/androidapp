import type { TaskStatus } from '../../domain/entities/models';
interface StatusBadgeProps { status: TaskStatus; }
const labels: Record<TaskStatus, string> = {
  planned: 'Planned', completed: 'Completed', partial: 'Partially done',
  skipped: 'Skipped', rescheduled: 'Moved', cancelled: 'Cancelled', unreported: 'Needs review',
};
export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={'status-badge status-badge--' + status}>{labels[status]}</span>;
}
