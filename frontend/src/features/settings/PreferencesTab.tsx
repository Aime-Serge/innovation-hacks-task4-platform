"use client";

import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { THEME_CHOICES } from "@/providers/theme";
import { t } from "@/i18n";
import type { Me } from "@/schemas";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input, Select } from "@/ui/Input";
import { useToast } from "@/ui/Toast";
import { useUpdatePreferences } from "../data/hooks";

/** MF-15: theme and time zone, saved per account; the header toggle reads the same theme value. */
export function PreferencesTab({ me }: { me: Me }) {
  const { theme, setTheme } = useTheme();
  const [timeZone, setTimeZone] = useState(me.profile?.timeZone ?? "UTC");
  const update = useUpdatePreferences();
  const toast = useToast();

  const submit = async () => {
    try {
      await update.mutateAsync({ theme, timeZone });
      toast.notify("success", t("settings.preferences.saved"));
    } catch {
      toast.notify("error", t("form.saveFailed"));
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
      className="flex max-w-md flex-col gap-4"
    >
      <FormField id="prefs-theme" label={t("settings.preferences.theme")}>
        {(c) => (
          <Select {...c} value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
            {THEME_CHOICES.map((option) => (
              <option key={option} value={option}>
                {t(`theme.${option}`)}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField id="prefs-timezone" label={t("settings.preferences.timeZone")}>
        {(c) => (
          <Input
            {...c}
            maxLength={64}
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
          />
        )}
      </FormField>
      <div>
        <Button type="submit" variant="primary" disabled={update.isPending}>
          {update.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
