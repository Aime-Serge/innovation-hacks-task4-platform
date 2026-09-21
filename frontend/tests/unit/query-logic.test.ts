import { describe, expect, it } from "vitest";
import {
  applyProjectQuery,
  applyTaskQuery,
  filterTasks,
  normalizeSearch,
  projectProgress,
  sortTasks,
} from "@/lib/query-logic";
import { emptyProjectQuery, emptyTaskQuery } from "@/schemas";
import { makeProject, makeTask } from "./helpers";

describe("TC-040 progress math (BR-03)", () => {
  it("TC-040 rounds done / total to a whole percent", () => {
    const tasks = [
      makeTask({ status: "done" }),
      makeTask({ status: "todo" }),
      makeTask({ status: "todo" }),
    ];
    expect(projectProgress("p-1", tasks)).toEqual({ total: 3, done: 1, percent: 33 });
  });

  it("TC-040 shows 0% for a project with no tasks", () => {
    expect(projectProgress("p-1", [])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it("TC-040 only counts the project's own tasks", () => {
    const tasks = [makeTask({ projectId: "p-2", status: "done" }), makeTask({ status: "todo" })];
    expect(projectProgress("p-1", tasks).percent).toBe(0);
  });

  it("TC-040 reaches 100% when every task is done", () => {
    expect(projectProgress("p-1", [makeTask({ status: "done" })]).percent).toBe(100);
  });
});

describe("TC-050 search matching (BR-05)", () => {
  const tasks = [
    makeTask({ title: "Fix Login bug", description: "" }),
    makeTask({ title: "Write docs", description: "explain the LOGIN flow" }),
    makeTask({ title: "Deploy", description: "" }),
  ];

  it("TC-050 matches title and description case-insensitively", () => {
    expect(filterTasks(tasks, { ...emptyTaskQuery(), q: "login" })).toHaveLength(2);
  });

  it("TC-050 ignores leading and trailing spaces", () => {
    expect(normalizeSearch("  Login  ")).toBe("login");
    expect(filterTasks(tasks, { ...emptyTaskQuery(), q: "  DEPLOY " })).toHaveLength(1);
  });

  it("TC-050 treats a blank query as no filter", () => {
    expect(filterTasks(tasks, { ...emptyTaskQuery(), q: "   " })).toHaveLength(3);
  });

  it("TC-050 searches projects by name and description", () => {
    const projects = [makeProject({ name: "Alpha" }), makeProject({ description: "alpha team" })];
    expect(applyProjectQuery(projects, { ...emptyProjectQuery(), q: "ALPHA" })).toHaveLength(2);
  });
});

describe("TC-051 filter combination (BR-06)", () => {
  const tasks = [
    makeTask({ status: "todo", priority: "high", projectId: "p-1" }),
    makeTask({ status: "done", priority: "high", projectId: "p-2" }),
    makeTask({ status: "in_review", priority: "low", projectId: "p-1" }),
    makeTask({ status: "todo", priority: "low", projectId: "p-2" }),
  ];

  it("TC-051 combines different filters with AND", () => {
    const result = filterTasks(tasks, {
      ...emptyTaskQuery(),
      status: ["todo"],
      priority: ["high"],
    });
    expect(result).toHaveLength(1);
  });

  it("TC-051 combines values inside one filter with OR", () => {
    const result = filterTasks(tasks, { ...emptyTaskQuery(), status: ["todo", "done"] });
    expect(result).toHaveLength(3);
  });

  it("TC-051 filters by project and by assignee", () => {
    const own = [makeTask({ assigneeId: "u-1" }), makeTask({ assigneeId: "u-2" })];
    expect(filterTasks(own, { ...emptyTaskQuery(), assigneeId: "u-1" })).toHaveLength(1);
    expect(filterTasks(tasks, { ...emptyTaskQuery(), projectId: ["p-2"] })).toHaveLength(2);
  });

  it("TC-051 returns everything for the empty query (clear all)", () => {
    expect(filterTasks(tasks, emptyTaskQuery())).toHaveLength(4);
  });
});

describe("TC-052 sort", () => {
  it("TC-052 sorts by due date with undated tasks last in both directions", () => {
    const tasks = [
      makeTask({ title: "b", dueDate: "2030-02-01" }),
      makeTask({ title: "none", dueDate: null }),
      makeTask({ title: "a", dueDate: "2030-01-01" }),
    ];
    expect(sortTasks(tasks, "due_date", "asc").map((t) => t.title)).toEqual(["a", "b", "none"]);
    expect(sortTasks(tasks, "due_date", "desc").map((t) => t.title)).toEqual(["b", "a", "none"]);
  });

  it("TC-052 sorts by priority rank, urgent highest", () => {
    const tasks = [
      makeTask({ title: "l", priority: "low" }),
      makeTask({ title: "u", priority: "urgent" }),
      makeTask({ title: "h", priority: "high" }),
    ];
    expect(sortTasks(tasks, "priority", "desc").map((t) => t.title)).toEqual(["u", "h", "l"]);
  });

  it("TC-052 sorts by title and does not mutate its input", () => {
    const tasks = [makeTask({ title: "b" }), makeTask({ title: "a" })];
    const sorted = applyTaskQuery(tasks, { ...emptyTaskQuery(), sort: "title" });
    expect(sorted.map((t) => t.title)).toEqual(["a", "b"]);
    expect(tasks.map((t) => t.title)).toEqual(["b", "a"]);
  });

  it("TC-052 sorts projects by name and due date", () => {
    const projects = [
      makeProject({ name: "B", dueDate: "2030-01-01" }),
      makeProject({ name: "A", dueDate: "2030-02-01" }),
    ];
    expect(applyProjectQuery(projects, { ...emptyProjectQuery(), sort: "name" })[0]?.name).toBe(
      "A",
    );
    expect(applyProjectQuery(projects, { ...emptyProjectQuery(), sort: "due_date" })[0]?.name).toBe(
      "B",
    );
  });
});
