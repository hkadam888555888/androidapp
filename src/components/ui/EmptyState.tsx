import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** A reusable, non-interactive zero-content state. Pass any action explicitly from its caller. */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={['mar-ui-empty-state', className ?? ''].filter(Boolean).join(' ')}>
      <div className="mar-ui-empty-state__icon" aria-hidden="true">
        {icon ?? <Inbox size={24} strokeWidth={1.8} />}
      </div>
      <h3 className="mar-ui-empty-state__title">{title}</h3>
      {description ? <p className="mar-ui-empty-state__description">{description}</p> : null}
      {action ? <div className="mar-ui-empty-state__action">{action}</div> : null}
    </div>
  );
}
