"use client";

import { useId, useState, type SyntheticEvent } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { THEME_CHOICES } from "@/providers/theme";
import { t } from "@/i18n";
import { reportError } from "@/lib/report-error";
import { Theme, User } from "@/schemas";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input, Select } from "@/ui/Input";
import { useToast } from "@/ui/Toast";

const NameSchema = User.shape.name;

/** FR-10: inline validation; Save is disabled while invalid, unchanged or saving. */
export function ProfileForm({ user }: { user: User }) {
  const { auth, setUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const formId = useId();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const valid = NameSchema.safeParse(trimmed).success;
  const error = valid ? null : t(trimmed === "" ? "profile.nameRequired" : "profile.nameTooLong");
  const changed = trimmed !== user.name;

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      setUser(await auth.updateProfile(user.id, { name: trimmed }));
      toast.notify("success", t("profile.saved"));
    } catch (failure) {
      reportError(failure, "profile.save");
      toast.notify("error", t("form.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex max-w-md flex-col gap-4"
    >
      <FormField id={`${formId}-name`} label={t("profile.name")} error={error}>
        {(control) => (
          <Input
            {...control}
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </FormField>
      <FormField id={`${formId}-theme`} label={t("profile.theme")}>
        {(control) => (
          <Select
            {...control}
            value={theme}
            onChange={(event) => setTheme(Theme.parse(event.target.value))}
          >
            {THEME_CHOICES.map((option) => (
              <option key={option} value={option}>
                {t(`theme.${option}`)}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <div>
        <Button type="submit" variant="primary" disabled={!valid || !changed || saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
