import { useRef, type ReactNode } from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { t } from "@/i18n";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** "drawer" slides in from the side (mobile filters, FR-14). */
  variant?: "modal" | "drawer";
  children: ReactNode;
};

/** Focus is trapped, Escape closes, focus returns to the trigger (Radix). */
export default function DialogImpl({
  open,
  onOpenChange,
  title,
  description,
  variant = "modal",
  children,
}: DialogProps) {
  const position =
    variant === "drawer"
      ? "inset-y-0 right-0 w-full max-w-sm"
      : "inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2";
  const opener = useRef<HTMLElement | null>(null);
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <RadixDialog.Content
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            // Focus returns to whatever opened the dialog, even a state-driven button.
            event.preventDefault();
            opener.current?.focus();
          }}
          className={`fixed z-50 max-h-dvh overflow-y-auto border border-line bg-surface p-6 shadow-lg ${position} ${
            variant === "drawer" ? "" : "rounded-lg"
          }`}
          {...(description === undefined ? { "aria-describedby": undefined } : {})}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton label={t("common.close")}>
                <Icon name="x" />
              </IconButton>
            </RadixDialog.Close>
          </div>
          {description !== undefined && (
            <RadixDialog.Description className="mb-4 text-sm text-muted">
              {description}
            </RadixDialog.Description>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
