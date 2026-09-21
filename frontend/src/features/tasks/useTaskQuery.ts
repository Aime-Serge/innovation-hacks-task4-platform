"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { replaceUrl } from "@/lib/navigation";
import { emptyTaskQuery, Priority, SortDir, TaskSort, TaskStatus, type TaskQuery } from "@/schemas";

const list = <T extends string>(raw: string | null, allowed: readonly T[]): T[] =>
  (raw ?? "")
    .split(",")
    .filter((value): value is T => (allowed as readonly string[]).includes(value));

/** FR-17: the whole view lives in the query string; other params (scenario) survive. */
export function useTaskQuery() {
  const params = useSearchParams();
  const pathname = usePathname();
  const serialized = params.toString();

  const query = useMemo<TaskQuery>(() => {
    const base = emptyTaskQuery();
    const p = new URLSearchParams(serialized);
    return {
      q: p.get("q") ?? "",
      status: list(p.get("status"), TaskStatus.options),
      priority: list(p.get("priority"), Priority.options),
      projectId: (p.get("project") ?? "").split(",").filter(Boolean),
      assigneeId: p.get("assignee"),
      sort: TaskSort.safeParse(p.get("sort")).data ?? base.sort,
      dir: SortDir.safeParse(p.get("dir")).data ?? base.dir,
    };
  }, [serialized]);

  const update = useCallback(
    (patch: Partial<TaskQuery>) => {
      const next = { ...query, ...patch };
      const p = new URLSearchParams(serialized);
      const put = (key: string, value: string | null) =>
        value === null || value === "" ? p.delete(key) : p.set(key, value);
      put("q", next.q.trim());
      put("status", next.status.join(","));
      put("priority", next.priority.join(","));
      put("project", next.projectId.join(","));
      put("assignee", next.assigneeId);
      put("sort", next.sort === "due_date" ? null : next.sort);
      put("dir", next.dir === "asc" ? null : next.dir);
      const qs = p.toString();
      replaceUrl(qs === "" ? pathname : `${pathname}?${qs}`);
    },
    [query, serialized, pathname],
  );

  const clear = useCallback(
    () => update({ ...emptyTaskQuery(), sort: query.sort, dir: query.dir }),
    [update, query.sort, query.dir],
  );
  const filtered =
    query.q.trim() !== "" ||
    query.status.length + query.priority.length + query.projectId.length > 0 ||
    query.assigneeId !== null;

  return { query, update, clear, filtered };
}
