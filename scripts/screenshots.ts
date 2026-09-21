// Task 4 screenshots (README "Screenshots", guide section 08): `make screenshots`.
//
// Runs against a stack that is already up (`make up`), never a live production site, and only with
// synthetic data: it registers two throwaway members whose names and company are invented here, a
// project and a few tasks, then captures each screen at 1440x900 and 390x844 into
// docs/screenshots/task-4/. It needs the registration payload of feat/minimal-profile (field names
// follow pack section 5; confirm them against backend/docs/openapi.json). A screen that fails to
// load is reported and skipped; nothing is written for it, so the folder only holds real captures.
//
// Run from frontend/ so Playwright resolves: `cd frontend && npx jiti ../scripts/screenshots.ts`.
// Environment: SITE_URL (default http://localhost:3000). No secret is read or written; the demo
// password is generated per run and printed nowhere.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const requireFromFrontend = createRequire(path.resolve(process.cwd(), "package.json"));
const { chromium } = requireFromFrontend("@playwright/test") as typeof import("@playwright/test");

const SITE = (process.env["SITE_URL"] ?? "http://localhost:3000").replace(/\/$/, "");
const BFF = `${SITE}/api/bff`;
const OUT = path.resolve(process.cwd(), "..", "docs", "screenshots", "task-4");
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const run = randomBytes(4).toString("hex");
const password = `Shot-${randomBytes(9).toString("base64url")}`; // per run, never printed
const headers = { "content-type": "application/json", origin: SITE };

type Member = { email: string; givenName: string; familyName: string; discipline: string; company: string };
const members: Member[] = [
  { email: `shots-ada-${run}@example.com`, givenName: "Ada", familyName: "Demo", discipline: "backend", company: "Example Labs" },
  { email: `shots-ben-${run}@example.com`, givenName: "Ben", familyName: "Sample", discipline: "frontend", company: "Sample Works" },
];

const registration = (m: Member) => ({
  givenName: m.givenName,
  familyName: m.familyName,
  email: m.email,
  password,
  profile: {
    discipline: m.discipline,
    seniority: "mid",
    employmentStatus: "employed",
    companyName: m.company,
    jobTitle: "Engineer",
    country: "GB",
    city: "London",
    timeZone: "Europe/London",
  },
  termsAccepted: true,
  ageConfirmed: true,
});

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const saved: string[] = [];
  const skipped: string[] = [];
  try {
    // Second member first, so it exists for the people picker and its profile page.
    const other = await browser.newContext();
    const otherRes = await other.request.post(`${BFF}/users`, { headers, data: registration(members[1]!) });
    const otherId = otherRes.ok() ? ((await otherRes.json()) as { id: string }).id : undefined;
    await other.close();

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const shot = async (name: string, url: string, before?: () => Promise<void>): Promise<void> => {
        try {
          await page.goto(`${SITE}${url}`, { waitUntil: "networkidle", timeout: 20_000 });
          if (before) await before();
          await page.screenshot({ path: path.join(OUT, `${name}-${vp.name}.png`), fullPage: false });
          saved.push(`${name}-${vp.name}.png`);
        } catch (error) {
          skipped.push(`${name}-${vp.name}: ${(error as Error).message.split("\n")[0]}`);
        }
      };

      await shot("01-login", "/login");
      await shot("02-register", "/register");

      // A fresh account per viewport so the welcome banner is shown.
      const me: Member = { ...members[0]!, email: `shots-${vp.name}-${run}@example.com` };
      const reg = await context.request.post(`${BFF}/users`, { headers, data: registration(me) });
      const login = reg.ok()
        ? await context.request.post(`${BFF}/auth/login`, { headers, data: { email: me.email, password } })
        : reg;
      if (!login.ok()) {
        skipped.push(`${vp.name}: could not register or sign in synthetic member (HTTP ${login.status()})`);
        await context.close();
        continue;
      }
      const project = await context.request.post(`${BFF}/projects`, { headers, data: { name: "Sample launch plan", description: "Synthetic data for screenshots." } });
      if (project.ok()) {
        const projectId = ((await project.json()) as { id: string }).id;
        for (const title of ["Draft the API contract", "Build the profile page", "Write the release notes"]) {
          await context.request.post(`${BFF}/tasks`, { headers, data: { projectId, title, ...(otherId ? { assigneeId: otherId } : {}) } });
        }
      }

      await shot("03-dashboard", "/");
      await shot("04-projects", "/projects");
      await shot("05-tasks", "/tasks");
      await shot("06-profile", "/profile");
      await shot("07-settings", "/settings");
      if (otherId) await shot("08-member-profile", `/people/${otherId}`);
      await shot("09-task-assign-picker", "/tasks", async () => {
        await page.getByRole("button", { name: /new task|create task/i }).first().click();
        await page.getByRole("combobox", { name: /assignee/i }).click();
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`saved ${saved.length} screenshot(s) to ${OUT}`);
  for (const s of saved) console.log(`  ok   ${s}`);
  for (const s of skipped) console.log(`  SKIP ${s}`);
  if (skipped.length > 0) process.exitCode = 1;
}

void main();
