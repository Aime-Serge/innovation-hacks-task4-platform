// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const request = (path: string, session = false) =>
  new NextRequest(
    `http://localhost:3000${path}`,
    session ? { headers: { cookie: "mock_session=user-1" } } : {},
  );

describe("TC-004 route guard (proxy)", () => {
  it("TC-004 sends a visitor without a session to login, remembering the page", () => {
    const response = proxy(request("/tasks"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?next=%2Ftasks");
  });

  it("TC-004 lets signed-in users through and sets a fresh CSP nonce per request", () => {
    const first = proxy(request("/", true));
    const second = proxy(request("/", true));
    const csp = first.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp).not.toBe(second.headers.get("content-security-policy"));
  });

  it("TC-004 keeps login and register away from signed-in users", () => {
    expect(proxy(request("/login", true)).headers.get("location")).toBe("http://localhost:3000/");
    expect(proxy(request("/register", true)).status).toBe(307);
  });

  it("TC-004 the public pages need no session, and reset works while signed in", () => {
    expect(proxy(request("/login")).headers.get("content-security-policy")).toContain(
      "default-src",
    );
    expect(proxy(request("/register")).status).toBe(200);
    expect(proxy(request("/forgot-password")).status).toBe(200);
    expect(proxy(request("/reset-password?token=x", true)).status).toBe(200);
  });

  it("TC-004 static assets and robots are outside the matcher", () => {
    const source = config.matcher[0]?.source ?? "";
    for (const path of ["_next/static/x", "robots.txt", "favicon.ico"]) {
      expect(new RegExp(`^${source}$`).test(`/${path}`), path).toBe(false);
    }
    expect(new RegExp(`^${source}$`).test("/tasks")).toBe(true);
  });
});
