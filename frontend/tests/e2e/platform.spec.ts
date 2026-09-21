import { expect, test } from "@playwright/test";
import { settled, signIn, visit } from "./helpers";

test.describe("TC-016 security headers (NFR-16, TH-06)", () => {
  test("TC-016 every response carries the required headers and a per-request nonce CSP", async ({
    request,
  }) => {
    const first = await request.get("/login");
    const second = await request.get("/login");
    const h = first.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(h["strict-transport-security"]).toContain("max-age=63072000");
    expect(h["x-powered-by"]).toBeUndefined();
    const csp = h["content-security-policy"] ?? "";
    for (const directive of [
      "default-src 'self'",
      "img-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).toMatch(/style-src 'self' 'nonce-[^']+'/);
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toBe(second.headers()["content-security-policy"]);
  });

  test("TC-016 the page's own scripts carry the nonce and nothing violates the CSP", async ({
    page,
    context,
  }) => {
    await signIn(context);
    const problems: string[] = [];
    page.on("console", (m) => {
      // The app's own error reporter logs the expected update-fails failure; only
      // browser-raised problems (CSP violations, React warnings) count here.
      const reported = m.text().startsWith("[");
      // WebKit logs Next's background link prefetches (?_rsc=) as errors when the
      // page navigates away mid-flight. That is a cancelled request, not a policy violation.
      const cancelledPrefetch =
        m.text().includes("_rsc=") && m.text().includes("access control checks");
      if ((m.type() === "error" || m.type() === "warning") && !reported && !cancelledPrefetch)
        problems.push(m.text());
    });
    page.on("pageerror", (e) => problems.push(e.message));
    for (const route of ["/", "/projects", "/projects/project-1", "/tasks", "/profile"]) {
      await visit(page, route);
      await settled(page);
    }
    await visit(page, "/tasks");
    await page.getByRole("button", { name: "New task" }).click();
    await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("combobox", { name: "Scenario" }).selectOption("update-fails");
    await settled(page);
    await page.getByRole("article").first().getByRole("combobox").selectOption("done");
    await expect(
      page.getByText("Could not update the task. The change was undone.", { exact: true }),
    ).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("TC-016 an injected script tag in a query value is inert (TH-01)", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await visit(page, "/tasks?q=%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E");
    await settled(page);
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();
    await expect(page.getByRole("searchbox", { name: "Search tasks" })).toHaveValue(
      "<img src=x onerror=window.__xss=1>",
    );
  });
});

test.describe("TC-009 theme (FR-24)", () => {
  test("TC-009 a dark OS preference paints dark before hydration, with no flash", async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    await signIn(context);
    const page = await context.newPage();
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { __firstTheme: string | undefined }).__firstTheme =
          document.documentElement.dataset["theme"];
      });
    });
    await page.goto("/");
    expect(
      await page.evaluate(() => (window as unknown as { __firstTheme?: string }).__firstTheme),
    ).toBe("dark");
    await context.close();
  });

  test("TC-009 the Appearance menu switches light and dark, and the choice survives a reload", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    await visit(page, "/");
    const html = page.locator("html");
    const choose = async (name: string) => {
      await page.getByRole("button", { name: /Account menu for/ }).click();
      await page.getByRole("menuitem", { name: "Appearance" }).focus();
      await page.keyboard.press("ArrowRight");
      await page.getByRole("menuitemradio", { name }).focus();
      await page.keyboard.press("Enter");
    };
    await choose("Light");
    await expect(html).toHaveAttribute("data-theme", "light");
    await choose("Dark");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("TC-009 the profile form theme select applies immediately", async ({ page, context }) => {
    await signIn(context);
    await visit(page, "/profile");
    await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("TC-008 reduced motion (NFR-08)", () => {
  test("TC-008 skeleton animation is off under prefers-reduced-motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await signIn(context);
    const page = await context.newPage();
    await visit(page, "/tasks", "loading");
    const skeleton = page.locator(".skeleton").first();
    await expect(skeleton).toBeVisible();
    const name = await skeleton.evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBeTruthy();
    const duration = await skeleton.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThan(0.001); // 0.01ms: effectively off
    await context.close();
    const animated = await browser.newContext({ reducedMotion: "no-preference" });
    await signIn(animated);
    const p2 = await animated.newPage();
    await visit(p2, "/tasks", "loading");
    const running = await p2
      .locator(".skeleton")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(running).not.toBe("none");
    await animated.close();
  });
});
