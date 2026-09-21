// NFR-420, TC-465 (local): no axe violations on the real screens, including the AI dialogs and the
// privacy notice, at a phone and a desktop width. Runs against the real adapter on the stack.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [
  { name: "phone", width: 360, height: 740 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

async function violations(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
  expect(summary, label).toEqual([]);
}

for (const size of WIDTHS) {
  test.describe(`axe at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test(`TC-465 every screen and AI dialog has no violations (${size.name})`, async ({ page }) => {
      await page.goto("/login");
      await violations(page, "login");
      await page.goto("/register");
      await violations(page, "register");

      const stamp = `${size.name}-${Date.now()}`;
      await page.getByLabel("Name", { exact: true }).fill("Axe Tester");
      await page.getByLabel("Email").fill(`axe-${stamp}@example.com`);
      await page.getByLabel("Password", { exact: true }).fill("axe-password-12");
      await page.getByLabel("Confirm password").fill("axe-password-12");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
      await violations(page, "dashboard");

      await page.goto("/projects");
      await page.getByRole("button", { name: "New project" }).first().click();
      const name = `Axe ${stamp}`;
      await page.getByLabel("Name", { exact: true }).fill(name);
      await page.getByLabel("Description").fill("accessibility");
      await page.getByLabel("Due date").fill("2030-06-30");
      await violations(page, "project form dialog");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("link", { name }).first()).toBeVisible();
      await violations(page, "projects");

      await page.getByRole("link", { name }).first().click();
      await expect(page.getByRole("heading", { name: "AI assistant" })).toBeVisible();
      await violations(page, "project detail with the AI panel");

      await page.getByRole("button", { name: "Generate tasks" }).click();
      await expect(page.getByText(/sent to an external AI provider/)).toBeVisible();
      await violations(page, "privacy notice");
      await page.getByRole("button", { name: "I understand" }).click();
      await violations(page, "task generation form");
      await page.getByRole("button", { name: "Generate", exact: true }).click();
      await expect(page.getByText("AI-generated, review before adding")).toBeVisible();
      await violations(page, "task generation results");
      await page.getByRole("button", { name: /^Add selected/ }).click();
      await expect(page.getByText(/Added \d+ tasks/).first()).toBeVisible();

      await page.getByRole("button", { name: "Suggest priorities" }).click();
      await expect(page.getByText("AI-generated, review before adding")).toBeVisible();
      await violations(page, "priorities");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Summarise project" }).click();
      await expect(page.getByText("AI-generated, review before adding")).toBeVisible();
      await violations(page, "summary");
      await page.keyboard.press("Escape");

      await page.goto("/tasks");
      await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible();
      await violations(page, "tasks");
    });
  });
}
