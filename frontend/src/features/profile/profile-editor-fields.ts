// MF-08: the editor's local field shape and the diff against PATCH /me/profile, split out of
// ProfileEditor.tsx to keep it under the house line-length rule.
import type { Discipline, EmploymentStatus, Me, ProfilePatch, Seniority } from "@/schemas";

export type Fields = {
  givenName: string;
  familyName: string;
  discipline: string;
  seniority: string;
  employmentStatus: EmploymentStatus;
  companyName: string;
  jobTitle: string;
  country: string;
  city: string;
  headline: string;
  about: string;
  github: string;
  linkedin: string;
  website: string;
};

export function fieldsOf(me: Me): Fields {
  const p = me.profile;
  return {
    givenName: me.givenName ?? "",
    familyName: me.familyName ?? "",
    discipline: p?.discipline ?? "backend",
    seniority: p?.seniority ?? "mid",
    employmentStatus: p?.employmentStatus ?? "employed",
    companyName: p?.companyName ?? "",
    jobTitle: p?.jobTitle ?? "",
    country: p?.country ?? "",
    city: p?.city ?? "",
    headline: p?.headline ?? "",
    about: p?.about ?? "",
    github: p?.links.github ?? "",
    linkedin: p?.links.linkedin ?? "",
    website: p?.links.website ?? "",
  };
}

/** Only the fields that changed, matching PATCH /me/profile's "send only what changes" rule. */
export function patchOf(fields: Fields, original: Fields): ProfilePatch {
  const patch: ProfilePatch = {};
  if (fields.givenName !== original.givenName) patch.givenName = fields.givenName;
  if (fields.familyName !== original.familyName) patch.familyName = fields.familyName;
  if (fields.discipline !== original.discipline) patch.discipline = fields.discipline as Discipline;
  if (fields.seniority !== original.seniority) patch.seniority = fields.seniority as Seniority;
  if (fields.employmentStatus !== original.employmentStatus) {
    patch.employmentStatus = fields.employmentStatus;
  }
  if (fields.companyName !== original.companyName) {
    patch.companyName = fields.companyName === "" ? null : fields.companyName;
  }
  if (fields.jobTitle !== original.jobTitle) {
    patch.jobTitle = fields.jobTitle === "" ? null : fields.jobTitle;
  }
  if (fields.country !== original.country) patch.country = fields.country;
  if (fields.city !== original.city) patch.city = fields.city === "" ? null : fields.city;
  if (fields.headline !== original.headline) {
    patch.headline = fields.headline === "" ? null : fields.headline;
  }
  if (fields.about !== original.about) patch.about = fields.about;
  const links: NonNullable<ProfilePatch["links"]> = {};
  if (fields.github !== original.github) links.github = fields.github === "" ? null : fields.github;
  if (fields.linkedin !== original.linkedin) {
    links.linkedin = fields.linkedin === "" ? null : fields.linkedin;
  }
  if (fields.website !== original.website) {
    links.website = fields.website === "" ? null : fields.website;
  }
  if (Object.keys(links).length > 0) patch.links = links;
  return patch;
}

/** Maps a 422's dotted `links.*` field names onto the flat field keys the form uses. */
export function fieldErrorsFrom(
  details: readonly { field: string; message: string }[],
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const d of details) {
    const key =
      d.field === "links.github" ? "github" : d.field === "links.linkedin" ? "linkedin" : d.field;
    mapped[key] = d.message;
  }
  return mapped;
}
