/**
 * Mock for usePermissions hook used by PermissionGate and other auth components.
 */
import { vi } from "vitest";

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

export interface PermissionsMockOptions {
  permissions?: string[];
  modules?: string[];
  role?: string;
  isLoading?: boolean;
}

/**
 * Configure the usePermissions mock with specific permissions/modules.
 * Must be called after vi.mock("@/hooks/usePermissions") and
 * vi.mock("@/contexts/PermissionsContext") are set up.
 */
export function mockPermissions(options: PermissionsMockOptions = {}) {
  const {
    permissions = ALL_PERMISSIONS,
    modules = ALL_MODULES,
    role = "admin",
    isLoading = false,
  } = options;

  return {
    permissions,
    modules,
    role,
    plan: { name: "Pro", key: "pro" },
    isLoading,
    can: (permission: string) => permissions.includes(permission),
    hasModule: (module: string) => modules.includes(module),
  };
}
