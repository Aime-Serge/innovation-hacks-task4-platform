import type { Project, Task, User } from "@/schemas";

let counter = 0;

/** S-D: a schema-valid user for tests that do not care about profile details. */
export function makeUser(overrides: Partial<User> = {}): User {
  counter += 1;
  return {
    id: `u-${counter}`,
    name: `Test User ${counter}`,
    givenName: "Test",
    familyName: `User ${counter}`,
    email: `test${counter}@example.com`,
    role: "developer",
    preferences: { theme: "system" },
    profile: null,
    ...overrides,
  };
}

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
