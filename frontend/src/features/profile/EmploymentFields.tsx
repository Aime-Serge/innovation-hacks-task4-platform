import { DISCIPLINES, EMPLOYMENT_STATUSES, SENIORITIES } from "@/generated/profile-lists";
import { t } from "@/i18n";
import type { EmploymentStatus } from "@/schemas";
import { FormField } from "@/ui/FormField";
import { Input, Select } from "@/ui/Input";

/** MB-03: company and job title are required only when employed or freelance. */
function needsCompany(status: EmploymentStatus): boolean {
  return status === "employed" || status === "freelance";
}

type FieldErrors = Partial<
  Record<"discipline" | "seniority" | "employmentStatus" | "companyName" | "jobTitle", string>
>;

type Props = {
  idPrefix: string;
  discipline: string;
  seniority: string;
  employmentStatus: EmploymentStatus;
  companyName: string;
  jobTitle: string;
  errors: FieldErrors;
  onDiscipline: (value: string) => void;
  onSeniority: (value: string) => void;
  onEmploymentStatus: (value: EmploymentStatus) => void;
  onCompanyName: (value: string) => void;
  onJobTitle: (value: string) => void;
  onBlurField?: () => void;
  autoComplete?: boolean;
};

/** Discipline, seniority, employment status, and company/job title when they apply (MB-03).
 * Shared by the registration wizard's step 2 and the profile editor. */
export function EmploymentFields({
  idPrefix,
  discipline,
  seniority,
  employmentStatus,
  companyName,
  jobTitle,
  errors,
  onDiscipline,
  onSeniority,
  onEmploymentStatus,
  onCompanyName,
  onJobTitle,
  onBlurField,
  autoComplete = false,
}: Props) {
  const showCompany = needsCompany(employmentStatus);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-discipline`}
          label={t("auth.discipline")}
          error={errors.discipline}
        >
          {(c) => (
            <Select
              {...c}
              value={discipline}
              onChange={(e) => onDiscipline(e.target.value)}
              onBlur={onBlurField}
            >
              {DISCIPLINES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          id={`${idPrefix}-seniority`}
          label={t("auth.seniority")}
          error={errors.seniority}
        >
          {(c) => (
            <Select
              {...c}
              value={seniority}
              onChange={(e) => onSeniority(e.target.value)}
              onBlur={onBlurField}
            >
              {SENIORITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      <FormField
        id={`${idPrefix}-employment`}
        label={t("auth.employmentStatus")}
        error={errors.employmentStatus}
      >
        {(c) => (
          <Select
            {...c}
            value={employmentStatus}
            onChange={(e) => onEmploymentStatus(e.target.value as EmploymentStatus)}
            onBlur={onBlurField}
          >
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {showCompany && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            id={`${idPrefix}-company`}
            label={t("auth.companyName")}
            error={errors.companyName}
          >
            {(c) => (
              <Input
                {...c}
                autoComplete={autoComplete ? "organization" : undefined}
                maxLength={120}
                value={companyName}
                onChange={(e) => onCompanyName(e.target.value)}
                onBlur={onBlurField}
              />
            )}
          </FormField>
          <FormField
            id={`${idPrefix}-job-title`}
            label={t("auth.jobTitle")}
            error={errors.jobTitle}
          >
            {(c) => (
              <Input
                {...c}
                autoComplete={autoComplete ? "organization-title" : undefined}
                maxLength={100}
                value={jobTitle}
                onChange={(e) => onJobTitle(e.target.value)}
                onBlur={onBlurField}
              />
            )}
          </FormField>
        </div>
      )}
    </>
  );
}
