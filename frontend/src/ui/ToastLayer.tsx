"use client";

import { Toast as RadixToast } from "radix-ui";
import { t } from "@/i18n";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

export type ToastItem = { id: number; tone: "success" | "error"; message: string };

type ToastLayerProps = { items: readonly ToastItem[]; onClose: (id: number) => void };

/** The Radix half of the toast system, loaded when the first toast appears. */
export default function ToastLayer({ items, onClose }: ToastLayerProps) {
  return (
    <RadixToast.Provider duration={5000} label={t("toast.region")}>
      {items.map((item) => (
        <RadixToast.Root
          key={item.id}
          type={item.tone === "error" ? "foreground" : "background"}
          onOpenChange={(open) => {
            if (!open) onClose(item.id);
          }}
          className={`flex items-start gap-3 rounded-md border p-3 shadow-md ${
            item.tone === "error"
              ? "border-danger bg-danger-bg text-danger"
              : "border-success bg-success-bg text-success"
          }`}
        >
          <RadixToast.Description className="flex-1 text-sm">{item.message}</RadixToast.Description>
          <RadixToast.Close asChild>
            <IconButton label={t("common.dismiss")}>
              <Icon name="x" />
            </IconButton>
          </RadixToast.Close>
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:w-80" />
    </RadixToast.Provider>
  );
}
