import type { Task, TaskStatus } from "@/lib/types";
import { formatDueDate } from "@/lib/format";
import { StatusBadge } from "@/components/shared/StatusBadge";

// Visible text stays short (the row already reads as a task's
// priority in context); a visually-hidden sr-only span carries the
// full "High priority" form for screen readers instead. (aria-label
// on a plain <span> is invalid ARIA — role="generic" doesn't support
// naming — axe's aria-prohibited-attr rule catches this.)
const PRIORITY_LABEL: Record<Task["priority"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_ARIA_LABEL: Record<Task["priority"], string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

const PRIORITY_DOT: Record<Task["priority"], string> = {
  high: "bg-status-blocked",
  medium: "bg-status-progress",
  low: "bg-text-secondary",
};

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

export function TaskCard({
  task,
  projectName,
  assigneeName,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: Task;
  projectName?: string;
  assigneeName?: string;
  onStatusChange?: (status: TaskStatus) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const interactive = Boolean(onStatusChange || onEdit || onDelete);

  return (
    <li className="flex flex-col gap-2 border-b border-border-hairline px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
        {projectName && (
          <p className="mt-0.5 truncate text-xs text-text-secondary">{projectName}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {onStatusChange ? (
          <label className="sr-only" htmlFor={`status-${task.id}`}>
            Change status for {task.title}
          </label>
        ) : (
          <StatusBadge status={task.status} />
        )}
        {onStatusChange && (
          <select
            id={`status-${task.id}`}
            value={task.status}
            onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
            className="rounded border border-border-hairline bg-surface px-2 py-1 text-xs text-text-primary focus-visible:border-interactive"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <span
            aria-hidden="true"
            className={`inline-block h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`}
          />
          <span aria-hidden="true">{PRIORITY_LABEL[task.priority]}</span>
          <span className="sr-only">{PRIORITY_ARIA_LABEL[task.priority]}</span>
        </span>
        <span className="font-mono text-text-secondary">{formatDueDate(task.dueDate)}</span>
        {assigneeName && (
          <span
            title={assigneeName}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface font-mono text-[10px] font-semibold text-text-primary"
          >
            {assigneeName
              .split(/\s+/)
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
        )}
        {interactive && (onEdit || onDelete) && (
          <span className="flex gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-text-secondary hover:text-text-primary"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-status-blocked hover:underline"
              >
                Delete
              </button>
            )}
          </span>
        )}
      </div>
    </li>
  );
}
