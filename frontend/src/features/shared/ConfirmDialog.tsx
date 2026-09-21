import type { ReactNode } from "react";
import { t } from "@/i18n";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  /** A failure explained in plain words, announced as it appears. */
  problem?: ReactNode;
};

/** A destructive action always asks first (FR-413, FR-420); the safe choice comes first. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  problem,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="flex flex-col gap-4">
        <p>{body}</p>
        <div role="alert" aria-live="assertive" className="text-sm text-danger">
          {problem}
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {busy ? t("common.deleting") : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
