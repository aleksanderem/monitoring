"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function AdminDashboardPage() {
  const t = useTranslations("admin");
  usePageTitle("Admin", "Dashboard");
  const stats = useQuery(api.admin.getSystemStats);
  const auditLogs = useQuery(api.admin.getAdminAuditLogs, { limit: 5 });

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-solid" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">{t("breadcrumbHome")}</Breadcrumbs.Item>
          <Breadcrumbs.Item>{t("sidebarTitle")}</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">{t("navDashboard")}</h1>
        <p className="mt-1 text-sm text-tertiary">{t("dashboardDescription")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="relative rounded-xl border border-secondary bg-primary p-5">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <p className="text-sm font-medium text-tertiary">{t("statsUsers")}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.users.total}</p>
        </div>
        <div className="relative rounded-xl border border-secondary bg-primary p-5">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <p className="text-sm font-medium text-tertiary">{t("statsOrganizations")}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.organizations.total}</p>
          <p className="mt-1 text-xs text-tertiary">{t("statsRecentOrgs", { count: stats.organizations.recent })}</p>
        </div>
        <div className="relative rounded-xl border border-secondary bg-primary p-5">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <p className="text-sm font-medium text-tertiary">{t("statsProjects")}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.projects.total}</p>
        </div>
        <div className="relative rounded-xl border border-secondary bg-primary p-5">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <p className="text-sm font-medium text-tertiary">{t("statsDomains")}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.domains.total}</p>
        </div>
        <div className="relative rounded-xl border border-secondary bg-primary p-5">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <p className="text-sm font-medium text-tertiary">{t("statsActiveKeywords")}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.keywords.active}</p>
          <p className="mt-1 text-xs text-tertiary">{t("statsOfTotal", { count: stats.keywords.total })}</p>
        </div>
        <div className="relative rounded-xl border border-secondary bg-primary p-5">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <p className="text-sm font-medium text-tertiary">{t("statsPendingKeywords")}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.keywords.pending}</p>
          <p className="mt-1 text-xs text-tertiary">{t("statsPaused", { count: stats.keywords.paused })}</p>
        </div>
      </div>

      <div className="relative bg-primary rounded-xl border border-secondary shadow-xs overflow-hidden">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="px-6 py-4 border-b border-secondary">
          <h2 className="text-lg font-semibold text-primary">{t("recentAdminActions")}</h2>
        </div>
        {auditLogs && auditLogs.length > 0 ? (
          <div className="divide-y divide-secondary">
            {auditLogs.map((log) => (
              <div key={log._id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">{getActionLabel(log.action)}</p>
                  <p className="text-sm text-tertiary">{log.targetType}: {log.targetId.slice(0, 12)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-secondary">{log.adminEmail}</p>
                  <p className="text-xs text-tertiary">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-tertiary">{t("noRecentActions")}</div>
        )}
      </div>
    </div>
  );
}

function getActionLabel(action: string): string {
  // These are system action labels that map to backend action keys
  const labels: Record<string, string> = {
    update_org_limits: "Updated org limits",
    delete_organization: "Deleted organization",
    grant_super_admin: "Granted super admin",
    revoke_super_admin: "Revoked super admin",
    delete_user: "Deleted user",
    update_default_limits: "Updated default limits",
    suspend_user: "Suspended user",
    activate_user: "Activated user",
    impersonate_user: "Impersonated user",
    suspend_organization: "Suspended organization",
    activate_organization: "Activated organization",
  };
  return labels[action] || action.replace(/_/g, " ");
}
