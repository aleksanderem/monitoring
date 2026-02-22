/**
 * Integration tests for Forgot Password page (/forgot-password).
 *
 * Tests the two-step OTP flow:
 * Step 1: Enter email → signIn("password", { email, flow: "reset" })
 * Step 2: Enter code + new password → signIn("password", { email, code, newPassword, flow: "reset-verification" })
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockSignIn = vi.fn().mockResolvedValue(undefined);
const mockRouterPush = vi.fn();

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mockSignIn }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/forgot-password",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let ForgotPasswordPage: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockSignIn.mockResolvedValue(undefined);
  const mod = await import("@/app/(auth)/forgot-password/page");
  ForgotPasswordPage = mod.default;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ForgotPasswordPage", () => {
  describe("Step 1: Email entry", () => {
    it("renders email input and send code button", () => {
      renderWithProviders(<ForgotPasswordPage />);
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /send.*code/i })).toBeInTheDocument();
    });

    it("renders back to login link", () => {
      renderWithProviders(<ForgotPasswordPage />);
      const link = screen.getByRole("link", { name: /back.*login/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/login");
    });

    it("calls signIn with reset flow when email submitted", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ForgotPasswordPage />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.click(screen.getByRole("button", { name: /send.*code/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("password", {
          email: "user@example.com",
          flow: "reset",
        });
      });
    });

    it("shows success toast and advances to step 2 on successful code send", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ForgotPasswordPage />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.click(screen.getByRole("button", { name: /send.*code/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });

      // Step 2 should now be visible (code input)
      expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
    });

    it("shows error toast when signIn fails on send code", async () => {
      mockSignIn.mockRejectedValueOnce(new Error("Account not found"));
      const user = userEvent.setup();
      renderWithProviders(<ForgotPasswordPage />);

      await user.type(screen.getByLabelText(/email/i), "bad@example.com");
      await user.click(screen.getByRole("button", { name: /send.*code/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Should stay on step 1
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });
  });

  describe("Step 2: Code + new password", () => {
    async function advanceToStep2() {
      const user = userEvent.setup();
      renderWithProviders(<ForgotPasswordPage />);
      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.click(screen.getByRole("button", { name: /send.*code/i }));
      await waitFor(() => expect(screen.getByLabelText(/code/i)).toBeInTheDocument());
      return user;
    }

    it("renders code, new password, and confirm password fields", async () => {
      await advanceToStep2();
      expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it("shows password requirements text", async () => {
      await advanceToStep2();
      expect(screen.getByText(/8 characters/i)).toBeInTheDocument();
    });

    it("calls signIn with reset-verification flow on valid submission", async () => {
      const user = await advanceToStep2();
      mockSignIn.mockClear();

      await user.type(screen.getByLabelText(/code/i), "123456");
      await user.type(screen.getByLabelText(/new password/i), "NewPass123");
      await user.type(screen.getByLabelText(/confirm password/i), "NewPass123");
      await user.click(screen.getByRole("button", { name: /reset password/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("password", {
          email: "user@example.com",
          code: "123456",
          newPassword: "NewPass123",
          flow: "reset-verification",
        });
      });
    });

    it("redirects to /domains on successful reset", async () => {
      const user = await advanceToStep2();
      mockSignIn.mockClear();

      await user.type(screen.getByLabelText(/code/i), "123456");
      await user.type(screen.getByLabelText(/new password/i), "NewPass123");
      await user.type(screen.getByLabelText(/confirm password/i), "NewPass123");
      await user.click(screen.getByRole("button", { name: /reset password/i }));

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith("/domains");
      });
    });

    it("shows error toast on password mismatch without calling signIn", async () => {
      const user = await advanceToStep2();
      mockSignIn.mockClear();

      await user.type(screen.getByLabelText(/code/i), "123456");
      await user.type(screen.getByLabelText(/new password/i), "NewPass123");
      await user.type(screen.getByLabelText(/confirm password/i), "DifferentPass1");
      await user.click(screen.getByRole("button", { name: /reset password/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("shows error toast when verification code is invalid", async () => {
      const user = await advanceToStep2();
      mockSignIn.mockClear();
      mockSignIn.mockRejectedValueOnce(new Error("Invalid code"));

      await user.type(screen.getByLabelText(/code/i), "000000");
      await user.type(screen.getByLabelText(/new password/i), "NewPass123");
      await user.type(screen.getByLabelText(/confirm password/i), "NewPass123");
      await user.click(screen.getByRole("button", { name: /reset password/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it("shows resend cooldown timer after code is sent", async () => {
      await advanceToStep2();
      // Should see a cooldown message (60 seconds)
      expect(screen.getByText(/resend/i)).toBeInTheDocument();
    });
  });
});
