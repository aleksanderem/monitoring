/**
 * Integration tests for the TwoFactorSetup component (R25).
 *
 * Verifies loading state, disabled state, enabled state, backup codes display,
 * setup flow with QR code, verification input, and mutation calls.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useMutation } from "convex/react";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: any) => {
    if (params) return `${key} ${JSON.stringify(params)}`;
    return key;
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    mfa: {
      getMfaStatus: "mfa:getMfaStatus",
      initializeTotpSetup: "mfa:initializeTotpSetup",
      confirmTotpSetup: "mfa:confirmTotpSetup",
      disableTotp: "mfa:disableTotp",
      regenerateBackupCodes: "mfa:regenerateBackupCodes",
      getBackupCodes: "mfa:getBackupCodes",
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getKey(ref: unknown): string {
  if (typeof ref === "string") return ref;
  try {
    return getFunctionName(ref as any);
  } catch {
    return String(ref);
  }
}

function setupQueryMock(responses: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown) => {
    const key = getKey(ref);
    for (const [pattern, value] of Object.entries(responses)) {
      if (key.includes(pattern)) return value;
    }
    return undefined;
  }) as any);
}

const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();

function setupMutationMock() {
  mutationMap.clear();
  vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
    const key = getKey(ref);
    if (!mutationMap.has(key)) {
      mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    }
    return mutationMap.get(key)!;
  }) as any);
}

function getMutation(partial: string) {
  for (const [key, fn] of mutationMap.entries()) {
    if (key.includes(partial)) return fn;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { TwoFactorSetup } from "@/components/settings/TwoFactorSetup";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MFA_DISABLED = {
  isEnabled: false,
  hasBackupCodes: false,
  backupCodesRemaining: 0,
  enabledAt: null,
};

const MFA_ENABLED = {
  isEnabled: true,
  hasBackupCodes: true,
  backupCodesRemaining: 8,
  enabledAt: 1700000000000,
};

const MFA_ENABLED_NO_CODES = {
  isEnabled: true,
  hasBackupCodes: false,
  backupCodesRemaining: 0,
  enabledAt: 1700000000000,
};

const SETUP_RESPONSE = {
  secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  otpauthUrl: "otpauth://totp/DSEO:user%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=DSEO&algorithm=SHA1&digits=6&period=30",
};

const BACKUP_CODES_RESPONSE = {
  backupCodes: ["a1b2c3d4", "e5f6a7b8", "c9d0e1f2", "a3b4c5d6", "e7f8a9b0", "c1d2e3f4", "a5b6c7d8", "e9f0a1b2", "c3d4e5f6", "a7b8c9d0"],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TwoFactorSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMutationMock();
  });

  it("renders loading state when query returns undefined", () => {
    setupQueryMock({});
    const { container } = render(<TwoFactorSetup />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders disabled state with enable button", () => {
    setupQueryMock({ getMfaStatus: MFA_DISABLED });
    render(<TwoFactorSetup />);
    expect(screen.getByText("mfaTitle")).toBeInTheDocument();
    expect(screen.getByText("mfaDescription")).toBeInTheDocument();
    expect(screen.getByText("mfaEnable")).toBeInTheDocument();
  });

  it("renders enabled state with status badge", () => {
    setupQueryMock({ getMfaStatus: MFA_ENABLED });
    render(<TwoFactorSetup />);
    expect(screen.getByText("mfaEnabled")).toBeInTheDocument();
  });

  it("shows backup codes remaining count", () => {
    setupQueryMock({ getMfaStatus: MFA_ENABLED });
    render(<TwoFactorSetup />);
    expect(screen.getByText(/mfaBackupCodesRemaining/)).toBeInTheDocument();
    expect(screen.getByText(/"count":8/)).toBeInTheDocument();
  });

  it("shows disable button when enabled", () => {
    setupQueryMock({ getMfaStatus: MFA_ENABLED });
    render(<TwoFactorSetup />);
    expect(screen.getByText("mfaDisable")).toBeInTheDocument();
  });

  it("shows regenerate codes button when enabled", () => {
    setupQueryMock({ getMfaStatus: MFA_ENABLED });
    render(<TwoFactorSetup />);
    expect(screen.getByText("mfaRegenerateCodes")).toBeInTheDocument();
  });

  it("calls initializeTotpSetup on enable click", async () => {
    setupQueryMock({ getMfaStatus: MFA_DISABLED });
    render(<TwoFactorSetup />);

    const initMut = getMutation("initializeTotpSetup")!;
    initMut.mockResolvedValue(SETUP_RESPONSE);

    fireEvent.click(screen.getByText("mfaEnable"));

    await waitFor(() => {
      expect(initMut).toHaveBeenCalled();
    });
  });

  it("shows QR section after setup initialized", async () => {
    setupQueryMock({ getMfaStatus: MFA_DISABLED });
    render(<TwoFactorSetup />);

    const initMut = getMutation("initializeTotpSetup")!;
    initMut.mockResolvedValue(SETUP_RESPONSE);

    fireEvent.click(screen.getByText("mfaEnable"));

    await waitFor(() => {
      expect(screen.getByText("mfaScanQrCode")).toBeInTheDocument();
    });
  });

  it("shows manual secret code after setup initialized", async () => {
    setupQueryMock({ getMfaStatus: MFA_DISABLED });
    render(<TwoFactorSetup />);

    const initMut = getMutation("initializeTotpSetup")!;
    initMut.mockResolvedValue(SETUP_RESPONSE);

    fireEvent.click(screen.getByText("mfaEnable"));

    await waitFor(() => {
      expect(screen.getByText(SETUP_RESPONSE.secret)).toBeInTheDocument();
    });
  });

  it("shows verification input after setup initialized", async () => {
    setupQueryMock({ getMfaStatus: MFA_DISABLED });
    render(<TwoFactorSetup />);

    const initMut = getMutation("initializeTotpSetup")!;
    initMut.mockResolvedValue(SETUP_RESPONSE);

    fireEvent.click(screen.getByText("mfaEnable"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
    });
  });

  it("verify button is disabled when code is less than 6 characters", async () => {
    setupQueryMock({ getMfaStatus: MFA_DISABLED });
    render(<TwoFactorSetup />);

    const initMut = getMutation("initializeTotpSetup")!;
    initMut.mockResolvedValue(SETUP_RESPONSE);

    fireEvent.click(screen.getByText("mfaEnable"));

    await waitFor(() => {
      expect(screen.getByText("mfaVerify")).toBeInTheDocument();
    });

    const verifyButton = screen.getByText("mfaVerify");
    expect(verifyButton).toBeDisabled();

    const input = screen.getByPlaceholderText("000000");
    fireEvent.change(input, { target: { value: "123" } });
    expect(verifyButton).toBeDisabled();
  });

  it("shows backup codes after successful verification", async () => {
    setupQueryMock({ getMfaStatus: MFA_DISABLED });
    render(<TwoFactorSetup />);

    const initMut = getMutation("initializeTotpSetup")!;
    initMut.mockResolvedValue(SETUP_RESPONSE);
    const confirmMut = getMutation("confirmTotpSetup")!;
    confirmMut.mockResolvedValue(BACKUP_CODES_RESPONSE);

    // Start setup
    fireEvent.click(screen.getByText("mfaEnable"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
    });

    // Enter code and verify
    const input = screen.getByPlaceholderText("000000");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByText("mfaVerify"));

    await waitFor(() => {
      expect(screen.getByText("mfaBackupCodesTitle")).toBeInTheDocument();
    });

    // Check backup codes are shown
    expect(screen.getByText("a1b2c3d4")).toBeInTheDocument();
    expect(screen.getByText("e5f6a7b8")).toBeInTheDocument();
  });

  it("calls disableTotp when disable button is clicked", async () => {
    setupQueryMock({ getMfaStatus: MFA_ENABLED });
    render(<TwoFactorSetup />);

    const disableMut = getMutation("disableTotp")!;

    fireEvent.click(screen.getByText("mfaDisable"));

    await waitFor(() => {
      expect(disableMut).toHaveBeenCalled();
    });
  });

  it("calls regenerateBackupCodes and shows new codes", async () => {
    setupQueryMock({ getMfaStatus: MFA_ENABLED });
    render(<TwoFactorSetup />);

    const regenMut = getMutation("regenerateBackupCodes")!;
    regenMut.mockResolvedValue(BACKUP_CODES_RESPONSE);

    fireEvent.click(screen.getByText("mfaRegenerateCodes"));

    await waitFor(() => {
      expect(regenMut).toHaveBeenCalled();
      expect(screen.getByText("mfaBackupCodesTitle")).toBeInTheDocument();
    });
  });

  it("shows error message when mutation fails", async () => {
    setupQueryMock({ getMfaStatus: MFA_DISABLED });
    render(<TwoFactorSetup />);

    const initMut = getMutation("initializeTotpSetup")!;
    initMut.mockRejectedValue(new Error("Not authenticated"));

    fireEvent.click(screen.getByText("mfaEnable"));

    await waitFor(() => {
      expect(screen.getByText("Not authenticated")).toBeInTheDocument();
    });
  });

  it("cancel button clears setup data", async () => {
    setupQueryMock({ getMfaStatus: MFA_DISABLED });
    render(<TwoFactorSetup />);

    const initMut = getMutation("initializeTotpSetup")!;
    initMut.mockResolvedValue(SETUP_RESPONSE);

    fireEvent.click(screen.getByText("mfaEnable"));

    await waitFor(() => {
      expect(screen.getByText("mfaCancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("mfaCancel"));

    // Should go back to showing enable button
    expect(screen.getByText("mfaEnable")).toBeInTheDocument();
    expect(screen.queryByText("mfaScanQrCode")).not.toBeInTheDocument();
  });
});
