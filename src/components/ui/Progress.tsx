export type ProgressTone = 'primary' | 'confirmed' | 'attention' | 'error';

export interface ProgressProps {
  value?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  tone?: ProgressTone;
  className?: string;
}

/** A semantic progress indicator; omitting value creates an indeterminate progress bar. */
export function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  tone = 'primary',
  className,
}: ProgressProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const safeValue = hasValue ? Math.min(safeMax, Math.max(0, value)) : undefined;
  const percent = safeValue === undefined ? 0 : (safeValue / safeMax) * 100;
  const percentLabel = safeValue === undefined ? undefined : Math.round(percent) + '%';

  return (
    <div className={['mar-ui-progress', 'mar-ui-progress--' + tone, className ?? ''].filter(Boolean).join(' ')}>
      {(label || showValue) ? (
        <div className="mar-ui-progress__heading">
          {label ? <span>{label}</span> : <span aria-hidden="true" />}
          {showValue && percentLabel ? <span className="mar-ui-progress__value">{percentLabel}</span> : null}
        </div>
      ) : null}
      <div
        className="mar-ui-progress__track"
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        aria-valuetext={safeValue === undefined ? 'In progress' : percentLabel}
        data-indeterminate={safeValue === undefined ? 'true' : undefined}
      >
        <div
          className="mar-ui-progress__fill"
          style={{ width: safeValue === undefined ? '35%' : percent + '%' }}
        />
      </div>
    </div>
  );
}
