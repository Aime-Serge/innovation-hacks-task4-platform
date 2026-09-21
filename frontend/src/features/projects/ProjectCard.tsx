import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { t, tCount } from "@/i18n";
import type { Progress } from "@/lib/query-logic";
import type { Project } from "@/schemas";
import { Card } from "@/ui/Card";
import { Icon } from "@/ui/Icon";
import { ProgressBar } from "@/ui/ProgressBar";
import { ProjectStatusBadge } from "../shared/badges";

/** FR-11: name, status, due date, progress and task counts; long names truncate. */
export function ProjectCard({ project, progress }: { project: Project; progress: Progress }) {
  return (
    <Card as="article" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 font-semibold">
          <Link
            href={`/projects/${project.id}`}
            className="block truncate hover:underline"
            title={project.name}
          >
            {project.name}
          </Link>
        </h2>
        <ProjectStatusBadge status={project.status} />
      </div>
      <p className="flex items-center gap-1 text-sm text-muted">
        <Icon name="calendar" />
        {t("project.due", { date: formatDate(project.dueDate) })}
      </p>
      <ProgressBar
        value={progress.percent}
        label={t("project.progressOf", { name: project.name })}
      />
      <p className="text-sm text-muted">
        {tCount("project.tasksDone", progress.total, { done: progress.done })}
      </p>
    </Card>
  );
}
