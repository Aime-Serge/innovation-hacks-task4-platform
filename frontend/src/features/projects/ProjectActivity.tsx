"use client";

import { useMemo } from "react";
import { t } from "@/i18n";
import type { Project } from "@/schemas";
import { useActivity, useUsers } from "../data/hooks";
import { ActivityFeed } from "../dashboard/ActivityFeed";

const LATEST = 50; // the API's page limit; a project shows its own share of it (FR-414)
const SHOWN = 10;

/** The latest activity of one project, from the activity the caller may read (BR-401). */
export function ProjectActivity({ project }: { project: Project }) {
  const activity = useActivity(LATEST);
  const users = useUsers();
  const userMap = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, u])), [users.data]);
  const projectMap = useMemo(() => new Map([[project.id, project]]), [project]);
  const items = useMemo(
    () => (activity.data ?? []).filter((a) => a.projectId === project.id).slice(0, SHOWN),
    [activity.data, project.id],
  );
  if (activity.isError) return null; // the rest of the page does not depend on it
  return (
    <section aria-labelledby="activity-heading" className="mt-6">
      <h2 id="activity-heading" className="mb-3 text-lg font-semibold">
        {t("project.activity")}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">
          {activity.isPending ? t("common.loading") : t("project.activity.none")}
        </p>
      ) : (
        <ActivityFeed items={items} users={userMap} projects={projectMap} />
      )}
    </section>
  );
}
