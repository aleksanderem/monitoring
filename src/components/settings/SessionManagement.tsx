"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Monitor01,
  Phone01,
  Tablet01,
  Check,
  XClose,
  LogOut01,
} from "@untitledui/icons";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function DeviceIcon({ type }: { type: string }) {
  switch (type) {
    case "mobile":
      return <Phone01 className="h-4 w-4 text-tertiary" />;
    case "tablet":
      return <Tablet01 className="h-4 w-4 text-tertiary" />;
    default:
      return <Monitor01 className="h-4 w-4 text-tertiary" />;
  }
}

// ---------------------------------------------------------------------------
// Active Sessions List
// ---------------------------------------------------------------------------

export function ActiveSessionsList() {
  const t = useTranslations("settings");
  const sessions = useQuery(api.security.getActiveSessions);
  const revokeSession = useMutation(api.security.revokeSession);
  const revokeAll = useMutation(api.security.revokeAllOtherSessions);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const handleRevoke = async (sessionId: Id<"userSessions">) => {
    setRevokingId(sessionId);
    try {
      await revokeSession({ sessionId });
      toast.success(t("sessionRevoked"));
    } catch {
      toast.error(t("sessionRevokeError"));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm(t("confirmRevokeAll"))) return;
    setRevokingAll(true);
    try {
      const result = await revokeAll({});
      toast.success(t("allSessionsRevoked", { count: String(result.revokedCount) }));
    } catch {
      toast.error(t("sessionRevokeError"));
    } finally {
      setRevokingAll(false);
    }
  };

  if (sessions === undefined) {
    return <LoadingState type="table" rows={3} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-primary">
            {t("activeSessionsTitle")}
          </h3>
          <p className="text-sm text-tertiary">
            {t("activeSessionsDescription")}
          </p>
        </div>
        {sessions.length > 1 && (
          <Button
            color="secondary"
            size="sm"
            iconLeading={LogOut01}
            onClick={handleRevokeAll}
            isLoading={revokingAll}
          >
            {t("revokeAllOther")}
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="py-6 text-center text-sm text-tertiary">
          {t("noActiveSessions")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-secondary">
                <th className="pb-3 pr-4 font-medium text-tertiary">
                  {t("sessionDevice")}
                </th>
                <th className="pb-3 pr-4 font-medium text-tertiary">
                  {t("sessionLocation")}
                </th>
                <th className="pb-3 pr-4 font-medium text-tertiary">
                  {t("sessionLastActive")}
                </th>
                <th className="pb-3 font-medium text-tertiary" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session._id}
                  className="border-b border-secondary last:border-0"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <DeviceIcon type={session.deviceInfo.deviceType} />
                      <div className="flex flex-col">
                        <span className="font-medium text-primary">
                          {session.deviceInfo.browser || "Unknown"}{" "}
                          {session.deviceInfo.os
                            ? `on ${session.deviceInfo.os}`
                            : ""}
                        </span>
                        {session.isCurrent && (
                          <Badge size="sm" type="pill-color" color="success">
                            {t("currentSession")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-tertiary">
                    {session.ipAddress || session.location || "—"}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-tertiary">
                    {relativeTime(session.lastActivityAt)}
                  </td>
                  <td className="py-3">
                    {!session.isCurrent && (
                      <Button
                        color="primary-destructive"
                        size="sm"
                        onClick={() =>
                          handleRevoke(session._id as Id<"userSessions">)
                        }
                        isLoading={revokingId === session._id}
                      >
                        {t("revokeSessionBtn")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login History Table
// ---------------------------------------------------------------------------

export function LoginHistoryTable() {
  const t = useTranslations("settings");
  const history = useQuery(api.security.getLoginHistory, { limit: 50 });

  if (history === undefined) {
    return <LoadingState type="table" rows={5} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-primary">
          {t("loginHistoryTitle")}
        </h3>
        <p className="text-sm text-tertiary">
          {t("loginHistoryDescription")}
        </p>
      </div>

      {history.length === 0 ? (
        <p className="py-6 text-center text-sm text-tertiary">
          {t("noLoginHistory")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-secondary">
                <th className="pb-3 pr-4 font-medium text-tertiary">
                  {t("loginDate")}
                </th>
                <th className="pb-3 pr-4 font-medium text-tertiary">
                  {t("loginMethod")}
                </th>
                <th className="pb-3 pr-4 font-medium text-tertiary">
                  {t("loginDeviceColumn")}
                </th>
                <th className="pb-3 pr-4 font-medium text-tertiary">
                  {t("loginIp")}
                </th>
                <th className="pb-3 font-medium text-tertiary">
                  {t("loginStatus")}
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={entry._id}
                  className="border-b border-secondary last:border-0"
                >
                  <td className="whitespace-nowrap py-3 pr-4 text-primary">
                    {new Date(entry.loginAt).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-tertiary capitalize">
                    {entry.loginMethod}
                  </td>
                  <td className="py-3 pr-4 text-tertiary">
                    {entry.deviceInfo.browser || "Unknown"}{" "}
                    {entry.deviceInfo.os ? `/ ${entry.deviceInfo.os}` : ""}
                  </td>
                  <td className="py-3 pr-4 text-tertiary">
                    {entry.ipAddress || "—"}
                  </td>
                  <td className="py-3">
                    {entry.status === "success" ? (
                      <div className="flex items-center gap-1">
                        <Check className="h-4 w-4 text-fg-success-primary" />
                        <span className="text-fg-success-primary">
                          {t("loginSuccess")}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <XClose className="h-4 w-4 text-fg-error-primary" />
                        <span className="text-fg-error-primary">
                          {t("loginFailed")}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Combined Sessions tab content
// ---------------------------------------------------------------------------

export function SessionManagement() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <ActiveSessionsList />
      <hr className="border-secondary" />
      <LoginHistoryTable />
    </div>
  );
}
