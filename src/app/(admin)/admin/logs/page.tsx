"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { Badge } from "@/components/base/badges/badges";
import { useTranslations } from "next-intl";

export default function AdminLogsPage() {
  const t = useTranslations("admin");
  const auditLogs = useQuery(api.admin.getAdminAuditLogs, { limit: 100 });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-6">
        <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{t("navAuditLogs")}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">{t("navAuditLogs")}</h1>
        <p className="mt-1 text-sm text-tertiary">{t("auditLogsDescription")}</p>
      </div>

      <div className="bg-primary rounded-xl border border-secondary shadow-xs overflow-hidden">
        {auditLogs && auditLogs.length > 0 ? (
          <div className="divide-y divide-secondary">
            {auditLogs.map((log) => (
              <div key={log._id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge color="gray" size="sm">{log.action.replace(/_/g, " ")}</Badge>
                  <div>
                    <p className="text-sm text-primary">{log.targetType}: {log.targetId.slice(0, 16)}...</p>
                    {log.details && <p className="text-xs text-tertiary mt-0.5">{JSON.stringify(log.details).slice(0, 100)}</p>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm text-secondary">{log.adminEmail}</p>
                  <p className="text-xs text-tertiary">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-tertiary">
            {auditLogs === undefined ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-solid mx-auto" />
            ) : (
              t("noAuditLogs")
            )}
          </div>
        )}
      </div>
    </div>
  );
}
