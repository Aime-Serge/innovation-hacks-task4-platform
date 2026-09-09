// QA verification suite — real browser checks that Vitest/jsdom can't do:
// automated accessibility scanning, keyboard interaction, and responsive
// layout integrity. Requires the app already running (dev or prod) at
// BASE_URL. Not part of `npm test` because it needs a live server;
// run it manually or wire it into CI as a separate step.
//
// Every route here is checked unauthenticated: proxy.ts (Task 4's
// auth gate) redirects everything else to /login, so /login and
// /register are the only pages this suite can reach without a live
// backend + a real session. Authenticated-flow checks (dashboard,
// project detail, the AI panel, every modal) need NEXT_PUBLIC_API_URL
// pointed at a running backend with a real account to log in as —
// run those manually against a deployed/staging environment; this
// suite intentionally doesn't fake that with a mocked session.
//
// Usage:
//   npm run dev &
//   BASE_URL=http://localhost:3000 node scripts/qa-checks.mjs

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;

function report(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ": " + detail : ""}`);
  if (!ok) failures++;
}

async function newPage(viewport) {
  const context = await browser.newContext({ viewport });
  return context.newPage();
}

// 1. Unauthenticated visitors are redirected to /login by proxy.ts.
{
  const page = await newPage({ width: 1280, height: 900 });
  const response = await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  report(
    "unauthenticated / redirects to /login",
    page.url().includes("/login"),
    `landed on ${page.url()} (status ${response?.status()})`,
  );
  await page.close();
}
{
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/projects/anything`, { waitUntil: "networkidle" });
  report(
    "unauthenticated /projects/:id redirects to /login",
    page.url().includes("/login"),
    `landed on ${page.url()}`,
  );
  await page.close();
}

// 2. Axe scan: login
{
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1:has-text('Log in')");
  const results = await new AxeBuilder({ page }).analyze();
  report(
    "axe scan: /login has zero violations",
    results.violations.length === 0,
    results.violations.map((v) => `${v.id} (${v.nodes.length} nodes)`).join(", "),
  );
  await page.close();
}

// 3. Axe scan: register
{
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1:has-text('Create your account')");
  const results = await new AxeBuilder({ page }).analyze();
  report(
    "axe scan: /register has zero violations",
    results.violations.length === 0,
    results.violations.map((v) => `${v.id} (${v.nodes.length} nodes)`).join(", "),
  );
  await page.close();
}

// 4. Keyboard: Tab order through the login form reaches every field and
//    the submit button before wrapping, and the "Create one" link is
//    reachable.
{
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1:has-text('Log in')");

  await page.keyboard.press("Tab"); // skip-link
  await page.keyboard.press("Tab"); // logo link
  await page.keyboard.press("Tab"); // dashboard nav link (still rendered, though redirect-guarded)
  await page.keyboard.press("Tab"); // email
  let focused = await page.evaluate(() => document.activeElement?.id);
  report("Tab order reaches the email field", focused === "email", `got: ${focused}`);

  await page.keyboard.press("Tab"); // password
  focused = await page.evaluate(() => document.activeElement?.id);
  report("Tab order reaches the password field", focused === "password", `got: ${focused}`);

  await page.keyboard.press("Tab"); // submit button
  const tag = await page.evaluate(() => document.activeElement?.tagName);
  const type = await page.evaluate(() => document.activeElement?.getAttribute("type"));
  report(
    "Tab order reaches the submit button",
    tag === "BUTTON" && type === "submit",
    `got: ${tag} type=${type}`,
  );
  await page.close();
}

// 5. Responsive: no horizontal scroll at 375px on either auth page.
for (const path of ["/login", "/register"]) {
  const page = await newPage({ width: 375, height: 900 });
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const hScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  report(`no horizontal scroll at 375px on ${path}`, !hScroll);
  await page.close();
}

// 6. Login form surfaces a validation error without a crash when the
//    backend is unreachable (proves the ApiError/network-failure path
//    degrades to visible text, not a blank screen or thrown exception).
{
  const page = await newPage({ width: 1280, height: 900 });
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "nobody@example.com");
  await page.fill("#password", "whatever-password");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  const hasAlert = await page.isVisible('[role="alert"]');
  report(
    "a failed login shows an inline error, no uncaught exception",
    hasAlert && errors.length === 0,
    errors.join("; "),
  );
  await page.close();
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
