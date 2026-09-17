// Full live end-to-end check — drives the actual product through a real
// browser against a real backend + real Postgres (and, if GEMINI_API_KEY
// is set on the backend, a real Gemini call). This is the one check in
// this repo that exercises every layer at once; qa-checks.mjs covers
// accessibility/responsive/keyboard concerns in more depth but never
// logs in, since it only has the unauthenticated pages to work with.
//
// Prerequisites (none of this spins anything up for you):
//   - Postgres running and migrated (docker compose up -d && alembic upgrade head)
//   - Backend running (uvicorn app.main:app --port 8000), CORS_ORIGINS
//     and FRONTEND_URL matching BASE_URL below
//   - Frontend running (npm run dev), NEXT_PUBLIC_API_URL pointing at
//     the backend above
//
// Usage:
//   BASE_URL=http://localhost:3000 node scripts/live-e2e-check.mjs

import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();

// Only uncaught exceptions count as real failures here — a 401 in the
// network log right after logout is expected (that's the redirect-on-401
// contract working), not a bug, so it's not treated as one.
const uncaughtErrors = [];
page.on("pageerror", (e) => uncaughtErrors.push(String(e)));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ": " + detail : ""}`);
  if (!ok) failures++;
}

// A minimal valid 1x1 PNG, written to a real temp file for the file-input test.
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4" +
    "890000000a49444154789c6360000002000100000005ac9c8d0000000049454e44ae426082",
  "hex",
);
const tinyPngPath = join(mkdtempSync(join(tmpdir(), "avatar-")), "tiny.png");
writeFileSync(tinyPngPath, TINY_PNG);

const email = `live-e2e-${Date.now()}@example.com`;
const password = "supersecret1";

// 1. Register
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.fill("#name", "Live E2E User");
await page.fill("#email", email);
await page.fill("#password", password);
await page.fill("#confirm-password", password);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 10000 });
check("register lands on dashboard", page.url() === `${BASE}/`);

await page.waitForSelector("h1:has-text('Dashboard')");
check("dashboard renders after register", await page.isVisible("text=Dashboard"));

// 2. Create a project
await page.click('button:has-text("New Project")');
await page.waitForSelector('[role="dialog"]');
await page.fill("#project-name", "Live E2E Project");
await page.fill("#project-description", "Created by the live end-to-end check.");
await page.click('button:has-text("Create project")');
await page.waitForSelector("text=Live E2E Project");
check("project created and visible on dashboard", true);

// 3. Open project, create a task
await page.click("text=Live E2E Project");
await page.waitForSelector("h2:has-text('Tasks')");
await page.click('button:has-text("New Task")');
await page.waitForSelector('[role="dialog"]');
await page.fill("#task-title", "Live E2E Task");
await page.click('button:has-text("Create task")');
await page.waitForSelector("text=Live E2E Task");
check("task created and visible on project detail", true);

// 4. Trigger the AI feature. Works either way — a real Gemini call, or
// the honest fallback if no key is set or the call fails — the point of
// this check is that the feature never breaks, not which path it took.
await page.click('button:has-text("Generate tasks with AI")');
await page.waitForSelector('button:has-text("Add"):has-text("task")', { timeout: 20000 });
const aiPanelText = await page.textContent("body");
const usedFallback = aiPanelText.includes("AI suggestions aren't available");
check(
  "AI feature produced a checklist either way (real call or honest fallback)",
  true,
  usedFallback ? "fallback path" : "real AI call succeeded",
);
await page.click('button:has-text("Discard")').catch(() => {});

// 5. Log out, confirm protected routes now reject
await page.click('button[aria-haspopup="menu"]');
await page.waitForSelector('[role="menu"]');
await page.click('button:has-text("Sign out")');
await page.waitForURL(new RegExp(`^${BASE}/login`), { timeout: 10000 });
check("logout redirects to /login", page.url().startsWith(`${BASE}/login`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
check("visiting / after logout redirects back to /login", page.url().includes("/login"));

// 6. Forgot password -> reset -> login with the new password
await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.click('button:has-text("Send reset link")');
await page.waitForSelector('a[href*="/reset-password?token="]', { timeout: 10000 });
const resetLinkHref = await page.getAttribute('a[href*="/reset-password?token="]', "href");
check("forgot-password page surfaces a dev reset link", Boolean(resetLinkHref));

const newPassword = "brandnewpassword1";
await page.goto(`${BASE}${resetLinkHref}`, { waitUntil: "networkidle" });
await page.fill("#password", newPassword);
await page.fill("#confirm-password", newPassword);
await page.click('button:has-text("Reset password")');
await page.waitForSelector("text=Your password has been reset", { timeout: 10000 });
check("reset-password flow completes", true);

await page.click('a:has-text("Log in")');
await page.waitForURL(new RegExp(`^${BASE}/login`));
await page.fill("#email", email);
await page.fill("#password", newPassword);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 10000 });
check("login with the newly reset password works", page.url() === `${BASE}/`);

// 7. Settings: avatar upload, change password
await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
check("settings page loads while authenticated", await page.isVisible("h1:has-text('Settings')"));

const profileNameValue = await page.inputValue("#settings-name");
const profileEmailValue = await page.inputValue("#settings-email");
check(
  "settings profile fields are pre-populated with real data, not empty",
  profileNameValue === "Live E2E User" && profileEmailValue === email,
  `got name="${profileNameValue}" email="${profileEmailValue}"`,
);

await page.setInputFiles('input[type="file"]', tinyPngPath);
await page.waitForSelector('button:has-text("Remove")', { timeout: 10000 });
check("avatar upload succeeds (Remove button now shown)", true);

await page.fill("#current-password", newPassword);
await page.fill("#new-password", "yetanotherpassword1");
await page.fill("#confirm-new-password", "yetanotherpassword1");
await page.click('button:has-text("Change password")');
await page.waitForSelector("text=Password changed.", { timeout: 10000 });
check("change-password flow completes", true);

check("no uncaught client-side exceptions during the run", uncaughtErrors.length === 0, uncaughtErrors.join(" | "));

console.log(`\n${failures === 0 ? "ALL LIVE CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
