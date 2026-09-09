import Link from "next/link";
import type { Project, ProjectProgress } from "@/lib/types";
import { ProgressBar } from "@/components/shared/ProgressBar";

export function ProjectCard({
  project,
  progress,
}: {
  project: Project;
  progress: ProjectProgress;
}) {
  return (
    <li>
      <Link
        href={`/projects/${project.id}`}
        className="block rounded border border-border-hairline bg-surface p-4 transition-colors hover:border-interactive focus-visible:border-interactive"
      >
        <h3 className="truncate text-sm font-semibold text-text-primary">{project.name}</h3>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{project.description}</p>
        )}
        <div className="mt-3">
          <ProgressBar progress={progress} />
        </div>
      </Link>
    </li>
  );
}
