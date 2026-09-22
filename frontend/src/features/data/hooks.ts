"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServices } from "@/providers/ServicesProvider";
import { reportError } from "@/lib/report-error";
import type { PasswordChangeInput } from "@/services/types";
import {
  emptyTaskQuery,
  type NewProject,
  type NewTask,
  type ProfilePatch,
  type ProjectQuery,
  type Task,
  type TaskQuery,
  type TaskStatus,
  type Theme,
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
  me: ["me"] as const,
  member: (id: string) => ["member", id] as const,
  peopleSearch: (q: string) => ["people-search", q] as const,
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

/** FR-420: the row leaves the list at once; a failed delete puts it back and says why. */
export function useDeleteTask(onFailure: () => void) {
  const { tasks } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasks.remove(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: ["tasks"] });
      const previous = client.getQueriesData<TaskPages>({ queryKey: ["tasks"] });
      client.setQueriesData<TaskPages>({ queryKey: ["tasks"] }, (page) =>
        page === undefined
          ? page
          : {
              ...page,
              items: page.items.filter((task) => task.id !== id),
              total: Math.max(0, page.total - 1),
            },
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      reportError(error, "tasks.remove");
      context?.previous.forEach(([key, value]) => client.setQueryData(key, value));
      onFailure();
    },
    onSettled: () => {
      for (const key of ["tasks", "activity", "projects", "project"]) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

/** FR-413: the caller reads the error itself, because a 409 needs its own explanation. */
export function useDeleteProject() {
  const { projects } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projects.remove(id),
    onSuccess: () => {
      for (const key of ["projects", "project", "tasks", "activity"]) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

// MF-06, MF-08, MF-12: the signed-in person's own view and its writes.

export function useMe() {
  const { me } = useServices();
  return useQuery({
    queryKey: keys.me,
    queryFn: ({ signal }) => reported("me.get", () => me.get(signal)),
  });
}

/** MF-07: another member's page; null id resolves to "not found" (never a leaked profile). */
export function useMember(id: string) {
  const { users } = useServices();
  return useQuery({
    queryKey: keys.member(id),
    queryFn: ({ signal }) => reported("users.get", () => users.get(id, signal)),
  });
}

/** MF-11: the people picker. Disabled below the two-character minimum (section 4). */
export function usePeopleSearch(query: string) {
  const { users } = useServices();
  const trimmed = query.trim();
  return useQuery({
    queryKey: keys.peopleSearch(trimmed),
    queryFn: ({ signal }) => reported("users.search", () => users.search(trimmed, signal)),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
  });
}

function useMeMutation<Input>(mutationFn: (input: Input) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (value) => client.setQueryData(keys.me, value),
    onError: (error) => reportError(error, "me.save"),
  });
}

export function useUpdateProfile() {
  const { me } = useServices();
  return useMeMutation((patch: ProfilePatch) => me.updateProfile(patch));
}

export function useReplaceSkills() {
  const { me } = useServices();
  return useMeMutation((skills: string[]) => me.replaceSkills(skills));
}

export function useUpdatePreferences() {
  const { me } = useServices();
  return useMeMutation((input: { theme: Theme; timeZone: string }) => me.updatePreferences(input));
}

export function useUpdatePrivacy() {
  const { me } = useServices();
  return useMeMutation((value: boolean) => me.updatePrivacy(value));
}

export function useChangePassword() {
  const { me } = useServices();
  return useMutation({ mutationFn: (input: PasswordChangeInput) => me.changePassword(input) });
}

export function useSignOutAllDevices() {
  const { me } = useServices();
  return useMutation({ mutationFn: () => me.signOutAllDevices() });
}

export function useDeleteAccount() {
  const { me } = useServices();
  return useMutation({ mutationFn: (password: string) => me.deleteAccount(password) });
}
