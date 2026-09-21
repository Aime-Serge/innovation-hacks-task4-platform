import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const SCENARIOS = [
  "default",
  "loading",
  "empty",
  "error",
  "partial-error",
  "flaky",
  "update-fails",
  "large",
  "edge-text",
] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const VIEWPORTS = [
  { name: "mobile", width: 360, height: 740 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

/** The mock session is a plain cookie (ADR-010), so tests set it directly. */
export async function signIn(context: BrowserContext): Promise<void> {
  await context.addCookies([
    { name: "mock_session", value: "user-1", url: "http://localhost:3100" },
  ]);
}

export async function visit(
  page: Page,
  path: string,
  scenario: Scenario = "default",
): Promise<void> {
  const url = new URL(path, "http://localhost:3100");
  url.searchParams.set("scenario", scenario);
  await page.goto(url.pathname + url.search);
}

/** Waits until nothing is loading any more. */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 15_000 });
}

export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}
