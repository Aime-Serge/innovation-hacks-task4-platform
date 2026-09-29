"use client";

import { useState } from "react";
import { Modal } from "./Modal";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-text-secondary">{message}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-status-blocked">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded bg-status-blocked px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-60"
        >
          {submitting ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
