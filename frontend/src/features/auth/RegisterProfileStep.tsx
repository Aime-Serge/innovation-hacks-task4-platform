import { useEffect, useRef } from "react";
import { COUNTRIES } from "@/generated/profile-lists";
import { t } from "@/i18n";
import type { ProfileDraft } from "@/schemas";
import { EmploymentFields } from "@/features/profile/EmploymentFields";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { FormField } from "@/ui/FormField";
import { Input, Select } from "@/ui/Input";
import { RegisterAvatarField } from "./RegisterAvatarField";
import type { ProfileDraftForm, ProfileErrors } from "./registration-form";

function StepHeading({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h2 ref={ref} tabIndex={-1} className="text-lg font-semibold outline-none">
      {text}
    </h2>
  );
}

type Props = {
  profile: ProfileDraftForm;
  errors: ProfileErrors;
  busy: boolean;
  onChange: (profile: ProfileDraftForm) => void;
  onBlurField: () => void;
  onBack: () => void;
  onSubmit: () => void;
  /** ADR-426: a top-level field, not part of the profile block above. */
  avatarUrl: string | null;
  avatarError: string | undefined;
  onAvatarChange: (avatarUrl: string | null) => void;
  onAvatarError: (message: string | undefined) => void;
};

/** MF-01 step 2: professional details, a photo, and consent. */
export function RegisterProfileStep({
  profile,
  errors,
  busy,
  onChange,
  onBlurField,
  onBack,
  onSubmit,
  avatarUrl,
  avatarError,
  onAvatarChange,
  onAvatarError,
}: Props) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <StepHeading text={t("auth.stepProfile.heading")} />
      <EmploymentFields
        idPrefix="reg"
        autoComplete
        discipline={profile.discipline}
        seniority={profile.seniority}
        employmentStatus={profile.employmentStatus}
        companyName={profile.companyName ?? ""}
        jobTitle={profile.jobTitle ?? ""}
        errors={errors}
        onBlurField={onBlurField}
        onDiscipline={(v) => onChange({ ...profile, discipline: v as ProfileDraft["discipline"] })}
        onSeniority={(v) => onChange({ ...profile, seniority: v as ProfileDraft["seniority"] })}
        onEmploymentStatus={(v) => onChange({ ...profile, employmentStatus: v })}
        onCompanyName={(v) => onChange({ ...profile, companyName: v })}
        onJobTitle={(v) => onChange({ ...profile, jobTitle: v })}
      />
      <FormField id="reg-country" label={t("auth.country")} error={errors.country}>
        {(c) => (
          <Select
            {...c}
            name="country"
            autoComplete="country-name"
            value={profile.country}
            onChange={(e) => onChange({ ...profile, country: e.target.value })}
            onBlur={onBlurField}
          >
            <option value="">{t("auth.chooseOne")}</option>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField id="reg-city" label={t("auth.city")} error={errors.city}>
        {(c) => (
          <Input
            {...c}
            name="city"
            maxLength={80}
            value={profile.city ?? ""}
            onChange={(e) => onChange({ ...profile, city: e.target.value })}
            onBlur={onBlurField}
          />
        )}
      </FormField>
      <FormField id="reg-timezone" label={t("auth.timeZone")} error={errors.timeZone}>
        {(c) => (
          <Input
            {...c}
            name="timeZone"
            maxLength={64}
            value={profile.timeZone}
            onChange={(e) => onChange({ ...profile, timeZone: e.target.value })}
            onBlur={onBlurField}
          />
        )}
      </FormField>
      <RegisterAvatarField
        avatarUrl={avatarUrl}
        avatarError={avatarError}
        onAvatarChange={onAvatarChange}
        onAvatarError={onAvatarError}
      />
      <Checkbox
        id="reg-terms"
        label={t("auth.termsAccepted")}
        checked={profile.termsAccepted}
        onCheckedChange={(v) => onChange({ ...profile, termsAccepted: v })}
      />
      <Checkbox
        id="reg-age"
        label={t("auth.ageConfirmed")}
        checked={profile.ageConfirmed}
        onCheckedChange={(v) => onChange({ ...profile, ageConfirmed: v })}
      />
      <div className="flex justify-between">
        <Button type="button" onClick={onBack}>
          {t("auth.back")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !profile.termsAccepted || !profile.ageConfirmed}
        >
          {busy ? t("auth.creating") : t("auth.createAccount")}
        </Button>
      </div>
    </form>
  );
}
