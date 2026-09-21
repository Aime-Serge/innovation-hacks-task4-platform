"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServices } from "@/providers/ServicesProvider";
import { reportError } from "@/lib/report-error";
import {
  emptyTaskQuery,
  type NewProject,
  type NewTask,
  type ProjectQuery,
  type Task,
  type TaskQuery,
  type TaskStatus,
} from "@/schemas";

/** Every read goes through here so failures are reported once (NFR-20). */
function reported<T>(context: string, load: () => Promise<T>): Promise<T> {
  return load().catch((error: unknown) => {
    reportError(error, context);
    throw error;
  });
}

export const keys = {
  tasks: (query: TaskQuery) => ["tasks", query] as const,
  projects: (query: ProjectQuery) => ["projects", query] as const,
  project: (id: string) => ["project", id] as const,
  users: ["users"] as const,
  activity: (limit: number) => ["activity", limit] as const,
};

export function useTasks(query: TaskQuery) {
  const { tasks } = useServices();
  return useQuery({
    queryKey: keys.tasks(query),
    queryFn: ({ signal }) => reported("tasks.list", () => tasks.list(query, signal)),
    // Keep the list on screen while a new filter loads instead of flashing skeletons.
    placeholderData: keepPreviousData,
  });
}

/** All tasks, unfiltered: progress and KPIs are computed from this. */
export function useAllTasks() {
  return useTasks(emptyTaskQuery());
}

export function useProjects(query: ProjectQuery) {
  const { projects } = useServices();
  return useQuery({
    queryKey: keys.projects(query),
    queryFn: ({ signal }) => reported("projects.list", () => projects.list(query, signal)),
    placeholderData: keepPreviousData,
  });
}

export function useProject(id: string) {
  const { projects } = useServices();
  return useQuery({
    queryKey: keys.project(id),
    queryFn: ({ signal }) => reported("projects.get", () => projects.get(id, signal)),
  });
}

export function useUsers() {
  const { users } = useServices();
  return useQuery({
    queryKey: keys.users,
    queryFn: ({ signal }) => reported("users.list", () => users.list(signal)),
  });
}

export function useActivity(limit: number) {
  const { activity } = useServices();
  return useQuery({
    queryKey: keys.activity(limit),
    queryFn: ({ signal }) => reported("activity.list", () => activity.list(limit, signal)),
  });
}

type TaskPages = { items: Task[]; total: number };

/** FR-19: optimistic status change that rolls back when the service rejects. */
export function useUpdateTaskStatus(onFailure: () => void) {
  const { tasks } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasks.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey: ["tasks"] });
      const previous = client.getQueriesData<TaskPages>({ queryKey: ["tasks"] });
      client.setQueriesData<TaskPages>({ queryKey: ["tasks"] }, (page) =>
        page === undefined
          ? page
          : { ...page, items: page.items.map((t) => (t.id === id ? { ...t, status } : t)) },
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      reportError(error, "tasks.updateStatus");
      context?.previous.forEach(([key, value]) => client.setQueryData(key, value));
      onFailure();
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["tasks"] });
      void client.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useSaveProject(onDone: () => void) {
  const { projects } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: NewProject }) =>
      id === null ? projects.create(input) : projects.update(id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["projects"] });
      void client.invalidateQueries({ queryKey: ["project"] });
      onDone();
    },
    onError: (error) => reportError(error, "projects.save"),
  });
}

export function useSaveTask(onDone: () => void) {
  const { tasks } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: NewTask }) =>
      id === null ? tasks.create(input) : tasks.update(id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["tasks"] });
      void client.invalidateQueries({ queryKey: ["activity"] });
      onDone();
    },
    onError: (error) => reportError(error, "tasks.save"),
  });
}
