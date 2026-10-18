import type { ReactNode } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDot,
  CircleHelp,
  CircleX,
  Clock3,
  MinusCircle,
} from 'lucide-react';

export type StatusBadgeStatus =
  | 'confirmed'
  | 'attention'
  | 'error'
  | 'planned'
  | 'in-progress'
  | 'needs-status'
  | 'skipped'
  | 'moved'
  | 'neutral';

export interface StatusBadgeProps {
  status: StatusBadgeStatus;
  label?: string;
  className?: string;
}

const labels: Record<StatusBadgeStatus, string> = {
  confirmed: 'Confirmed',
  attention: 'Needs attention',
  error: 'Error',
  planned: 'Planned',
  'in-progress': 'In progress',
  'needs-status': 'Needs status',
  skipped: 'Skipped',
  moved: 'Moved',
  neutral: 'Status',
};

const icons: Record<StatusBadgeStatus, ReactNode> = {
  confirmed: <CheckCircle2 size={14} aria-hidden="true" />,
  attention: <CircleAlert size={14} aria-hidden="true" />,
  error: <CircleX size={14} aria-hidden="true" />,
  planned: <Clock3 size={14} aria-hidden="true" />,
  'in-progress': <CircleDot size={14} aria-hidden="true" />,
  'needs-status': <CircleHelp size={14} aria-hidden="true" />,
  skipped: <MinusCircle size={14} aria-hidden="true" />,
  moved: <ArrowRightLeft size={14} aria-hidden="true" />,
  neutral: <Circle size={14} aria-hidden="true" />,
};

/** Every status includes readable text and an icon so color is never the only cue. */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const classes = ['mar-ui-status', 'mar-ui-status--' + status, className ?? ''].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      <span className="mar-ui-status__icon">{icons[status]}</span>
      <span>{label ?? labels[status]}</span>
    </span>
  );
}
