import { t } from "@/i18n";
import { relativeTime } from "@/lib/dates";
import type { Activity, Project, User } from "@/schemas";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Card";

type Props = {
  items: readonly Activity[];
  users: ReadonlyMap<string, User>;
  projects: ReadonlyMap<string, Project>;
};

/** FR-04: newest first, with relative times. */
export function ActivityFeed({ items, users, projects }: Props) {
  return (
    <Card
      as="ul"
      tabIndex={0}
      aria-labelledby="activity-heading"
      className="max-h-96 divide-y divide-line overflow-y-auto p-0"
    >
      {items.map((item) => {
        const actorUser = users.get(item.actorId);
        const actor = actorUser?.name ?? t("activity.someone");
        const project = projects.get(item.projectId)?.name ?? t("task.unknownProject");
        return (
          <li key={item.id} className="flex items-center gap-3 p-3">
            <Avatar name={actor} avatarUrl={actorUser?.avatarUrl} size="sm" />
            <p className="min-w-0 flex-1 break-words text-sm">
              {t(`activity.${item.type}`, { actor, project })}
            </p>
            <time dateTime={item.at} className="shrink-0 text-xs text-muted">
              {relativeTime(item.at)}
            </time>
          </li>
        );
      })}
    </Card>
  );
}
