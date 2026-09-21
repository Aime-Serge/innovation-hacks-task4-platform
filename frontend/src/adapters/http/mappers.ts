import {
  Activity,
  User,
  pageOf,
  type NewProject,
  type NewTask,
  type Page,
  type ProjectQuery,
  type TaskQuery,
} from "@/schemas";
import { unknown } from "zod/mini";

// Task 1's names and sort keys on one side, the API's on the other (section 6).

export const PAGE_SIZE = 100;
const MAX_PAGES = 10; // 1000 rows: a small team's projects and tasks fit; see docs/blockers.md

const SORT_KEYS = {
  due_date: "dueDate",
  priority: "priority",
  title: "title",
  name: "name",
} as const;

export function sortParam(sort: keyof typeof SORT_KEYS, dir: "asc" | "desc"): string {
  return `${dir === "desc" ? "-" : ""}${SORT_KEYS[sort]}`;
}

export function projectParams(query: ProjectQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q.trim() !== "") params.set("q", query.q.trim());
  for (const status of query.status) params.append("status", status);
  params.set("sort", sortParam(query.sort, query.dir));
  return params;
}

export function taskParams(query: TaskQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q.trim() !== "") params.set("q", query.q.trim());
  for (const status of query.status) params.append("status", status);
  for (const priority of query.priority) params.append("priority", priority);
  for (const id of query.projectId) params.append("projectId", id);
  if (query.assigneeId !== null) params.append("assigneeId", query.assigneeId);
  params.set("sort", sortParam(query.sort, query.dir));
  return params;
}

type Fetcher = (params: URLSearchParams) => Promise<unknown>;

/** Reads every page (up to the cap) so the screens keep their whole-list behaviour. */
export async function readAll<T>(
  fetchPage: Fetcher,
  base: URLSearchParams,
  parseItem: (raw: unknown) => T,
): Promise<Page<T>> {
  const schema = pageOf(unknown());
  const items: T[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams(base);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    const parsed = schema.parse(await fetchPage(params));
    items.push(...parsed.items.map(parseItem));
    total = parsed.total;
    if (items.length >= total || parsed.items.length === 0) break;
  }
  return { items, total };
}

/** The API sends `null` for what Task 1 models as absent (avatarUrl, taskId): drop it at the edge. */
function withoutNulls(raw: unknown, keys: string[]): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  return Object.fromEntries(
    Object.entries(raw).filter(([key, value]) => !(keys.includes(key) && value === null)),
  );
}

export const parseUser = (raw: unknown): User => User.parse(withoutNulls(raw, ["avatarUrl"]));
export const parseActivity = (raw: unknown): Activity =>
  Activity.parse(withoutNulls(raw, ["taskId"]));

// The API rejects unknown fields, and Task 1's forms carry a few it does not take: the owner comes
// from the session, and a task's status changes only through its own route (section 6).
function pick(source: object, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(([key, value]) => keys.includes(key) && value !== undefined),
  );
}

export const projectBody = (input: Partial<NewProject>) =>
  pick(input, ["name", "description", "status", "dueDate"]);
export const taskCreateBody = (input: NewTask) =>
  pick(input, ["projectId", "title", "description", "priority", "dueDate", "assigneeId"]);
export const taskPatchBody = (input: Partial<NewTask>) =>
  pick(input, ["title", "description", "priority", "dueDate", "assigneeId"]);
