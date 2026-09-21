import { describe, expect, it } from "vitest";
import { computeKpis, upcomingDeadlines } from "@/features/dashboard/kpis";
import { profileStats } from "@/features/profile/stats";
import { makeProject, makeTask } from "./helpers";

const TODAY = "2030-01-10";

describe("TC-002 KPI calculations (FR-02)", () => {
  const projects = [
    makeProject({ status: "active" }),
    makeProject({ status: "active" }),
    makeProject({ status: "completed" }),
  ];
  const tasks = [
    makeTask({ status: "done", dueDate: "2030-01-01" }),
    makeTask({ status: "todo", dueDate: "2030-01-05" }),
    makeTask({ status: "in_progress", dueDate: "2030-01-20" }),
    makeTask({ status: "todo" }),
  ];

  it("TC-002 counts active projects, open tasks and overdue tasks", () => {
    const kpis = computeKpis(projects, tasks, TODAY);
    expect(kpis.activeProjects).toBe(2);
    expect(kpis.openTasks).toBe(3);
    expect(kpis.overdueTasks).toBe(1);
  });

  it("TC-002 completion rate is done over all tasks, rounded", () => {
    expect(computeKpis(projects, tasks, TODAY).completionRate).toBe(25);
  });

  it("TC-002 shows zeros when there is no data", () => {
    expect(computeKpis([], [], TODAY)).toEqual({
      activeProjects: 0,
      openTasks: 0,
      overdueTasks: 0,
      completionRate: 0,
    });
  });
});

describe("TC-003 deadlines (FR-03)", () => {
  it("TC-003 lists open tasks due in the next 7 days, soonest first", () => {
    const soon = makeTask({ title: "soon", dueDate: "2030-01-11" });
    const later = makeTask({ title: "later", dueDate: "2030-01-17" });
    const list = upcomingDeadlines(
      [
        later,
        soon,
        makeTask({ dueDate: "2030-01-18" }),
        makeTask({ dueDate: "2030-01-09" }),
        makeTask({ status: "done", dueDate: "2030-01-12" }),
        makeTask({ dueDate: null }),
      ],
      TODAY,
      "2030-01-17",
    );
    expect(list.map((t) => t.title)).toEqual(["soon", "later"]);
  });

  it("TC-003 returns an empty list when nothing is due", () => {
    expect(upcomingDeadlines([], TODAY, "2030-01-17")).toEqual([]);
  });
});

describe("TC-020 profile stats (FR-09)", () => {
  it("TC-020 derives stats from the user's own tasks only", () => {
    const stats = profileStats(
      "u-1",
      [
        makeTask({ assigneeId: "u-1", status: "done" }),
        makeTask({ assigneeId: "u-1", status: "todo", dueDate: "2030-01-01" }),
        makeTask({ assigneeId: "u-2", status: "done" }),
      ],
      TODAY,
    );
    expect(stats).toEqual({ assigned: 2, done: 1, overdue: 1, completionRate: 50 });
  });

  it("TC-020 is all zeros for a user with no tasks", () => {
    expect(profileStats("nobody", [makeTask()], TODAY).assigned).toBe(0);
  });
});
