// MF-02, MF-08: field-rule validation shared by the mock registration, profile-edit and
// settings endpoints (S-D). The exact wording differs from the backend; the mock only has to
// be internally consistent and catch the same mistakes, since the server is authoritative.
import type { EmploymentStatus, ErrorDetail } from "@/schemas";
import { COUNTRIES, DISCIPLINES, SENIORITIES } from "@/generated/profile-lists";

const detail = (field: string, message: string): ErrorDetail => ({ field, message });

function isBlank(value: string): boolean {
  return value.trim() === "";
}

export function validateGivenOrFamilyName(field: string, value: string): ErrorDetail | null {
  if (isBlank(value)) return detail(field, "This field is required.");
  if (value.length > 60) return detail(field, "Use 60 characters or fewer.");
  return null;
}

export function validateDisplayName(givenName: string, familyName: string): ErrorDetail | null {
  return `${givenName} ${familyName}`.length > 80
    ? detail("familyName", "The full name must be 80 characters or fewer in total.")
    : null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function validateEmailField(email: string): ErrorDetail | null {
  if (isBlank(email)) return detail("email", "Enter an email address.");
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return detail("email", "Enter a valid email address.");
  }
  return null;
}

export function validatePasswordField(
  password: string,
  email: string,
  givenName: string,
  familyName: string,
): ErrorDetail | null {
  if (password.length < 12 || password.length > 128) {
    return detail("password", "Use 12 to 128 characters.");
  }
  const lower = password.toLowerCase();
  const name = `${givenName} ${familyName}`.trim().toLowerCase();
  if (lower === email.trim().toLowerCase() || lower === name) {
    return detail("password", "The password cannot be your email or your name.");
  }
  return null;
}

const DISCIPLINE_VALUES = new Set(DISCIPLINES.map((d) => d.value));
const SENIORITY_VALUES = new Set(SENIORITIES.map((s) => s.value));
const EMPLOYMENT_VALUES = new Set<EmploymentStatus>([
  "employed",
  "freelance",
  "student",
  "between_roles",
]);
const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));
const COUNTRY_RE = /^[A-Z]{2}$/;

export function needsCompany(status: string | null | undefined): boolean {
  return status === "employed" || status === "freelance";
}

export type ProfileDraftLike = {
  discipline?: string | null | undefined;
  seniority?: string | null | undefined;
  employmentStatus?: string | null | undefined;
  companyName?: string | null | undefined;
  jobTitle?: string | null | undefined;
  country?: string | null | undefined;
  city?: string | null | undefined;
  timeZone?: string | null | undefined;
};

/** Step 2 of registration, or the professional block of the editor. `required` mirrors the
 * server's two schemas: ProfileBlock (registration) names every missing field. */
export function validateProfileDraft(
  input: ProfileDraftLike,
  options: { required: boolean } = { required: true },
): ErrorDetail[] {
  const errors: ErrorDetail[] = [];
  const need = options.required;

  if (input.discipline === undefined || input.discipline === null || input.discipline === "") {
    if (need) errors.push(detail("discipline", "Choose a discipline."));
  } else if (!DISCIPLINE_VALUES.has(input.discipline)) {
    errors.push(detail("discipline", "Choose a discipline from the list."));
  }

  if (input.seniority === undefined || input.seniority === null || input.seniority === "") {
    if (need) errors.push(detail("seniority", "Choose a seniority level."));
  } else if (!SENIORITY_VALUES.has(input.seniority)) {
    errors.push(detail("seniority", "Choose a seniority level from the list."));
  }

  if (
    input.employmentStatus === undefined ||
    input.employmentStatus === null ||
    input.employmentStatus === ""
  ) {
    if (need) errors.push(detail("employmentStatus", "Choose an employment status."));
  } else if (!EMPLOYMENT_VALUES.has(input.employmentStatus as EmploymentStatus)) {
    errors.push(detail("employmentStatus", "Choose an employment status from the list."));
  }

  const company = input.companyName ?? null;
  if (company !== null && (isBlank(company) || company.length > 120)) {
    errors.push(detail("companyName", "Use 1 to 120 characters."));
  }
  const jobTitle = input.jobTitle ?? null;
  if (jobTitle !== null && (isBlank(jobTitle) || jobTitle.length > 100)) {
    errors.push(detail("jobTitle", "Use 1 to 100 characters."));
  }
  if (needsCompany(input.employmentStatus ?? undefined)) {
    if (company === null || isBlank(company)) {
      errors.push(detail("companyName", "Enter a company name (or “Independent”)."));
    }
    if (jobTitle === null || isBlank(jobTitle)) {
      errors.push(detail("jobTitle", "Enter a job title."));
    }
  }

  if (input.country === undefined || input.country === null || input.country === "") {
    if (need) errors.push(detail("country", "Choose a country."));
  } else if (!COUNTRY_RE.test(input.country) || !COUNTRY_CODES.has(input.country)) {
    errors.push(detail("country", "Choose a country from the list."));
  }

  const city = input.city ?? null;
  if (city !== null && (isBlank(city) || city.length > 80)) {
    errors.push(detail("city", "Use 1 to 80 characters."));
  }

  if (input.timeZone === undefined || input.timeZone === null || input.timeZone === "") {
    if (need) errors.push(detail("timeZone", "Choose a time zone."));
  } else if (input.timeZone.length > 64) {
    errors.push(detail("timeZone", "Use 64 characters or fewer."));
  }

  return errors;
}

export function validateAbout(about: string): ErrorDetail | null {
  return about.length > 500 ? detail("about", "Use 500 characters or fewer.") : null;
}

export function validateHeadline(headline: string | null): ErrorDetail | null {
  if (headline === null) return null;
  if (isBlank(headline) || headline.length > 120) {
    return detail("headline", "Use 1 to 120 characters.");
  }
  return null;
}

/** MB-05: at most 10, 1-30 characters each, unique ignoring case. */
export function validateSkills(skills: string[]): ErrorDetail | null {
  if (skills.length > 10) return detail("skills", "You can have at most 10 skills.");
  for (const skill of skills) {
    if (isBlank(skill) || skill.length > 30) {
      return detail("skills", "Each skill must be 1 to 30 characters.");
    }
  }
  const seen = new Set<string>();
  for (const skill of skills) {
    const key = skill.trim().toLowerCase();
    if (seen.has(key)) return detail("skills", "Skills must be unique (case does not matter).");
    seen.add(key);
  }
  return null;
}

const HTTPS_RE = /^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^\s]*)?$/;
const GITHUB_RE = /^https:\/\/([A-Za-z0-9-]+\.)?github\.com([/?#][^\s]*)?$/;
const LINKEDIN_RE = /^https:\/\/([A-Za-z0-9-]+\.)?linkedin\.com([/?#][^\s]*)?$/;

/** MB-04: https only, and GitHub/LinkedIn must point to that provider's host. */
export function validateLinks(links: {
  github?: string | null;
  linkedin?: string | null;
  website?: string | null;
}): ErrorDetail[] {
  const errors: ErrorDetail[] = [];
  if (links.github != null && !GITHUB_RE.test(links.github)) {
    errors.push(detail("links.github", "Enter a valid https://github.com link."));
  }
  if (links.linkedin != null && !LINKEDIN_RE.test(links.linkedin)) {
    errors.push(detail("links.linkedin", "Enter a valid https://linkedin.com link."));
  }
  if (links.website != null && !HTTPS_RE.test(links.website)) {
    errors.push(detail("links.website", "Enter a valid https:// link."));
  }
  return errors;
}
