// S-D: the four fixture team members, with a full minimal profile each, split out of
// fixtures.ts to keep it under the house line-length rule.
import type { Profile, User } from "@/schemas";
import { composeDisplayHeadline } from "./profile";

function profileOf(input: {
  discipline: Profile["discipline"];
  seniority: Profile["seniority"];
  employmentStatus: Profile["employmentStatus"];
  companyName?: string | null;
  jobTitle?: string | null;
  country: string;
  city?: string | null;
  timeZone: string;
  headline?: string | null;
  about?: string;
  skills?: string[];
  links?: Partial<Profile["links"]>;
}): Profile {
  const base: Profile = {
    discipline: input.discipline,
    seniority: input.seniority,
    employmentStatus: input.employmentStatus,
    companyName: input.companyName ?? null,
    jobTitle: input.jobTitle ?? null,
    country: input.country,
    city: input.city ?? null,
    timeZone: input.timeZone,
    headline: input.headline ?? null,
    displayHeadline: null,
    about: input.about ?? "",
    links: { github: null, linkedin: null, website: null, ...input.links },
    skills: input.skills ?? [],
  };
  return { ...base, displayHeadline: composeDisplayHeadline(base) };
}

export const USERS: User[] = [
  {
    id: "user-1",
    name: "Aime Serge UKOBIZABA",
    givenName: "Aime Serge",
    familyName: "UKOBIZABA",
    email: "aime.serge@example.com",
    role: "developer",
    preferences: { theme: "dark" },
    createdAt: "2029-11-01T09:00:00.000Z",
    profile: profileOf({
      discipline: "backend",
      seniority: "senior",
      employmentStatus: "employed",
      companyName: "DevDash Inc.",
      jobTitle: "Backend Engineer",
      country: "RW",
      city: "Kigali",
      timeZone: "Africa/Kigali",
      about: "I build the services behind DevDash and keep the API contract honest.",
      skills: ["Python", "PostgreSQL", "FastAPI"],
      links: { github: "https://github.com/aime-serge" },
    }),
  },
  {
    id: "user-2",
    name: "Amara Diallo",
    givenName: "Amara",
    familyName: "Diallo",
    email: "amara.diallo@example.com",
    role: "lead",
    preferences: { theme: "dark" },
    createdAt: "2029-10-15T09:00:00.000Z",
    profile: profileOf({
      discipline: "full_stack",
      seniority: "lead_or_above",
      employmentStatus: "employed",
      companyName: "DevDash Inc.",
      jobTitle: "Engineering Lead",
      country: "SN",
      city: "Dakar",
      timeZone: "Africa/Dakar",
      about: "Leading the team building DevDash end to end.",
      skills: ["TypeScript", "React", "Leadership"],
      links: { linkedin: "https://linkedin.com/in/amaradiallo" },
    }),
  },
  {
    id: "user-3",
    name: "Kwame Mensah",
    givenName: "Kwame",
    familyName: "Mensah",
    email: "kwame.mensah@example.com",
    role: "developer",
    preferences: { theme: "dark" },
    createdAt: "2029-12-02T09:00:00.000Z",
    // Privacy switch off (see fixtures.ts's PRIVACY map): MB-02, MT-07, MT-14 exercise this member.
    profile: profileOf({
      discipline: "mobile",
      seniority: "mid",
      employmentStatus: "freelance",
      companyName: "Independent",
      jobTitle: "Mobile Developer",
      country: "GH",
      city: "Accra",
      timeZone: "Africa/Accra",
      about: "Freelance mobile engineer, currently between long contracts.",
      skills: ["Kotlin", "Swift"],
    }),
  },
  {
    id: "user-4",
    name: "Sofia Alvarez",
    givenName: "Sofia",
    familyName: "Alvarez",
    email: "sofia.alvarez@example.com",
    role: "developer",
    preferences: { theme: "dark" },
    createdAt: "2030-01-05T09:00:00.000Z",
    profile: profileOf({
      discipline: "data_ai",
      seniority: "junior",
      employmentStatus: "student",
      country: "ES",
      city: "Madrid",
      timeZone: "Europe/Madrid",
      about: "",
      skills: [],
    }),
  },
];
