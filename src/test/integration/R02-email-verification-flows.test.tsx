/**
 * Integration tests for Register page (/register) — R02 Email Verification.
 *
 * Tests the 3-step registration flow:
 * Step 1: Enter name/email/password → signIn("password", { flow: "signUp" })
 * Step 2: Enter 8-digit OTP → signIn("password", { flow: "email-verification" })
 * Step 3: Success screen with auto-redirect
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
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
  usePathname: () => "/register",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

// Mock PinInput to avoid input-otp's dependency on document.elementFromPoint
// which doesn't exist in jsdom. We replace it with a simple controlled text input.
let pinOnChange: ((value: string) => void) | null = null;
vi.mock("@/components/base/pin-input/pin-input", () => {
  const PinRoot = ({ children, ...props }: { children: React.ReactNode; size?: string }) => (
    <div data-testid="pin-input-root" {...props}>{children}</div>
  );
  const PinGroup = ({ children, value, onChange, maxLength }: {
    children: React.ReactNode; value?: string; onChange?: (v: string) => void; maxLength?: number;
  }) => {
    // Expose onChange so tests can drive it
    pinOnChange = onChange ?? null;
    return (
      <div data-testid="pin-input-group">
        <input
          data-testid="pin-otp-input"
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value.slice(0, maxLength ?? 8))}
          maxLength={maxLength ?? 8}
          aria-label="verification code"
        />
        {children}
      </div>
    );
  };
  const PinSlot = ({ index }: { index: number }) => (
    <span data-testid={`pin-slot-${index}`} />
  );
  const PinInput = Object.assign(PinRoot, { Group: PinGroup, Slot: PinSlot });
  return { PinInput };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let RegisterPage: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockSignIn.mockResolvedValue(undefined);
  pinOnChange = null;
  const mod = await import("@/app/(auth)/register/page");
  RegisterPage = mod.default;
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "StrongPass1";
const TEST_NAME = "Test User";
const TEST_CODE = "12345678";

async function fillAndSubmitRegistrationForm(user: ReturnType<typeof userEvent.setup>) {
  const nameInput = screen.getByLabelText(/name/i);
  const emailInput = screen.getByLabelText(/email/i);
  const passwordInput = screen.getByLabelText(/password/i);

  await user.type(nameInput, TEST_NAME);
  await user.type(emailInput, TEST_EMAIL);
  await user.type(passwordInput, TEST_PASSWORD);

  const submitBtn = screen.getByRole("button", { name: /get.*started/i });
  await user.click(submitBtn);
}

async function advanceToStep2() {
  mockSignIn.mockResolvedValueOnce({ signingIn: false });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderWithProviders(<RegisterPage />);
  await fillAndSubmitRegistrationForm(user);
  await waitFor(() => {
    expect(screen.getByText(/Check your email/i)).toBeInTheDocument();
  });
  return user;
}

async function advanceToStep3() {
  const user = await advanceToStep2();
  mockSignIn.mockClear();
  mockSignIn.mockResolvedValueOnce(undefined);

  // Use the mocked PinInput's onChange to set the code value
  act(() => {
    pinOnChange?.(TEST_CODE);
  });

  // Submit the verification form
  const verifyBtn = screen.getByRole("button", { name: /Verify email/i });
  await user.click(verifyBtn);

  await waitFor(() => {
    expect(screen.getByText(/Email verified/i)).toBeInTheDocument();
  });

  return user;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RegisterPage — R02 Email Verification", () => {
  // =========================================================================
  // Step 1: Registration Form
  // =========================================================================
  describe("Step 1: Registration form", () => {
    it("renders name, email, and password fields", () => {
      renderWithProviders(<RegisterPage />);
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it("renders submit button with 'Get started' text", () => {
      renderWithProviders(<RegisterPage />);
      expect(screen.getByRole("button", { name: /get.*started/i })).toBeInTheDocument();
    });

    it("renders link to login page", () => {
      renderWithProviders(<RegisterPage />);
      const loginLink = screen.getByRole("link", { name: /log.*in/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute("href", "/login");
    });

    it("renders features panel on desktop layout", () => {
      renderWithProviders(<RegisterPage />);
      expect(screen.getByText(/Everything you need to dominate search/i)).toBeInTheDocument();
    });

    it("shows password strength indicator", () => {
      renderWithProviders(<RegisterPage />);
      expect(screen.getByText(/Must be at least 8 characters/i)).toBeInTheDocument();
    });

    it("calls signIn with signUp flow when form submitted", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithProviders(<RegisterPage />);

      await fillAndSubmitRegistrationForm(user);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("password", {
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          name: TEST_NAME,
          flow: "signUp",
        });
      });
    });

    it("redirects to /domains when signUp results in immediate sign-in", async () => {
      mockSignIn.mockResolvedValueOnce(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithProviders(<RegisterPage />);

      await fillAndSubmitRegistrationForm(user);

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith("/domains");
      });
    });

    it("transitions to step 2 when signUp returns signingIn: false", async () => {
      mockSignIn.mockResolvedValueOnce({ signingIn: false });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithProviders(<RegisterPage />);

      await fillAndSubmitRegistrationForm(user);

      await waitFor(() => {
        expect(screen.getByText(/Check your email/i)).toBeInTheDocument();
      });
    });

    it("shows error message when signUp fails", async () => {
      mockSignIn.mockRejectedValueOnce(new Error("Email already registered"));
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithProviders(<RegisterPage />);

      await fillAndSubmitRegistrationForm(user);

      await waitFor(() => {
        expect(screen.getByText(/Email already registered/i)).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    it("shows toast when code is sent successfully", async () => {
      mockSignIn.mockResolvedValueOnce({ signingIn: false });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithProviders(<RegisterPage />);

      await fillAndSubmitRegistrationForm(user);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // Step 2: Email Verification
  // =========================================================================
  describe("Step 2: Email verification", () => {
    it("shows 'Check your email' heading with user's email", async () => {
      await advanceToStep2();
      expect(screen.getByText(/Check your email/i)).toBeInTheDocument();
      expect(screen.getByText(TEST_EMAIL)).toBeInTheDocument();
    });

    it("renders pin input for OTP code entry", async () => {
      await advanceToStep2();
      expect(screen.getAllByTestId("pin-input-root").length).toBeGreaterThan(0);
      expect(screen.getAllByTestId("pin-otp-input").length).toBeGreaterThan(0);
    });

    it("renders verify email button", async () => {
      await advanceToStep2();
      const verifyBtn = screen.getByRole("button", { name: /Verify email/i });
      expect(verifyBtn).toBeInTheDocument();
    });

    it("calls signIn with email-verification flow on valid code submission", async () => {
      const user = await advanceToStep2();
      mockSignIn.mockClear();
      mockSignIn.mockResolvedValueOnce(undefined);

      // Set the OTP code via mock's onChange
      act(() => {
        pinOnChange?.(TEST_CODE);
      });

      const verifyBtn = screen.getByRole("button", { name: /Verify email/i });
      await user.click(verifyBtn);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("password", {
          email: TEST_EMAIL,
          code: TEST_CODE,
          flow: "email-verification",
        });
      });
    });

    it("shows error message on invalid code", async () => {
      const user = await advanceToStep2();
      mockSignIn.mockClear();
      mockSignIn.mockRejectedValueOnce(new Error("Invalid code"));

      act(() => {
        pinOnChange?.("00000000");
      });

      const verifyBtn = screen.getByRole("button", { name: /Verify email/i });
      await user.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByText(/Invalid verification code/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Check your email/i)).toBeInTheDocument();
    });

    it("renders resend link with initial cooldown", async () => {
      await advanceToStep2();
      expect(screen.getByText(/Resend in/i)).toBeInTheDocument();
    });

    it("shows 'Click to resend' after cooldown expires", async () => {
      await advanceToStep2();
      expect(screen.getByText(/Resend in/i)).toBeInTheDocument();

      // Advance cooldown one second at a time to let React process each state update
      for (let i = 0; i < 61; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }

      expect(screen.getByText(/Click to resend/i)).toBeInTheDocument();
    });

    it("'Back to registration' returns to step 1", async () => {
      const user = await advanceToStep2();

      const backBtn = screen.getByText(/Back to registration/i);
      await user.click(backBtn);

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Step 3: Success
  // =========================================================================
  describe("Step 3: Success", () => {
    it("shows 'Email verified' heading", async () => {
      await advanceToStep3();
      expect(screen.getByText(/Email verified/i)).toBeInTheDocument();
    });

    it("shows account created success message", async () => {
      await advanceToStep3();
      expect(screen.getByText(/Your account has been created successfully/i)).toBeInTheDocument();
    });

    it("shows 'Continue to dashboard' link", async () => {
      await advanceToStep3();
      const continueLink = screen.getByRole("link", { name: /Continue to dashboard/i });
      expect(continueLink).toBeInTheDocument();
      expect(continueLink).toHaveAttribute("href", "/domains");
    });

    it("shows redirect countdown text", async () => {
      await advanceToStep3();
      expect(screen.getByText(/Redirecting in/i)).toBeInTheDocument();
    });

    it("auto-redirects to /domains after countdown", async () => {
      await advanceToStep3();

      // Advance countdown one second at a time to let React process each tick
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }

      expect(mockRouterPush).toHaveBeenCalledWith("/domains");
    });

    it("shows success toast when verification succeeds", async () => {
      await advanceToStep3();
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
