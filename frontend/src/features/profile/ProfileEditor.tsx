"use client";

import { useState } from "react";
import { COUNTRIES } from "@/generated/profile-lists";
import { t } from "@/i18n";
import type { Me } from "@/schemas";
import { ServiceError } from "@/services/types";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input, Select, Textarea } from "@/ui/Input";
import { useToast } from "@/ui/Toast";
import { useUpdateProfile } from "../data/hooks";
import { EmploymentFields } from "./EmploymentFields";
import { validateGithub, validateLinkedin, validateWebsite } from "./links-validate";
import { fieldErrorsFrom, fieldsOf, patchOf, type Fields } from "./profile-editor-fields";
import { ProfileLinksFields } from "./ProfileLinksFields";
import { SkillsEditor } from "./SkillsEditor";

/** MF-08: every field validated, saved and error-reported against PATCH /me/profile. */
export function ProfileEditor({ me }: { me: Me }) {
  const [fields, setFields] = useState<Fields>(() => fieldsOf(me));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const update = useUpdateProfile();
  const toast = useToast();

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const linkErrors: Record<string, string> = {};
    if (!validateGithub(fields.github)) linkErrors["github"] = t("editor.links.github.invalid");
    if (!validateLinkedin(fields.linkedin))
      linkErrors["linkedin"] = t("editor.links.linkedin.invalid");
    if (!validateWebsite(fields.website)) linkErrors["website"] = t("editor.links.website.invalid");
    if (Object.keys(linkErrors).length > 0) {
      setErrors(linkErrors);
      return;
    }
    const patch = patchOf(fields, fieldsOf(me));
    if (Object.keys(patch).length === 0) return;
    try {
      await update.mutateAsync(patch);
      setErrors({});
      toast.notify("success", t("editor.saved"));
    } catch (failure) {
      if (failure instanceof ServiceError && failure.details) {
        setErrors(fieldErrorsFrom(failure.details));
      } else {
        toast.notify("error", t("form.saveFailed"));
      }
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
      className="flex max-w-2xl flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="edit-given-name" label={t("auth.givenName")} error={errors["givenName"]}>
          {(c) => (
            <Input
              {...c}
              maxLength={60}
              value={fields.givenName}
              onChange={(e) => set("givenName", e.target.value)}
            />
          )}
        </FormField>
        <FormField id="edit-family-name" label={t("auth.familyName")} error={errors["familyName"]}>
          {(c) => (
            <Input
              {...c}
              maxLength={60}
              value={fields.familyName}
              onChange={(e) => set("familyName", e.target.value)}
            />
          )}
        </FormField>
      </div>
      <FormField id="edit-headline" label={t("editor.headline")} error={errors["headline"]}>
        {(c) => (
          <Input
            {...c}
            maxLength={120}
            value={fields.headline}
            onChange={(e) => set("headline", e.target.value)}
          />
        )}
      </FormField>
      <EmploymentFields
        idPrefix="edit"
        discipline={fields.discipline}
        seniority={fields.seniority}
        employmentStatus={fields.employmentStatus}
        companyName={fields.companyName}
        jobTitle={fields.jobTitle}
        errors={errors}
        onDiscipline={(v) => set("discipline", v)}
        onSeniority={(v) => set("seniority", v)}
        onEmploymentStatus={(v) => set("employmentStatus", v)}
        onCompanyName={(v) => set("companyName", v)}
        onJobTitle={(v) => set("jobTitle", v)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="edit-country" label={t("auth.country")} error={errors["country"]}>
          {(c) => (
            <Select {...c} value={fields.country} onChange={(e) => set("country", e.target.value)}>
              <option value="">{t("auth.chooseOne")}</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="edit-city" label={t("auth.city")} error={errors["city"]}>
          {(c) => (
            <Input
              {...c}
              maxLength={80}
              value={fields.city}
              onChange={(e) => set("city", e.target.value)}
            />
          )}
        </FormField>
      </div>
      <FormField id="edit-about" label={t("editor.about")} error={errors["about"]}>
        {(c) => (
          <Textarea
            {...c}
            maxLength={500}
            value={fields.about}
            onChange={(e) => set("about", e.target.value)}
          />
        )}
      </FormField>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-fg">{t("editor.skills")}</legend>
        <SkillsEditor skills={me.profile?.skills ?? []} />
      </fieldset>
      <ProfileLinksFields fields={fields} errors={errors} onChange={set} />
      <div>
        <Button type="submit" variant="primary" disabled={update.isPending}>
          {update.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
