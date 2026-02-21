import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

// window.matchMedia — not implemented in jsdom, needed by useBreakpoint etc.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Global mocks for third-party packages that break in jsdom/vitest
// ---------------------------------------------------------------------------

// @untitledui/icons — ESM barrel export broken (missing file extensions)
// Proxy returns stub SVG for any icon name
vi.mock("@untitledui/icons", () => {
  const cache = new Map<string, React.FC<Record<string, unknown>>>();

  function getIcon(name: string) {
    if (!cache.has(name)) {
      const Icon = React.forwardRef<SVGSVGElement, Record<string, unknown>>(
        (props, ref) => React.createElement("svg", { ...props, ref, "data-testid": `icon-${name}` })
      );
      Icon.displayName = name;
      cache.set(name, Icon as unknown as React.FC<Record<string, unknown>>);
    }
    return cache.get(name)!;
  }

  return new Proxy(
    { __esModule: true },
    {
      get(target, prop: string) {
        if (prop in target) return (target as Record<string, unknown>)[prop];
        if (prop === "default" || prop === "then") return undefined;
        return getIcon(prop);
      },
      has() { return true; },
    }
  );
});

// @untitledui/file-icons — same issue as @untitledui/icons
vi.mock("@untitledui/file-icons", () => {
  const FileIcon = React.forwardRef<SVGSVGElement, Record<string, unknown>>(
    (props, ref) => React.createElement("svg", { ...props, ref, "data-testid": "file-icon" })
  );
  FileIcon.displayName = "FileIcon";
  return new Proxy(
    { __esModule: true, FileIcon },
    {
      get(target, prop: string) {
        if (prop in target) return (target as Record<string, unknown>)[prop];
        if (prop === "default" || prop === "then") return undefined;
        return FileIcon;
      },
      has() { return true; },
    }
  );
});

// next-intl — useTranslations returns the key as string (passthrough)
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}(${JSON.stringify(params)})`;
    return key;
  },
  useLocale: () => "en",
  useFormatter: () => ({
    number: (v: number) => String(v),
    dateTime: (v: Date) => v.toISOString(),
  }),
}));

// recharts — ResponsiveContainer needs real DOM measurements, stub it
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "responsive-container", style: { width: 300, height: 200 } }, children),
  };
});

// sonner — toast notifications
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

afterEach(() => {
  cleanup();
});
