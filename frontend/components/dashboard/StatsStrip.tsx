import type { Project, Task } from "@/lib/types";
import { Skeleton } from "@/components/shared/Skeleton";
import { ErrorState } from "@/components/shared/ErrorState";

export function StatsStrip({
  status,
  projects,
  tasks,
  onRetry,
}: {
  status: "loading" | "error" | "success";
  projects: Project[];
  tasks: Task[];
  onRetry: () => void;
}) {
  if (status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading activity" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded border border-border-hairline bg-surface px-4 py-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (status === "error") {
    return <ErrorState message="Unable to load activity." onRetry={onRetry} />;
  }

  if (tasks.length === 0 && projects.length === 0) {
    return <p className="text-sm text-text-secondary">No activity yet.</p>;
  }

  const stats = [
    { label: "Active projects", value: projects.length },
    { label: "Open tasks", value: tasks.filter((t) => t.status !== "done").length },
    { label: "In progress", value: tasks.filter((t) => t.status === "in-progress").length },
    { label: "Blocked", value: tasks.filter((t) => t.status === "blocked").length },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded border border-border-hairline bg-surface px-4 py-3"
        >
          <dt className="text-xs text-text-secondary">{stat.label}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold text-text-primary">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
