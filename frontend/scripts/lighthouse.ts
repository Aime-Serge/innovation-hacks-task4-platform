// TC-090: Lighthouse on the production build, mobile profile, for the four
// routes. Fails when a score is under 90 or a Pack budget (NFR-01..03) is missed.
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse, { type Flags } from "lighthouse";

const PORT = 3101;
const ROUTES = process.env["LH_ROUTES"]?.split(",") ?? ["/", "/projects", "/tasks", "/profile"];
const MIN_SCORE = 90;
// NFR-03 (INP) cannot be measured in a lab run; tests/e2e/inp.spec.ts measures it
// on real interactions. Total Blocking Time is printed for information only.
const RUNS = 3;
const BUDGETS = { lcpMs: 2500, cls: 0.1 };

function waitFor(url: string, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  const attempt = async (): Promise<void> => {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) throw new Error(`Server did not start at ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return attempt();
  };
  return attempt();
}

type Measurement = {
  performance: number;
  accessibility: number;
  "best-practices": number;
  seo: number;
  lcp: number;
  cls: number;
  tbt: number;
  finalUrl: string;
};

const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? Number.NaN;

function medianOf(runs: Measurement[]): Measurement {
  const pick = (key: Exclude<keyof Measurement, "finalUrl">) => median(runs.map((run) => run[key]));
  return {
    performance: pick("performance"),
    accessibility: pick("accessibility"),
    "best-practices": pick("best-practices"),
    seo: pick("seo"),
    lcp: pick("lcp"),
    cls: pick("cls"),
    tbt: pick("tbt"),
    finalUrl: runs[0]?.finalUrl ?? "",
  };
}

async function main(): Promise<void> {
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
  const server: ChildProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: "ignore",
  });
  // Reuse the Chromium Playwright already installed, so no separate Chrome is needed.
  const chrome = await launch({
    chromePath: process.env["CHROME_PATH"] ?? chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });
  const failures: string[] = [];
  try {
    await waitFor(`http://localhost:${PORT}/login`, 60_000);
    // The mock session is a plain cookie the page reads itself, so it has to be a
    // real browser cookie, not a request header.
    const browser = await chromium.connectOverCDP(`http://localhost:${chrome.port}`);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    await context.addCookies([
      { name: "mock_session", value: "user-1", url: `http://localhost:${PORT}` },
    ]);
    await browser.close();
    for (const route of ROUTES) {
      const url = `http://localhost:${PORT}${route}`;
      const settings: Flags = {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        // Keep the session cookie added above.
        disableStorageReset: true,
      };
      // One discarded warm-up run (a cold server skews the first measurement),
      // then the median of RUNS runs: single lab runs vary by a second or more.
      await lighthouse(url, settings);
      const runs: Measurement[] = [];
      for (let run = 0; run < RUNS; run += 1) {
        const lhr = (await lighthouse(url, settings))?.lhr;
        if (lhr === undefined) throw new Error(`No Lighthouse result for ${route}`);
        const score = (id: keyof typeof lhr.categories) =>
          Math.round((lhr.categories[id]?.score ?? 0) * 100);
        const value = (id: string) => lhr.audits[id]?.numericValue ?? Number.NaN;
        runs.push({
          performance: score("performance"),
          accessibility: score("accessibility"),
          "best-practices": score("best-practices"),
          seo: score("seo"),
          lcp: Math.round(value("largest-contentful-paint")),
          cls: Number(value("cumulative-layout-shift").toFixed(3)),
          tbt: Math.round(value("total-blocking-time")),
          finalUrl: lhr.finalDisplayedUrl.replace(`http://localhost:${PORT}`, ""),
        });
      }
      const line = medianOf(runs);
      console.log(`${route}  ${JSON.stringify(line)}`);
      for (const category of ["performance", "accessibility", "best-practices", "seo"] as const) {
        if (line[category] < MIN_SCORE)
          failures.push(`${route}: ${category} ${line[category]} < ${MIN_SCORE}`);
      }
      if (line.lcp > BUDGETS.lcpMs)
        failures.push(`${route}: LCP ${line.lcp}ms > ${BUDGETS.lcpMs}ms`);
      if (line.cls >= BUDGETS.cls) failures.push(`${route}: CLS ${line.cls} >= ${BUDGETS.cls}`);
      if (line.finalUrl.startsWith("/login"))
        failures.push(`${route}: redirected to login, the session was not accepted`);
    }
  } finally {
    chrome.kill();
    server.kill();
  }
  if (failures.length > 0) {
    console.error("Lighthouse failed:\n" + failures.join("\n"));
    process.exit(1);
  }
  console.log("lighthouse OK");
}

void main();
