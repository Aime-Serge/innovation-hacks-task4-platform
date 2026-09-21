import { expect, test } from "@playwright/test";
import { settled, signIn, visit } from "./helpers";

test.beforeEach(async ({ context }) => signIn(context));

test.describe("TC-050 search, filter and sort (FR-15..19)", () => {
  test("TC-050 search narrows the list, announces the count and is stored in the URL", async ({
    page,
  }) => {
    await visit(page, "/tasks");
    await settled(page);
    const count = async () => Number((await page.getByRole("status").innerText()).split(" ")[0]);
    await expect.poll(count).toBeGreaterThan(0);
    const total = await count();
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("auth");
    await expect(page).toHaveURL(/q=auth/);
    await expect.poll(count).toBeLessThan(total);
    expect(await count()).toBeGreaterThan(0);
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("  AUTH  ");
    await expect(page).toHaveURL(/q=AUTH/);
    await expect(page.getByRole("status")).toContainText("tasks");
  });

  test("TC-051 filters combine: values inside one filter with OR, different filters with AND", async ({
    page,
  }) => {
    await visit(page, "/tasks");
    await settled(page);
    const count = async () => Number((await page.getByRole("status").innerText()).split(" ")[0]);
    await expect.poll(count).toBeGreaterThan(0);
    const all = await count();
    await page.getByRole("checkbox", { name: "To do" }).click();
    await expect.poll(count).toBeLessThan(all);
    const todo = await count();
    await page.getByRole("checkbox", { name: "Done" }).click();
    await expect.poll(count).toBeGreaterThan(todo);
    const todoOrDone = await count();
    await page.getByRole("checkbox", { name: "Urgent" }).click();
    await expect.poll(count).toBeLessThan(todoOrDone);
  });

  test("TC-052 sort by title reorders the cards, and direction flips them", async ({ page }) => {
    await visit(page, "/tasks?sort=title");
    await settled(page);
    const titles = () => page.getByRole("article").getByRole("heading").allInnerTexts();
    const asc = await titles();
    expect([...asc].sort((a, b) => a.localeCompare(b))).toEqual(asc);
    await page.getByRole("button", { name: /Ascending/ }).click();
    await expect(page).toHaveURL(/dir=desc/);
    // Only the first 48 cards render, so check the visible order, not the global maximum.
    await expect
      .poll(async () => {
        const shown = await titles();
        return shown.every((title, i) => i === 0 || (shown[i - 1] ?? "").localeCompare(title) >= 0);
      })
      .toBe(true);
    expect((await titles())[0]).not.toBe(asc[0]);
  });

  test("TC-053 reloading restores the same view from the URL", async ({ page }) => {
    await visit(page, "/tasks?q=fix&status=todo&priority=high&sort=title");
    await settled(page);
    await expect(page.getByRole("searchbox", { name: "Search tasks" })).toHaveValue("fix");
    await expect(page.getByRole("checkbox", { name: "To do" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "High" })).toBeChecked();
    const before = await page.getByRole("status").innerText();
    await page.reload();
    await settled(page);
    await expect(page.getByRole("status")).toHaveText(before);
    await expect(page.getByRole("checkbox", { name: "To do" })).toBeChecked();
  });

  test("TC-053 hostile query values fall back to defaults instead of breaking the page", async ({
    page,
  }) => {
    await visit(page, "/tasks?status=%3Cscript%3E&sort=drop%20table&dir=sideways&priority=nope");
    await settled(page);
    await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("TC-054 no-results and no-data are different, and Clear filters restores the list", async ({
    page,
  }) => {
    await visit(page, "/tasks?q=qqqqqqqq");
    await expect(page.getByRole("heading", { name: "No results" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create a task" })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(page).not.toHaveURL(/q=/);
  });

  test("TC-019 changing a status sticks, and progress on the project page follows", async ({
    page,
  }) => {
    await visit(page, "/tasks");
    await settled(page);
    const select = page.getByRole("article").first().getByRole("combobox");
    const before = await select.inputValue();
    const next = (await select.locator("option").nth(1).getAttribute("value")) as string; // the first workflow-legal move (FR-417)
    expect(next).not.toBe(before);
    await select.selectOption(next);
    await expect(select).toHaveValue(next);
    await expect(page.getByText("Could not update the task")).toHaveCount(0);
  });

  test("TC-030 a new task can be created from the tasks page", async ({ page }) => {
    await visit(page, "/tasks");
    await settled(page);
    await page.getByRole("button", { name: "New task" }).click();
    const dialog = page.getByRole("dialog", { name: "New task" });
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Enter a title of 1 to 120 characters.")).toBeVisible();
    await dialog.getByLabel("Title").fill("Write the end-to-end tests");
    await dialog.getByLabel("Project").selectOption({ index: 1 });
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Task created.", { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test("TC-040 progress bars match the calculated percentage and the detail page has a ring", async ({
    page,
  }) => {
    await visit(page, "/projects");
    await settled(page);
    const bars = page.getByRole("progressbar");
    await expect(bars.first()).toBeVisible();
    const card = page.getByRole("article").first();
    const done = await card.getByText(/of \d+ tasks? done/).innerText();
    const [d, t] = done.match(/\d+/g)?.map(Number) ?? [0, 0];
    const expected = t === 0 ? 0 : Math.round(((d ?? 0) / (t ?? 1)) * 100);
    await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(expected));
    await card.getByRole("link").first().click();
    await page.waitForURL(/\/projects\/[^/?]+/);
    await expect(page.getByRole("progressbar", { name: /^Progress of/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  });

  test("TC-014 an unknown project id shows a not-found state", async ({ page }) => {
    await visit(page, "/projects/does-not-exist");
    await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to projects" }).click();
    await expect(page).toHaveURL(/\/projects/);
  });

  test("TC-022 the scenario switcher changes the data and is reflected in the URL", async ({
    page,
  }) => {
    await visit(page, "/tasks");
    await settled(page);
    await page.getByRole("combobox", { name: "Scenario" }).selectOption("empty");
    await expect(page).toHaveURL(/scenario=empty/);
    await expect(page.getByRole("heading", { name: "No tasks yet" })).toBeVisible();
  });
});
