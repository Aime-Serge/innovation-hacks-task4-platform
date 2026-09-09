"use client";

import { useMemo, useState } from "react";
import { fetchProjects, fetchTasks } from "@/lib/data";
import { useAsync } from "@/lib/useAsync";
import type { Project, Task, TaskStatus } from "@/lib/types";

// Stable references so a null fetch result doesn't produce a new array
// identity on every render, which would otherwise re-trigger the
// useMemo filters below unnecessarily.
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_TASKS: Task[] = [];
import { StatsStrip } from "./StatsStrip";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { TaskList } from "@/components/tasks/TaskList";
import { SearchBar } from "@/components/controls/SearchBar";
import { FilterBar } from "@/components/controls/FilterBar";

export function DashboardView() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);

  const projectsState = useAsync(() => fetchProjects(), []);
  const tasksState = useAsync(() => fetchTasks(), []);

  const projects = projectsState.data ?? EMPTY_PROJECTS;
  const tasks = tasksState.data ?? EMPTY_TASKS;

  const normalizedQuery = query.trim().toLowerCase();
  // Status filter only narrows tasks, not projects — kept separate so
  // ProjectGrid's empty-state copy doesn't blame a filter that couldn't
  // have affected it.
  const isProjectsFiltered = normalizedQuery.length > 0;
  const isTasksFiltered = normalizedQuery.length > 0 || statusFilter !== null;

  const filteredProjects = useMemo(
    () =>
      normalizedQuery
        ? projects.filter((p) => p.name.toLowerCase().includes(normalizedQuery))
        : projects,
    [projects, normalizedQuery],
  );

  const filteredTasks = useMemo(
    () =>
      tasks
        .filter((t) => (normalizedQuery ? t.title.toLowerCase().includes(normalizedQuery) : true))
        .filter((t) => (statusFilter ? t.status === statusFilter : true)),
    [tasks, normalizedQuery, statusFilter],
  );

  function clearFilters() {
    setQuery("");
    setStatusFilter(null);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            See where every project stands, at a glance.
          </p>
        </div>
      </div>

      <section aria-label="Activity summary" className="mt-6">
        <StatsStrip
          status={projectsState.status}
          projects={projects}
          tasks={tasks}
          onRetry={projectsState.retry}
        />
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar value={query} onChange={setQuery} label="Search projects and tasks" />
        <FilterBar value={statusFilter} onChange={setStatusFilter} />
      </div>

      <section aria-labelledby="projects-heading" className="mt-6">
        <h2 id="projects-heading" className="text-lg font-semibold text-text-primary">
          Projects
        </h2>
        <div className="mt-3">
          <ProjectGrid
            status={projectsState.status}
            projects={filteredProjects}
            tasks={tasks}
            filtered={isProjectsFiltered}
            onRetry={projectsState.retry}
            onClearFilters={clearFilters}
          />
        </div>
      </section>

      <section aria-labelledby="tasks-heading" className="mt-8">
        <h2 id="tasks-heading" className="text-lg font-semibold text-text-primary">
          My tasks
        </h2>
        <div className="mt-3">
          <TaskList
            status={tasksState.status}
            tasks={filteredTasks}
            projects={projects}
            showProjectName
            filtered={isTasksFiltered}
            onRetry={tasksState.retry}
            onClearFilters={clearFilters}
          />
        </div>
      </section>
    </div>
  );
}
