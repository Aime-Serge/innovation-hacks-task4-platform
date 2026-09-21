"use client";

import Link from "next/link";
import { useState, type SyntheticEvent } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { t } from "@/i18n";
import { formText } from "@/lib/form";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { FormAlert, FormNotice } from "./messages";

/** The same message shows whether or not the email exists (no account enumeration). */
export function ForgotPasswordForm() {
  const { auth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ devResetUrl: string | null } | null>(null);
  const [failed, setFailed] = useState(false);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = formText(new FormData(event.currentTarget), "email");
    setBusy(true);
    setFailed(false);
    try {
      setSent(await auth.forgotPassword(email));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
      {failed && <FormAlert>{t("auth.genericError")}</FormAlert>}
      {sent !== null && (
        <FormNotice>
          {t("auth.resetSent")}
          {sent.devResetUrl !== null && (
            <>
              {" "}
              <Link href={sent.devResetUrl} className="underline">
                {t("auth.devResetLink")}
              </Link>
            </>
          )}
        </FormNotice>
      )}
      <FormField id="forgot-email" label={t("auth.email")}>
        {(c) => <Input {...c} name="email" type="email" autoComplete="email" required />}
      </FormField>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? t("common.saving") : t("auth.sendReset")}
      </Button>
      <Link href="/login" className="text-sm text-accent-fg underline">
        {t("auth.backToLogin")}
      </Link>
    </form>
  );
}
