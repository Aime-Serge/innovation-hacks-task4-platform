import { defineConfig, devices } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const PORT = 3100;
const cache = path.join(homedir(), ".cache", "ms-playwright");
const installed = (prefix: string): boolean =>
  existsSync(cache) && readdirSync(cache).some((name) => name.startsWith(prefix));

const INP_SPEC = /inp\.spec\.ts$/;
const LIVE_SPEC = /live\/.*\.spec\.ts$/;
// LIVE_URL points at a running stack (make e2e-local, make e2e-live); without it only the mock runs.
const LIVE_URL = process.env["LIVE_URL"];

// Chromium always runs; Firefox runs when installed; WebKit runs in CI only.
const browsers = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ...(installed("firefox-") ? [{ name: "firefox", use: { ...devices["Desktop Firefox"] } }] : []),
  // WebKit needs system libraries that only CI installs (`playwright install --with-deps`).
  ...(process.env["PW_WEBKIT"] === "1"
    ? [{ name: "webkit", use: { ...devices["Desktop Safari"] } }]
    : []),
].map((project) => ({ ...project, testIgnore: [INP_SPEC, LIVE_SPEC] }));

// Interaction latency (@perf) runs in its own step, alone (see package.json): a
// CPU-throttled page shares the machine with the other workers, and their load
// would be counted as the page's own slowness.
const projects = [
  ...(LIVE_URL === undefined
    ? browsers
    : [
        {
          name: "live",
          testMatch: LIVE_SPEC,
          use: { ...devices["Desktop Chrome"], baseURL: LIVE_URL },
        },
      ]),
  {
    name: "perf",
    testMatch: INP_SPEC,
    fullyParallel: false,
    use: { ...devices["Desktop Chrome"] },
  },
];

export default defineConfig({
  testDir: "tests",
  // Vitest owns *.test.ts(x); Playwright only runs *.spec.ts.
  testMatch: "**/*.spec.ts",
  timeout: 45_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects,
  ...(LIVE_URL === undefined
    ? {
        webServer: {
          command: `npm run build && npx next start -p ${PORT}`,
          env: { NEXT_PUBLIC_DATA_SOURCE: "mock" }, // the Task 1 browser tests use the mock adapter (S8)
          url: `http://localhost:${PORT}/login`,
          reuseExistingServer: !process.env["CI"],
          timeout: 240_000,
        },
      }
    : {}),
});
