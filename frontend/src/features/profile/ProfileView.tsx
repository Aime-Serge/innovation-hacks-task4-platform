"use client";

import { useMemo } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { Grid } from "@/layout/Grid";
import { PageHeader } from "@/layout/PageHeader";
import { t } from "@/i18n";
import { todayIso } from "@/lib/dates";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Card";
import { RegionState } from "@/ui/RegionState";
import { Skeleton } from "@/ui/Skeleton";
import { useAllTasks } from "../data/hooks";
import { KpiTile } from "../dashboard/KpiTile";
import { ProfileForm } from "./ProfileForm";
import { profileStats } from "./stats";

export function ProfileView() {
  const { user } = useAuth();
  const tasks = useAllTasks();
  const stats = useMemo(
    () =>
      user === null || tasks.data === undefined
        ? undefined
        : [profileStats(user.id, tasks.data.items, todayIso())],
    [user, tasks.data],
  );
  return (
    <>
      <PageHeader title={t("profile.title")} description={t("profile.description")} />
      {user === null ? (
        // Hold the card's space until the session resolves, so the footer does not jump.
        <Skeleton className="mb-6 h-28" />
      ) : (
        <Card className="mb-6 flex flex-wrap items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold">{user.name}</p>
            <p className="break-all text-sm text-muted">{user.email}</p>
            <p className="text-sm text-muted">{t(`role.${user.role}`)}</p>
          </div>
        </Card>
      )}
      <section aria-labelledby="stats-heading" className="mb-6">
        <h2 id="stats-heading" className="mb-3 text-lg font-semibold">
          {t("profile.stats")}
        </h2>
        <RegionState
          status={tasks.isPending ? "loading" : tasks.isError ? "error" : "success"}
          data={stats}
          filtered={false}
          skeleton={
            <Grid layout="kpis">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </Grid>
          }
          empty={{ title: t("profile.stats.empty") }}
          onRetry={() => void tasks.refetch()}
        >
          {([value]) =>
            value === undefined ? null : (
              <Grid layout="kpis">
                <KpiTile icon="tasks" label={t("stat.assigned")} value={String(value.assigned)} />
                <KpiTile icon="checkCircle" label={t("stat.done")} value={String(value.done)} />
                <KpiTile icon="alert" label={t("stat.overdue")} value={String(value.overdue)} />
                <KpiTile
                  icon="flag"
                  label={t("kpi.completionRate")}
                  value={`${value.completionRate}%`}
                />
              </Grid>
            )
          }
        </RegionState>
      </section>
      <section aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="mb-3 text-lg font-semibold">
          {t("profile.edit")}
        </h2>
        {user === null ? <Skeleton className="h-56 max-w-md" /> : <ProfileForm user={user} />}
      </section>
    </>
  );
}
