"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import type { Role } from "@/schemas";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onConfirm: (role: Role) => void;
};

const OPTIONS = [
  {
    role: "developer" as const,
    labelKey: "auth.roleDialog.developer.label" as const,
    descriptionKey: "auth.roleDialog.developer.description" as const,
  },
  {
    role: "lead" as const,
    labelKey: "auth.roleDialog.lead.label" as const,
    descriptionKey: "auth.roleDialog.lead.description" as const,
  },
];

/** RF-01: shown after the account and professional-details steps. Nothing is pre-selected, and
 * Create account stays disabled until one option is chosen. Canceling (or Escape, handled by
 * the Dialog primitive) leaves the registration form exactly as it was — this dialog only ever
 * reads a role choice, it never submits anything on its own. */
export function RegisterRoleDialog({ open, onOpenChange, busy, onConfirm }: Props) {
  // Starts unset (RF-01's "no default"); reopening after Cancel keeps the last pick rather
  // than forcing a re-choice, which needs no effect and nothing to reset.
  const [choice, setChoice] = useState<Role | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("auth.roleDialog.title")}>
      <div className="flex flex-col gap-4">
        <div
          role="radiogroup"
          aria-label={t("auth.roleDialog.title")}
          className="flex flex-col gap-3"
        >
          {OPTIONS.map(({ role, labelKey, descriptionKey }) => (
            <label
              key={role}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3",
                choice === role ? "border-accent" : "border-line",
              )}
            >
              <input
                type="radio"
                name="register-role"
                value={role}
                checked={choice === role}
                onChange={() => setChoice(role)}
                aria-label={t(labelKey)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{t(labelKey)}</span>
                <span className="block text-sm text-muted">{t(descriptionKey)}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted">{t("auth.roleDialog.changeLater")}</p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            disabled={choice === null || busy}
            onClick={() => choice !== null && onConfirm(choice)}
          >
            {busy ? t("auth.creating") : t("auth.createAccount")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
