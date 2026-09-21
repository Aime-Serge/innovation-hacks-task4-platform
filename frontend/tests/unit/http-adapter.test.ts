// TC-405 (silent refresh), TC-453 (adapter parity with the Task 1 interfaces), TC-459 (waking up).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpAuth, createHttpServices } from "@/adapters/http";
import { AWAKE_EVENT, WAKING_EVENT, call, callJson, onSessionEnded } from "@/adapters/http/client";
import {
  emptyProjectQuery,
  emptyTaskQuery,
  type NewProject,
  type NewTask,
  type Task,
} from "@/schemas";
import { ServiceError } from "@/services/types";

const P1 = "11111111-1111-4111-8111-111111111111";
const project = {
  id: P1,
  name: "Atlas",
  description: "",
  status: "active",
  dueDate: null,
  ownerId: "u1",
};
const task: Task = {
  id: "t1",
  projectId: P1,
  title: "Write",
  description: "",
  status: "todo",
  priority: "high",
  dueDate: "2026-09-30",
  assigneeId: null,
};
const user = {
  id: "u1",
  name: "Ada",
  email: null,
  role: "developer",
  preferences: { theme: "system" },
};
const newProject: NewProject = {
  name: "Atlas",
  description: "",
  status: "active",
  dueDate: null,
  ownerId: "u1",
};
const newTask: NewTask = {
  projectId: P1,
  title: "Write",
  description: "",
  status: "todo",
  priority: "high",
  dueDate: "2026-09-30",
  assigneeId: null,
};
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const envelope = (code: string, message = "m") => ({ error: { code, message } });

type Seen = { url: string; method: string; body: string | null; credentials: string | undefined };
let seen: Seen[];
let queue: (Response | Error)[];
function stub() {
  seen = [];
  queue = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      seen.push({
        url,
        method: init?.method ?? "GET",
        body: (init?.body as string | undefined) ?? null,
        credentials: init?.credentials,
      });
      const next = queue.shift();
      if (next === undefined) return Promise.reject(new Error("no answer queued for " + url));
      return next instanceof Error || next instanceof DOMException
        ? Promise.reject(next)
        : Promise.resolve(next);
    }),
  );
}
beforeEach(stub);
afterEach(() => vi.unstubAllGlobals());

describe("TC-453 the client", () => {
  it("calls the server layer on the same origin with the query string", async () => {
    queue.push(json(200, { ok: true }));
    await callJson("GET", "tasks", { query: new URLSearchParams({ q: "a b" }) });
    expect(seen[0]).toMatchObject({
      url: "/api/bff/tasks?q=a+b",
      method: "GET",
      credentials: "same-origin",
    });
  });
  it("turns an error envelope into a ServiceError, with Retry-After", async () => {
    queue.push(json(429, envelope("AI_QUOTA_EXCEEDED", "limit"), { "retry-after": "40" }));
    const error = (await call("POST", "ai/projects/p/summary").catch(
      (e: unknown) => e,
    )) as ServiceError;
    expect(error).toBeInstanceOf(ServiceError);
    expect([error.code, error.message, error.status, error.retryAfter]).toEqual([
      "AI_QUOTA_EXCEEDED",
      "limit",
      429,
      40,
    ]);
  });
  it("copes with an error that is not JSON, and with a network failure", async () => {
    queue.push(new Response("<html>", { status: 400, statusText: "Bad" }));
    const odd = (await call("GET", "tasks").catch((e: unknown) => e)) as ServiceError;
    expect([odd.code, odd.status]).toEqual(["UNKNOWN", 400]);
    queue.push(new TypeError("offline"));
    const down = (await call("GET", "tasks").catch((e: unknown) => e)) as ServiceError;
    expect([down.code, down.status]).toEqual(["NETWORK_ERROR", 0]);
  });
  it("lets an abort through untouched", async () => {
    queue.push(new DOMException("aborted", "AbortError"));
    await expect(call("GET", "tasks")).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("TC-405 silent refresh", () => {
  it("refreshes once and retries the call once", async () => {
    queue.push(
      json(401, envelope("UNAUTHENTICATED")),
      new Response(null, { status: 204 }),
      json(200, { items: [] }),
    );
    const res = await call("GET", "tasks");
    expect(res.status).toBe(200);
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      "GET /api/bff/tasks",
      "POST /api/bff/auth/refresh",
      "GET /api/bff/tasks",
    ]);
  });
  it("shares one refresh between calls that fail together", async () => {
    queue.push(
      json(401, envelope("UNAUTHENTICATED")),
      json(401, envelope("UNAUTHENTICATED")),
      new Response(null, { status: 204 }),
      json(200, {}),
      json(200, {}),
    );
    await Promise.all([call("GET", "tasks"), call("GET", "projects")]);
    expect(seen.filter((s) => s.url.endsWith("/auth/refresh"))).toHaveLength(1);
  });
  it("ends the session when the refresh fails, and only tries once", async () => {
    const ended = vi.fn();
    const off = onSessionEnded(ended);
    queue.push(
      json(401, envelope("UNAUTHENTICATED")),
      json(401, envelope("REFRESH_TOKEN_INVALID")),
    );
    await expect(call("GET", "tasks")).rejects.toMatchObject({ status: 401 });
    expect(ended).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
    off();
    queue.push(json(401, envelope("UNAUTHENTICATED")), new TypeError("x"));
    await expect(call("GET", "tasks")).rejects.toMatchObject({ status: 401 });
    expect(ended).toHaveBeenCalledTimes(1); // unsubscribed
  });
  it("never refreshes for the auth calls themselves", async () => {
    queue.push(json(401, envelope("INVALID_CREDENTIALS")));
    await expect(
      call("POST", "auth/login", { body: { email: "a", password: "b" } }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.body).toBe(JSON.stringify({ email: "a", password: "b" }));
  });
});

describe("TC-459 waking up", () => {
  it("retries a GET after a gateway error and says so", async () => {
    const events: string[] = [];
    const record = (event: Event) => events.push(event.type);
    window.addEventListener(WAKING_EVENT, record);
    window.addEventListener(AWAKE_EVENT, record);
    queue.push(
      json(504, envelope("UPSTREAM_TIMEOUT")),
      json(502, envelope("UPSTREAM_UNAVAILABLE")),
      json(200, {}),
    );
    expect((await call("GET", "tasks")).status).toBe(200);
    expect(seen).toHaveLength(3);
    expect(events).toContain(WAKING_EVENT);
    expect(events.at(-1)).toBe(AWAKE_EVENT);
    window.removeEventListener(WAKING_EVENT, record);
    window.removeEventListener(AWAKE_EVENT, record);
  });
  it("gives up after three attempts, and never retries a write", async () => {
    queue.push(
      json(504, envelope("UPSTREAM_TIMEOUT")),
      json(504, envelope("UPSTREAM_TIMEOUT")),
      json(504, envelope("UPSTREAM_TIMEOUT")),
    );
    await expect(call("GET", "tasks")).rejects.toMatchObject({ status: 504 });
    expect(seen).toHaveLength(3);
    queue.push(json(504, envelope("UPSTREAM_TIMEOUT")));
    await expect(call("POST", "tasks", { body: {} })).rejects.toMatchObject({ status: 504 });
    expect(seen).toHaveLength(4);
  });
});

describe("TC-453 services keep the Task 1 interfaces", () => {
  const services = createHttpServices();
  it("maps project queries to API parameters and reads every page", async () => {
    const many = Array.from({ length: 100 }, (_, n) => ({
      ...project,
      id: `${P1.slice(0, -3)}${String(n).padStart(3, "0")}`,
    }));
    queue.push(
      json(200, { items: many, page: 1, pageSize: 100, total: 101 }),
      json(200, { items: [project], page: 2, pageSize: 100, total: 101 }),
    );
    const page = await services.projects.list({
      ...emptyProjectQuery(),
      q: " atl ",
      status: ["active", "planned"],
      sort: "due_date",
      dir: "desc",
    });
    expect(page.total).toBe(101);
    expect(page.items).toHaveLength(101);
    const first = new URL(seen[0]?.url ?? "", "http://x").searchParams;
    expect(first.get("sort")).toBe("-dueDate");
    expect(first.getAll("status")).toEqual(["active", "planned"]);
    expect([first.get("q"), first.get("page"), first.get("pageSize")]).toEqual(["atl", "1", "100"]);
    expect(new URL(seen[1]?.url ?? "", "http://x").searchParams.get("page")).toBe("2");
  });
  it("maps task queries, including several projects and an assignee", async () => {
    queue.push(json(200, { items: [task], page: 1, pageSize: 100, total: 1 }));
    const page = await services.tasks.list({
      ...emptyTaskQuery(),
      priority: ["high"],
      projectId: ["p1", "p2"],
      assigneeId: "u9",
      sort: "priority",
    });
    expect(page.items[0]?.title).toBe("Write");
    const params = new URL(seen[0]?.url ?? "", "http://x").searchParams;
    expect([params.get("sort"), params.getAll("projectId"), params.get("assigneeId")]).toEqual([
      "priority",
      ["p1", "p2"],
      "u9",
    ]);
  });
  it("reads one project (null when it is not found or not readable) and writes them", async () => {
    queue.push(json(404, envelope("NOT_FOUND")));
    expect(await services.projects.get("nope")).toBeNull();
    queue.push(json(500, envelope("INTERNAL_ERROR")));
    await expect(services.projects.get("x")).rejects.toMatchObject({ status: 500 });
    queue.push(
      json(200, project),
      json(201, project),
      json(200, project),
      new Response(null, { status: 204 }),
    );
    expect((await services.projects.get(P1))?.name).toBe("Atlas");
    await services.projects.create(newProject);
    await services.projects.update(P1, { name: "New" });
    await services.projects.remove(P1);
    expect(seen.slice(-3).map((s) => s.method)).toEqual(["POST", "PATCH", "DELETE"]);
  });
  it("sends only the fields the API accepts (no owner, no status on create)", async () => {
    queue.push(
      json(201, project),
      json(200, project),
      json(201, task),
      json(200, task),
      json(200, task),
      json(200, { ...task, status: "done" }),
    );
    await services.projects.create(newProject);
    await services.projects.update(P1, { name: "New", ownerId: "someone-else" });
    await services.tasks.create(newTask);
    await services.tasks.update("t1", { title: "New", status: "todo" });
    const bodies = seen.map((s) =>
      s.body === null ? null : (JSON.parse(s.body) as Record<string, unknown>),
    );
    expect(bodies[0]).toEqual({ name: "Atlas", description: "", status: "active", dueDate: null });
    expect(bodies[1]).toEqual({ name: "New" });
    expect(bodies[2]).not.toHaveProperty("status");
    expect(bodies[2]).toMatchObject({
      projectId: P1,
      title: "Write",
      priority: "high",
      assigneeId: null,
    });
    // The status of an update goes to its own route, after the other fields.
    expect(seen.slice(3).map((s) => `${s.method} ${s.url}`)).toEqual([
      "PATCH /api/bff/tasks/t1",
      "PATCH /api/bff/tasks/t1/status",
    ]);
    queue.push(json(200, { ...task, status: "done" }));
    expect((await services.tasks.update("t1", { status: "done" })).status).toBe("done");
    await expect(services.tasks.update("t1", {})).rejects.toMatchObject({ status: 422 });
  });
  it("changes a task's status through its own route, and creates, edits and removes tasks", async () => {
    queue.push(
      json(200, { ...task, status: "in_progress" }),
      json(201, task),
      json(200, task),
      new Response(null, { status: 204 }),
    );
    expect((await services.tasks.updateStatus("t1", "in_progress")).status).toBe("in_progress");
    expect(seen[0]).toMatchObject({
      url: "/api/bff/tasks/t1/status",
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress" }),
    });
    await services.tasks.create(newTask);
    await services.tasks.update("t1", { title: "New" });
    await services.tasks.remove("t1");
    expect(seen.map((s) => s.method)).toEqual(["PATCH", "POST", "PATCH", "DELETE"]);
  });
  it("lists users with a null email, updates a profile, and clamps the activity limit", async () => {
    queue.push(json(200, { items: [user], page: 1, pageSize: 100, total: 1 }));
    expect((await services.users.list())[0]?.email).toBeNull();
    queue.push(json(404, envelope("NOT_FOUND")), json(200, user));
    expect(await services.users.get("x")).toBeNull();
    await services.users.update("u1", { name: "Ada L", theme: "dark" });
    expect(seen.at(-1)?.body).toBe(
      JSON.stringify({ name: "Ada L", preferences: { theme: "dark" } }),
    );
    const event = {
      id: "a1",
      actorId: "u1",
      projectId: "p1",
      taskId: null,
      type: "created",
      at: "2026-09-21T10:00:00Z",
    };
    queue.push(json(200, { items: [event], page: 1, pageSize: 50, total: 1 }));
    const feed = await services.activity.list(500);
    expect(feed[0]?.taskId).toBeUndefined();
    expect(seen.at(-1)?.url).toContain("/api/bff/activity?limit=50");
  });
  it("reaches the AI endpoints", async () => {
    queue.push(
      json(200, { enabled: true }),
      json(200, { suggestions: [] }),
      json(200, { items: [] }),
      json(200, { summary: "" }),
    );
    await services.ai.status();
    await services.ai.suggestTasks(P1, { brief: "b", count: 3 });
    await services.ai.prioritize(P1);
    await services.ai.summarize(P1);
    expect(seen.map((s) => s.url)).toEqual([
      "/api/bff/ai/status",
      `/api/bff/ai/projects/${P1}/task-suggestions`,
      `/api/bff/ai/projects/${P1}/prioritization`,
      `/api/bff/ai/projects/${P1}/summary`,
    ]);
    expect(seen[1]?.body).toBe(JSON.stringify({ brief: "b", count: 3 }));
  });
});

describe("TC-401 to TC-403 auth through the server layer", () => {
  const auth = createHttpAuth();
  it("logs in and returns the user, never a token", async () => {
    queue.push(json(200, { user }));
    const found = await auth.login("a@b.co", "pw");
    expect(found.id).toBe("u1");
    expect(found.avatarUrl).toBeUndefined(); // the API's null becomes absent
    expect(JSON.stringify(found)).not.toContain("oken");
  });
  it("reads the session, and answers null when there is none", async () => {
    queue.push(json(200, user));
    expect((await auth.getSession())?.name).toBe("Ada");
    queue.push(json(401, envelope("UNAUTHENTICATED")));
    expect(await auth.getSession()).toBeNull();
    queue.push(json(500, envelope("INTERNAL_ERROR")));
    await expect(auth.getSession()).rejects.toMatchObject({ status: 500 });
  });
  it("registers and then signs in (FR-401)", async () => {
    queue.push(json(201, user), json(200, { user }));
    await auth.register("Ada", "a@b.co", "long-password-1");
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      "POST /api/bff/users",
      "POST /api/bff/auth/login",
    ]);
  });
  it("shows a duplicate email as a 409 to the form", async () => {
    queue.push(json(409, envelope("EMAIL_ALREADY_EXISTS")));
    await expect(auth.register("Ada", "a@b.co", "long-password-1")).rejects.toMatchObject({
      status: 409,
    });
  });
  it("logs out, and updates the name", async () => {
    queue.push(new Response(null, { status: 204 }), json(200, user));
    await auth.logout();
    await auth.updateProfile("u1", { name: "Ada" });
    expect(seen.map((s) => s.method)).toEqual(["POST", "PATCH"]);
  });
  it("says plainly what this version does not offer", async () => {
    const attempts: (() => Promise<unknown>)[] = [
      () => auth.forgotPassword("a@b.co"),
      () => auth.resetPassword("t", "p"),
      () => auth.changePassword("u1", "a", "b"),
      () => auth.uploadAvatar("u1", new File([], "a.png")),
      () => auth.deleteAvatar("u1"),
      () => auth.deleteAccount("u1"),
      () => auth.updateProfile("u1", { email: "x@y.co" }),
    ];
    for (const run of attempts) {
      await expect(Promise.resolve().then(run)).rejects.toMatchObject({
        code: "NOT_SUPPORTED",
        status: 501,
      });
    }
    expect(seen).toHaveLength(0);
  });
});
