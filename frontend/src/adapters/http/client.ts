import { AWAKE_EVENT, WAKING_EVENT } from "@/lib/events";
import { ServiceError } from "@/services/types";

// The browser's only door to the API (FR-435, ADR-401): same-origin calls to /api/bff, which holds
// the session in HttpOnly cookies. No token is ever visible here (NFR-409).

const BASE = "/api/bff";
const WAKING_AFTER_MS = 5_000; // NFR-403: tell the person the service is waking up
const WAKING_BUDGET_MS = 60_000;
const MAX_ATTEMPTS = 3;

export { AWAKE_EVENT, WAKING_EVENT };

type Body = Record<string, unknown> | undefined;
export type RequestOptions = {
  body?: Body;
  query?: URLSearchParams;
  signal?: AbortSignal | undefined;
};

const listeners = new Set<() => void>();
/** Called when the session cannot be continued (the refresh failed). */
export function onSessionEnded(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let refreshing: Promise<boolean> | null = null;
/** One refresh at a time, however many calls got a 401 together (FR-405). */
async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "same-origin" })
    .then((res) => res.status === 204)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type RawDetail = { field?: unknown; message?: unknown };

function readDetails(value: unknown): ServiceError["details"] {
  if (!Array.isArray(value)) return undefined;
  const details = (value as RawDetail[])
    .filter((d) => typeof d.field === "string" && typeof d.message === "string")
    .map((d) => ({ field: d.field as string, message: d.message as string }));
  return details.length > 0 ? details : undefined;
}

async function toError(res: Response): Promise<ServiceError> {
  const retry = Number(res.headers.get("retry-after"));
  const retryAfter = Number.isFinite(retry) && retry > 0 ? retry : undefined;
  try {
    const body = (await res.json()) as {
      error?: { code?: unknown; message?: unknown; details?: unknown };
    };
    const code = typeof body.error?.code === "string" ? body.error.code : "UNKNOWN";
    const message = typeof body.error?.message === "string" ? body.error.message : res.statusText;
    const details = readDetails(body.error?.details);
    return new ServiceError(code, message, res.status, retryAfter, details);
  } catch {
    return new ServiceError(
      "UNKNOWN",
      res.statusText || "The request failed.",
      res.status,
      retryAfter,
    );
  }
}

function announce(name: string): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name));
}

async function send(method: string, path: string, options: RequestOptions): Promise<Response> {
  const query = options.query?.toString() ?? "";
  const init: RequestInit = { method, credentials: "same-origin", signal: options.signal ?? null };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = { "content-type": "application/json" };
  }
  return fetch(`${BASE}/${path}${query === "" ? "" : `?${query}`}`, init);
}

/** Calls the API through the server layer; returns the response of a successful (2xx) call. */
export async function call(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const started = Date.now();
  const slow = setTimeout(() => announce(WAKING_EVENT), WAKING_AFTER_MS);
  let woke = false;
  try {
    let refreshed = false;
    for (let attempt = 1; ; attempt += 1) {
      let res: Response;
      try {
        res = await send(method, path, options);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new ServiceError("NETWORK_ERROR", "The network is not reachable.", 0);
      }
      if (res.status === 401 && !refreshed && !path.startsWith("auth/")) {
        refreshed = true;
        if (await refreshSession()) continue; // one refresh, one retry
        listeners.forEach((listener) => listener());
      }
      const asleep = (res.status === 502 || res.status === 504) && method === "GET";
      if (asleep && attempt < MAX_ATTEMPTS && Date.now() - started < WAKING_BUDGET_MS) {
        woke = true;
        announce(WAKING_EVENT);
        continue; // the service was idle: try again (NFR-403)
      }
      if (!res.ok) throw await toError(res);
      return res;
    }
  } finally {
    clearTimeout(slow);
    if (woke || Date.now() - started >= WAKING_AFTER_MS) announce(AWAKE_EVENT);
  }
}

export async function callJson<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return (await call(method, path, options)).json() as Promise<T>;
}
