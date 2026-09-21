import {
  array,
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

export const User = object({
  id: string().check(minLength(1)),
  name: string().check(minLength(1), maxLength(80)),
  email: email(),
  role: Role,
  avatarUrl: optional(string()),
  preferences: object({ theme: Theme }),
});
export type User = Infer<typeof User>;

export const Project = object({
  id: string().check(minLength(1)),
  name: string().check(minLength(1), maxLength(80)),
  description: string().check(maxLength(500)),
  status: ProjectStatus,
  dueDate: IsoDate,
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
export const ApiErrorBody = object({
  error: object({ code: string(), message: string() }),
});
export type ApiErrorBody = Infer<typeof ApiErrorBody>;
