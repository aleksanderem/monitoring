/**
 * R26 — OAuth Expansion Tests
 *
 * Verifies that GitHub and Microsoft OAuth providers are configured in the
 * auth backend, that login/register pages render the corresponding OAuth
 * buttons, and that translations exist for both EN and PL locales.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignIn = vi.fn();

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mockSignIn }),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// ---------------------------------------------------------------------------
// Auth config tests (source-level verification)
// ---------------------------------------------------------------------------

describe("R26: Auth config — provider registration", () => {
  let authSource: string;

  beforeEach(() => {
    const authPath = path.resolve(__dirname, "../../../convex/auth.ts");
    authSource = fs.readFileSync(authPath, "utf-8");
  });

  it("imports GitHub provider from @auth/core/providers/github", () => {
    expect(authSource).toMatch(
      /import\s+GitHub\s+from\s+["']@auth\/core\/providers\/github["']/
    );
  });

  it("imports MicrosoftEntraId provider from @auth/core/providers/microsoft-entra-id", () => {
    expect(authSource).toMatch(
      /import\s+MicrosoftEntraId\s+from\s+["']@auth\/core\/providers\/microsoft-entra-id["']/
    );
  });

  it("includes GitHub in the providers array", () => {
    expect(authSource).toMatch(/providers\s*:\s*\[[\s\S]*?GitHub[\s\S]*?\]/);
  });

  it("includes MicrosoftEntraId in the providers array with client config", () => {
    expect(authSource).toMatch(/MicrosoftEntraId\s*\(\s*\{/);
    expect(authSource).toContain("MICROSOFT_CLIENT_ID");
    expect(authSource).toContain("MICROSOFT_CLIENT_SECRET");
  });
});

// ---------------------------------------------------------------------------
// Login page — OAuth buttons
// ---------------------------------------------------------------------------

describe("R26: Login page — OAuth buttons", () => {
  beforeEach(async () => {
    mockSignIn.mockClear();
    const { default: LoginPage } = await import(
      "@/app/(auth)/login/page"
    );
    render(<LoginPage />);
  });

  it("renders a GitHub OAuth button", () => {
    const btn = screen.getByTestId("oauth-github");
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain("signInWithGithub");
  });

  it("renders a Microsoft OAuth button", () => {
    const btn = screen.getByTestId("oauth-microsoft");
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain("signInWithMicrosoft");
  });

  it("calls signIn with 'github' when GitHub button is clicked", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByTestId("oauth-github"));
    expect(mockSignIn).toHaveBeenCalledWith("github");
  });

  it("calls signIn with 'microsoft-entra-id' when Microsoft button is clicked", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByTestId("oauth-microsoft"));
    expect(mockSignIn).toHaveBeenCalledWith("microsoft-entra-id");
  });
});

// ---------------------------------------------------------------------------
// Register page — OAuth buttons
// ---------------------------------------------------------------------------

describe("R26: Register page — OAuth buttons", () => {
  beforeEach(async () => {
    mockSignIn.mockClear();
    const { default: RegisterPage } = await import(
      "@/app/(auth)/register/page"
    );
    render(<RegisterPage />);
  });

  it("renders GitHub and Microsoft OAuth buttons on register page", () => {
    expect(screen.getByTestId("oauth-github")).toBeInTheDocument();
    expect(screen.getByTestId("oauth-microsoft")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Translation completeness
// ---------------------------------------------------------------------------

describe("R26: Translations — OAuth keys present", () => {
  const enPath = path.resolve(__dirname, "../../messages/en/auth.json");
  const plPath = path.resolve(__dirname, "../../messages/pl/auth.json");

  let en: Record<string, string>;
  let pl: Record<string, string>;

  beforeEach(() => {
    en = JSON.parse(fs.readFileSync(enPath, "utf-8"));
    pl = JSON.parse(fs.readFileSync(plPath, "utf-8"));
  });

  it("EN translations include signInWithGithub and signInWithMicrosoft", () => {
    expect(en.signInWithGithub).toBe("Sign in with GitHub");
    expect(en.signInWithMicrosoft).toBe("Sign in with Microsoft");
  });

  it("PL translations include signInWithGithub and signInWithMicrosoft", () => {
    expect(pl.signInWithGithub).toBe("Zaloguj się przez GitHub");
    expect(pl.signInWithMicrosoft).toBe("Zaloguj się przez Microsoft");
  });

  it("EN translations include orContinueWith divider text", () => {
    expect(en.orContinueWith).toBe("or continue with");
  });

  it("PL translations include orContinueWith divider text", () => {
    expect(pl.orContinueWith).toBe("lub kontynuuj przez");
  });
});
