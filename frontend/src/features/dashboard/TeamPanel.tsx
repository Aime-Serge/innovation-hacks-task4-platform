import { t } from "@/i18n";
import { Card } from "@/ui/Card";
import type { TeamMemberStats } from "./teamStats";

type Props = { members: readonly TeamMemberStats[] };

/** RF-07: lead-only. Same tokens and Card as every other dashboard list (RF-08); never
 * rendered, and its data never computed, for a developer (DashboardView gates it by role). */
export function TeamPanel({ members }: Props) {
  return (
    <section aria-labelledby="team-heading" className="mt-6">
      <h2 id="team-heading" className="mb-3 text-lg font-semibold">
        {t("dashboard.team")}
      </h2>
      <Card as="ul" className="divide-y divide-line p-0">
        {members.map(({ user, openTasks, overdueTasks }) => (
          <li key={user.id} className="flex items-center justify-between gap-3 p-3">
            <p className="min-w-0 flex-1 truncate font-medium">{user.name}</p>
            <p className="flex shrink-0 gap-3 text-sm text-muted">
              <span>{t("dashboard.team.openTasks", { count: openTasks })}</span>
              <span>{t("dashboard.team.overdueTasks", { count: overdueTasks })}</span>
            </p>
          </li>
        ))}
      </Card>
    </section>
  );
}
