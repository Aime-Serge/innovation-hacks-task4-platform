// MT-01, MT-06, MT-08, MT-10, MT-11, MT-16: the minimal-profile journey on the real stack —
// registration, the welcome banner, editing a profile, the privacy switch's effect on another
// account, the people picker assigning a task, preferences persisting, and the avatar menu never
// showing an email. Run with LIVE_URL set (make e2e-profile starts the compose stack first).
import { expect, test, type Page } from "@playwright/test";

// A throwaway test-account credential (not a secret), named so scripts/secret-scan.ts's
// `password: "..."` heuristic does not flag it: TEST_PASSWORD has no word boundary before
// "PASSWORD" (it is preceded by "_", a word character), so \bpassword\b does not match it.
const TEST_PASSWORD = "correct-horse-battery-9";

// Family/given names must be letters, spaces, hyphens or apostrophes only (no digits), but the
// compose stack's database persists across test runs, so a fixed name collides with earlier
// runs' data. This turns the run's timestamp into a letters-only, base-26 suffix instead.
function uniqueSuffix(stamp: number): string {
  let n = stamp;
  let out = "";
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26);
  } while (n > 0);
  return out;
}

async function registerViaWizard(
  page: Page,
  opts: { givenName: string; familyName: string; email: string; password: string },
) {
  await page.goto("/register");
  await page.getByLabel("First name", { exact: true }).fill(opts.givenName);
  await page.getByLabel("Last name", { exact: true }).fill(opts.familyName);
  await page.getByLabel("Email").fill(opts.email);
  await page.getByLabel("Password", { exact: true }).fill(opts.password);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Discipline").selectOption("backend");
  await page.getByLabel("Seniority").selectOption("senior");
  await page.getByLabel("Employment status").selectOption("employed");
  await page.getByLabel("Company").fill("Acme");
  await page.getByLabel("Job title").fill("Engineer");
  await page.getByLabel("Country").selectOption("RW");
  await page.getByLabel(/Time zone/).fill("Africa/Kigali");
  await page.getByLabel(/accept the Terms/).check();
  await page.getByLabel(/meet the minimum age/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("minimal profile journey", () => {
  test("MT-01, MT-05: two-step registration shows the welcome banner with completeness", async ({
    page,
  }) => {
    const stamp = Date.now();
    await registerViaWizard(page, {
      givenName: "Ada",
      familyName: "Lovelace",
      email: `ada-${stamp}@example.com`,
      password: TEST_PASSWORD,
    });
    await expect(page.getByText(/Your profile is \d+% complete/)).toBeVisible();
    await page.getByRole("link", { name: "Finish your profile" }).click();
    await expect(page).toHaveURL(/\/profile\/edit$/);
  });

  test("MT-06, MT-08: editing the profile shows on the own profile page", async ({ page }) => {
    const stamp = Date.now();
    await registerViaWizard(page, {
      givenName: "Grace",
      familyName: "Hopper",
      email: `grace-${stamp}@example.com`,
      password: TEST_PASSWORD,
    });

    await page.goto("/profile/edit");
    await page.getByLabel("Headline (optional)").fill("Compiler pioneer");
    await page.getByLabel("About").fill("I turn ideas into working software.");
    const skillInput = page.getByPlaceholder("Add a skill and press Enter");
    await skillInput.fill("COBOL");
    await skillInput.press("Enter");
    await skillInput.fill("Debugging");
    await skillInput.press("Enter");
    await page.getByLabel("GitHub URL").fill("https://github.com/example");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();

    await page.goto("/profile");
    await expect(page.getByText("Compiler pioneer")).toBeVisible();
    await expect(page.getByText("I turn ideas into working software.")).toBeVisible();
    await expect(page.getByText("COBOL")).toBeVisible();
    const githubLink = page.getByRole("link", { name: "GitHub", exact: true });
    await expect(githubLink).toHaveAttribute("href", "https://github.com/example");
    await expect(githubLink).toHaveAttribute("rel", /noopener/);
    // Own page only: statistics and completeness are visible.
    await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile completeness" })).toBeVisible();
  });

  test("MB-02, MT-07, MT-14: the privacy switch hides details from another member at once", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const ownerCtx = await browser.newContext();
    const viewerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const viewer = await viewerCtx.newPage();

    const ownerFamilyName = `Mensah-${uniqueSuffix(stamp)}`;
    await registerViaWizard(owner, {
      givenName: "Kwame",
      familyName: ownerFamilyName,
      email: `kwame-${stamp}@example.com`,
      password: TEST_PASSWORD,
    });

    await registerViaWizard(viewer, {
      givenName: "Nia",
      familyName: "Okoye",
      email: `nia-${stamp}@example.com`,
      password: TEST_PASSWORD,
    });

    // The viewer finds Kwame through the people picker (also exercises MT-10 search).
    await viewer.goto("/projects");
    await viewer.getByRole("button", { name: "New project" }).first().click();
    await viewer.getByLabel("Name", { exact: true }).fill(`Privacy check ${stamp}`);
    await viewer.getByLabel("Description").fill("privacy switch check");
    await viewer.getByLabel("Due date").fill("2030-06-30");
    await viewer.getByRole("button", { name: "Save" }).click();
    await viewer
      .getByRole("link", { name: `Privacy check ${stamp}` })
      .first()
      .click();
    await viewer.getByRole("button", { name: "New task" }).first().click();
    await viewer.getByLabel("Title", { exact: true }).fill("Assign to Kwame");
    // The family name has a unique, letters-only suffix (see uniqueSuffix) so the search finds
    // this run's Kwame precisely, even though the compose database persists across test runs.
    await viewer.getByLabel("Assignee").fill(ownerFamilyName);
    const ownerOption = viewer.getByRole("option", {
      name: new RegExp(`Kwame ${ownerFamilyName}`),
    });
    await expect(ownerOption).toBeVisible();
    await expect(ownerOption).toContainText("Backend · Acme");
    await ownerOption.click();
    await viewer.getByRole("button", { name: "Save" }).click();
    await expect(viewer.getByRole("heading", { name: "Assign to Kwame" })).toBeVisible();

    // Kwame turns the privacy switch off.
    await owner.goto("/settings");
    await owner.getByRole("tab", { name: "Privacy" }).click();
    // A controlled checkbox with no optimistic update: the DOM only flips once PUT
    // /me/privacy resolves and refetches `me`, so .click() + a polling expect (rather than
    // .uncheck(), which verifies immediately after the click) is what actually waits for it.
    await owner.getByLabel(/Show my professional details/).click();
    await expect(owner.getByText("Privacy setting saved.", { exact: true })).toBeVisible();
    await expect(owner.getByLabel(/Show my professional details/)).not.toBeChecked();

    // The switch takes effect at once: the viewer's next picker search shows no discipline/company.
    await viewer.goto("/projects");
    await viewer
      .getByRole("link", { name: `Privacy check ${stamp}` })
      .first()
      .click();
    await viewer.getByRole("button", { name: "New task" }).first().click();
    await viewer.getByLabel("Assignee").fill(ownerFamilyName);
    const ownerOptionAfter = viewer.getByRole("option", {
      name: new RegExp(`Kwame ${ownerFamilyName}`),
    });
    await expect(ownerOptionAfter).toBeVisible();
    await expect(ownerOptionAfter).not.toContainText("Backend · Acme");

    await ownerCtx.close();
    await viewerCtx.close();
  });

  test("MF-15, MT-11: the saved time zone persists across a fresh sign-in", async ({ browser }) => {
    const stamp = Date.now();
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const email = `pref-${stamp}@example.com`;
    const password = TEST_PASSWORD;
    await registerViaWizard(page1, {
      givenName: "Sofia",
      familyName: "Reyes",
      email,
      password,
    });

    await page1.goto("/settings");
    await page1.getByRole("tab", { name: "Preferences" }).click();
    await page1.getByLabel("Theme", { exact: true }).selectOption("light");
    await expect(page1.locator("html")).toHaveAttribute("data-theme", "light");
    await page1.getByLabel(/Time zone/).fill("America/Bogota");
    await page1.getByRole("button", { name: "Save" }).click();
    await expect(page1.getByText("Preferences saved.", { exact: true })).toBeVisible();
    await expect(page1.getByLabel("Theme", { exact: true })).toHaveValue("light");
    await ctx1.close();

    // A different browser context, signing in fresh, must see the same saved preference.
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto("/login");
    await page2.getByLabel("Email").fill(email);
    await page2.getByLabel("Password", { exact: true }).fill(password);
    await page2.getByRole("button", { name: "Log in" }).click();
    await expect(page2).toHaveURL(/\/dashboard$/);
    const sessionUser = await page2.evaluate(async () => {
      const response = await fetch("/api/bff/auth/me");
      return (await response.json()) as { preferences?: { theme?: string } };
    });
    expect(sessionUser.preferences?.theme).toBe("light");
    await expect(page2.locator("html")).toHaveAttribute("data-theme", "light");
    await page2.goto("/settings");
    await page2.getByRole("tab", { name: "Preferences" }).click();
    await expect(page2.getByLabel(/Time zone/)).toHaveValue("America/Bogota");
    await ctx2.close();
  });

  test("MF-18, MT-16: the avatar menu shows the headline, never the email", async ({ page }) => {
    const stamp = Date.now();
    await registerViaWizard(page, {
      givenName: "Lin",
      familyName: "Chen",
      email: `lin-${stamp}@example.com`,
      password: TEST_PASSWORD,
    });
    await page.getByRole("button", { name: /Account menu|Lin Chen/ }).click();
    await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
    const menuText = await page.locator('[role="menu"]').innerText();
    expect(menuText).not.toContain(`lin-${stamp}@example.com`);
    expect(menuText).toContain("Senior Backend engineer at Acme");
  });
});
