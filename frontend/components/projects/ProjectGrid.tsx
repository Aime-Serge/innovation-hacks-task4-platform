import type { Project, Task } from "@/lib/types";
import { getProjectProgress } from "@/lib/mock-data";
import { ProjectCard } from "./ProjectCard";
import { Skeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";

function ProjectCardSkeleton() {
  return (
    <li className="rounded border border-border-hairline bg-surface p-4">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1 h-3 w-4/5" />
      <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
      <Skeleton className="mt-1.5 h-3 w-16" />
    </li>
  );
}

export function ProjectGrid({
  status,
  projects,
  tasks,
  filtered,
  onRetry,
  onClearFilters,
}: {
  status: "loading" | "error" | "success";
  projects: Project[];
  tasks: Task[];
  filtered?: boolean;
  onRetry: () => void;
  onClearFilters?: () => void;
}) {
  if (status === "loading") {
    return (
      <ul aria-busy="true" aria-label="Loading projects" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </ul>
    );
  }

  if (status === "error") {
    return <ErrorState message="Unable to load projects." onRetry={onRetry} />;
  }

  if (projects.length === 0) {
    return filtered ? (
      <EmptyState
        title="No matching projects"
        message="Try a different search term or clear your filters."
        actionLabel={onClearFilters ? "Clear filters" : undefined}
        onAction={onClearFilters}
      />
    ) : (
      <EmptyState title="No projects yet" message="No projects to show right now." />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          progress={getProjectProgress(project.id, tasks)}
        />
      ))}
    </ul>
  );
}
