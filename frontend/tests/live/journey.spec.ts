// TC-458 (local), TC-421, TC-431, TC-403: the whole user journey on the real stack, at three
// viewports: register, create a project, generate tasks with AI, add them, log out.
// Run with LIVE_URL set (make e2e-local starts the compose stack first).
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 360, height: 740 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`journey at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`TC-458 register, project, AI tasks, log out (${viewport.name})`, async ({
      page,
      context,
    }) => {
      const email = `e2e-${viewport.name}-${Date.now()}@example.com`;
      const project = `Journey ${viewport.name} ${Date.now()}`;

      // A visitor is sent to log in first, and comes back to the page they wanted (FR-404).
      await page.goto("/projects");
      await expect(page).toHaveURL(/\/login\?next=%2Fprojects/);

      // Register: success signs the person in (FR-401).
      await page.goto("/register");
      await page.getByLabel("Name", { exact: true }).fill("Journey Tester");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill("journey-password-1");
      await page.getByLabel("Confirm password").fill("journey-password-1");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(/\/$/);

      // No token is readable by page scripts (NFR-409).
      expect(await page.evaluate(() => document.cookie)).not.toMatch(/ih_at|ih_rt|token/i);
      expect(
        await page.evaluate(() =>
          JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
        ),
      ).not.toMatch(/eyJ|token/i);
      const cookies = await context.cookies();
      expect(cookies.length).toBeGreaterThan(0);
      for (const cookie of cookies) expect(cookie.httpOnly, cookie.name).toBe(true);

      // Create a project (FR-411).
      await page.goto("/projects");
      await page.getByRole("button", { name: "New project" }).first().click();
      await page.getByLabel("Name", { exact: true }).fill(project);
      await page.getByLabel("Description").fill("Made by the browser journey");
      await page.getByLabel("Due date").fill("2030-06-30");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByRole("link", { name: project }).first().click();
      await expect(page.getByRole("heading", { name: project })).toBeVisible();

      // Generate tasks with AI: notice first, then suggestions, and nothing exists until confirmed.
      await expect(page.getByRole("heading", { name: "AI assistant" })).toBeVisible();
      await page.getByRole("button", { name: "Generate tasks" }).click();
      await page.getByRole("button", { name: "I understand" }).click();
      await page.getByLabel("What is this work about? (optional)").fill("Launch the mobile app");
      await page.getByRole("button", { name: "Generate", exact: true }).click();
      await expect(page.getByText("AI-generated, review before adding")).toBeVisible();
      // Nothing exists yet: the task list behind the dialog has no such task (FR-432).
      await expect(page.locator("main").getByText("Define the scope and goals")).toHaveCount(0);
      await page.getByRole("button", { name: /^Add selected/ }).click();
      await expect(page.getByText(/Added \d+ tasks from AI suggestions/).first()).toBeVisible();
      await expect(
        page.locator("main").getByText("Define the scope and goals").first(),
      ).toBeVisible();

      // Log out: the session ends and protected pages redirect again (FR-403).
      await page.getByRole("button", { name: /Account menu/ }).click();
      await page.getByRole("menuitem", { name: "Log out" }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.goto("/projects");
      await expect(page).toHaveURL(/\/login\?next=%2Fprojects/);
    });
  });
}
