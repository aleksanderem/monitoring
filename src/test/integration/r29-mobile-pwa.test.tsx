/**
 * R29: Mobile Optimization & PWA integration tests.
 *
 * Validates PWA manifest, service worker, MobileBottomNav component,
 * layout meta tags, and translation keys.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

let currentPathname = "/domains";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...rest }, children),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "../../..");

function readPublicFile(name: string): string {
  return fs.readFileSync(path.join(ROOT, "public", name), "utf-8");
}

function readMessages(locale: string): Record<string, string> {
  const raw = fs.readFileSync(
    path.join(ROOT, "src", "messages", locale, "common.json"),
    "utf-8"
  );
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// PWA Manifest tests
// ---------------------------------------------------------------------------

describe("PWA Manifest (public/manifest.json)", () => {
  let manifest: Record<string, unknown>;

  beforeEach(() => {
    manifest = JSON.parse(readPublicFile("manifest.json"));
  });

  it("is valid JSON", () => {
    expect(manifest).toBeDefined();
    expect(typeof manifest).toBe("object");
  });

  it("has required PWA fields", () => {
    expect(manifest).toHaveProperty("name");
    expect(manifest).toHaveProperty("short_name");
    expect(manifest).toHaveProperty("start_url");
    expect(manifest).toHaveProperty("display");
    expect(manifest).toHaveProperty("background_color");
    expect(manifest).toHaveProperty("theme_color");
    expect(manifest).toHaveProperty("icons");
  });

  it("uses the correct brand theme color", () => {
    expect(manifest.theme_color).toBe("#7f56d9");
  });

  it("has standalone display mode", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("references icon files with correct sizes", () => {
    const icons = manifest.icons as Array<{
      src: string;
      sizes: string;
      type: string;
    }>;
    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ sizes: "512x512", type: "image/png" }),
      ])
    );
  });

  it("uses doseo brand name", () => {
    expect(manifest.short_name).toBe("doseo");
    expect((manifest.name as string).toLowerCase()).toContain("doseo");
  });
});

// ---------------------------------------------------------------------------
// Service Worker tests
// ---------------------------------------------------------------------------

describe("Service Worker (public/sw.js)", () => {
  it("file exists and is non-empty", () => {
    const sw = readPublicFile("sw.js");
    expect(sw.length).toBeGreaterThan(0);
  });

  it("registers install, activate, and fetch listeners", () => {
    const sw = readPublicFile("sw.js");
    expect(sw).toContain("addEventListener");
    expect(sw).toContain('"install"');
    expect(sw).toContain('"activate"');
    expect(sw).toContain('"fetch"');
  });
});

// ---------------------------------------------------------------------------
// Layout meta tags
// ---------------------------------------------------------------------------

describe("Root layout meta tags (src/app/layout.tsx)", () => {
  let layoutSource: string;

  beforeEach(() => {
    layoutSource = fs.readFileSync(
      path.join(ROOT, "src", "app", "layout.tsx"),
      "utf-8"
    );
  });

  it("includes manifest link", () => {
    expect(layoutSource).toContain('href="/manifest.json"');
  });

  it("includes theme-color via Viewport export", () => {
    expect(layoutSource).toContain("themeColor");
    expect(layoutSource).toContain("#7f56d9");
  });

  it("includes mobile-web-app-capable meta", () => {
    expect(layoutSource).toContain("mobile-web-app-capable");
  });
});

// ---------------------------------------------------------------------------
// MobileBottomNav component
// ---------------------------------------------------------------------------

describe("MobileBottomNav", () => {
  beforeEach(() => {
    currentPathname = "/domains";
  });

  it("renders all four navigation items", () => {
    render(<MobileBottomNav />);
    expect(screen.getByText("mobileNavDashboard")).toBeInTheDocument();
    expect(screen.getByText("mobileNavDomains")).toBeInTheDocument();
    expect(screen.getByText("mobileNavKeywords")).toBeInTheDocument();
    expect(screen.getByText("mobileNavSettings")).toBeInTheDocument();
  });

  it("has the mobile-only visibility class (md:hidden)", () => {
    render(<MobileBottomNav />);
    const nav = screen.getByTestId("mobile-bottom-nav");
    expect(nav.className).toContain("md:hidden");
  });

  it("has fixed positioning for bottom bar", () => {
    render(<MobileBottomNav />);
    const nav = screen.getByTestId("mobile-bottom-nav");
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("bottom-0");
  });

  it("marks the active route with brand color class", () => {
    currentPathname = "/domains";
    render(<MobileBottomNav />);
    const domainsLink = screen.getByText("mobileNavDomains").closest("a");
    expect(domainsLink?.className).toContain("text-brand-600");
  });

  it("marks non-active routes with gray color class", () => {
    currentPathname = "/domains";
    render(<MobileBottomNav />);
    const settingsLink = screen.getByText("mobileNavSettings").closest("a");
    expect(settingsLink?.className).toContain("text-utility-gray-500");
  });

  it("activates Dashboard only on exact root path", () => {
    currentPathname = "/";
    render(<MobileBottomNav />);
    const dashboardLink = screen
      .getByText("mobileNavDashboard")
      .closest("a");
    expect(dashboardLink?.className).toContain("text-brand-600");

    const domainsLink = screen.getByText("mobileNavDomains").closest("a");
    expect(domainsLink?.className).toContain("text-utility-gray-500");
  });
});

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

describe("Mobile nav translations", () => {
  const REQUIRED_KEYS = [
    "mobileNavDashboard",
    "mobileNavDomains",
    "mobileNavKeywords",
    "mobileNavSettings",
  ];

  it("EN translations contain all mobile nav keys", () => {
    const en = readMessages("en");
    for (const key of REQUIRED_KEYS) {
      expect(en).toHaveProperty(key);
      expect(en[key].length).toBeGreaterThan(0);
    }
  });

  it("PL translations contain all mobile nav keys", () => {
    const pl = readMessages("pl");
    for (const key of REQUIRED_KEYS) {
      expect(pl).toHaveProperty(key);
      expect(pl[key].length).toBeGreaterThan(0);
    }
  });
});
