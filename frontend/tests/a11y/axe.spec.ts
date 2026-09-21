import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SCENARIOS, settled, signIn, visit } from "../e2e/helpers";

// TC-091: zero axe violations (WCAG 2.2 AA) on every route, in both themes and
// in every scenario, checked with data on screen and, for loading, on skeletons.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["light", "dark"] as const;
const APP_ROUTES = ["/", "/projects", "/tasks", "/profile"] as const;

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((value) => {
    window.localStorage.setItem("devdash_theme", value);
  }, theme);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
}

test.describe("TC-091 axe on the app routes", () => {
  test.beforeEach(async ({ context }) => signIn(context));

  for (const scenario of SCENARIOS) {
    for (const route of APP_ROUTES) {
      for (const theme of THEMES) {
        test(`TC-091 ${route} · ${scenario} · ${theme}`, async ({ page }) => {
          await visit(page, route, scenario);
          await setTheme(page, theme);
          if (scenario !== "loading") await settled(page);
          expect(await violations(page)).toEqual([]);
        });
      }
    }
  }

  for (const theme of THEMES) {
    test(`TC-091 /projects/project-1 · ${theme}`, async ({ page }) => {
      await visit(page, "/projects/project-1");
      await setTheme(page, theme);
      await settled(page);
      expect(await violations(page)).toEqual([]);
    });

    test(`TC-091 /projects/unknown (not found) · ${theme}`, async ({ page }) => {
      await visit(page, "/projects/unknown");
      await setTheme(page, theme);
      await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test(`TC-091 new task dialog and the mobile drawer · ${theme}`, async ({ page }) => {
      await visit(page, "/tasks");
      await setTheme(page, theme);
      await settled(page);
      await page.getByRole("button", { name: "New task" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test(`TC-091 the account menu · ${theme}`, async ({ page }) => {
      await visit(page, "/");
      await setTheme(page, theme);
      await page.getByRole("button", { name: /Account menu/ }).click();
      await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }

  test("TC-091 a toast on screen · light", async ({ page }) => {
    await visit(page, "/tasks", "update-fails");
    await settled(page);
    await page.getByRole("article").first().getByRole("combobox").selectOption("done");
    await expect(
      page.getByText("Could not update the task. The change was undone.", { exact: true }),
    ).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});

test.describe("TC-091 axe on the public routes", () => {
  for (const route of [
    "/login",
    "/login?registered=1",
    "/register",
    "/forgot-password",
    "/reset-password?token=abc",
    "/reset-password",
  ]) {
    for (const theme of THEMES) {
      test(`TC-091 ${route} · ${theme}`, async ({ page }) => {
        await page.goto(route);
        await setTheme(page, theme);
        expect(await violations(page)).toEqual([]);
      });
    }
  }

  test("TC-091 the 404 page", async ({ page, context }) => {
    await signIn(context);
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
