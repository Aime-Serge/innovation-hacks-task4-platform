import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import nextConfig from "../../next.config";
import { contentSecurityPolicy } from "@/proxy";
import { findBundleLeaks } from "../../scripts/lib/bundle";
import { findSecrets, findSensitivePublicVars } from "../../scripts/lib/secrets";

describe("TC-016 response headers (NFR-16, TH-06)", () => {
  it("TC-016 CSP matches the Pack: nonce scripts, nonce styles only, no framing", () => {
    const csp = contentSecurityPolicy("abc123", false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("TC-016 only development adds unsafe-eval", () => {
    expect(contentSecurityPolicy("n", true)).toContain("'unsafe-eval'");
  });

  it("TC-016 static headers cover nosniff, referrer, permissions, HSTS and framing", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const map = new Map((rules[0]?.headers ?? []).map((h) => [h.key, h.value]));
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(map.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
  });
});

describe("TC-092 secret scan (NFR-15, TH-04)", () => {
  // Built at runtime so this file never contains a literal that looks like a secret.
  const fakeGoogleKey = "AIza" + "x".repeat(35);
  const fakeKeyHeader = "-----BEGIN " + "PRIVATE KEY-----";

  it("TC-092 detects credentials", () => {
    expect(findSecrets(`const k = "${fakeGoogleKey}"`)).toContain("Google API key");
    expect(findSecrets(fakeKeyHeader)).toContain("private key block");
    expect(findSecrets(`password = "${"a1".repeat(12)}"`)).toContain(
      "hard-coded secret assignment",
    );
  });

  it("TC-092 ignores ordinary text", () => {
    expect(findSecrets("const password = props.password;")).toEqual([]);
  });

  it("TC-092 flags sensitive NEXT_PUBLIC_ variables only", () => {
    expect(findSensitivePublicVars("NEXT_PUBLIC_API_KEY=abc")).toEqual(["NEXT_PUBLIC_API_KEY"]);
    expect(findSensitivePublicVars("NEXT_PUBLIC_SCENARIO_SWITCHER=on")).toEqual([]);
  });

  it("TC-092 the repository passes the scan", () => {
    expect(() =>
      execFileSync("npx", ["jiti", "scripts/secret-scan.ts"], { stdio: "pipe" }),
    ).not.toThrow();
  }, 30_000);
});

describe("TC-082 no JavaScript sources (NFR-11)", () => {
  it("TC-082 check:no-js passes", () => {
    expect(() =>
      execFileSync("npx", ["jiti", "scripts/check-no-js.ts"], { stdio: "pipe" }),
    ).not.toThrow();
  }, 30_000);
});

describe("TC-080 architecture (NFR-12, TH-01)", () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? sources(full) : /\.tsx?$/.test(name) ? [full] : [];
    });

  it("TC-080 no source file uses dangerouslySetInnerHTML, any, or ts-ignore", () => {
    for (const file of sources("src")) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(
        /dangerouslySetInnerHTML|@ts-ignore|@ts-nocheck|:\s*any\b|as any\b/,
      );
    }
  });

  it("TC-083 no component file exceeds 200 lines", () => {
    for (const file of sources("src").filter((f) => f.endsWith(".tsx"))) {
      expect(readFileSync(file, "utf8").split("\n").length, file).toBeLessThanOrEqual(200);
    }
  });

  it("TC-080 the UI layer imports no feature, app, service or adapter code", () => {
    for (const file of sources("src/ui")) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /from "@\/(features|app|services|adapters|providers)/,
      );
    }
  });

  it("TC-080 features never import an adapter", () => {
    for (const file of sources("src/features")) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/from "@\/adapters/);
    }
  });
});

describe("TC-462 bundle scan", () => {
  it("passes ordinary application code", () => {
    expect(findBundleLeaks("const a = fetch('/api/bff/tasks'); export {a}")).toEqual([]);
  });
  it.each([
    ["const k = 'LLM_API_KEY'", "a server-only setting name"],
    ["connect('postgresql+asyncpg://u:p@h/db')", "a connection string"],
    ["role = 'ih_migrator'", "a database role"],
    ["name: 'Amara Diallo'", "mock fixture data (the mock adapter must not ship)"],
    ["const url = process.env.API_BASE_URL", "the API's server-layer settings"],
  ])("catches %s", (text, leak) => {
    expect(findBundleLeaks(text)).toContain(leak);
  });
  it("catches the API address only when it is given", () => {
    const text = "fetch('https://ih-api.onrender.com/api/v1/tasks')";
    expect(findBundleLeaks(text)).toEqual([]);
    expect(findBundleLeaks(text, "https://ih-api.onrender.com")).toContain("the API address");
    expect(findBundleLeaks(text, "x")).toEqual([]); // a too-short value is ignored, not matched
  });
  it("catches a key that slipped into a bundle", () => {
    const key = "AIza" + "x".repeat(35); // built at runtime so this file holds no key-shaped text
    expect(findBundleLeaks(`x="${key}"`)).toContain("Google API key");
  });
});
