"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Toggle } from "@/components/base/toggle/toggle";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function AdminDebugLogsPage() {
  const t = useTranslations("admin");
  usePageTitle("Admin", "Debug Logs");
  const isEnabled = useQuery(api.debugLog.getStatus);
  const logs = useQuery(api.debugLog.getLogs, { limit: 100 });
  const toggleDebug = useMutation(api.debugLog.toggle);
  const clearLogs = useMutation(api.debugLog.clearLogs);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionFilter, setActionFilter] = useState<string>("all");

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggleDebug({ enabled });
      toast.success(enabled ? t("debugEnabled") : t("debugDisabled"));
    } catch {
      toast.error(t("debugToggleFailed"));
    }
  };

  const handleClear = async () => {
    try {
      const result = await clearLogs();
      toast.success(t("debugLogsCleared", { count: result.deleted }));
    } catch {
      toast.error(t("debugClearFailed"));
    }
  };

  // Collect unique action names for filter
  const actionNames = logs
    ? [...new Set(logs.map((l) => l.action))].sort()
    : [];

  const filteredLogs = logs?.filter(
    (l) => actionFilter === "all" || l.action === actionFilter
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-6">
        <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{t("navDebugLogs")}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">
          {t("navDebugLogs")}
        </h1>
        <p className="mt-1 text-sm text-tertiary">
          {t("debugLogsDescription")}
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Toggle
            size="md"
            label={t("debugToggleLabel")}
            hint={t("debugToggleHint")}
            isSelected={isEnabled ?? false}
            onChange={handleToggle}
          />
        </div>
        <div className="flex items-center gap-3">
          {/* Action filter */}
          {actionNames.length > 0 && (
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm text-primary dark:bg-utility-gray-800 dark:text-white dark:border-utility-gray-700"
            >
              <option value="all">{t("debugFilterAll")}</option>
              {actionNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <Button
            color="secondary"
            size="sm"
            onClick={handleClear}
            disabled={!logs || logs.length === 0}
          >
            {t("debugClearButton")}
          </Button>
        </div>
      </div>

      {/* Log entries */}
      <div className="bg-primary rounded-xl border border-secondary shadow-xs overflow-hidden">
        {filteredLogs && filteredLogs.length > 0 ? (
          <div className="divide-y divide-secondary">
            {filteredLogs.map((log) => {
              const isExpanded = expandedIds.has(log._id);
              return (
                <div key={log._id}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(log._id)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        color={log.status === "success" ? "success" : "error"}
                        size="sm"
                      >
                        {log.status}
                      </Badge>
                      <Badge color="gray" size="sm">
                        {log.action}
                      </Badge>
                      <span className="text-sm font-medium text-primary truncate">
                        {log.step}
                      </span>
                      {log.error && (
                        <span className="text-xs text-error-primary truncate max-w-xs">
                          {log.error}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <span className="text-xs text-tertiary tabular-nums">
                        {log.durationMs}ms
                      </span>
                      <span className="text-xs text-tertiary">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      <svg
                        className={`w-4 h-4 text-tertiary transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-4 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-tertiary mb-1">
                          {t("debugRequest")}
                        </p>
                        <pre className="bg-tertiary rounded-lg p-3 text-xs text-secondary overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
                          {formatJson(log.request)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-tertiary mb-1">
                          {t("debugResponse")}
                        </p>
                        <pre className="bg-tertiary rounded-lg p-3 text-xs text-secondary overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
                          {formatJson(log.response)}
                        </pre>
                      </div>
                      {log.domainId && (
                        <p className="text-xs text-tertiary">
                          Domain: {log.domainId}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-tertiary">
            {logs === undefined ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-solid mx-auto" />
            ) : (
              t("debugNoLogs")
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatJson(raw: string): string {
  if (!raw) return "(empty)";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
