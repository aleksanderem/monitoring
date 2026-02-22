import { test, expect } from "@playwright/test";

// ─── Public pages: no auth required, must render without errors ───

const PUBLIC_PAGES = [
  { path: "/login", expectText: "Sign in" },
  { path: "/register", expectText: "Create account" },
  { path: "/forgot-password", expectText: "Reset" },
  { path: "/pricing", expectText: "Pricing" },
  { path: "/accessibility", expectText: "Accessibility" },
  { path: "/status", expectText: "Status" },
  { path: "/help", expectText: "Help" },
  { path: "/api-docs", expectText: "API" },
];

for (const { path, expectText } of PUBLIC_PAGES) {
  test(`${path} renders without crash`, async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const response = await page.goto(path, { waitUntil: "networkidle" });

    // Page loaded with a successful HTTP status
    expect(response?.status()).toBeLessThan(400);

    // No visible error boundary covering the main content
    const visibleError = page.locator('[role="alert"]:visible:has-text("Something went wrong")');
    await expect(visibleError).toHaveCount(0);

    // No Next.js build error overlay
    const buildError = page.locator('text="Build Error"');
    await expect(buildError).toHaveCount(0);

    // Expected content is visible
    await expect(page.getByText(expectText, { exact: false }).first()).toBeVisible();

    // No uncaught JS exceptions (filter known noise)
    const fatalErrors = jsErrors.filter(
      (e) =>
        !e.includes("Convex") &&
        !e.includes("hydration") &&
        !e.includes("Unauthenticated") &&
        !e.includes("net::ERR")
    );
    expect(fatalErrors).toEqual([]);
  });
}
