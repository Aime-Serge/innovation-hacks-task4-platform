import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("TC-001 landing and authentication", () => {
  test("TC-001 an anonymous visitor is sent to login and back to the page they wanted", async ({
    page,
  }) => {
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login\?next=%2Ftasks/);
    await page.getByLabel("Email").fill("aime.serge@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/tasks$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
  });

  test("TC-001 / opens the dashboard with four KPIs, deadlines and activity", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    for (const label of ["Active projects", "Open tasks", "Overdue tasks", "Completion rate"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Upcoming deadlines" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  // MT-01, MF-01, MF-05 (was: single-step form landing on /login; see supersession-log.md).
  // Not run in this session (no live stack); kept correct and ready for `npm run test:e2e`.
  test("TC-005 the two-step wizard signs the person in and shows the welcome banner", async ({
    page,
  }) => {
    const email = `new-${Date.now()}@example.com`;
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByLabel("First name").fill("New");
    await page.getByLabel("Last name").fill("Person");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("password123456");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Tell us about your work" })).toBeVisible();
    await page.getByLabel("Country").selectOption("RW");
    await page.getByLabel(/accept the Terms/).check();
    await page.getByLabel(/confirm that I meet/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("status").filter({ hasText: "profile is" })).toBeVisible();
  });

  test("TC-004 wrong credentials show one plain message and keep the user on login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("aime.serge@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("main [role=alert]")).toHaveText("Invalid email or password.");
    await expect(page).toHaveURL(/\/login/);
  });

  test("TC-004 a signed-in user is kept away from login, and logout returns there", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.goto("/login");
    await expect(page).toHaveURL(/localhost:3100\/$/);
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login\?next=%2Ftasks/);
  });

  test("TC-004 forgot password shows the same message for any email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");
  });

  test("TC-004 an open redirect through ?next= is ignored", async ({ page }) => {
    await page.goto("/login?next=https%3A%2F%2Fevil.example");
    await page.getByLabel("Email").fill("aime.serge@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/localhost:3100\/$/, { timeout: 30_000 });
  });
});
