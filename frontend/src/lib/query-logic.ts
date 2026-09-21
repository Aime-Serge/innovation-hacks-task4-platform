import type { Project, ProjectQuery, SortDir, Task, TaskQuery } from "@/schemas";
import { assertNever } from "@/lib/assert";

// Pure list logic shared by the mock adapter today and mirrored by the FastAPI
// backend in Task 2. Business rules: BR-03 (progress), BR-05 (search),
// BR-06 (filters combine with AND; values inside one filter combine with OR).

/** BR-05: case-insensitive, ignoring leading and trailing spaces. */
export function normalizeSearch(q: string): string {
  return q.trim().toLowerCase();
}

function matchesText(fields: string[], q: string): boolean {
  const needle = normalizeSearch(q);
  if (needle === "") return true;
  return fields.some((f) => f.toLowerCase().includes(needle));
}

const PRIORITY_RANK = { low: 0, medium: 1, high: 2, urgent: 3 } as const;

function direction(dir: SortDir): 1 | -1 {
  return dir === "asc" ? 1 : -1;
}

export function filterTasks(tasks: Task[], query: TaskQuery): Task[] {
  return tasks.filter(
    (t) =>
      matchesText([t.title, t.description], query.q) &&
      (query.status.length === 0 || query.status.includes(t.status)) &&
      (query.priority.length === 0 || query.priority.includes(t.priority)) &&
      (query.projectId.length === 0 || query.projectId.includes(t.projectId)) &&
      (query.assigneeId === null || t.assigneeId === query.assigneeId),
  );
}

export function sortTasks(tasks: Task[], sort: TaskQuery["sort"], dir: SortDir): Task[] {
  const sign = direction(dir);
  const copy = [...tasks];
  switch (sort) {
    case "due_date":
      // Undated tasks always sort last, whatever the direction.
      return copy.sort((a, b) => {
        if (a.dueDate === b.dueDate) return a.title.localeCompare(b.title);
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate < b.dueDate ? -sign : sign;
      });
    case "priority":
      return copy.sort(
        (a, b) =>
          sign * (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) ||
          a.title.localeCompare(b.title),
      );
    case "title":
      return copy.sort((a, b) => sign * a.title.localeCompare(b.title));
    default:
      return assertNever(sort);
  }
}

export function applyTaskQuery(tasks: Task[], query: TaskQuery): Task[] {
  return sortTasks(filterTasks(tasks, query), query.sort, query.dir);
}

export function filterProjects(projects: Project[], query: ProjectQuery): Project[] {
  return projects.filter(
    (p) =>
      matchesText([p.name, p.description], query.q) &&
      (query.status.length === 0 || query.status.includes(p.status)),
  );
}

export function applyProjectQuery(projects: Project[], query: ProjectQuery): Project[] {
  const sign = direction(query.dir);
  const copy = filterProjects(projects, query);
  switch (query.sort) {
    case "name":
      return copy.sort((a, b) => sign * a.name.localeCompare(b.name));
    case "due_date":
      return copy.sort((a, b) =>
        a.dueDate === b.dueDate
          ? a.name.localeCompare(b.name)
          : a.dueDate < b.dueDate
            ? -sign
            : sign,
      );
    default:
      return assertNever(query.sort);
  }
}

export type Progress = { total: number; done: number; percent: number };

/** BR-03: done divided by total, rounded to a whole percent; no tasks is 0%. */
export function projectProgress(projectId: string, tasks: Task[]): Progress {
  const own = tasks.filter((t) => t.projectId === projectId);
  const done = own.filter((t) => t.status === "done").length;
  const total = own.length;
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
