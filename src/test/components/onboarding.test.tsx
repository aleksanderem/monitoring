import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render-with-providers";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/onboarding",
  useSearchParams: () => new URLSearchParams(),
}));

const mockMutationFn = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => mockMutationFn),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: () => (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}(${JSON.stringify(params)})`;
      return key;
    },
    useLocale: () => "en",
    useFormatter: () => ({
      number: (v: number) => String(v),
      dateTime: (v: Date) => v.toISOString(),
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// WelcomeStep
// ---------------------------------------------------------------------------

describe("WelcomeStep", () => {
  it("renders heading and CTA button", async () => {
    const { WelcomeStep } = await import(
      "@/components/onboarding/WelcomeStep"
    );
    renderWithProviders(
      <WelcomeStep onNext={vi.fn()} onSkip={vi.fn()} />
    );

    expect(screen.getByText("welcome.heading")).toBeInTheDocument();
    expect(screen.getByText("welcome.cta")).toBeInTheDocument();
  });

  it("calls onNext when CTA is clicked", async () => {
    const { WelcomeStep } = await import(
      "@/components/onboarding/WelcomeStep"
    );
    const onNext = vi.fn();
    renderWithProviders(<WelcomeStep onNext={onNext} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByText("welcome.cta"));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("has skip button", async () => {
    const { WelcomeStep } = await import(
      "@/components/onboarding/WelcomeStep"
    );
    const onSkip = vi.fn();
    renderWithProviders(<WelcomeStep onNext={vi.fn()} onSkip={onSkip} />);

    const skipBtn = screen.getByText("skip");
    expect(skipBtn).toBeInTheDocument();
    fireEvent.click(skipBtn);
    expect(onSkip).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// OrgSetupStep
// ---------------------------------------------------------------------------

describe("OrgSetupStep", () => {
  it("renders org name input and submit button", async () => {
    const { OrgSetupStep } = await import(
      "@/components/onboarding/OrgSetupStep"
    );
    renderWithProviders(
      <OrgSetupStep
        initialOrgName="My Org"
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    // Check for the label text and the input (via placeholder)
    expect(screen.getByText("orgSetup.nameLabel")).toBeInTheDocument();
    expect(screen.getByText("orgSetup.cta")).toBeInTheDocument();
  });

  it("has skip button", async () => {
    const { OrgSetupStep } = await import(
      "@/components/onboarding/OrgSetupStep"
    );
    renderWithProviders(
      <OrgSetupStep
        initialOrgName="My Org"
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText("skip")).toBeInTheDocument();
  });

  it("calls onNext with org name on submit", async () => {
    const { OrgSetupStep } = await import(
      "@/components/onboarding/OrgSetupStep"
    );
    const onNext = vi.fn();
    renderWithProviders(
      <OrgSetupStep
        initialOrgName="My Org"
        onNext={onNext}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("orgSetup.cta"));
    expect(onNext).toHaveBeenCalledWith("My Org");
  });
});

// ---------------------------------------------------------------------------
// FirstDomainStep
// ---------------------------------------------------------------------------

describe("FirstDomainStep", () => {
  it("renders URL input and submit button", async () => {
    const { FirstDomainStep } = await import(
      "@/components/onboarding/FirstDomainStep"
    );
    renderWithProviders(
      <FirstDomainStep
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        isSubmitting={false}
      />
    );

    // Check for label text and submit button
    expect(screen.getByText("firstDomain.urlLabel")).toBeInTheDocument();
    expect(screen.getByText("firstDomain.cta")).toBeInTheDocument();
  });

  it("has skip button", async () => {
    const { FirstDomainStep } = await import(
      "@/components/onboarding/FirstDomainStep"
    );
    renderWithProviders(
      <FirstDomainStep
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByText("skip")).toBeInTheDocument();
  });

  it("disables submit when URL is empty", async () => {
    const { FirstDomainStep } = await import(
      "@/components/onboarding/FirstDomainStep"
    );
    renderWithProviders(
      <FirstDomainStep
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        isSubmitting={false}
      />
    );

    const submitBtn = screen.getByText("firstDomain.cta");
    expect(submitBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// FirstTimeFlow — step navigation
// ---------------------------------------------------------------------------

describe("FirstTimeFlow", () => {
  it("starts on welcome step and navigates to org setup", async () => {
    const { useQuery } = await import("convex/react");
    vi.mocked(useQuery).mockReturnValue([{ _id: "org1", name: "Test Org" }]);

    const { FirstTimeFlow } = await import(
      "@/components/onboarding/FirstTimeFlow"
    );
    renderWithProviders(<FirstTimeFlow />);

    // Should start on welcome step
    expect(screen.getByText("welcome.heading")).toBeInTheDocument();

    // Click CTA to go to step 2
    fireEvent.click(screen.getByText("welcome.cta"));

    // Should now show org setup
    expect(screen.getByText("orgSetup.heading")).toBeInTheDocument();
  });

  it("navigates from org setup to first domain step", async () => {
    const { useQuery } = await import("convex/react");
    vi.mocked(useQuery).mockReturnValue([{ _id: "org1", name: "Test Org" }]);

    const { FirstTimeFlow } = await import(
      "@/components/onboarding/FirstTimeFlow"
    );
    renderWithProviders(<FirstTimeFlow />);

    // Go to step 2
    fireEvent.click(screen.getByText("welcome.cta"));

    // Go to step 3 (submit form)
    fireEvent.click(screen.getByText("orgSetup.cta"));

    // Should now show first domain step
    expect(screen.getByText("firstDomain.heading")).toBeInTheDocument();
  });

  it("can navigate back from org setup to welcome", async () => {
    const { useQuery } = await import("convex/react");
    vi.mocked(useQuery).mockReturnValue([{ _id: "org1", name: "Test Org" }]);

    const { FirstTimeFlow } = await import(
      "@/components/onboarding/FirstTimeFlow"
    );
    renderWithProviders(<FirstTimeFlow />);

    // Go to step 2
    fireEvent.click(screen.getByText("welcome.cta"));
    expect(screen.getByText("orgSetup.heading")).toBeInTheDocument();

    // Go back — there are multiple buttons, get the one that says "back"
    const backButtons = screen.getAllByText("back");
    fireEvent.click(backButtons[0]);
    expect(screen.getByText("welcome.heading")).toBeInTheDocument();
  });
});
