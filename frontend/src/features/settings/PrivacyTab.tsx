"use client";

import { t } from "@/i18n";
import type { Me } from "@/schemas";
import { Checkbox } from "@/ui/Checkbox";
import { useToast } from "@/ui/Toast";
import { useUpdatePrivacy } from "../data/hooks";

/** MF-16, MB-02: applies at once to the profile page, the people picker and GET /users. */
export function PrivacyTab({ me }: { me: Me }) {
  const update = useUpdatePrivacy();
  const toast = useToast();

  const toggle = async (value: boolean) => {
    try {
      await update.mutateAsync(value);
      toast.notify("success", t("settings.privacy.saved"));
    } catch {
      toast.notify("error", t("form.saveFailed"));
    }
  };

  return (
    <div className="flex max-w-md flex-col gap-2">
      <Checkbox
        id="privacy-toggle"
        label={t("settings.privacy.toggle")}
        checked={me.privacy.showProfessionalDetails}
        onCheckedChange={(v) => void toggle(v)}
      />
      <p className="text-sm text-muted">{t("settings.privacy.body")}</p>
    </div>
  );
}
