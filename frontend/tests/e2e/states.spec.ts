import { expect, test } from "@playwright/test";
import { hasHorizontalScroll, settled, signIn, visit, VIEWPORTS } from "./helpers";

test.beforeEach(async ({ context }) => signIn(context));

// Section 8: each scenario has at least one test that fails if its state is missing.
for (const viewport of VIEWPORTS) {
  test.describe(`states at ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("TC-070 loading: skeletons hold the layout, then data arrives without a layout shift", async ({
      page,
    }) => {
      await visit(page, "/tasks", "loading");
      const busy = page.locator("[aria-busy='true']").first();
      await expect(busy).toBeVisible();
      const before = await page.getByRole("heading", { level: 1, name: "Tasks" }).boundingBox();
      await settled(page);
      await expect(page.getByRole("article").first()).toBeVisible();
      const after = await page.getByRole("heading", { level: 1, name: "Tasks" }).boundingBox();
      expect(after?.y).toBe(before?.y);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });

    test("TC-071 empty: every list explains itself and offers a first action", async ({ page }) => {
      await visit(page, "/dashboard", "empty");
      await expect(page.getByText("No deadlines this week")).toBeVisible();
      await expect(page.getByText("No activity yet")).toBeVisible();
      await visit(page, "/projects", "empty");
      await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Create a project" })).toBeVisible();
      await visit(page, "/tasks", "empty");
      await expect(page.getByRole("heading", { name: "No tasks yet" })).toBeVisible();
      await page.getByRole("button", { name: "Create a task" }).click();
      await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
    });

    test("TC-072 error: each region shows a plain message and Retry, and the page stays usable", async ({
      page,
    }) => {
      await visit(page, "/dashboard", "error");
      await expect(page.locator("main [role=alert]")).toHaveCount(3);
      await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(3);
      await expect(page.locator("main [role=alert]").first()).not.toContainText(
        /Error:|stack|undefined/,
      );
      await expect(
        page
          .getByRole("navigation", { name: "Primary" })
          .or(page.getByRole("button", { name: "Open menu" }))
          .first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "Retry" }).first().click();
      await expect(page.locator("main [role=alert]").first()).toBeVisible();
    });

    test("TC-073 partial error: only the tasks regions fail, activity still loads", async ({
      page,
    }) => {
      await visit(page, "/dashboard", "partial-error");
      await expect(page.locator("main [role=alert]")).toHaveCount(2);
      await expect(page.getByText(/(completed|created|changed) a task in/).first()).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    });

    test("TC-072 flaky: the first request fails and Retry recovers", async ({ page }) => {
      await visit(page, "/tasks", "flaky");
      await expect(page.locator("main [role=alert]")).toBeVisible();
      await page.getByRole("button", { name: "Retry" }).click();
      await expect(page.getByRole("article").first()).toBeVisible();
      await expect(page.locator("main [role=alert]")).toHaveCount(0);
    });

    test("TC-019 update-fails: the status change rolls back and an error toast appears", async ({
      page,
    }) => {
      await visit(page, "/tasks", "update-fails");
      const card = page.getByRole("article").first();
      const select = card.getByRole("combobox");
      await expect(select).toBeVisible();
      const before = await select.inputValue();
      await select.selectOption(await select.locator("option").nth(1).getAttribute("value")); // the first workflow-legal move (FR-417)
      await expect(
        page.getByText("Could not update the task. The change was undone.", { exact: true }),
      ).toBeVisible();
      await expect(select).toHaveValue(before);
    });

    test("TC-070 large: 500 tasks stay scrollable and search stays responsive", async ({
      page,
    }) => {
      await visit(page, "/tasks", "large");
      await expect(page.getByRole("status")).toHaveText("500 tasks", { timeout: 15_000 });
      await page.getByRole("searchbox", { name: "Search tasks" }).fill("zzzz-no-such-task");
      await expect(page.getByRole("heading", { name: "No results" })).toBeVisible();
      await page.getByRole("button", { name: "Clear filters" }).first().click();
      await expect(page.getByRole("status")).toHaveText("500 tasks");
      expect(await hasHorizontalScroll(page)).toBe(false);
    });

    test("TC-030 edge-text: 80-character names, long words, emoji and RTL never break the layout", async ({
      page,
    }) => {
      for (const path of ["/projects", "/tasks", "/dashboard"]) {
        await visit(page, path, "edge-text");
        await settled(page);
        expect(await hasHorizontalScroll(page), path).toBe(false);
      }
      await visit(page, "/projects", "edge-text");
      await expect(page.getByRole("article").first()).toBeVisible();
      const clipped = await page
        .getByRole("article")
        .first()
        .evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(clipped).toBe(false);
    });
  });
}
