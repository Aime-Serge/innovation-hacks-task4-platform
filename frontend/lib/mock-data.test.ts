import { describe, expect, it } from "vitest";
import { getProjectProgress } from "./mock-data";
import type { Task } from "./types";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t",
    projectId: "p1",
    title: "Task",
    status: "todo",
    priority: "low",
    dueDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getProjectProgress", () => {
  it("returns zeroed progress for a project with no tasks", () => {
    expect(getProjectProgress("p1", [])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it("counts only tasks belonging to the given project", () => {
    const tasks = [
      makeTask({ id: "a", projectId: "p1", status: "done" }),
      makeTask({ id: "b", projectId: "p2", status: "done" }),
    ];
    expect(getProjectProgress("p1", tasks)).toEqual({ total: 1, done: 1, percent: 100 });
  });

  it("rounds the percentage", () => {
    const tasks = [
      makeTask({ id: "a", status: "done" }),
      makeTask({ id: "b", status: "todo" }),
      makeTask({ id: "c", status: "todo" }),
    ];
    expect(getProjectProgress("p1", tasks)).toEqual({ total: 3, done: 1, percent: 33 });
  });
});
