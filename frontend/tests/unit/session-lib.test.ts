// @vitest-environment node
// TC-450, TC-451: settings, cookies and request guards of the server layer.
import { describe, expect, it } from "vitest";
import { readSessionConfig } from "@/lib/session/config";
import {
  clearedCookies,
  cookieNames,
  parseCookies,
  serializeCookie,
  sessionCookies,
} from "@/lib/session/cookies";
import { isAllowedOrigin, requestIdFrom, resolveUpstreamPath } from "@/lib/session/guards";

const dev = {
  API_BASE_URL: "http://api:8000/",
  SITE_URL: "http://localhost:3000",
  NODE_ENV: "development",
};
const prod = {
  API_BASE_URL: "https://api.example.com",
  SITE_URL: "https://app.example.com",
  NODE_ENV: "production",
};
const tokens = {
  accessToken: "a-token",
  expiresIn: 900,
  refreshToken: "r-token",
  refreshExpiresIn: 604800,
};

describe("TC-450 settings", () => {
  it("reads and normalises the addresses and the timeout", () => {
    const config = readSessionConfig({ ...dev, BFF_TIMEOUT_MS: "5000" });
    expect(config).toEqual({
      apiBaseUrl: "http://api:8000",
      siteUrl: "http://localhost:3000",
      timeoutMs: 5000,
      insecureCookies: false,
    });
    expect(readSessionConfig(dev).timeoutMs).toBe(28000);
  });
  it("refuses a missing, malformed or out-of-range value, naming it", () => {
    expect(() => readSessionConfig({ SITE_URL: dev.SITE_URL })).toThrow("API_BASE_URL is required");
    expect(() => readSessionConfig({ ...dev, SITE_URL: "not a url" })).toThrow(
      "SITE_URL must be a valid URL",
    );
    expect(() => readSessionConfig({ ...dev, BFF_TIMEOUT_MS: "10" })).toThrow("BFF_TIMEOUT_MS");
    expect(() => readSessionConfig({ ...dev, BFF_TIMEOUT_MS: "abc" })).toThrow("BFF_TIMEOUT_MS");
  });
  it("treats a missing APP_ENV as production under NODE_ENV=production, and honours APP_ENV", () => {
    const bare = { API_BASE_URL: "http://api", SITE_URL: "http://site", NODE_ENV: "production" };
    expect(() => readSessionConfig(bare)).toThrow("https");
    expect(
      readSessionConfig({ ...bare, APP_ENV: "development", ALLOW_INSECURE_COOKIES: "true" })
        .insecureCookies,
    ).toBe(true);
    expect(() =>
      readSessionConfig({ ...bare, APP_ENV: "production", ALLOW_INSECURE_COOKIES: "true" }),
    ).toThrow("refused in production");
  });
  it("production requires https and refuses insecure cookies", () => {
    expect(readSessionConfig(prod).insecureCookies).toBe(false);
    expect(() => readSessionConfig({ ...prod, API_BASE_URL: "http://api.example.com" })).toThrow(
      "https",
    );
    expect(() => readSessionConfig({ ...prod, ALLOW_INSECURE_COOKIES: "true" })).toThrow(
      "refused in production",
    );
    expect(readSessionConfig({ ...dev, ALLOW_INSECURE_COOKIES: "true" }).insecureCookies).toBe(
      true,
    );
  });
});

describe("TC-451 cookies", () => {
  it("sets the three cookies with the section 9 attributes", () => {
    const [access, refresh, marker] = sessionCookies(tokens, false).map(serializeCookie);
    expect(access).toBe(
      "__Host-ih_at=a-token; Path=/; Max-Age=900; HttpOnly; SameSite=Lax; Secure",
    );
    expect(refresh).toBe(
      "__Secure-ih_rt=r-token; Path=/api/bff/auth; Max-Age=604800; HttpOnly; SameSite=Strict; Secure",
    );
    expect(marker).toContain("__Host-ih_s=1");
    expect(marker).not.toContain("token");
  });
  it("relaxes only the prefixes and Secure over plain HTTP", () => {
    const names = cookieNames(true);
    expect(names).toEqual({ access: "ih_at", refresh: "ih_rt", marker: "ih_s" });
    const [access] = sessionCookies(tokens, true).map(serializeCookie);
    expect(access).toBe("ih_at=a-token; Path=/; Max-Age=900; HttpOnly; SameSite=Lax");
  });
  it("clears every cookie on the same paths", () => {
    const cleared = clearedCookies(false).map(serializeCookie);
    expect(cleared).toHaveLength(3);
    for (const line of cleared) expect(line).toMatch(/=; Path=.*; Max-Age=0; HttpOnly/);
    expect(cleared[1]).toContain("Path=/api/bff/auth");
  });
  it("parses a Cookie header and ignores malformed values", () => {
    const jar = parseCookies("a=1; __Host-ih_at=x%20y; bad=%E0%A4%A; =nope; c");
    expect(jar.get("a")).toBe("1");
    expect(jar.get("__Host-ih_at")).toBe("x y");
    expect(jar.has("bad")).toBe(false);
    expect(parseCookies(null).size).toBe(0);
  });
});

describe("TC-450 guards", () => {
  const site = "https://app.example.com";
  it("needs the site's own Origin on every state-changing method only", () => {
    expect(isAllowedOrigin("GET", null, site)).toBe(true);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      expect(isAllowedOrigin(method, site, site)).toBe(true);
      expect(isAllowedOrigin(method, "https://evil.example", site)).toBe(false);
      expect(isAllowedOrigin(method, null, site)).toBe(false);
      expect(isAllowedOrigin(method, "https://app.example.com.evil.io", site)).toBe(false);
    }
  });
  it("maps known areas and refuses traversal, odd characters and unknown areas", () => {
    expect(resolveUpstreamPath(["projects", "abc-123", "tasks"])).toEqual({
      ok: true,
      path: "/api/v1/projects/abc-123/tasks",
    });
    expect(resolveUpstreamPath(["ai", "projects", "x", "task-suggestions"]).ok).toBe(true);
    const refused: string[][] = [
      [],
      ["secret"],
      ["tasks", ".."],
      ["tasks", "."],
      ["tasks", ""],
      ["tasks", "%2e%2e"],
      ["tasks", "a%2Fb"],
      ["tasks", "a%5Cb"],
      ["tasks", "a%00"],
      ["tasks", "%E0%A4%A"],
      ["tasks", "a b"],
      ["healthz"],
      ["docs"],
      ["a", "b", "c", "d", "e", "f", "g"],
    ];
    for (const segments of refused)
      expect(resolveUpstreamPath(segments).ok, segments.join("/")).toBe(false);
  });
  it("keeps a sane request id and replaces anything else", () => {
    expect(requestIdFrom("abcd1234-ef", () => "fresh")).toBe("abcd1234-ef");
    expect(requestIdFrom("bad id!", () => "fresh")).toBe("fresh");
    expect(requestIdFrom(null, () => "fresh")).toBe("fresh");
  });
});
