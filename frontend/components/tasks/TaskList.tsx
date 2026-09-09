import type { Project, Task } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { Skeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";

function TaskRowSkeleton() {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-border-hairline px-4 py-3 last:border-b-0">
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-12" />
      </div>
    </li>
  );
}

export function TaskList({
  status,
  tasks,
  projects,
  showProjectName = false,
  filtered,
  onRetry,
  onClearFilters,
}: {
  status: "loading" | "error" | "success";
  tasks: Task[];
  projects: Project[];
  showProjectName?: boolean;
  filtered?: boolean;
  onRetry: () => void;
  onClearFilters?: () => void;
}) {
  if (status === "loading") {
    return (
      <ul
        aria-busy="true"
        aria-label="Loading tasks"
        className="rounded border border-border-hairline bg-surface"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <TaskRowSkeleton key={i} />
        ))}
      </ul>
    );
  }

  if (status === "error") {
    return <ErrorState message="Unable to load tasks." onRetry={onRetry} />;
  }

  if (tasks.length === 0) {
    return filtered ? (
      <EmptyState
        title="No matching tasks"
        message="Try a different search term or clear your filters."
        actionLabel={onClearFilters ? "Clear filters" : undefined}
        onAction={onClearFilters}
      />
    ) : (
      <EmptyState title="No tasks yet" message="No tasks to show right now." />
    );
  }

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <ul className="rounded border border-border-hairline bg-surface">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          projectName={showProjectName ? projectNameById.get(task.projectId) : undefined}
        />
      ))}
    </ul>
  );
}
