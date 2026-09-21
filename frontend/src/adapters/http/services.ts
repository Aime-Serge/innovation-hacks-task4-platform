import { Activity, NewProject, NewTask, Project, Task, User, pageOf } from "@/schemas";
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
import { projectParams, readAll, taskParams } from "./mappers";

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
      Project,
    ),
  get: (id, signal) =>
    orNull(async () => Project.parse(await callJson("GET", `projects/${id}`, { signal }))),
  create: async (input) =>
    Project.parse(await callJson("POST", "projects", { body: NewProject.parse(input) })),
  update: async (id, patch) =>
    Project.parse(await callJson("PATCH", `projects/${id}`, { body: patch })),
  remove: async (id) => {
    await call("DELETE", `projects/${id}`);
  },
};

const tasks: TaskService = {
  list: (query, signal) =>
    readAll((p) => callJson("GET", "tasks", { query: p, signal }), taskParams(query), Task),
  updateStatus: async (id, status) =>
    Task.parse(await callJson("PATCH", `tasks/${id}/status`, { body: { status } })),
  create: async (input) =>
    Task.parse(await callJson("POST", "tasks", { body: NewTask.parse(input) })),
  update: async (id, patch) => Task.parse(await callJson("PATCH", `tasks/${id}`, { body: patch })),
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
        User,
      )
    ).items,
  get: (id, signal) =>
    orNull(async () => User.parse(await callJson("GET", `users/${id}`, { signal }))),
  update: async (id, patch: UserPatch) => {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body["name"] = patch.name;
    if (patch.theme !== undefined) body["preferences"] = { theme: patch.theme };
    return User.parse(await callJson("PATCH", `users/${id}`, { body }));
  },
};

const activity: ActivityService = {
  list: async (limit, signal) => {
    const query = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 50)) });
    return pageOf(Activity).parse(await callJson("GET", "activity", { query, signal })).items;
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
