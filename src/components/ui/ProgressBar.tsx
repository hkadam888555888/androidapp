interface ProgressBarProps { value: number; label: string; }
export function ProgressBar({ value, label }: ProgressBarProps) {
  const safeValue = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
  return <div className="progress-accessible"><div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}><span style={{ width: safeValue + '%' }} /></div></div>;
}
