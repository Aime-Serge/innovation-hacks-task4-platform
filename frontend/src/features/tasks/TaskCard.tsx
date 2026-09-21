import { memo } from "react";
import { formatDate, isOverdue, todayIso } from "@/lib/dates";
import { t } from "@/i18n";
import { TaskStatus, type Task } from "@/schemas";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Card } from "@/ui/Card";
import { Icon } from "@/ui/Icon";
import { IconButton } from "@/ui/IconButton";
import { Select } from "@/ui/Input";
import { PriorityBadge } from "../shared/badges";

type TaskCardProps = {
  task: Task;
  projectName: string | undefined;
  assigneeName: string | undefined;
  onStatusChange: (id: string, status: TaskStatus) => void;
  /** Present only when the person may delete this task (BR-203). */
  onDelete?: (task: Task) => void;
  /** Headings never skip a level: h2 under the page's h1, h3 under a section's h2. */
  headingLevel?: "h2" | "h3";
};

/** FR-12: every field, overdue marked visibly and announced to screen readers. */
/**
 * Memoised: a filter change re-renders the page but leaves unchanged cards alone,
 * which keeps interactions inside the INP budget (NFR-03). Callers must pass a
 * stable onStatusChange.
 */
export const TaskCard = memo(function TaskCard({
  task,
  projectName,
  assigneeName,
  onStatusChange,
  onDelete,
  headingLevel: Heading = "h2",
}: TaskCardProps) {
  const overdue = isOverdue(task, todayIso());
  return (
    <Card as="article" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Heading className="min-w-0 truncate font-semibold" title={task.title}>
          {task.title}
        </Heading>
        <PriorityBadge priority={task.priority} />
      </div>
      {projectName !== undefined && (
        <p className="flex items-center gap-1 text-sm text-muted">
          <Icon name="folder" />
          <span className="truncate" title={projectName}>
            {projectName}
          </span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1 text-muted">
          <Icon name="calendar" />
          {task.dueDate === null ? t("task.noDueDate") : formatDate(task.dueDate)}
        </span>
        {overdue && (
          <Badge tone="danger" icon="alert">
            {t("task.overdue")}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm">
        {assigneeName === undefined ? (
          <span className="text-muted">{t("task.unassigned")}</span>
        ) : (
          <>
            <Avatar name={assigneeName} size="sm" />
            <span className="truncate" title={assigneeName}>
              {assigneeName}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={`status-${task.id}`} className="sr-only">
          {t("task.changeStatus", { title: task.title })}
        </label>
        <Select
          id={`status-${task.id}`}
          value={task.status}
          onChange={(event) => onStatusChange(task.id, TaskStatus.parse(event.target.value))}
        >
          {TaskStatus.options.map((status) => (
            <option key={status} value={status}>
              {t(`taskStatus.${status}`)}
            </option>
          ))}
        </Select>
        {onDelete !== undefined && (
          <IconButton
            label={t("task.delete.label", { title: task.title })}
            onClick={() => onDelete(task)}
          >
            <Icon name="trash" />
          </IconButton>
        )}
      </div>
    </Card>
  );
});
