"use client";

import { useMemo } from "react";
import { Grid } from "@/layout/Grid";
import { PageHeader } from "@/layout/PageHeader";
import { t } from "@/i18n";
import { addDays, todayIso } from "@/lib/dates";
import { useAuth } from "@/providers/AuthProvider";
import { emptyProjectQuery } from "@/schemas";
import { Skeleton } from "@/ui/Skeleton";
import { RegionState, type RegionStatus } from "@/ui/RegionState";
import { useActivity, useAllTasks, useProjects, useUsers } from "../data/hooks";
import { byId } from "../shared/lookups";
import { ActivityFeed } from "./ActivityFeed";
import { DeadlineList } from "./DeadlineList";
import { KpiTile } from "./KpiTile";
import { computeKpis, upcomingDeadlines } from "./kpis";
import { computeTeamStats } from "./teamStats";
import { TeamPanel } from "./TeamPanel";
import { WelcomeBanner } from "./WelcomeBanner";

const statusOf = (...queries: { isPending: boolean; isError: boolean }[]): RegionStatus =>
  queries.some((q) => q.isError)
    ? "error"
    : queries.some((q) => q.isPending)
      ? "loading"
      : "success";

/** FR-01..04: three independent regions, so one failure never blanks the page (NFR-19).
 * RF-04/RF-05: one route, one component for both roles; the scope of the data (own vs
 * team-wide) already comes from the API (BR-401) via these same queries. RF-06/RF-07: the
 * title, KPI labels and the team panel are the only things that vary by role, from
 * `user.role` already on the session — see docs/role-alignment-contract.md. */
export function DashboardView() {
  const { user } = useAuth();
  const isLead = user?.role === "lead";
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
  // RF-07: computed only when rendered (isLead below); no extra fetch either way — it reads
  // the same tasks/users queries every dashboard already makes.
  const teamStats = useMemo(
    () => (isLead ? computeTeamStats(users.data ?? [], tasks.data?.items ?? [], today) : []),
    [isLead, users.data, tasks.data, today],
  );

  const retryKpis = () => {
    void tasks.refetch();
    void projects.refetch();
  };

  return (
    <>
      <WelcomeBanner />
      <PageHeader
        title={isLead ? t("dashboard.title.lead") : t("dashboard.title")}
        description={isLead ? t("dashboard.description.lead") : t("dashboard.description")}
      />
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
                <KpiTile
                  icon="tasks"
                  label={t(isLead ? "kpi.openTasks.lead" : "kpi.openTasks")}
                  value={String(value.openTasks)}
                />
                <KpiTile
                  icon="alert"
                  label={t(isLead ? "kpi.overdueTasks.lead" : "kpi.overdueTasks")}
                  value={String(value.overdueTasks)}
                />
                <KpiTile
                  icon="checkCircle"
                  label={t(isLead ? "kpi.completionRate.lead" : "kpi.completionRate")}
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
      {isLead && <TeamPanel members={teamStats} />}
    </>
  );
}
