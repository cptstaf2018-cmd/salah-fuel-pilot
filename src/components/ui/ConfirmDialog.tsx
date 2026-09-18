"use client";
import { useEffect, useRef } from "react";

export type ConfirmRequest = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

type ConfirmDialogProps = {
  request: ConfirmRequest | null;
  busy?: boolean;
  onDismiss: () => void;
};

/**
 * Native <dialog>, so focus trapping, Escape and the backdrop come from the
 * platform rather than being re-implemented (and half-implemented) here.
 */
export function ConfirmDialog({ request, busy = false, onDismiss }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (request && !dialog.open) {
      dialog.showModal();
    } else if (!request && dialog.open) {
      dialog.close();
    }
  }, [request]);

  return (
    <dialog ref={ref} className="dialog" onCancel={onDismiss} onClose={onDismiss}>
      {request && (
        <div className="dialog-body">
          <h2>{request.title}</h2>
          <p>{request.body}</p>
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onDismiss} disabled={busy}>
              إلغاء
            </button>
            <button
              type="button"
              className={request.danger ? "btn btn-danger" : "btn btn-primary"}
              onClick={() => void request.onConfirm()}
              disabled={busy}
            >
              {busy ? "جارٍ التنفيذ…" : request.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
