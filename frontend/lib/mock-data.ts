import type { Project, ProjectProgress, Task, User } from "./types";

// This module simulates the REST API that Task 2 will provide.
// fetchProjects()/fetchTasks() intentionally mirror the shape and async
// contract of a real network call (latency + rejectable promise) so that
// swapping them for `fetch("/api/projects")` etc. later is a drop-in
// replacement, not a rewrite of any consuming component.

const projects: Project[] = [
  {
    id: "proj-atlas",
    name: "Atlas API Gateway",
    description: "Rate-limited gateway routing traffic to internal services.",
    createdAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "proj-beacon",
    name: "Beacon Notifications",
    description: "Push/email/SMS delivery pipeline with retry handling.",
    createdAt: "2026-07-14T09:00:00.000Z",
  },
  {
    id: "proj-cairn",
    name: "Cairn Design System",
    description: "Shared component library used across product surfaces.",
    createdAt: "2026-08-02T09:00:00.000Z",
  },
];

const tasks: Task[] = [
  { id: "t-1", projectId: "proj-atlas", title: "Add per-route rate limit config", status: "done", priority: "high", dueDate: "2026-08-20", createdAt: "2026-07-02T09:00:00.000Z" },
  { id: "t-2", projectId: "proj-atlas", title: "Write integration tests for auth middleware", status: "in-progress", priority: "high", dueDate: "2026-09-10", createdAt: "2026-07-05T09:00:00.000Z" },
  { id: "t-3", projectId: "proj-atlas", title: "Document gateway error codes", status: "todo", priority: "low", dueDate: "2026-09-20", createdAt: "2026-07-10T09:00:00.000Z" },
  { id: "t-4", projectId: "proj-atlas", title: "Upgrade to new load balancer", status: "blocked", priority: "medium", dueDate: "2026-09-15", createdAt: "2026-07-12T09:00:00.000Z" },
  { id: "t-5", projectId: "proj-beacon", title: "Retry queue for failed SMS sends", status: "in-progress", priority: "high", dueDate: "2026-09-12", createdAt: "2026-07-15T09:00:00.000Z" },
  { id: "t-6", projectId: "proj-beacon", title: "Add delivery receipts webhook", status: "todo", priority: "medium", dueDate: "2026-09-25", createdAt: "2026-07-16T09:00:00.000Z" },
  { id: "t-7", projectId: "proj-beacon", title: "Migrate email templates to MJML", status: "done", priority: "low", dueDate: "2026-08-30", createdAt: "2026-07-18T09:00:00.000Z" },
  { id: "t-8", projectId: "proj-cairn", title: "Ship StatusBadge accessibility fixes", status: "in-progress", priority: "high", dueDate: "2026-09-09", createdAt: "2026-08-03T09:00:00.000Z" },
  { id: "t-9", projectId: "proj-cairn", title: "Publish v2 design tokens", status: "todo", priority: "medium", dueDate: "2026-09-18", createdAt: "2026-08-04T09:00:00.000Z" },
];

const currentUser: User = {
  id: "user-1",
  name: "Serge Irakoze",
  role: "Backend Engineer",
  initials: "SI",
};

function delay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export interface FetchOptions {
  simulateError?: boolean;
  latencyMs?: number;
}

export async function fetchProjects(opts: FetchOptions = {}): Promise<Project[]> {
  if (opts.simulateError) {
    await delay(null, opts.latencyMs ?? 400);
    throw new Error("Failed to load projects");
  }
  return delay([...projects], opts.latencyMs ?? 500);
}

export async function fetchProject(
  id: string,
  opts: FetchOptions = {},
): Promise<Project | null> {
  if (opts.simulateError) {
    await delay(null, opts.latencyMs ?? 400);
    throw new Error("Failed to load project");
  }
  const found = projects.find((p) => p.id === id) ?? null;
  return delay(found, opts.latencyMs ?? 400);
}

export async function fetchTasks(
  projectId?: string,
  opts: FetchOptions = {},
): Promise<Task[]> {
  if (opts.simulateError) {
    await delay(null, opts.latencyMs ?? 400);
    throw new Error("Failed to load tasks");
  }
  const result = projectId ? tasks.filter((t) => t.projectId === projectId) : [...tasks];
  return delay(result, opts.latencyMs ?? 600);
}

export async function fetchCurrentUser(opts: FetchOptions = {}): Promise<User> {
  if (opts.simulateError) {
    await delay(null, opts.latencyMs ?? 300);
    throw new Error("Failed to load profile");
  }
  return delay({ ...currentUser }, opts.latencyMs ?? 250);
}

export function getProjectProgress(projectId: string, allTasks: Task[]): ProjectProgress {
  const projectTasks = allTasks.filter((t) => t.projectId === projectId);
  const done = projectTasks.filter((t) => t.status === "done").length;
  const total = projectTasks.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}
