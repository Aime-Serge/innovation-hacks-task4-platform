import { t } from "@/i18n";
import type { Priority, ProjectStatus, TaskStatus } from "@/schemas";
import { Badge, type BadgeTone } from "@/ui/Badge";
import type { IconName } from "@/ui/Icon";

const TASK_STATUS: Record<TaskStatus, { tone: BadgeTone; icon: IconName }> = {
  todo: { tone: "neutral", icon: "circle" },
  in_progress: { tone: "info", icon: "clock" },
  in_review: { tone: "warning", icon: "eye" },
  done: { tone: "success", icon: "checkCircle" },
};

const PRIORITY: Record<Priority, { tone: BadgeTone; icon: IconName }> = {
  low: { tone: "neutral", icon: "arrowDown" },
  medium: { tone: "info", icon: "minus" },
  high: { tone: "warning", icon: "arrowUp" },
  urgent: { tone: "danger", icon: "flame" },
};

const PROJECT_STATUS: Record<ProjectStatus, { tone: BadgeTone; icon: IconName }> = {
  planned: { tone: "neutral", icon: "calendar" },
  active: { tone: "info", icon: "circleDot" },
  on_hold: { tone: "warning", icon: "pause" },
  completed: { tone: "success", icon: "checkCircle" },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { tone, icon } = TASK_STATUS[status];
  return (
    <Badge tone={tone} icon={icon}>
      {t(`taskStatus.${status}`)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { tone, icon } = PRIORITY[priority];
  return (
    <Badge tone={tone} icon={icon}>
      {t(`priority.${priority}`)}
    </Badge>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { tone, icon } = PROJECT_STATUS[status];
  return (
    <Badge tone={tone} icon={icon}>
      {t(`projectStatus.${status}`)}
    </Badge>
  );
}
