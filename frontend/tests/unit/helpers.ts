import type { Project, Task } from "@/schemas";

let counter = 0;

export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `t-${counter}`,
    projectId: "p-1",
    title: `Task ${counter}`,
    description: "",
    status: "todo",
    priority: "medium",
    dueDate: null,
    assigneeId: null,
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  counter += 1;
  return {
    id: `p-${counter}`,
    name: `Project ${counter}`,
    description: "",
    status: "active",
    dueDate: "2030-01-01",
    ownerId: "user-1",
    ...overrides,
  };
}
