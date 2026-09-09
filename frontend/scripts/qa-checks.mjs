// QA verification suite — real browser checks that Vitest/jsdom can't do:
// automated accessibility scanning, keyboard interaction, and responsive
// layout integrity. Requires the app already running (dev or prod) at
// BASE_URL. Not part of `npm test` because it needs a live server;
// run it manually or wire it into CI as a separate step.
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

// 1. Axe scan: dashboard
{
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Dashboard");
  await page.waitForTimeout(1000);
  const results = await new AxeBuilder({ page }).analyze();
  report(
    "axe scan: dashboard has zero violations",
    results.violations.length === 0,
    results.violations.map((v) => `${v.id} (${v.nodes.length} nodes)`).join(", "),
  );
  await page.close();
}

// 2. Axe scan: project detail
{
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/projects/proj-atlas`, { waitUntil: "networkidle" });
  await page.waitForSelector("h2:has-text('Tasks')");
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).analyze();
  report(
    "axe scan: project detail has zero violations",
    results.violations.length === 0,
    results.violations.map((v) => `${v.id} (${v.nodes.length} nodes)`).join(", "),
  );
  await page.close();
}

// 3. Nonexistent project id doesn't crash
{
  const page = await newPage({ width: 1280, height: 900 });
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto(`${BASE_URL}/projects/does-not-exist`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const text = await page.textContent("body");
  report(
    "nonexistent project id shows 'Project not found', no crash",
    text.includes("Project not found") && errors.length === 0,
    errors.join("; "),
  );
  await page.close();
}

// 4. Keyboard: Tab reaches the profile menu, Enter opens it, Escape closes
//    it and returns focus to the trigger.
{
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Dashboard");
  await page.waitForTimeout(800);
  // skip-link -> logo link -> Dashboard link -> profile trigger
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-haspopup"));
  report("Tab order reaches the profile menu trigger", focused === "menu", `got: ${focused}`);

  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  report("Enter opens the profile menu", await page.isVisible('[role="menu"]'));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  report("Escape closes the profile menu", !(await page.isVisible('[role="menu"]')));

  const refocused = await page.evaluate(() => document.activeElement?.getAttribute("aria-haspopup"));
  report("focus returns to the trigger after Escape", refocused === "menu", `got: ${refocused}`);
  await page.close();
}

// 5. Responsive: no horizontal scroll at 375px
{
  const page = await newPage({ width: 375, height: 900 });
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Dashboard");
  await page.waitForTimeout(800);
  const hScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  report("no horizontal scroll at 375px", !hScroll);
  await page.close();
}

// 6. Truncation stress test: a pathologically long, unbreakable title
//    must not blow out the layout (real bug class: truncate/line-clamp
//    classes present in JSX but not actually effective, e.g. a missing
//    min-w-0 on a flex ancestor).
{
  const page = await newPage({ width: 375, height: 900 });
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Dashboard");
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const longText = "X".repeat(300);
    const projectTitle = document.querySelector("h3");
    const taskTitle = document.querySelector("li p.truncate");
    if (projectTitle) projectTitle.textContent = longText;
    if (taskTitle) taskTitle.textContent = longText;
  });
  await page.waitForTimeout(100);
  const hScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  report("a 300-char unbreakable title doesn't cause horizontal scroll", !hScroll);
  await page.close();
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
