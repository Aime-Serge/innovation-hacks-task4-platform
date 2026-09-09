"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteProject,
  deleteTask,
  fetchProject,
  fetchTasks,
  fetchUsers,
  getProjectProgress,
  updateTaskStatus,
} from "@/lib/data";
import { useAsync } from "@/lib/useAsync";
import type { Priority, Task, TaskStatus } from "@/lib/types";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { ErrorState } from "@/components/shared/ErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SearchBar } from "@/components/controls/SearchBar";
import { FilterBar } from "@/components/controls/FilterBar";
import { TaskList } from "@/components/tasks/TaskList";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";

const EMPTY_TASKS: Task[] = [];

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const projectState = useAsync(() => fetchProject(projectId), [projectId]);
  const tasksState = useAsync(() => fetchTasks(projectId), [projectId]);
  const usersState = useAsync(() => fetchUsers(), []);

  const [editingProject, setEditingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [taskModal, setTaskModal] = useState<"create" | Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);

  const tasks = tasksState.data ?? EMPTY_TASKS;
  const users = usersState.data ?? [];
  const project = projectState.data;

  const normalizedQuery = query.trim().toLowerCase();
  const isFiltered = normalizedQuery.length > 0 || statusFilter !== null || priorityFilter !== null;

  const filteredTasks = useMemo(
    () =>
      tasks
        .filter((t) => (normalizedQuery ? t.title.toLowerCase().includes(normalizedQuery) : true))
        .filter((t) => (statusFilter ? t.status === statusFilter : true))
        .filter((t) => (priorityFilter ? t.priority === priorityFilter : true)),
    [tasks, normalizedQuery, statusFilter, priorityFilter],
  );

  function clearFilters() {
    setQuery("");
    setStatusFilter(null);
    setPriorityFilter(null);
  }

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
                  onClick={() => setEditingProject(true)}
                  className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingProject(true)}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="tasks-heading" className="text-lg font-semibold text-text-primary">
            Tasks
          </h2>
          <button
            type="button"
            onClick={() => setTaskModal("create")}
            className="rounded bg-interactive px-3 py-1.5 text-sm font-medium text-canvas"
          >
            New Task
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SearchBar value={query} onChange={setQuery} label="Search tasks" />
          <FilterBar
            value={statusFilter}
            onChange={setStatusFilter}
            priorityValue={priorityFilter}
            onPriorityChange={setPriorityFilter}
          />
        </div>

        <div className="mt-3">
          <TaskList
            status={tasksState.status}
            tasks={filteredTasks}
            projects={[]}
            users={users}
            filtered={isFiltered}
            onRetry={tasksState.retry}
            onClearFilters={clearFilters}
            onStatusChange={(task, status) =>
              updateTaskStatus(task.id, status).then(() => tasksState.retry())
            }
            onEdit={(task) => setTaskModal(task)}
            onDelete={(task) => setDeletingTask(task)}
          />
        </div>
      </section>

      {editingProject && project && (
        <ProjectFormModal
          project={project}
          onClose={() => setEditingProject(false)}
          onSaved={() => {
            setEditingProject(false);
            projectState.retry();
          }}
        />
      )}

      {deletingProject && project && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${project.name}" and all of its tasks? This can't be undone.`}
          onClose={() => setDeletingProject(false)}
          onConfirm={async () => {
            await deleteProject(project.id);
            router.push("/");
          }}
        />
      )}

      {taskModal && (
        <TaskFormModal
          projectId={projectId}
          task={taskModal === "create" ? undefined : taskModal}
          users={users}
          onClose={() => setTaskModal(null)}
          onSaved={() => {
            setTaskModal(null);
            tasksState.retry();
          }}
        />
      )}

      {deletingTask && (
        <ConfirmDialog
          title="Delete task"
          message={`Delete "${deletingTask.title}"? This can't be undone.`}
          onClose={() => setDeletingTask(null)}
          onConfirm={async () => {
            await deleteTask(deletingTask.id);
            setDeletingTask(null);
            tasksState.retry();
          }}
        />
      )}
    </div>
  );
}
