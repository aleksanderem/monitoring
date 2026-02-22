import { test, expect } from "@playwright/test";

// ─── Auth pages: verify forms render and are interactive ───

test("login page has working email/password form", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });

  // Form fields exist and are interactive
  const emailInput = page.getByRole("textbox", { name: /email/i });
  const passwordInput = page.locator('input[type="password"]');

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  // Can type into fields
  await emailInput.fill("test@example.com");
  await passwordInput.fill("password123");

  // Submit button exists
  const submitButton = page.getByRole("button", { name: /sign in/i }).first();
  await expect(submitButton).toBeVisible();
});

test("register page has working form", async ({ page }) => {
  await page.goto("/register", { waitUntil: "networkidle" });

  // Form renders with email input (use type selector since label is translated)
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible();

  // Has link to login
  const loginLink = page.getByRole("link", { name: /log in|sign in/i }).first();
  await expect(loginLink).toBeVisible();
});

test("forgot-password page has email input", async ({ page }) => {
  await page.goto("/forgot-password", { waitUntil: "networkidle" });

  const emailInput = page.getByRole("textbox", { name: /email/i });
  await expect(emailInput).toBeVisible();
});

test("login page navigates to register", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });

  await page.getByRole("link", { name: /sign up/i }).first().click();

  await expect(page).toHaveURL(/register/);
});
