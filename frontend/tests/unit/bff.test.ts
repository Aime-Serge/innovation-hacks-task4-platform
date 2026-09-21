// @vitest-environment node
// TC-450 (proxy, Origin, JSON-only, timeouts) and TC-451 (no token ever reaches the browser).
import { describe, expect, it, vi } from "vitest";
import { handleBff, type BffDeps } from "@/lib/session/bff";
import { readSessionConfig } from "@/lib/session/config";

const SITE = "https://app.example.com";
const config = readSessionConfig({
  API_BASE_URL: "https://api.example.com",
  SITE_URL: SITE,
  NODE_ENV: "production",
});
const tokens = {
  accessToken: "ACCESS-SECRET",
  tokenType: "bearer",
  expiresIn: 900,
  refreshToken: "REFRESH-SECRET",
  refreshExpiresIn: 604800,
};
const user = { id: "u1", name: "Ada", email: "ada@example.com", role: "developer" };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

type Call = { url: string; method: string; headers: Headers; body: string | undefined };
function setup(...answers: (Response | Error)[]) {
  const calls: Call[] = [];
  const queue = [...answers];
  const fetchImpl = vi.fn((url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      headers: new Headers(init.headers),
      body: init.body as string | undefined,
    });
    const next = queue.shift();
    if (next === undefined) throw new Error("no more answers");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  const deps: BffDeps = {
    config,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    newId: () => "generated-id-1234",
  };
  return { calls, deps };
}
function req(
  method: string,
  path: string,
  opts: {
    body?: unknown;
    origin?: string | null;
    cookie?: string;
    type?: string;
    rid?: string;
  } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.origin !== null) headers["origin"] = opts.origin ?? SITE;
  if (opts.cookie) headers["cookie"] = opts.cookie;
  if (opts.rid) headers["x-request-id"] = opts.rid;
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    headers["content-type"] = opts.type ?? "application/json";
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }
  return new Request(`${SITE}/api/bff/${path}`, init);
}
const setCookies = (res: Response) => res.headers.getSetCookie();
const ACCESS = "__Host-ih_at=ACCESS-SECRET";
const REFRESH = "__Secure-ih_rt=REFRESH-SECRET";

describe("TC-451 login keeps every token out of the browser", () => {
  it("sets HttpOnly cookies and returns only the user", async () => {
    const { calls, deps } = setup(json(200, tokens), json(200, user));
    const res = await handleBff(
      req("POST", "auth/login", { body: { email: "a@b.co", password: "pw" } }),
      ["auth", "login"],
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ user });
    expect(body).not.toContain("SECRET");
    const cookies = setCookies(res);
    expect(cookies).toHaveLength(3);
    for (const cookie of cookies) expect(cookie).toContain("HttpOnly");
    expect(cookies[0]).toContain("SameSite=Lax");
    expect(cookies[1]).toContain("SameSite=Strict");
    expect(cookies[1]).toContain("Path=/api/bff/auth");
    expect(calls[0]?.url).toBe("https://api.example.com/api/v1/auth/login");
    expect(calls[1]?.headers.get("authorization")).toBe("Bearer ACCESS-SECRET");
  });
  it("sets no cookie when the credentials are wrong", async () => {
    const { deps } = setup(json(401, { error: { code: "INVALID_CREDENTIALS", message: "no" } }));
    const res = await handleBff(
      req("POST", "auth/login", { body: { email: "a@b.co", password: "x" } }),
      ["auth", "login"],
      deps,
    );
    expect(res.status).toBe(401);
    expect(setCookies(res)).toHaveLength(0);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "INVALID_CREDENTIALS",
    );
  });
  it("fails closed when the API answers strangely or the profile cannot be read", async () => {
    const odd = setup(json(200, { nothing: true }));
    expect(
      (await handleBff(req("POST", "auth/login", { body: {} }), ["auth", "login"], odd.deps))
        .status,
    ).toBe(502);
    const noMe = setup(json(200, tokens), json(500, { error: {} }));
    const res = await handleBff(
      req("POST", "auth/login", { body: {} }),
      ["auth", "login"],
      noMe.deps,
    );
    expect(res.status).toBe(502);
    expect(setCookies(res)).toHaveLength(0);
  });
});

describe("TC-450 the proxy", () => {
  it("forwards with the Bearer token, the request id and the query string", async () => {
    const { calls, deps } = setup(json(200, { items: [], total: 0 }));
    const res = await handleBff(
      req("GET", "tasks?status=todo&page=2", {
        cookie: `${ACCESS}; other=1`,
        rid: "client-req-1234",
      }),
      ["tasks"],
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("client-req-1234");
    expect(calls[0]?.url).toBe("https://api.example.com/api/v1/tasks?status=todo&page=2");
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer ACCESS-SECRET");
    expect(calls[0]?.headers.get("x-request-id")).toBe("client-req-1234");
  });
  it("sends no Authorization header without a session, so public routes still work", async () => {
    const { calls, deps } = setup(json(201, user));
    const res = await handleBff(req("POST", "users", { body: { name: "A" } }), ["users"], deps);
    expect(res.status).toBe(201);
    expect(calls[0]?.headers.has("authorization")).toBe(false);
    expect(res.headers.get("x-request-id")).toBe("generated-id-1234");
  });
  it("passes a 401 through so the page can refresh once", async () => {
    const { deps } = setup(json(401, { error: { code: "UNAUTHENTICATED", message: "x" } }));
    const res = await handleBff(req("GET", "tasks", { cookie: ACCESS }), ["tasks"], deps);
    expect(res.status).toBe(401);
    expect(setCookies(res)).toHaveLength(0);
  });
  it("passes Retry-After on a 429 and keeps a 204 empty", async () => {
    const limited = setup(
      json(429, { error: { code: "AI_QUOTA_EXCEEDED", message: "x" } }, { "retry-after": "40" }),
    );
    const res = await handleBff(
      req("POST", "ai/projects/p1/summary", { cookie: ACCESS }),
      ["ai", "projects", "p1", "summary"],
      limited.deps,
    );
    expect(res.headers.get("retry-after")).toBe("40");
    const empty = setup(new Response(null, { status: 204 }));
    const gone = await handleBff(
      req("DELETE", "tasks/t1", { cookie: ACCESS }),
      ["tasks", "t1"],
      empty.deps,
    );
    expect(gone.status).toBe(204);
    expect(await gone.text()).toBe("");
  });
  it("never forwards Set-Cookie or unlisted headers from the API", async () => {
    const { deps } = setup(json(200, {}, { "set-cookie": "evil=1", "x-secret": "s" }));
    const res = await handleBff(req("GET", "activity", { cookie: ACCESS }), ["activity"], deps);
    expect(setCookies(res)).toHaveLength(0);
    expect(res.headers.has("x-secret")).toBe(false);
  });
});

describe("TC-450 refusals", () => {
  it.each([
    ["a foreign Origin", { origin: "https://evil.example", body: {} }],
    ["no Origin", { origin: null, body: {} }],
  ])("rejects a state-changing call with %s and never calls the API", async (_label, opts) => {
    const { calls, deps } = setup();
    const res = await handleBff(req("POST", "tasks", { ...opts, cookie: ACCESS }), ["tasks"], deps);
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("rejects a body that is not JSON, or is too large", async () => {
    const { calls, deps } = setup();
    const form = await handleBff(
      req("POST", "tasks", {
        body: "a=b",
        type: "application/x-www-form-urlencoded",
        cookie: ACCESS,
      }),
      ["tasks"],
      deps,
    );
    expect(form.status).toBe(415);
    const huge = await handleBff(
      req("POST", "tasks", { body: JSON.stringify({ x: "y".repeat(1_048_600) }), cookie: ACCESS }),
      ["tasks"],
      deps,
    );
    expect(huge.status).toBe(413);
    expect(calls).toHaveLength(0);
  });
  it("answers 404 for paths outside the allowlist and 405 for other methods", async () => {
    const { calls, deps } = setup();
    for (const segments of [["docs"], ["tasks", ".."], ["tasks", "%2e%2e", "x"]]) {
      expect((await handleBff(req("GET", "x"), segments, deps)).status).toBe(404);
    }
    expect(
      (await handleBff(req("PUT", "tasks/1", { body: {} }), ["tasks", "1"], deps)).status,
    ).toBe(405);
    expect(calls).toHaveLength(0);
  });
  it("turns a timeout into 504 and a network failure into 502, in the API's envelope", async () => {
    const slow = setup(new DOMException("timed out", "TimeoutError"));
    const timeout = await handleBff(req("GET", "tasks", { cookie: ACCESS }), ["tasks"], slow.deps);
    expect(timeout.status).toBe(504);
    expect(((await timeout.json()) as { error: { code: string } }).error.code).toBe(
      "UPSTREAM_TIMEOUT",
    );
    const down = setup(new TypeError("fetch failed"));
    expect(
      (await handleBff(req("GET", "tasks", { cookie: ACCESS }), ["tasks"], down.deps)).status,
    ).toBe(502);
  });
  it("hides an HTML error page from a failing upstream", async () => {
    const { deps } = setup(
      new Response("<html>oops</html>", { status: 502, headers: { "content-type": "text/html" } }),
    );
    const res = await handleBff(req("GET", "tasks", { cookie: ACCESS }), ["tasks"], deps);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("<html>");
  });
});

describe("TC-403, TC-405 refresh and logout", () => {
  it("refreshes with the path-limited cookie and swaps all three cookies", async () => {
    const { calls, deps } = setup(
      json(200, { ...tokens, accessToken: "NEW-A", refreshToken: "NEW-R" }),
    );
    const res = await handleBff(
      req("POST", "auth/refresh", { cookie: REFRESH }),
      ["auth", "refresh"],
      deps,
    );
    expect(res.status).toBe(204);
    expect(setCookies(res)).toHaveLength(3);
    expect(setCookies(res).join(" ")).toContain("NEW-R");
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ refreshToken: "REFRESH-SECRET" });
  });
  it("ends the session when there is no cookie, or the API refuses the token", async () => {
    const none = await handleBff(req("POST", "auth/refresh"), ["auth", "refresh"], setup().deps);
    expect(none.status).toBe(401);
    expect(setCookies(none).every((c) => c.includes("Max-Age=0"))).toBe(true);
    const refused = setup(json(401, { error: { code: "REFRESH_TOKEN_INVALID", message: "x" } }));
    const res = await handleBff(
      req("POST", "auth/refresh", { cookie: REFRESH }),
      ["auth", "refresh"],
      refused.deps,
    );
    expect(res.status).toBe(401);
    expect(setCookies(res).every((c) => c.includes("Max-Age=0"))).toBe(true);
  });
  it("keeps the session on a rate limit or an outage, and rejects an odd success", async () => {
    const limited = setup(
      json(429, { error: { code: "RATE_LIMITED", message: "x" } }, { "retry-after": "5" }),
    );
    const res = await handleBff(
      req("POST", "auth/refresh", { cookie: REFRESH }),
      ["auth", "refresh"],
      limited.deps,
    );
    expect(res.status).toBe(429);
    expect(setCookies(res)).toHaveLength(0);
    const down = setup(new TypeError("x"));
    expect(
      (
        await handleBff(
          req("POST", "auth/refresh", { cookie: REFRESH }),
          ["auth", "refresh"],
          down.deps,
        )
      ).status,
    ).toBe(502);
    const odd = setup(json(200, { nothing: 1 }));
    expect(
      (
        await handleBff(
          req("POST", "auth/refresh", { cookie: REFRESH }),
          ["auth", "refresh"],
          odd.deps,
        )
      ).status,
    ).toBe(502);
  });
  it("logs out: revokes upstream, clears every cookie, and is safe without a cookie", async () => {
    const { calls, deps } = setup(new Response(null, { status: 204 }));
    const res = await handleBff(
      req("POST", "auth/logout", { cookie: `${ACCESS}; ${REFRESH}` }),
      ["auth", "logout"],
      deps,
    );
    expect(res.status).toBe(204);
    expect(setCookies(res).every((c) => c.includes("Max-Age=0"))).toBe(true);
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ refreshToken: "REFRESH-SECRET" });
    const twice = await handleBff(req("POST", "auth/logout"), ["auth", "logout"], setup().deps);
    expect(twice.status).toBe(204);
    expect(setCookies(twice)).toHaveLength(3);
  });
  it("still clears the cookies when revocation could not be confirmed", async () => {
    const { deps } = setup(new TypeError("down"));
    const res = await handleBff(
      req("POST", "auth/logout", { cookie: REFRESH }),
      ["auth", "logout"],
      deps,
    );
    expect(res.status).toBe(502);
    expect(setCookies(res)).toHaveLength(3);
  });
});
