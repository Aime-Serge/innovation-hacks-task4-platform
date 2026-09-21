import { describe, expect, it } from "vitest";
import { createMockServices } from "@/adapters/mock";
import type { Scenario } from "@/schemas";
import { Activity, emptyProjectQuery, emptyTaskQuery, Project, Task, User } from "@/schemas";
import { ServiceError } from "@/services/types";

const NOW = new Date("2030-01-10T12:00:00Z");
const fast = (scenario: Scenario) =>
  createMockServices({ scenario, latency: { min: 0, max: 0 }, now: NOW });

// NFR-24 / TH-03: any adapter (mock now, HTTP later) must satisfy this contract.
describe("TC-100 adapter contract: responses match the schemas", () => {
  it.each(["default", "large", "edge-text"] as const)(
    "TC-100 %s scenario returns schema-valid projects, tasks, users and activity",
    async (scenario) => {
      const { services } = fast(scenario);
      const projects = await services.projects.list(emptyProjectQuery());
      const tasks = await services.tasks.list(emptyTaskQuery());
      const users = await services.users.list();
      const activity = await services.activity.list(10);
      expect(projects.items.every((p) => Project.safeParse(p).success)).toBe(true);
      expect(tasks.items.every((t) => Task.safeParse(t).success)).toBe(true);
      expect(users.every((u) => User.safeParse(u).success)).toBe(true);
      expect(activity.every((a) => Activity.safeParse(a).success)).toBe(true);
      expect(tasks.total).toBe(tasks.items.length);
    },
  );

  it("TC-100 the default scenario has realistic mixed data", async () => {
    const { services } = fast("default");
    const tasks = await services.tasks.list(emptyTaskQuery());
    expect(new Set(tasks.items.map((t) => t.status)).size).toBe(4);
    expect(new Set(tasks.items.map((t) => t.priority)).size).toBe(4);
  });

  it("TC-100 is deterministic for a fixed date", async () => {
    const a = await fast("default").services.tasks.list(emptyTaskQuery());
    const b = await fast("default").services.tasks.list(emptyTaskQuery());
    expect(a).toEqual(b);
  });

  it("TC-100 get() resolves to null for an unknown project id", async () => {
    expect(await fast("default").services.projects.get("nope")).toBeNull();
  });
});

describe("TC-072 scenarios drive every state (section 8)", () => {
  it("TC-071 empty: zero projects, tasks and activity", async () => {
    const { services } = fast("empty");
    expect((await services.projects.list(emptyProjectQuery())).total).toBe(0);
    expect((await services.tasks.list(emptyTaskQuery())).total).toBe(0);
    expect(await services.activity.list(10)).toEqual([]);
  });

  it("TC-072 error: every list request fails with a plain-language 500", async () => {
    const { services } = fast("error");
    const failure = await services.tasks.list(emptyTaskQuery()).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ServiceError);
    expect((failure as ServiceError).status).toBe(500);
    expect((failure as ServiceError).message).not.toMatch(/stack|undefined|TypeError/i);
    await expect(services.projects.list(emptyProjectQuery())).rejects.toBeInstanceOf(ServiceError);
    await expect(services.activity.list(10)).rejects.toBeInstanceOf(ServiceError);
  });

  it("TC-073 partial-error: only the tasks request fails", async () => {
    const { services } = fast("partial-error");
    await expect(services.tasks.list(emptyTaskQuery())).rejects.toBeInstanceOf(ServiceError);
    expect((await services.projects.list(emptyProjectQuery())).total).toBeGreaterThan(0);
    expect((await services.activity.list(10)).length).toBeGreaterThan(0);
  });

  it("TC-072 flaky: the first request fails and the retry succeeds", async () => {
    const { services } = fast("flaky");
    await expect(services.tasks.list(emptyTaskQuery())).rejects.toBeInstanceOf(ServiceError);
    expect((await services.tasks.list(emptyTaskQuery())).total).toBeGreaterThan(0);
  });

  it("TC-019 update-fails: reads work but a status change is rejected", async () => {
    const { services } = fast("update-fails");
    const tasks = await services.tasks.list(emptyTaskQuery());
    const first = tasks.items[0];
    expect(first).toBeDefined();
    await expect(services.tasks.updateStatus(first?.id ?? "", "done")).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  it("TC-070 large: 500 tasks and 40 projects", async () => {
    const { services } = fast("large");
    expect((await services.tasks.list(emptyTaskQuery())).total).toBe(500);
    expect((await services.projects.list(emptyProjectQuery())).total).toBe(40);
  });

  it("TC-030 edge-text: names reach the 80-character limit and include RTL and emoji", async () => {
    const { services } = fast("edge-text");
    const names = (await services.projects.list(emptyProjectQuery())).items.map((p) => p.name);
    expect(Math.max(...names.map((n) => n.length))).toBe(80);
    expect(names.some((n) => /[֐-ۿ]/.test(n))).toBe(true);
    expect(names.some((n) => /\p{Extended_Pictographic}/u.test(n))).toBe(true);
  });

  it("TC-070 loading: every request takes about 3 seconds", async () => {
    const started = Date.now();
    await fast("loading").services.projects.list(emptyProjectQuery());
    expect(Date.now() - started).toBeGreaterThanOrEqual(2900);
  }, 10_000);

  it("TC-070 loading: an aborted request rejects", async () => {
    const controller = new AbortController();
    const pending = fast("loading").services.tasks.list(emptyTaskQuery(), controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeDefined();
  });
});

describe("TC-019 service mutations", () => {
  it("TC-019 a status change updates the task and records activity", async () => {
    const { services } = fast("default");
    const before = await services.activity.list(50);
    const task = (await services.tasks.list(emptyTaskQuery())).items.find(
      (t) => t.status !== "done",
    );
    const updated = await services.tasks.updateStatus(task?.id ?? "", "done");
    expect(updated.status).toBe("done");
    expect((await services.activity.list(50)).length).toBe(Math.min(50, before.length + 1));
  });

  it("TC-030 creates, updates and removes a project, cascading to its tasks", async () => {
    const { services } = fast("default");
    const project = await services.projects.create({
      name: "New",
      description: "",
      status: "planned",
      dueDate: "2030-06-01",
      ownerId: "user-1",
    });
    await services.tasks.create({
      projectId: project.id,
      title: "Child",
      description: "",
      status: "todo",
      priority: "low",
      dueDate: null,
      assigneeId: null,
    });
    expect((await services.projects.update(project.id, { name: "Renamed" })).name).toBe("Renamed");
    await services.projects.remove(project.id);
    expect(await services.projects.get(project.id)).toBeNull();
    const tasks = await services.tasks.list({ ...emptyTaskQuery(), projectId: [project.id] });
    expect(tasks.total).toBe(0);
  });

  it("TC-030 rejects operations on unknown ids with not_found", async () => {
    const { services } = fast("default");
    await expect(services.tasks.updateStatus("nope", "done")).rejects.toMatchObject({
      status: 404,
    });
    await expect(services.projects.update("nope", { name: "x" })).rejects.toMatchObject({
      status: 404,
    });
  });
});
