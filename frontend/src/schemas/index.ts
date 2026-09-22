import {
  array,
  boolean,
  email,
  enum as zenum,
  int,
  iso,
  maxLength,
  minLength,
  nonnegative,
  nullable,
  object,
  omit,
  optional,
  string,
  type infer as Infer,
  type ZodMiniType,
} from "zod/mini";

// Every type in the app is inferred from these schemas (no hand-written
// duplicates). The mock adapter parses every response with them, so a parse
// failure surfaces as an error state (TH-03). zod/mini is Zod with a
// tree-shakeable API: the classic build alone was ~75 KB gzip of the first-load
// JavaScript, which broke the 170 KB budget (NFR-04).

export const TaskStatus = zenum(["todo", "in_progress", "in_review", "done"]);
export type TaskStatus = Infer<typeof TaskStatus>;

export const Priority = zenum(["low", "medium", "high", "urgent"]);
export type Priority = Infer<typeof Priority>;

export const ProjectStatus = zenum(["planned", "active", "on_hold", "completed"]);
export type ProjectStatus = Infer<typeof ProjectStatus>;

export const Role = zenum(["developer", "lead"]);
export type Role = Infer<typeof Role>;

export const Theme = zenum(["light", "dark", "system"]);
export type Theme = Infer<typeof Theme>;

export const ActivityType = zenum(["created", "status_changed", "completed"]);
export type ActivityType = Infer<typeof ActivityType>;

export const Scenario = zenum([
  "default",
  "loading",
  "empty",
  "error",
  "partial-error",
  "flaky",
  "update-fails",
  "large",
  "edge-text",
]);
export type Scenario = Infer<typeof Scenario>;

const IsoDate = iso.date();

// MF-02: the three enumerations also appear in openapi.json and in one JSON
// file shared with the API and the migration (src/generated/profile-lists.ts).
export const Discipline = zenum([
  "backend",
  "frontend",
  "full_stack",
  "mobile",
  "devops_cloud",
  "data_ai",
  "security",
  "qa",
  "other",
]);
export type Discipline = Infer<typeof Discipline>;

export const Seniority = zenum(["student_intern", "junior", "mid", "senior", "lead_or_above"]);
export type Seniority = Infer<typeof Seniority>;

export const EmploymentStatus = zenum(["employed", "freelance", "student", "between_roles"]);
export type EmploymentStatus = Infer<typeof EmploymentStatus>;

export const ProfileLinks = object({
  github: nullable(string()),
  linkedin: nullable(string()),
  website: nullable(string()),
});
export type ProfileLinks = Infer<typeof ProfileLinks>;

// MB-02: null on another member's user means either the switch is off or there
// is no profile row; the two are indistinguishable on purpose.
export const Profile = object({
  discipline: Discipline,
  seniority: Seniority,
  employmentStatus: EmploymentStatus,
  companyName: nullable(string()),
  jobTitle: nullable(string()),
  country: string().check(minLength(2), maxLength(2)),
  city: nullable(string()),
  timeZone: string().check(minLength(1)),
  headline: nullable(string()),
  displayHeadline: nullable(string()),
  about: string(),
  links: ProfileLinks,
  skills: array(string()),
});
export type Profile = Infer<typeof Profile>;

export const Stats = object({
  projectsOwned: int().check(nonnegative()),
  tasksDone: int().check(nonnegative()),
  tasksOpen: int().check(nonnegative()),
});
export type Stats = Infer<typeof Stats>;

export const Completeness = object({
  percent: int().check(nonnegative()),
  next: nullable(string()),
});
export type Completeness = Infer<typeof Completeness>;

export const Privacy = object({ showProfessionalDetails: boolean() });
export type Privacy = Infer<typeof Privacy>;

export const User = object({
  id: string().check(minLength(1)),
  name: string().check(minLength(1), maxLength(80)),
  // Null for accounts made before the minimal profile (MF-19 backfill).
  givenName: nullable(string()),
  familyName: nullable(string()),
  // BR-403: the API returns an email only to the user themself and to leads, otherwise null.
  email: nullable(email()),
  role: Role,
  avatarUrl: optional(string()),
  preferences: object({ theme: Theme }),
  // MB-02: present only when the member allows it (or is the signed-in person).
  profile: nullable(Profile),
  createdAt: optional(string()),
});
export type User = Infer<typeof User>;

// GET /me (MF-06, MF-09): the owner's own view, with statistics, completeness
// and the privacy switch that other members never see.
export const Me = object({
  id: string().check(minLength(1)),
  name: string().check(minLength(1), maxLength(80)),
  givenName: nullable(string()),
  familyName: nullable(string()),
  email: nullable(email()),
  role: Role,
  avatarUrl: optional(string()),
  preferences: object({ theme: Theme }),
  profile: nullable(Profile),
  stats: Stats,
  completeness: Completeness,
  privacy: Privacy,
  // True for accounts made before the minimal profile: show the completion prompt.
  legacyProfile: boolean(),
  createdAt: optional(string()),
});
export type Me = Infer<typeof Me>;

export const Project = object({
  id: string().check(minLength(1)),
  name: string().check(minLength(1), maxLength(80)),
  description: string().check(maxLength(2000)),
  status: ProjectStatus,
  dueDate: nullable(IsoDate),
  ownerId: string().check(minLength(1)),
});
export type Project = Infer<typeof Project>;

export const Task = object({
  id: string().check(minLength(1)),
  projectId: string().check(minLength(1)),
  title: string().check(minLength(1), maxLength(120)),
  description: string().check(maxLength(1000)),
  status: TaskStatus,
  priority: Priority,
  dueDate: nullable(IsoDate),
  assigneeId: nullable(string()),
});
export type Task = Infer<typeof Task>;

export const Activity = object({
  id: string().check(minLength(1)),
  actorId: string().check(minLength(1)),
  projectId: string().check(minLength(1)),
  taskId: optional(string()),
  type: ActivityType,
  at: iso.datetime(),
});
export type Activity = Infer<typeof Activity>;

export function pageOf<T extends ZodMiniType>(item: T) {
  return object({ items: array(item), total: int().check(nonnegative()) });
}
export type Page<T> = { items: T[]; total: number };

export const TaskSort = zenum(["due_date", "priority", "title"]);
export type TaskSort = Infer<typeof TaskSort>;

export const ProjectSort = zenum(["name", "due_date"]);
export type ProjectSort = Infer<typeof ProjectSort>;

export const SortDir = zenum(["asc", "desc"]);
export type SortDir = Infer<typeof SortDir>;

export type TaskQuery = {
  q: string;
  status: TaskStatus[];
  priority: Priority[];
  projectId: string[];
  assigneeId: string | null;
  sort: TaskSort;
  dir: SortDir;
};

export type ProjectQuery = {
  q: string;
  status: ProjectStatus[];
  sort: ProjectSort;
  dir: SortDir;
};

export const emptyTaskQuery = (): TaskQuery => ({
  q: "",
  status: [],
  priority: [],
  projectId: [],
  assigneeId: null,
  sort: "due_date",
  dir: "asc",
});

export const emptyProjectQuery = (): ProjectQuery => ({
  q: "",
  status: [],
  sort: "name",
  dir: "asc",
});

export const NewProject = omit(Project, { id: true });
export type NewProject = Infer<typeof NewProject>;
export const NewTask = omit(Task, { id: true });
export type NewTask = Infer<typeof NewTask>;

/** The error envelope, shared with the Task 2 FastAPI backend. */
export const ErrorDetail = object({ field: string(), message: string() });
export type ErrorDetail = Infer<typeof ErrorDetail>;

export const ApiErrorBody = object({
  error: object({
    code: string(),
    message: string(),
    details: optional(nullable(array(ErrorDetail))),
  }),
});
export type ApiErrorBody = Infer<typeof ApiErrorBody>;

// MF-01: registration step 2's professional details, reused by the profile editor (MF-08).
export const ProfileDraft = object({
  discipline: Discipline,
  seniority: Seniority,
  employmentStatus: EmploymentStatus,
  companyName: nullable(string().check(minLength(1), maxLength(120))),
  jobTitle: nullable(string().check(minLength(1), maxLength(100))),
  country: string().check(minLength(2), maxLength(2)),
  city: nullable(string().check(minLength(1), maxLength(80))),
  timeZone: string().check(minLength(1), maxLength(64)),
});
export type ProfileDraft = Infer<typeof ProfileDraft>;

export const RegisterAccount = object({
  givenName: string().check(minLength(1), maxLength(60)),
  familyName: string().check(minLength(1), maxLength(60)),
  email: email().check(maxLength(254)),
  password: string().check(minLength(12), maxLength(128)),
});
export type RegisterAccount = Infer<typeof RegisterAccount>;

// The full registration payload lives in services/auth.ts (RegisterInput), since it is the
// AuthService's input type, not a value ever parsed on its own by this schema module.

// MF-08: PATCH /me/profile sends only what changed.
export type ProfilePatch = Partial<{
  givenName: string;
  familyName: string;
  discipline: Discipline;
  seniority: Seniority;
  employmentStatus: EmploymentStatus;
  companyName: string | null;
  jobTitle: string | null;
  country: string;
  city: string | null;
  timeZone: string;
  headline: string | null;
  about: string;
  links: Partial<ProfileLinks>;
}>;
