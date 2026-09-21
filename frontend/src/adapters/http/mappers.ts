import { pageOf, type Page, type ProjectQuery, type TaskQuery } from "@/schemas";
import type { ZodMiniType, infer as Infer } from "zod/mini";

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
export async function readAll<T extends ZodMiniType>(
  fetchPage: Fetcher,
  base: URLSearchParams,
  item: T,
): Promise<Page<Infer<T>>> {
  const schema = pageOf(item);
  const items: Infer<T>[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams(base);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    const parsed = schema.parse(await fetchPage(params));
    items.push(...parsed.items);
    total = parsed.total;
    if (items.length >= total || parsed.items.length === 0) break;
  }
  return { items, total };
}
