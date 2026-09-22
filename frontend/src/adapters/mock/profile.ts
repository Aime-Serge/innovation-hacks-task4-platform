// MF-09: the composed headline and the completeness formula (pack section 3), plus applying a
// PATCH /me/profile body. Field-rule validation lives in ./profile-validate.ts (S-D).
import type { Profile, ProfilePatch } from "@/schemas";
import { DISCIPLINES, SENIORITIES } from "@/generated/profile-lists";
import { needsCompany } from "./profile-validate";

function isBlank(value: string): boolean {
  return value.trim() === "";
}

function label(list: { value: string; label: string }[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

/** The composed headline, e.g. "Senior Backend engineer at Acme" (pack section 3). */
export function composeDisplayHeadline(profile: Profile): string {
  if (profile.headline !== null && !isBlank(profile.headline)) return profile.headline;
  const seniority = label(SENIORITIES, profile.seniority);
  const discipline = label(DISCIPLINES, profile.discipline);
  const base = `${seniority} ${discipline} engineer`;
  return profile.companyName !== null && !isBlank(profile.companyName)
    ? `${base} at ${profile.companyName}`
    : base;
}

export type Completeness = { percent: number; next: string | null };

/** Pack section 3: registration alone earns 50; each remaining item is worth its points. */
export function computeCompleteness(user: {
  givenName: string | null;
  familyName: string | null;
  profile: Profile | null;
}): Completeness {
  const profile = user.profile;
  if (profile === null) return { percent: 0, next: "Complete your professional profile." };
  let percent = 0;
  if (user.givenName !== null && user.familyName !== null) percent += 10;
  percent += 15; // discipline + seniority: always set once a profile row exists
  const employmentOk =
    !needsCompany(profile.employmentStatus) ||
    (profile.companyName !== null && profile.jobTitle !== null);
  if (employmentOk) percent += 15;
  if (profile.country !== "ZZ" && profile.timeZone !== "") percent += 10;

  const steps: [boolean, number, string][] = [
    [profile.headline !== null && !isBlank(profile.headline), 10, "Add a short headline."],
    [!isBlank(profile.about), 15, "Write a short About section."],
    [profile.skills.length >= 3, 15, "Add at least 3 skills."],
    [
      profile.links.github !== null ||
        profile.links.linkedin !== null ||
        profile.links.website !== null,
      10,
      "Add at least one link (GitHub, LinkedIn or a website).",
    ],
  ];
  let next: string | null = null;
  for (const [done, points, message] of steps) {
    if (done) percent += points;
    else next ??= message;
  }
  return { percent: Math.min(100, percent), next: percent >= 100 ? null : next };
}

/** Applies a PATCH /me/profile body to a profile, recomputing the display headline. */
export function applyProfilePatch(profile: Profile, patch: ProfilePatch): Profile {
  const next: Profile = {
    ...profile,
    ...(patch.discipline !== undefined ? { discipline: patch.discipline } : {}),
    ...(patch.seniority !== undefined ? { seniority: patch.seniority } : {}),
    ...(patch.employmentStatus !== undefined ? { employmentStatus: patch.employmentStatus } : {}),
    ...("companyName" in patch ? { companyName: patch.companyName ?? null } : {}),
    ...("jobTitle" in patch ? { jobTitle: patch.jobTitle ?? null } : {}),
    ...(patch.country !== undefined ? { country: patch.country } : {}),
    ...("city" in patch ? { city: patch.city ?? null } : {}),
    ...(patch.timeZone !== undefined ? { timeZone: patch.timeZone } : {}),
    ...("headline" in patch ? { headline: patch.headline ?? null } : {}),
    ...(patch.about !== undefined ? { about: patch.about } : {}),
    links: { ...profile.links, ...(patch.links ?? {}) },
  };
  return { ...next, displayHeadline: composeDisplayHeadline(next) };
}
