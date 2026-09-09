export type TaskStatus = "todo" | "in-progress" | "done" | "blocked";
export type Priority = "low" | "medium" | "high";

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
}

export interface ProjectProgress {
  total: number;
  done: number;
  percent: number;
}

export interface User {
  id: string;
  name: string;
  role: string;
  initials: string;
}
