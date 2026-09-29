// TC-448, NFR-405, NFR-414: with AI off, the provider failing, the quota used up, or a hostile
// model answer, every AI screen shows a clear state and the rest of the app keeps working.
// scripts/e2e-faults.sh restarts the API with each FAULT and runs only that scenario.
import { expect, test, type Page } from "@playwright/test";

const FAULT = process.env["FAULT"] ?? "";
const only = (name: string) => test.skip(FAULT !== name, `runs only with FAULT=${name}`);

async function setUp(page: Page): Promise<string> {
  const stamp = `${FAULT}-${Date.now()}`;
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Fault Tester");
  await page.getByLabel("Email").fill(`fault-${stamp}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("fault-password-1");
  await page.getByLabel("Confirm password").fill("fault-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).first().click();
  const name = `Fault ${stamp}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Description").fill("fault injection");
  await page.getByLabel("Due date").fill("2030-06-30");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return name;
}

async function generate(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Generate tasks" }).click();
  // The notice shows on first use only; the dialog loads lazily, so wait for it briefly.
  await page
    .getByRole("button", { name: "I understand" })
    .click({ timeout: 4000 })
    .catch(() => undefined);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
}

async function restStillWorks(page: Page): Promise<void> {
  for (const [path, heading] of [
    ["/projects", "Projects"],
    ["/tasks", "Tasks"],
    ["/dashboard", "Dashboard"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
}

test.describe("fault injection", () => {
  test("TC-430 AI switched off: no AI actions anywhere, everything else works", async ({
    page,
  }) => {
    only("ai-off");
    await setUp(page);
    await expect(page.getByRole("button", { name: "Generate tasks" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "AI assistant" })).toHaveCount(0);
    await restStillWorks(page);
  });

  test("TC-438 provider timeout: a clear message, and the rest still works", async ({ page }) => {
    only("provider-timeout");
    await setUp(page);
    await generate(page);
    await expect(
      page.getByText("AI is unavailable right now. You can add tasks manually."),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await restStillWorks(page);
  });

  test("TC-437 unreadable answer: asks for a shorter brief", async ({ page }) => {
    only("bad-json");
    await setUp(page);
    await generate(page);
    await expect(
      page.getByText("The suggestions could not be read. Try a shorter brief."),
    ).toBeVisible();
  });

  test("TC-439 quota used up: the limit is explained after the allowed calls", async ({ page }) => {
    only("quota");
    await setUp(page);
    await generate(page);
    await expect(page.getByText("AI-generated, review before adding")).toBeVisible();
    await page.keyboard.press("Escape");
    await generate(page); // the second call of a one-call allowance
    await expect(page.getByText(/You have reached the AI limit/)).toBeVisible();
    await page.keyboard.press("Escape");
    await restStillWorks(page);
  });

  test("TC-443 a hostile answer shows as plain text and runs nothing", async ({ page }) => {
    only("injection");
    const dialogs: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await setUp(page);
    await generate(page);
    await expect(page.getByText("AI-generated, review before adding")).toBeVisible();
    await expect(page.getByLabel("Title").first()).toHaveValue(
      /IGNORE PREVIOUS INSTRUCTIONS <script>alert\(1\)<\/script>/,
    );
    expect(dialogs).toEqual([]); // no alert() ever ran
    expect(await page.locator("[role=dialog] script").count()).toBe(0);
  });
});
