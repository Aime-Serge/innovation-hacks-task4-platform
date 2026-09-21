"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { replaceUrl } from "@/lib/navigation";
import {
  emptyProjectQuery,
  ProjectSort,
  ProjectStatus,
  SortDir,
  type ProjectQuery,
} from "@/schemas";

/** FR-17 for the projects list: same URL contract as tasks. */
export function useProjectQuery() {
  const params = useSearchParams();
  const pathname = usePathname();
  const serialized = params.toString();

  const query = useMemo<ProjectQuery>(() => {
    const base = emptyProjectQuery();
    const p = new URLSearchParams(serialized);
    return {
      q: p.get("q") ?? "",
      status: (p.get("status") ?? "").split(",").flatMap((value) => {
        const parsed = ProjectStatus.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      }),
      sort: ProjectSort.safeParse(p.get("sort")).data ?? base.sort,
      dir: SortDir.safeParse(p.get("dir")).data ?? base.dir,
    };
  }, [serialized]);

  const update = useCallback(
    (patch: Partial<ProjectQuery>) => {
      const next = { ...query, ...patch };
      const p = new URLSearchParams(serialized);
      const put = (key: string, value: string | null) =>
        value === null || value === "" ? p.delete(key) : p.set(key, value);
      put("q", next.q.trim());
      put("status", next.status.join(","));
      put("sort", next.sort === "name" ? null : next.sort);
      put("dir", next.dir === "asc" ? null : next.dir);
      const qs = p.toString();
      replaceUrl(qs === "" ? pathname : `${pathname}?${qs}`);
    },
    [query, serialized, pathname],
  );

  const clear = useCallback(() => update({ q: "", status: [] }), [update]);
  const filtered = query.q.trim() !== "" || query.status.length > 0;
  return { query, update, clear, filtered };
}
