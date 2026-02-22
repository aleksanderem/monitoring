import { test, expect } from "@playwright/test";

// ─── Dashboard pages: these require auth, so they should redirect to login ───
// This still verifies the pages don't crash during SSR/client hydration

const PROTECTED_PAGES = [
  "/dashboard",
  "/domains",
  "/projects",
  "/settings",
  "/calendar",
  "/jobs",
];

for (const path of PROTECTED_PAGES) {
  test(`${path} redirects to login or renders without crash`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const response = await page.goto(path, { waitUntil: "networkidle" });

    // Either redirected to login (expected for protected routes)
    // or rendered successfully (if auth is relaxed in dev)
    const url = page.url();
    const status = response?.status() ?? 0;

    if (url.includes("/login")) {
      // Redirected to login — that's correct behavior
      expect(status).toBeLessThan(400);
    } else {
      // Rendered the page — check it didn't crash
      expect(status).toBeLessThan(500);
      // No visible error boundary covering the main content
      const visibleError = page.locator('[role="alert"]:visible:has-text("Something went wrong")');
      await expect(visibleError).toHaveCount(0);
    }

    // No fatal JS errors
    const fatalErrors = consoleErrors.filter(
      (e) =>
        !e.includes("Convex") &&
        !e.includes("net::ERR") &&
        !e.includes("favicon") &&
        !e.includes("hydration") &&
        !e.includes("Unauthenticated")
    );
    expect(fatalErrors).toEqual([]);
  });
}
