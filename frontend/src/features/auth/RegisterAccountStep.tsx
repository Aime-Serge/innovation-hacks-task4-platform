import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import type { Account, AccountErrors } from "./registration-form";

function StepHeading({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  // Pack section 3: focus moves to the step heading on each change.
  useEffect(() => ref.current?.focus(), []);
  return (
    <h2 ref={ref} tabIndex={-1} className="text-lg font-semibold outline-none">
      {text}
    </h2>
  );
}

type Props = {
  account: Account;
  errors: AccountErrors;
  busy: boolean;
  onChange: (account: Account) => void;
  onBlurField: (field: keyof Account) => void;
  onNext: () => void;
};

/** MF-01 step 1: the account fields (given/family name, email, password with a show toggle). */
export function RegisterAccountStep({
  account,
  errors,
  busy,
  onChange,
  onBlurField,
  onNext,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <StepHeading text={t("auth.stepAccount.heading")} />
      <FormField id="reg-given-name" label={t("auth.givenName")} error={errors.givenName}>
        {(c) => (
          <Input
            {...c}
            name="givenName"
            autoComplete="given-name"
            required
            maxLength={60}
            value={account.givenName}
            onChange={(e) => onChange({ ...account, givenName: e.target.value })}
            onBlur={() => onBlurField("givenName")}
          />
        )}
      </FormField>
      <FormField id="reg-family-name" label={t("auth.familyName")} error={errors.familyName}>
        {(c) => (
          <Input
            {...c}
            name="familyName"
            autoComplete="family-name"
            required
            maxLength={60}
            value={account.familyName}
            onChange={(e) => onChange({ ...account, familyName: e.target.value })}
            onBlur={() => onBlurField("familyName")}
          />
        )}
      </FormField>
      <FormField id="reg-email" label={t("auth.email")} error={errors.email}>
        {(c) => (
          <Input
            {...c}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={account.email}
            onChange={(e) => onChange({ ...account, email: e.target.value })}
            onBlur={() => onBlurField("email")}
          />
        )}
      </FormField>
      <FormField id="reg-password" label={t("auth.password")} error={errors.password}>
        {(c) => (
          <div className="flex gap-2">
            <Input
              {...c}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={account.password}
              onChange={(e) => onChange({ ...account, password: e.target.value })}
              onBlur={() => onBlurField("password")}
            />
            <Button type="button" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            </Button>
          </div>
        )}
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? t("auth.validating") : t("auth.next")}
        </Button>
      </div>
    </form>
  );
}
