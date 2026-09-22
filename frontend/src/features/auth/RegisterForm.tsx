"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { t } from "@/i18n";
import { hardNavigate } from "@/lib/navigation";
import { setWelcomeFlag } from "@/lib/welcome";
import { ServiceError } from "@/services/types";
import { ProgressBar } from "@/ui/ProgressBar";
import { FormAlert } from "./messages";
import { RegisterAccountStep } from "./RegisterAccountStep";
import { RegisterProfileStep } from "./RegisterProfileStep";
import {
  emptyAccount,
  emptyProfile,
  errorsFrom,
  profileBlock,
  type Account,
  type AccountErrors,
  type ProfileDraftForm,
  type ProfileErrors,
} from "./registration-form";

const LINK_FIELD_MAP = { "links.github": "links", "links.linkedin": "links" };

/** MF-01: two-step registration (account, then professional details and consent). */
export function RegisterForm() {
  const { auth, login } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [account, setAccount] = useState<Account>(emptyAccount);
  const [accountErrors, setAccountErrors] = useState<AccountErrors>({});
  const [profile, setProfile] = useState<ProfileDraftForm>(emptyProfile);
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checkStep1 = async () => {
    try {
      await auth.validateRegistration({ step: 1, ...account });
      setAccountErrors({});
    } catch (failure) {
      if (failure instanceof ServiceError && failure.status === 422) {
        setAccountErrors(errorsFrom(failure));
      }
    }
  };

  const goNext = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await auth.validateRegistration({ step: 1, ...account });
      setAccountErrors({});
      setStep(2);
    } catch (failure) {
      if (failure instanceof ServiceError && failure.status === 422) {
        setAccountErrors(errorsFrom(failure));
      } else {
        setFormError(t("auth.genericError"));
      }
    } finally {
      setBusy(false);
    }
  };

  const checkStep2 = async () => {
    try {
      await auth.validateRegistration({
        step: 2,
        profile: profileBlock(profile),
        termsAccepted: profile.termsAccepted,
        ageConfirmed: profile.ageConfirmed,
      });
      setProfileErrors({});
    } catch (failure) {
      setProfileErrors(errorsFrom(failure, LINK_FIELD_MAP));
    }
  };

  const submit = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await auth.register({
        givenName: account.givenName.trim(),
        familyName: account.familyName.trim(),
        email: account.email.trim(),
        password: account.password,
        profile: profileBlock(profile),
        termsAccepted: true,
        ageConfirmed: true,
      });
      // MF-01: a successful registration signs the person in.
      await login(account.email.trim(), account.password);
      setWelcomeFlag();
      // MF-01 (was: the mock sent the person to /login instead; see supersession-log.md).
      hardNavigate("/");
    } catch (failure) {
      handleSubmitFailure(failure);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitFailure = (failure: unknown) => {
    if (!(failure instanceof ServiceError)) {
      setFormError(t("auth.genericError"));
      return;
    }
    if (failure.status === 422) setProfileErrors(errorsFrom(failure, LINK_FIELD_MAP));
    else if (failure.status === 409) {
      setStep(1);
      setAccountErrors({ email: t("auth.emailTaken") });
    } else if (failure.code === "REGISTRATION_DISABLED") setFormError(t("auth.registrationClosed"));
    else if (failure.status === 429) setFormError(t("auth.tooManyAttempts"));
    else setFormError(t("auth.genericError"));
  };

  return (
    <div className="flex flex-col gap-4">
      <ProgressBar value={step === 1 ? 50 : 100} label={t("auth.step", { step, total: 2 })} />
      <p className="text-sm text-muted">{t("auth.step", { step, total: 2 })}</p>
      {formError !== null && <FormAlert>{formError}</FormAlert>}
      {step === 1 ? (
        <RegisterAccountStep
          account={account}
          errors={accountErrors}
          busy={busy}
          onChange={setAccount}
          onBlurField={() => void checkStep1()}
          onNext={() => void goNext()}
        />
      ) : (
        <RegisterProfileStep
          profile={profile}
          errors={profileErrors}
          busy={busy}
          onChange={setProfile}
          onBlurField={() => void checkStep2()}
          onBack={() => setStep(1)}
          onSubmit={() => void submit()}
        />
      )}
      <p className="text-sm">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="text-accent-fg underline">
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
