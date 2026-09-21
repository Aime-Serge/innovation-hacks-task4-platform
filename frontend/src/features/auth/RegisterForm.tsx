"use client";

import Link from "next/link";
import { useState, type SyntheticEvent } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { t } from "@/i18n";
import { dataSource } from "@/lib/data-source";
import { formText } from "@/lib/form";
import { hardNavigate } from "@/lib/navigation";
import { ServiceError } from "@/services/types";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { FormAlert } from "./messages";

const MIN_PASSWORD = 8;

/** Registering signs the person in on the real API; the mock sends them to the login page. */
export function RegisterForm() {
  const { auth } = useAuth();
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => formText(form, key);
    if (text("password").length < MIN_PASSWORD) {
      setErrors({ password: t("auth.passwordShort", { min: MIN_PASSWORD }) });
      return;
    }
    if (text("password") !== text("confirm")) {
      setErrors({ password: t("auth.passwordMismatch") });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await auth.register(text("name").trim(), text("email").trim(), text("password"));
      // The real API signs the new person in (FR-401); the Task 1 mock only creates the account.
      hardNavigate(dataSource() === "http" ? "/" : "/login?registered=1");
    } catch (failure) {
      const conflict = failure instanceof ServiceError && failure.status === 409;
      const closed = failure instanceof ServiceError && failure.code === "REGISTRATION_DISABLED";
      const limited = failure instanceof ServiceError && failure.status === 429;
      if (conflict) setErrors({ email: t("auth.emailTaken") });
      else if (closed) setErrors({ form: t("auth.registrationClosed") });
      else if (limited) setErrors({ form: t("auth.tooManyAttempts") });
      else setErrors({ form: t("auth.genericError") });
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
      {errors.form !== undefined && <FormAlert>{errors.form}</FormAlert>}
      <FormField id="reg-name" label={t("auth.name")}>
        {(c) => <Input {...c} name="name" autoComplete="name" required maxLength={80} />}
      </FormField>
      <FormField id="reg-email" label={t("auth.email")} error={errors.email}>
        {(c) => <Input {...c} name="email" type="email" autoComplete="email" required />}
      </FormField>
      <FormField id="reg-password" label={t("auth.password")} error={errors.password}>
        {(c) => (
          <Input {...c} name="password" type="password" autoComplete="new-password" required />
        )}
      </FormField>
      <FormField id="reg-confirm" label={t("auth.confirmPassword")}>
        {(c) => (
          <Input {...c} name="confirm" type="password" autoComplete="new-password" required />
        )}
      </FormField>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? t("auth.creating") : t("auth.createAccount")}
      </Button>
      <p className="text-sm">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="text-accent-fg underline">
          {t("auth.login")}
        </Link>
      </p>
    </form>
  );
}
