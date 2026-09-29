import { expect, test } from "@playwright/test";
import { hasHorizontalScroll, settled, signIn, visit } from "./helpers";

test.beforeEach(async ({ context }) => signIn(context));

const WIDTHS = [360, 768, 1280, 2560] as const;
const ROUTES = ["/dashboard", "/projects", "/projects/project-1", "/tasks", "/profile"] as const;

test.describe("TC-060 no horizontal scroll (FR-23, NFR-09)", () => {
  for (const width of WIDTHS) {
    test(`TC-060 no horizontal page scroll at ${width}px on every route`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        await visit(page, route);
        await settled(page);
        expect(await hasHorizontalScroll(page), `${route} at ${width}px`).toBe(false);
      }
    });
  }

  test("TC-060 the auth pages fit at 360px", async ({ page, context }) => {
    await context.clearCookies();
    await page.setViewportSize({ width: 360, height: 740 });
    for (const route of ["/login", "/register", "/forgot-password"]) {
      await page.goto(route);
      expect(await hasHorizontalScroll(page), route).toBe(false);
    }
  });

  test("TC-060 content stays inside the 1280px column on very wide screens", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 });
    await visit(page, "/tasks");
    await settled(page);
    const width = await page
      .locator("#main-content")
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(1280);
  });

  test("TC-060 the card grid reflows to 1, 2, 3 and 4 columns", async ({ page }) => {
    const columns = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      await visit(page, "/projects");
      await settled(page);
      return page
        .getByRole("article")
        .evaluateAll(
          (cards) => new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size,
        );
    };
    expect(await columns(360)).toBe(1);
    expect(await columns(768)).toBe(2);
    expect(await columns(1280)).toBe(3);
    expect(await columns(1600)).toBe(4);
  });

  test("TC-060 the layout still works at 200% zoom", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 480 }); // 1280 css px at 200%
    await visit(page, "/tasks");
    await settled(page);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });
});

test.describe("TC-061 touch targets (NFR-10)", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("TC-061 every interactive control is at least 44 by 44 px on a touch layout", async ({
    page,
  }) => {
    await visit(page, "/tasks");
    await settled(page);
    const small = await page.evaluate(() => {
      const controls = document.querySelectorAll<HTMLElement>(
        "a[href], button, select, input:not([type=hidden]), [role=menuitem]",
      );
      return [...controls]
        .filter(
          (el) =>
            el.getClientRects().length > 0 &&
            !el.closest(".sr-only") &&
            getComputedStyle(el).visibility !== "hidden",
        )
        .map((el) => ({
          label: el.getAttribute("aria-label") ?? el.textContent.trim().slice(0, 30),
          box: el.getBoundingClientRect(),
          tag: el.tagName,
        }))
        .filter(({ box, tag }) => tag !== "INPUT" || box.width >= 1)
        .filter(({ box }) => box.width < 43.5 || box.height < 43.5)
        .map(({ label, box }) => `${label}: ${Math.round(box.width)}x${Math.round(box.height)}`);
    });
    expect(small).toEqual([]);
  });
});
