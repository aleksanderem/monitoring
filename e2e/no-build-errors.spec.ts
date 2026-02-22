import { test, expect } from "@playwright/test";

// ─── Meta test: verify no Next.js build/runtime errors on any page ───
// This is the test that catches broken imports, missing exports, etc.

const ALL_VISITABLE_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
  "/pricing",
  "/accessibility",
  "/status",
  "/help",
  "/api-docs",
  "/dashboard",
  "/domains",
  "/projects",
  "/settings",
  "/calendar",
  "/jobs",
];

test.describe("No runtime errors on any page", () => {
  for (const path of ALL_VISITABLE_PAGES) {
    test(`${path} has no Next.js error overlay`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await page.goto(path, { waitUntil: "domcontentloaded" });

      // Wait for client-side hydration
      await page.waitForTimeout(3000);

      // Check for Next.js dev error overlays (these appear as visible UI elements)
      const buildError = page.locator('text="Build Error"');
      const runtimeError = page.locator('text="Unhandled Runtime Error"');
      const moduleNotFound = page.locator('text="Module not found"');
      const exportMissing = page.locator("text=/doesn't exist in target module/");

      await expect(buildError).toHaveCount(0);
      await expect(runtimeError).toHaveCount(0);
      await expect(moduleNotFound).toHaveCount(0);
      await expect(exportMissing).toHaveCount(0);

      // No uncaught JS exceptions
      const relevant = jsErrors.filter(
        (e) =>
          !e.includes("Convex") &&
          !e.includes("hydration") &&
          !e.includes("Unauthenticated") &&
          !e.includes("net::ERR")
      );
      expect(relevant).toEqual([]);
    });
  }
});
