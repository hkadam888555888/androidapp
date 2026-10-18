import { useEffect, useId, useRef } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'dialog' | 'sheet';
  closeLabel?: string;
  className?: string;
}

/** Native modal dialog with controlled visibility and browser-managed modal focus behavior. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  variant = 'dialog',
  closeLabel = 'Close dialog',
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onOpenChange(false);
  }

  function handleClose() {
    onOpenChange(false);
  }

  const classes = [
    'mar-ui-dialog',
    variant === 'sheet' ? 'mar-ui-dialog--sheet' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <dialog
      ref={dialogRef}
      className={classes}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClose={handleClose}
    >
      <header className="mar-ui-dialog__header">
        <div className="mar-ui-dialog__heading">
          <h2 className="mar-ui-dialog__title" id={titleId}>{title}</h2>
          {description ? <p className="mar-ui-dialog__description" id={descriptionId}>{description}</p> : null}
        </div>
        <button
          type="button"
          className="mar-ui-dialog__close"
          aria-label={closeLabel}
          onClick={() => onOpenChange(false)}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="mar-ui-dialog__body">{children}</div>
      {footer ? <footer className="mar-ui-dialog__footer">{footer}</footer> : null}
    </dialog>
  );
}

export type SheetProps = Omit<DialogProps, 'variant'>;

/** Bottom sheet on narrow screens and side sheet on wider screens. */
export function Sheet(props: SheetProps) {
  return <Dialog {...props} variant="sheet" />;
}
