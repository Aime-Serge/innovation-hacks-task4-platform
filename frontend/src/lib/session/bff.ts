// The server layer (FR-435, ADR-403): the only code that touches session tokens. It forwards
// browser calls to the API with the Bearer token from a cookie, checks the Origin of every
// state-changing call, applies a timeout, passes X-Request-ID and normalises upstream failures.
// It never returns a token to the browser and never forwards Set-Cookie from the API.

import type { SessionConfig } from "./config";
import {
  clearedCookies,
  cookieNames,
  parseCookies,
  serializeCookie,
  sessionCookies,
  type CookieSpec,
  type Tokens,
} from "./cookies";
import { ALLOWED_METHODS, isAllowedOrigin, requestIdFrom, resolveUpstreamPath } from "./guards";

export type BffDeps = {
  config: SessionConfig;
  fetchImpl?: typeof fetch;
  newId?: () => string;
};

const MAX_BODY_BYTES = 1_048_576;
const PASS_HEADERS = ["content-type", "retry-after"];

function respond(
  status: number,
  body: unknown,
  requestId: string,
  cookies: CookieSpec[] = [],
  headers: Record<string, string> = {},
): Response {
  const out = new Headers({ "x-request-id": requestId, "cache-control": "no-store", ...headers });
  for (const cookie of cookies) out.append("set-cookie", serializeCookie(cookie));
  if (body === null) return new Response(null, { status, headers: out });
  out.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: out });
}

function failure(
  status: number,
  code: string,
  message: string,
  requestId: string,
  cookies: CookieSpec[] = [],
): Response {
  return respond(status, { error: { code, message, requestId } }, requestId, cookies);
}

type Upstream = { kind: "ok"; res: Response } | { kind: "timeout" } | { kind: "down" };

async function callApi(
  deps: BffDeps,
  path: string,
  init: {
    method: string;
    token?: string | undefined;
    body?: string | undefined;
    requestId: string;
  },
): Promise<Upstream> {
  const headers: Record<string, string> = {
    "x-request-id": init.requestId,
    accept: "application/json",
  };
  if (init.token !== undefined) headers["authorization"] = `Bearer ${init.token}`;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const request: RequestInit = {
      method: init.method,
      headers,
      signal: AbortSignal.timeout(deps.config.timeoutMs),
      cache: "no-store",
    };
    if (init.body !== undefined) request.body = init.body;
    const res = await (deps.fetchImpl ?? fetch)(deps.config.apiBaseUrl + path, request);
    return { kind: "ok", res };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return timedOut ? { kind: "timeout" } : { kind: "down" };
  }
}

function unavailable(
  up: Exclude<Upstream, { kind: "ok" }>,
  id: string,
  cookies: CookieSpec[] = [],
): Response {
  return up.kind === "timeout"
    ? failure(504, "UPSTREAM_TIMEOUT", "The server took too long to answer.", id, cookies)
    : failure(502, "UPSTREAM_UNAVAILABLE", "The server could not be reached.", id, cookies);
}

/** A response from the API, minus anything that must not reach the browser. */
async function passThrough(
  res: Response,
  id: string,
  cookies: CookieSpec[] = [],
): Promise<Response> {
  const kept: Record<string, string> = {};
  for (const name of PASS_HEADERS) {
    const value = res.headers.get(name);
    if (value !== null) kept[name] = value;
  }
  const text = res.status === 204 ? "" : await res.text();
  const out = new Headers({ ...kept, "x-request-id": id, "cache-control": "no-store" });
  for (const cookie of cookies) out.append("set-cookie", serializeCookie(cookie));
  if (text === "" || (res.status >= 500 && !(kept["content-type"] ?? "").includes("json"))) {
    return res.status >= 500
      ? failure(
          res.status === 503 ? 503 : 502,
          "UPSTREAM_ERROR",
          "The server had a problem. Try again.",
          id,
          cookies,
        )
      : new Response(null, { status: res.status, headers: out });
  }
  return new Response(text, { status: res.status, headers: out });
}

function readTokens(value: unknown): Tokens | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const ok =
    typeof v["accessToken"] === "string" &&
    typeof v["refreshToken"] === "string" &&
    typeof v["expiresIn"] === "number" &&
    typeof v["refreshExpiresIn"] === "number";
  return ok ? (value as Tokens) : null;
}

async function login(deps: BffDeps, body: string, id: string): Promise<Response> {
  const up = await callApi(deps, "/api/v1/auth/login", { method: "POST", body, requestId: id });
  if (up.kind !== "ok") return unavailable(up, id);
  if (up.res.status !== 200) return passThrough(up.res, id); // wrong credentials, rate limit: no cookies
  const tokens = readTokens(await up.res.json().catch(() => null));
  if (tokens === null)
    return failure(502, "UPSTREAM_ERROR", "The server sent an unexpected answer.", id);
  const me = await callApi(deps, "/api/v1/auth/me", {
    method: "GET",
    token: tokens.accessToken,
    requestId: id,
  });
  if (me.kind !== "ok" || me.res.status !== 200) {
    return failure(502, "UPSTREAM_ERROR", "The session could not be started.", id);
  }
  const user: unknown = await me.res.json();
  return respond(200, { user }, id, sessionCookies(tokens, deps.config.insecureCookies));
}

async function refresh(
  deps: BffDeps,
  refreshToken: string | undefined,
  id: string,
): Promise<Response> {
  const clear = clearedCookies(deps.config.insecureCookies);
  if (refreshToken === undefined) {
    return failure(
      401,
      "REFRESH_TOKEN_INVALID",
      "The session has ended. Sign in again.",
      id,
      clear,
    );
  }
  const up = await callApi(deps, "/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    requestId: id,
  });
  if (up.kind !== "ok") return unavailable(up, id);
  if (up.res.status === 200) {
    const tokens = readTokens(await up.res.json().catch(() => null));
    if (tokens !== null)
      return respond(204, null, id, sessionCookies(tokens, deps.config.insecureCookies));
    return failure(502, "UPSTREAM_ERROR", "The server sent an unexpected answer.", id);
  }
  // Expired, revoked or reused: the session is over, so the cookies go too.
  return passThrough(up.res, id, up.res.status === 401 ? clear : []);
}

async function logout(
  deps: BffDeps,
  refreshToken: string | undefined,
  id: string,
): Promise<Response> {
  const clear = clearedCookies(deps.config.insecureCookies);
  if (refreshToken === undefined) return respond(204, null, id, clear);
  const up = await callApi(deps, "/api/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    requestId: id,
  });
  if (up.kind !== "ok") return unavailable(up, id, clear); // signed out here, revocation unconfirmed
  return respond(204, null, id, clear);
}

async function readBody(
  request: Request,
): Promise<{ text: string } | { status: number; code: string }> {
  if (request.method === "GET") return { text: "" };
  const text = await request.text();
  if (text === "") return { text };
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { status: 415, code: "UNSUPPORTED_MEDIA_TYPE" }; // JSON-only bodies (TH-408)
  }
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES)
    return { status: 413, code: "PAYLOAD_TOO_LARGE" };
  return { text };
}

export async function handleBff(
  request: Request,
  segments: string[],
  deps: BffDeps,
): Promise<Response> {
  const id = requestIdFrom(
    request.headers.get("x-request-id"),
    deps.newId ?? (() => crypto.randomUUID()),
  );
  const method = request.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method))
    return failure(405, "METHOD_NOT_ALLOWED", "This method is not supported.", id);
  const target = resolveUpstreamPath(segments);
  if (!target.ok) return failure(404, "NOT_FOUND", "The resource was not found.", id);
  if (!isAllowedOrigin(method, request.headers.get("origin"), deps.config.siteUrl)) {
    return failure(403, "FORBIDDEN_ORIGIN", "This request did not come from the site.", id);
  }
  const body = await readBody(request);
  if ("status" in body)
    return failure(body.status, body.code, "The request body is not acceptable.", id);
  const names = cookieNames(deps.config.insecureCookies);
  const jar = parseCookies(request.headers.get("cookie"));
  if (method === "POST" && target.path === "/api/v1/auth/login") return login(deps, body.text, id);
  if (method === "POST" && target.path === "/api/v1/auth/refresh")
    return refresh(deps, jar.get(names.refresh), id);
  if (method === "POST" && target.path === "/api/v1/auth/logout")
    return logout(deps, jar.get(names.refresh), id);
  const query = new URL(request.url).search;
  const up = await callApi(deps, target.path + query, {
    method,
    token: jar.get(names.access),
    body: body.text === "" ? undefined : body.text,
    requestId: id,
  });
  return up.kind === "ok" ? passThrough(up.res, id) : unavailable(up, id);
}
