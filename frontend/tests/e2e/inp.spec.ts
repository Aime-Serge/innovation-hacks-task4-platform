import { expect, test } from "@playwright/test";
import { settled, signIn, visit } from "./helpers";

// NFR-03: Interaction to Next Paint of 200 ms or less. Measured with the Event
// Timing API on real interactions, on a 4x throttled CPU (a mid-range phone).
const BUDGET_MS = 200;

test.describe("TC-090 interaction latency (NFR-03)", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "CPU throttling is a Chromium feature",
  );

  test(
    "TC-090 filters, search, sort, status changes and menus respond within 200 ms",
    { tag: "@perf" },
    async ({ page, context }) => {
      await signIn(context);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.addInitScript(() => {
        const w = window as unknown as { __inp: number[] };
        w.__inp = [];
        (w as unknown as { __slow: string[] }).__slow = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            w.__inp.push(entry.duration);
            if (entry.duration > 150)
              (w as unknown as { __slow: string[] }).__slow.push(
                `${entry.name} ${Math.round(entry.duration)}ms`,
              );
          }
        }).observe({
          type: "event",
          durationThreshold: 16,
          buffered: true,
        } as PerformanceObserverInit);
      });
      await visit(page, "/tasks");
      await settled(page);
      // Let hydration and the first render finish, then measure only what a user does next.
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        const w = window as unknown as { __inp: number[]; __slow: string[] };
        w.__inp.length = 0;
        w.__slow.length = 0;
      });
      await page.getByRole("checkbox", { name: "To do" }).click();
      await page.getByRole("checkbox", { name: "High" }).click();
      await page
        .getByRole("searchbox", { name: "Search tasks" })
        .pressSequentially("fix", { delay: 120 });
      await page.getByRole("button", { name: /Sort:/ }).click();
      await page.getByRole("menuitem", { name: "Title" }).click();
      await settled(page);
      const first = page.getByRole("article").first().getByRole("combobox");
      await first.selectOption((await first.inputValue()) === "done" ? "todo" : "done");
      await page.getByRole("button", { name: "New task" }).click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const durations = await page.evaluate(() => (window as unknown as { __inp: number[] }).__inp);
      expect(durations.length).toBeGreaterThan(5);
      const worst = Math.max(...durations);
      const slow = await page.evaluate(() => (window as unknown as { __slow: string[] }).__slow);
      if (slow.length > 0) console.log(`slow interactions: ${slow.join(", ")}`);
      console.log(`INP proxy: worst of ${durations.length} interactions = ${Math.round(worst)} ms`);
      expect(worst).toBeLessThanOrEqual(BUDGET_MS);
    },
  );
});
