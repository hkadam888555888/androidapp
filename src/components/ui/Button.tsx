import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'outline' | 'text' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

/** An accessible, business-logic-free button primitive. Icon-only use requires an aria-label. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  startIcon,
  endIcon,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    'mar-ui-button',
    'mar-ui-button--' + variant,
    'mar-ui-button--' + size,
    fullWidth ? 'mar-ui-button--full-width' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <LoaderCircle className="mar-ui-spinner" size={18} aria-hidden="true" />
      ) : startIcon ? (
        <span className="mar-ui-button__icon" aria-hidden="true">{startIcon}</span>
      ) : null}
      <span className="mar-ui-button__label">{children}</span>
      {!loading && endIcon ? <span className="mar-ui-button__icon" aria-hidden="true">{endIcon}</span> : null}
    </button>
  );
}
