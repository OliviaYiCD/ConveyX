import { useEffect, useState } from "react";

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmValue: string;
  confirmHint: string;
  warning?: string;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  open,
  title,
  description,
  confirmLabel,
  confirmValue,
  confirmHint,
  warning = "This action cannot be undone. Products using this field will have it removed from their required data lists.",
  deleting = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1);
      setTyped("");
    }
  }, [open]);

  if (!open) return null;

  const canConfirm = step === 2 && typed === confirmValue;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-delete-title">{title}</h2>
        <div className="modal-body">{description}</div>

        {step === 1 ? (
          <p className="modal-warning">{warning}</p>
        ) : (
          <>
            <p className="modal-warning">
              Type <code>{confirmValue}</code> below to confirm deletion.
            </p>
            <div className="field">
              <label htmlFor="confirm-delete-input">{confirmHint}</label>
              <input
                id="confirm-delete-input"
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmValue}
              />
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          {step === 1 ? (
            <button type="button" className="btn btn-danger" onClick={() => setStep(2)}>
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              disabled={!canConfirm || deleting}
              onClick={onConfirm}
            >
              {deleting ? "Deleting…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
