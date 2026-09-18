"use client";
import { useEffect, useRef, type FormEvent, type ReactNode } from "react";

type EditDialogProps = {
  open: boolean;
  title: string;
  submitLabel?: string;
  busy?: boolean;
  error?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDismiss: () => void;
  children: ReactNode;
};

/**
 * The shell around an edit form — dialog, heading, error slot and the two
 * buttons. Callers supply their own fields, so there is no field-descriptor
 * indirection between the markup and what it edits.
 */
export function EditDialog({
  open,
  title,
  submitLabel = "حفظ",
  busy = false,
  error,
  onSubmit,
  onDismiss,
  children
}: EditDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onCancel={onDismiss} onClose={onDismiss}>
      {open && (
        <form className="dialog-body" onSubmit={onSubmit}>
          <h2>{title}</h2>

          {error && (
            <p className="banner" data-tone="critical" role="alert">
              {error}
            </p>
          )}

          {children}

          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onDismiss} disabled={busy}>
              إلغاء
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "جارٍ الحفظ…" : submitLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
