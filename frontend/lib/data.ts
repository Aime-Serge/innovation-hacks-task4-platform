import { api, ApiError } from "./api";
import { getInitials } from "./auth";
import type { Priority, Project, ProjectProgress, Task, TaskStatus, User } from "./types";

interface ApiProject {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface ApiTask {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

function toProject(p: ApiProject): Project {
  return { id: p.id, name: p.name, description: p.description, ownerId: p.owner_id, createdAt: p.created_at };
}

function toTask(t: ApiTask): Task {
  return {
    id: t.id,
    projectId: t.project_id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date,
    assigneeId: t.assignee_id,
    createdAt: t.created_at,
  };
}

function toUser(u: ApiUser): User {
  return { id: u.id, name: u.name, email: u.email, initials: getInitials(u.name) };
}

export async function fetchProjects(opts: { search?: string } = {}): Promise<Project[]> {
  const qs = opts.search ? `?search=${encodeURIComponent(opts.search)}` : "";
  const data = await api.get<ApiProject[]>(`/projects${qs}`);
  return data.map(toProject);
}

export async function fetchProject(id: string): Promise<Project | null> {
  try {
    const data = await api.get<ApiProject>(`/projects/${id}`);
    return toProject(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function fetchTasks(projectId?: string): Promise<Task[]> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const data = await api.get<ApiTask[]>(`/tasks${qs}`);
  return data.map(toTask);
}

export async function fetchUsers(): Promise<User[]> {
  const data = await api.get<ApiUser[]>("/users");
  return data.map(toUser);
}

export function getProjectProgress(projectId: string, allTasks: Task[]): ProjectProgress {
  const projectTasks = allTasks.filter((t) => t.projectId === projectId);
  const done = projectTasks.filter((t) => t.status === "done").length;
  const total = projectTasks.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}

export async function createProject(input: { name: string; description?: string | null }): Promise<Project> {
  const data = await api.post<ApiProject>("/projects", input);
  return toProject(data);
}

export async function updateProject(
  id: string,
  input: { name?: string; description?: string | null },
): Promise<Project> {
  const data = await api.patch<ApiProject>(`/projects/${id}`, input);
  return toProject(data);
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export interface TaskCreateInput {
  title: string;
  description?: string | null;
  projectId: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export async function createTask(input: TaskCreateInput): Promise<Task> {
  const data = await api.post<ApiTask>("/tasks", {
    title: input.title,
    description: input.description,
    project_id: input.projectId,
    status: input.status,
    priority: input.priority,
    due_date: input.dueDate,
    assignee_id: input.assigneeId,
  });
  return toTask(data);
}

export interface TaskUpdateInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
  dueDate?: string | null;
  assigneeId?: string | null;
  clearDueDate?: boolean;
  clearAssignee?: boolean;
}

export async function updateTask(id: string, input: TaskUpdateInput): Promise<Task> {
  const data = await api.patch<ApiTask>(`/tasks/${id}`, {
    title: input.title,
    description: input.description,
    priority: input.priority,
    due_date: input.dueDate,
    assignee_id: input.assigneeId,
    clear_due_date: input.clearDueDate,
    clear_assignee: input.clearAssignee,
  });
  return toTask(data);
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const data = await api.patch<ApiTask>(`/tasks/${id}/status`, { status });
  return toTask(data);
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

export interface GeneratedTask {
  title: string;
  description: string;
  priority: Priority;
}

export interface GenerateTasksResult {
  source: "ai" | "fallback";
  tasks: GeneratedTask[];
}

export async function generateTasks(
  projectId: string,
  opts: { instructions?: string; count?: number } = {},
): Promise<GenerateTasksResult> {
  return api.post<GenerateTasksResult>(`/projects/${projectId}/ai/generate-tasks`, opts);
}
