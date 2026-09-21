"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type SyntheticEvent } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { t } from "@/i18n";
import { formText } from "@/lib/form";
import { hardNavigate, safeInternalPath } from "@/lib/navigation";
import { ServiceError } from "@/services/types";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { FormAlert, FormNotice } from "./messages";

export function LoginForm() {
  const { login } = useAuth();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await login(formText(form, "email"), formText(form, "password"));
      hardNavigate(safeInternalPath(params.get("next")));
    } catch (failure) {
      setError(failure instanceof ServiceError ? failure.message : t("auth.genericError"));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
      {params.get("registered") === "1" && <FormNotice>{t("auth.registered")}</FormNotice>}
      {error !== null && <FormAlert>{error}</FormAlert>}
      <FormField id="login-email" label={t("auth.email")}>
        {(c) => <Input {...c} name="email" type="email" autoComplete="email" required />}
      </FormField>
      <FormField id="login-password" label={t("auth.password")}>
        {(c) => (
          <Input {...c} name="password" type="password" autoComplete="current-password" required />
        )}
      </FormField>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? t("auth.loggingIn") : t("auth.login")}
      </Button>
      <p className="flex justify-between text-sm">
        <Link href="/register" className="text-accent-fg underline">
          {t("auth.createAccount")}
        </Link>
        <Link href="/forgot-password" className="text-accent-fg underline">
          {t("auth.forgot")}
        </Link>
      </p>
    </form>
  );
}
