"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProject, fetchProject, fetchTasks, getProjectProgress } from "@/lib/data";
import { useAsync } from "@/lib/useAsync";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { ErrorState } from "@/components/shared/ErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TaskList } from "@/components/tasks/TaskList";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const projectState = useAsync(() => fetchProject(projectId), [projectId]);
  const tasksState = useAsync(() => fetchTasks(projectId), [projectId]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tasks = tasksState.data ?? [];
  const project = projectState.data;

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
        {projectState.status === "success" && project === null && (
          <p className="text-sm text-text-secondary">Project not found.</p>
        )}
        {projectState.status === "success" && project && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">{project.name}</h1>
                {project.description && (
                  <p className="mt-1 text-sm text-text-secondary">{project.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(true)}
                  className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-status-blocked hover:border-status-blocked"
                >
                  Delete
                </button>
              </div>
            </div>
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

      {editing && project && (
        <ProjectFormModal
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            projectState.retry();
          }}
        />
      )}

      {deleting && project && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${project.name}" and all of its tasks? This can't be undone.`}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await deleteProject(project.id);
            router.push("/");
          }}
        />
      )}
    </div>
  );
}
