"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type SyntheticEvent } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { t } from "@/i18n";
import { formText } from "@/lib/form";
import { hardNavigate } from "@/lib/navigation";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { FormAlert } from "./messages";

const MIN_PASSWORD = 8;

export function ResetPasswordForm() {
  const { auth } = useAuth();
  const token = useSearchParams().get("token");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token === null || token === "") {
    return (
      <>
        <FormAlert>{t("auth.resetInvalid")}</FormAlert>
        <Link href="/forgot-password" className="text-sm text-accent-fg underline">
          {t("auth.sendReset")}
        </Link>
      </>
    );
  }

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = formText(form, "password");
    if (password.length < MIN_PASSWORD) {
      setError(t("auth.passwordShort", { min: MIN_PASSWORD }));
      return;
    }
    if (password !== formText(form, "confirm")) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.resetPassword(token, password);
      hardNavigate("/login?registered=0");
    } catch {
      setError(t("auth.resetInvalid"));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
      {error !== null && <FormAlert>{error}</FormAlert>}
      <FormField id="reset-password" label={t("auth.newPassword")}>
        {(c) => (
          <Input {...c} name="password" type="password" autoComplete="new-password" required />
        )}
      </FormField>
      <FormField id="reset-confirm" label={t("auth.confirmPassword")}>
        {(c) => (
          <Input {...c} name="confirm" type="password" autoComplete="new-password" required />
        )}
      </FormField>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? t("common.saving") : t("auth.resetPassword")}
      </Button>
    </form>
  );
}
