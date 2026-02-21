/**
 * Renders a component with all the providers the app uses:
 * - NextIntlClientProvider (with real EN translations)
 * - PermissionsContext (configurable permissions/modules)
 *
 * Convex is already globally mocked via vi.mock("convex/react") in setup.ts.
 * Use mockQueries() from convex-mock.ts to set per-test query responses.
 */
import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

// Import real translation files for accurate i18n testing
import enAdmin from "@/messages/en/admin.json";
import enAiResearch from "@/messages/en/aiResearch.json";
import enAuth from "@/messages/en/auth.json";
import enBacklinks from "@/messages/en/backlinks.json";
import enCommon from "@/messages/en/common.json";
import enCompetitors from "@/messages/en/competitors.json";
import enDomains from "@/messages/en/domains.json";
import enGenerators from "@/messages/en/generators.json";
import enJobs from "@/messages/en/jobs.json";
import enKeywords from "@/messages/en/keywords.json";
import enNav from "@/messages/en/nav.json";
import enOnsite from "@/messages/en/onsite.json";
import enProjects from "@/messages/en/projects.json";
import enSettings from "@/messages/en/settings.json";
import enShare from "@/messages/en/share.json";
import enStrategy from "@/messages/en/strategy.json";
import enOnboarding from "@/messages/en/onboarding.json";

const messages = {
  admin: enAdmin,
  aiResearch: enAiResearch,
  auth: enAuth,
  backlinks: enBacklinks,
  common: enCommon,
  competitors: enCompetitors,
  domains: enDomains,
  generators: enGenerators,
  jobs: enJobs,
  keywords: enKeywords,
  nav: enNav,
  onsite: enOnsite,
  projects: enProjects,
  settings: enSettings,
  share: enShare,
  strategy: enStrategy,
  onboarding: enOnboarding,
};

interface ProviderOptions {
  /** Permissions the user has. Defaults to all granted. */
  permissions?: string[];
  /** Modules the user has access to. Defaults to all. */
  modules?: string[];
  /** User role. Defaults to "admin". */
  role?: string;
  /** Locale. Defaults to "en". */
  locale?: string;
}

const ALL_PERMISSIONS = [
  "domains.create", "domains.edit", "domains.delete",
  "keywords.add", "keywords.refresh",
  "reports.create", "reports.share",
  "projects.create", "projects.edit", "projects.delete",
];

const ALL_MODULES = [
  "positioning", "backlinks", "seo_audit", "reports",
  "competitors", "ai_strategy", "forecasts", "link_building",
];

function TestProviders({
  children,
  permissions = ALL_PERMISSIONS,
  modules = ALL_MODULES,
  role = "admin",
  locale = "en",
}: ProviderOptions & { children: React.ReactNode }) {
  // PermissionsContext is consumed via useQuery(api.permissions.getMyContext),
  // which we mock via convex-mock.ts. But we also need to mock the usePermissions hook
  // for components that use PermissionGate directly without going through the provider.
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Render with all application providers.
 * Uses real translation messages (EN), configurable permissions.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: ProviderOptions & Omit<RenderOptions, "wrapper">,
) {
  const { permissions, modules, role, locale, ...renderOptions } = options ?? {};

  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders
        permissions={permissions}
        modules={modules}
        role={role}
        locale={locale}
      >
        {children}
      </TestProviders>
    ),
    ...renderOptions,
  });
}
