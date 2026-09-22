import { t } from "@/i18n";
import type { Completeness, Stats } from "@/schemas";
import { Card } from "@/ui/Card";
import { ProgressBar } from "@/ui/ProgressBar";

/** Own page only (MB-02). */
export function ProfileStatistics({
  stats,
  memberSince,
}: {
  stats: Stats;
  memberSince?: string | undefined;
}) {
  return (
    <section aria-labelledby="stats-heading" className="mb-6">
      <h2 id="stats-heading" className="mb-3 text-lg font-semibold">
        {t("profile.statistics.heading")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-2xl font-semibold">{stats.projectsOwned}</p>
          <p className="text-sm text-muted">{t("profile.statistics.projectsOwned")}</p>
        </Card>
        <Card>
          <p className="text-2xl font-semibold">{stats.tasksDone}</p>
          <p className="text-sm text-muted">{t("profile.statistics.tasksDone")}</p>
        </Card>
        <Card>
          <p className="text-2xl font-semibold">{stats.tasksOpen}</p>
          <p className="text-sm text-muted">{t("profile.statistics.tasksOpen")}</p>
        </Card>
        {memberSince !== undefined && (
          <Card>
            <p className="text-2xl font-semibold">
              {new Intl.DateTimeFormat("en", { year: "numeric", month: "short" }).format(
                new Date(memberSince),
              )}
            </p>
            <p className="text-sm text-muted">{t("profile.statistics.memberSince")}</p>
          </Card>
        )}
      </div>
    </section>
  );
}

/** Own page only (MF-09). */
export function ProfileCompleteness({ completeness }: { completeness: Completeness }) {
  return (
    <section aria-labelledby="completeness-heading" className="mb-6">
      <h2 id="completeness-heading" className="mb-3 text-lg font-semibold">
        {t("profile.completeness.heading")}
      </h2>
      <Card className="flex flex-col gap-2">
        <ProgressBar value={completeness.percent} label={t("profile.completeness.heading")} />
        <p className="text-sm text-muted">
          {completeness.next ?? t("profile.completeness.complete")}
        </p>
      </Card>
    </section>
  );
}
