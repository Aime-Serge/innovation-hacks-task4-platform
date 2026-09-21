import { NewProject, NewTask, Project, Task } from "@/schemas";
import type { Page } from "@/schemas";
import type { AiService } from "@/services/ai";
import { ServiceError } from "@/services/types";
import type {
  ActivityService,
  ProjectService,
  Services,
  TaskService,
  UserPatch,
  UserService,
} from "@/services/types";
import { call, callJson } from "./client";
import {
  parseActivity,
  parseUser,
  projectBody,
  projectParams,
  readAll,
  taskCreateBody,
  taskParams,
  taskPatchBody,
} from "./mappers";

async function orNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) return null;
    throw error;
  }
}

const projects: ProjectService = {
  list: (query, signal) =>
    readAll(
      (p) => callJson("GET", "projects", { query: p, signal }),
      projectParams(query),
      (raw) => Project.parse(raw),
    ),
  get: (id, signal) =>
    orNull(async () => Project.parse(await callJson("GET", `projects/${id}`, { signal }))),
  create: async (input) =>
    Project.parse(
      await callJson("POST", "projects", { body: projectBody(NewProject.parse(input)) }),
    ),
  update: async (id, patch) =>
    Project.parse(await callJson("PATCH", `projects/${id}`, { body: projectBody(patch) })),
  remove: async (id) => {
    await call("DELETE", `projects/${id}`);
  },
};

const tasks: TaskService = {
  list: (query, signal) =>
    readAll(
      (p) => callJson("GET", "tasks", { query: p, signal }),
      taskParams(query),
      (r) => Task.parse(r),
    ),
  updateStatus: async (id, status) =>
    Task.parse(await callJson("PATCH", `tasks/${id}/status`, { body: { status } })),
  create: async (input) =>
    Task.parse(await callJson("POST", "tasks", { body: taskCreateBody(NewTask.parse(input)) })),
  update: async (id, patch) => {
    const fields = taskPatchBody(patch);
    let saved =
      Object.keys(fields).length === 0
        ? null
        : Task.parse(await callJson("PATCH", `tasks/${id}`, { body: fields }));
    // A status change goes through its own route; the same status is a harmless no-op (BR-204).
    if (patch.status !== undefined) saved = await tasks.updateStatus(id, patch.status);
    if (saved === null)
      throw new ServiceError("VALIDATION_ERROR", "There is nothing to change.", 422);
    return saved;
  },
  remove: async (id) => {
    await call("DELETE", `tasks/${id}`);
  },
};

const users: UserService = {
  list: async (signal) =>
    (
      await readAll(
        (p) => callJson("GET", "users", { query: p, signal }),
        new URLSearchParams(),
        parseUser,
      )
    ).items,
  get: (id, signal) =>
    orNull(async () => parseUser(await callJson("GET", `users/${id}`, { signal }))),
  update: async (id, patch: UserPatch) => {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body["name"] = patch.name;
    if (patch.theme !== undefined) body["preferences"] = { theme: patch.theme };
    return parseUser(await callJson("PATCH", `users/${id}`, { body }));
  },
};

const activity: ActivityService = {
  list: async (limit, signal) => {
    const query = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 50)) });
    const page = await readAll(
      (p) => callJson("GET", "activity", { query: p, signal }),
      query,
      parseActivity,
    );
    return page.items;
  },
};

const ai: AiService = {
  status: (signal) => callJson("GET", "ai/status", { signal }),
  suggestTasks: (projectId, input, signal) =>
    callJson("POST", `ai/projects/${projectId}/task-suggestions`, { body: { ...input }, signal }),
  prioritize: (projectId, signal) =>
    callJson("POST", `ai/projects/${projectId}/prioritization`, { signal }),
  summarize: (projectId, signal) =>
    callJson("POST", `ai/projects/${projectId}/summary`, { signal }),
};

export function createHttpServices(): Services {
  return { projects, tasks, users, activity, ai };
}

export type { Page };
