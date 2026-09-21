"use client";

import { useMemo } from "react";
import { Grid } from "@/layout/Grid";
import { PageHeader } from "@/layout/PageHeader";
import { t } from "@/i18n";
import { addDays, todayIso } from "@/lib/dates";
import { emptyProjectQuery } from "@/schemas";
import { Skeleton } from "@/ui/Skeleton";
import { RegionState, type RegionStatus } from "@/ui/RegionState";
import { useActivity, useAllTasks, useProjects, useUsers } from "../data/hooks";
import { byId } from "../shared/lookups";
import { ActivityFeed } from "./ActivityFeed";
import { DeadlineList } from "./DeadlineList";
import { KpiTile } from "./KpiTile";
import { computeKpis, upcomingDeadlines } from "./kpis";

const statusOf = (...queries: { isPending: boolean; isError: boolean }[]): RegionStatus =>
  queries.some((q) => q.isError)
    ? "error"
    : queries.some((q) => q.isPending)
      ? "loading"
      : "success";

/** FR-01..04: three independent regions, so one failure never blanks the page (NFR-19). */
export function DashboardView() {
  const tasks = useAllTasks();
  const projects = useProjects(emptyProjectQuery());
  const users = useUsers();
  const activity = useActivity(10);
  const today = todayIso();
  const projectMap = useMemo(() => byId(projects.data?.items), [projects.data]);
  const userMap = useMemo(() => byId(users.data), [users.data]);
  const kpis = useMemo(
    () => computeKpis(projects.data?.items ?? [], tasks.data?.items ?? [], today),
    [projects.data, tasks.data, today],
  );
  const deadlines = useMemo(
    () => upcomingDeadlines(tasks.data?.items ?? [], today, addDays(today, 7)),
    [tasks.data, today],
  );

  const retryKpis = () => {
    void tasks.refetch();
    void projects.refetch();
  };

  return (
    <>
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />
      <section aria-labelledby="kpi-heading" className="mb-6">
        <h2 id="kpi-heading" className="sr-only">
          {t("dashboard.kpis")}
        </h2>
        <RegionState
          status={statusOf(tasks, projects)}
          data={projects.data === undefined || tasks.data === undefined ? undefined : [kpis]}
          filtered={false}
          skeleton={
            <Grid layout="kpis">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </Grid>
          }
          empty={{ title: t("dashboard.kpis.empty") }}
          onRetry={retryKpis}
        >
          {([value]) =>
            value === undefined ? null : (
              <Grid layout="kpis">
                <KpiTile
                  icon="folder"
                  label={t("kpi.activeProjects")}
                  value={String(value.activeProjects)}
                />
                <KpiTile icon="tasks" label={t("kpi.openTasks")} value={String(value.openTasks)} />
                <KpiTile
                  icon="alert"
                  label={t("kpi.overdueTasks")}
                  value={String(value.overdueTasks)}
                />
                <KpiTile
                  icon="checkCircle"
                  label={t("kpi.completionRate")}
                  value={`${value.completionRate}%`}
                />
              </Grid>
            )
          }
        </RegionState>
      </section>
      <Grid layout="dashboard">
        <section aria-labelledby="deadlines-heading" className="sm:col-span-1 lg:col-span-7">
          <h2 id="deadlines-heading" className="mb-3 text-lg font-semibold">
            {t("dashboard.deadlines")}
          </h2>
          <RegionState
            status={statusOf(tasks)}
            data={tasks.data === undefined ? undefined : deadlines}
            filtered={false}
            skeleton={<Skeleton className="h-96" />}
            empty={{
              icon: "calendar",
              title: t("deadlines.empty.title"),
              body: t("deadlines.empty.body"),
            }}
            onRetry={() => void tasks.refetch()}
          >
            {(items) => <DeadlineList tasks={items} projects={projectMap} />}
          </RegionState>
        </section>
        <section aria-labelledby="activity-heading" className="sm:col-span-1 lg:col-span-5">
          <h2 id="activity-heading" className="mb-3 text-lg font-semibold">
            {t("dashboard.activity")}
          </h2>
          <RegionState
            status={statusOf(activity)}
            data={activity.data}
            filtered={false}
            skeleton={<Skeleton className="h-96" />}
            empty={{
              icon: "clock",
              title: t("activity.empty.title"),
              body: t("activity.empty.body"),
            }}
            onRetry={() => void activity.refetch()}
          >
            {(items) => <ActivityFeed items={items} users={userMap} projects={projectMap} />}
          </RegionState>
        </section>
      </Grid>
    </>
  );
}
