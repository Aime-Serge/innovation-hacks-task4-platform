import { expect, test } from "@playwright/test";
import { signIn, visit } from "./helpers";

test.beforeEach(async ({ context }) => signIn(context));

test.describe("TC-010 navigation", () => {
  test("TC-010 reaches all four routes by mouse and marks the current page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await visit(page, "/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const [name, url, heading] of [
      ["Projects", /\/projects/, "Projects"],
      ["Tasks", /\/tasks/, "Tasks"],
      ["Profile", /\/profile/, "Profile"],
      ["Dashboard", /localhost:3100\/(\?.*)?$/, "Dashboard"],
    ] as const) {
      await nav.getByRole("link", { name }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
      await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
    }
  });

  test("TC-010 reaches every route with the keyboard alone and focus is visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await visit(page, "/");
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // Dashboard
    await page.keyboard.press("Tab"); // Projects
    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Projects" }),
    ).toBeFocused();
    const outline = await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Projects" })
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  });

  test("TC-011 below 1024px the sidebar becomes a drawer that traps focus and closes on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await visit(page, "/");
    await expect(page.locator("aside")).toBeHidden();
    const open = page.getByRole("button", { name: "Open menu" });
    await open.click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });

  test("TC-011 choosing a link in the drawer navigates and closes it", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await visit(page, "/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Tasks" }).click();
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("TC-011 from 1024px up the sidebar is fixed and there is no menu button", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await visit(page, "/");
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    const width = await page.locator("aside").evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(width)).toBe(256);
  });

  test("TC-012 the skip link is first in tab order and moves focus to main", async ({ page }) => {
    await visit(page, "/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("TC-008 the profile menu opens by keyboard and closes on Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await visit(page, "/");
    const trigger = page.getByRole("button", { name: /Account menu for/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "Log out" })).toBeHidden();
  });

  test("TC-020 the profile page shows the signed-in user's data and stats", async ({ page }) => {
    await visit(page, "/profile");
    await expect(page.getByText("aime.serge@example.com")).toBeVisible();
    await expect(page.getByText("Developer", { exact: true })).toBeVisible();
    await expect(page.getByText("Assigned", { exact: true })).toBeVisible();
  });

  test("TC-021 the profile form validates inline and saves", async ({ page }) => {
    await visit(page, "/profile");
    const name = page.getByLabel("Name");
    await name.fill("");
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    await name.fill("Aime Serge");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
  });
});
