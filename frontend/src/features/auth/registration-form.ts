// MF-01, S-A: shared types and pure helpers for the two-step registration wizard, split out of
// the components to keep files under the house line-length rule.
import type { EmploymentStatus, ProfileDraft } from "@/schemas";
import { ServiceError } from "@/services/types";

export type Account = { givenName: string; familyName: string; email: string; password: string };
export type AccountErrors = Partial<Record<keyof Account, string>>;

export const emptyAccount: Account = { givenName: "", familyName: "", email: "", password: "" };

export function defaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export type ProfileDraftForm = ProfileDraft & { termsAccepted: boolean; ageConfirmed: boolean };

export function emptyProfile(): ProfileDraftForm {
  return {
    discipline: "backend",
    seniority: "mid",
    employmentStatus: "employed",
    companyName: null,
    jobTitle: null,
    country: "",
    city: null,
    timeZone: defaultTimeZone(),
    termsAccepted: false,
    ageConfirmed: false,
  };
}

export type ProfileErrors = Partial<Record<keyof ProfileDraftForm, string>>;

/** Maps a 422's `[{field, message}]` details onto plain field-name keys. */
export function errorsFrom(
  failure: unknown,
  map: Record<string, string> = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  if (failure instanceof ServiceError && failure.details) {
    for (const d of failure.details) out[map[d.field] ?? d.field] = d.message;
  }
  return out;
}

export function needsCompany(status: EmploymentStatus): boolean {
  return status === "employed" || status === "freelance";
}

export function profileBlock(profile: ProfileDraftForm): ProfileDraft {
  return {
    discipline: profile.discipline,
    seniority: profile.seniority,
    employmentStatus: profile.employmentStatus,
    companyName: profile.companyName === "" ? null : profile.companyName,
    jobTitle: profile.jobTitle === "" ? null : profile.jobTitle,
    country: profile.country,
    city: profile.city === "" ? null : profile.city,
    timeZone: profile.timeZone,
  };
}
