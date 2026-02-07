"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";

export default function AdminDashboardPage() {
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
          <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
          <Breadcrumbs.Item>Admin</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Dashboard</h1>
        <p className="mt-1 text-sm text-tertiary">System statistics and recent actions overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-secondary bg-primary p-5">
          <p className="text-sm font-medium text-tertiary">Users</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.users.total}</p>
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-5">
          <p className="text-sm font-medium text-tertiary">Organizations</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.organizations.total}</p>
          <p className="mt-1 text-xs text-tertiary">+{stats.organizations.recent} in last 7 days</p>
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-5">
          <p className="text-sm font-medium text-tertiary">Projects</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.projects.total}</p>
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-5">
          <p className="text-sm font-medium text-tertiary">Domains</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.domains.total}</p>
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-5">
          <p className="text-sm font-medium text-tertiary">Active Keywords</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.keywords.active}</p>
          <p className="mt-1 text-xs text-tertiary">of {stats.keywords.total} total</p>
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-5">
          <p className="text-sm font-medium text-tertiary">Pending Keywords</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.keywords.pending}</p>
          <p className="mt-1 text-xs text-tertiary">{stats.keywords.paused} paused</p>
        </div>
      </div>

      <div className="bg-primary rounded-xl border border-secondary shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-secondary">
          <h2 className="text-lg font-semibold text-primary">Recent Admin Actions</h2>
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
          <div className="px-6 py-8 text-center text-tertiary">No recent actions</div>
        )}
      </div>
    </div>
  );
}

function getActionLabel(action: string): string {
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
