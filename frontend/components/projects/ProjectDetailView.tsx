"use client";

import Link from "next/link";
import { fetchProject, fetchTasks, getProjectProgress } from "@/lib/mock-data";
import { useAsync } from "@/lib/useAsync";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { ErrorState } from "@/components/shared/ErrorState";
import { TaskList } from "@/components/tasks/TaskList";

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const projectState = useAsync(() => fetchProject(projectId), [projectId]);
  const tasksState = useAsync(() => fetchTasks(projectId), [projectId]);

  const tasks = tasksState.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/" className="text-sm text-text-secondary hover:text-text-primary">
        ← Dashboard
      </Link>

      <div className="mt-4">
        {projectState.status === "loading" && (
          <p className="text-sm text-text-secondary">Loading project…</p>
        )}
        {projectState.status === "error" && (
          <ErrorState message="Unable to load this project." onRetry={projectState.retry} />
        )}
        {projectState.status === "success" && projectState.data === null && (
          <p className="text-sm text-text-secondary">Project not found.</p>
        )}
        {projectState.status === "success" && projectState.data && (
          <>
            <h1 className="text-2xl font-bold text-text-primary">{projectState.data.name}</h1>
            <p className="mt-1 text-sm text-text-secondary">{projectState.data.description}</p>
            <div className="mt-4 max-w-xs">
              <ProgressBar progress={getProjectProgress(projectId, tasks)} />
            </div>
          </>
        )}
      </div>

      <section aria-labelledby="tasks-heading" className="mt-8">
        <h2 id="tasks-heading" className="text-lg font-semibold text-text-primary">
          Tasks
        </h2>
        <div className="mt-3">
          <TaskList
            status={tasksState.status}
            tasks={tasks}
            projects={[]}
            onRetry={tasksState.retry}
          />
        </div>
      </section>
    </div>
  );
}
