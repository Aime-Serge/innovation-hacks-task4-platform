import Link from "next/link";
import { t } from "@/i18n";
import { formatDate } from "@/lib/dates";
import type { Project, Task } from "@/schemas";
import { Card } from "@/ui/Card";
import { Icon } from "@/ui/Icon";
import { PriorityBadge } from "../shared/badges";

type Props = { tasks: readonly Task[]; projects: ReadonlyMap<string, Project> };

export function DeadlineList({ tasks, projects }: Props) {
  return (
    <Card
      as="ul"
      tabIndex={0}
      aria-labelledby="deadlines-heading"
      className="max-h-96 divide-y divide-line overflow-y-auto p-0"
    >
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={task.title}>
              {task.title}
            </p>
            <p className="truncate text-sm text-muted">
              <Link href={`/projects/${task.projectId}`} className="hover:underline">
                {projects.get(task.projectId)?.name ?? t("task.unknownProject")}
              </Link>
            </p>
          </div>
          <PriorityBadge priority={task.priority} />
          <span className="flex items-center gap-1 text-sm text-muted">
            <Icon name="calendar" />
            {task.dueDate === null ? "" : formatDate(task.dueDate)}
          </span>
        </li>
      ))}
    </Card>
  );
}
