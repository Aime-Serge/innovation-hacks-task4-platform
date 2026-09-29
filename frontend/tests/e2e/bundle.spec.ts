import { expect, test } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { signIn, visit } from "./helpers";

// NFR-04: 170 KB or less of JavaScript on first load per route, gzip.
const BUDGET_BYTES = 170 * 1024;
const ROUTES = [
  "/dashboard",
  "/projects",
  "/projects/project-1",
  "/tasks",
  "/profile",
  "/login",
] as const;

test.describe("TC-090 JavaScript budget (NFR-04)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "measured once, in Chromium");

  for (const route of ROUTES) {
    test(`TC-090 ${route} ships at most 170 KB of gzipped JavaScript`, async ({
      page,
      context,
    }) => {
      await signIn(context);
      const scripts = new Map<string, number>();
      page.on("response", (response) => {
        const url = response.url();
        if (!url.includes("/_next/static/") || !url.endsWith(".js")) return;
        void response.body().then((body) => scripts.set(url, gzipSync(body, { level: 6 }).length));
      });
      await visit(page, route);
      await page.waitForLoadState("networkidle");
      const total = [...scripts.values()].reduce((sum, size) => sum + size, 0);
      console.log(`${route}: ${(total / 1024).toFixed(1)} KB gzip in ${scripts.size} files`);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(BUDGET_BYTES);
    });
  }
});
