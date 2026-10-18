import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
  inputClassName?: string;
}

/** A labelled input with optional hint and an explicitly announced validation error. */
export function TextField({
  label,
  hint,
  error,
  id,
  required,
  className,
  inputClassName,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? 'mar-ui-field-' + generatedId.replaceAll(':', '');
  const hintId = hint ? inputId + '-hint' : undefined;
  const errorId = error ? inputId + '-error' : undefined;
  const linkedIds = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={['mar-ui-field', className ?? ''].filter(Boolean).join(' ')}>
      <label className="mar-ui-field__label" htmlFor={inputId}>
        {label}
        {required ? <span className="mar-ui-field__required" aria-hidden="true"> *</span> : null}
      </label>
      <input
        {...inputProps}
        id={inputId}
        required={required}
        className={['mar-ui-field__input', inputClassName ?? ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={linkedIds}
      />
      {hint ? <p className="mar-ui-field__hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="mar-ui-field__error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
