import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

export type InlineAlertSeverity = 'info' | 'success' | 'attention' | 'error';

export interface InlineAlertProps {
  severity?: InlineAlertSeverity;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

const alertIcons = {
  info: <Info size={20} aria-hidden="true" />,
  success: <CheckCircle2 size={20} aria-hidden="true" />,
  attention: <AlertTriangle size={20} aria-hidden="true" />,
  error: <XCircle size={20} aria-hidden="true" />,
};

/** Inline feedback only: it does not pretend to persist, notify, or auto-dismiss. */
export function InlineAlert({
  severity = 'info',
  title,
  children,
  action,
  className,
}: InlineAlertProps) {
  const isUrgent = severity === 'error' || severity === 'attention';

  return (
    <div
      className={['mar-ui-alert', 'mar-ui-alert--' + severity, className ?? ''].filter(Boolean).join(' ')}
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
    >
      <span className="mar-ui-alert__icon" aria-hidden="true">{alertIcons[severity]}</span>
      <div className="mar-ui-alert__content">
        {title ? <p className="mar-ui-alert__title">{title}</p> : null}
        <div className="mar-ui-alert__message">{children}</div>
      </div>
      {action ? <div className="mar-ui-alert__action">{action}</div> : null}
    </div>
  );
}
