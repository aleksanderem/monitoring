"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Trash01 } from "@untitledui/icons";

// ─── Active Sessions List ────────────────────────────────────────────

function ActiveSessionsList() {
  const t = useTranslations("settings");
  const sessions = useQuery(api.security.getActiveSessions);
  const revokeSession = useMutation(api.security.revokeSession);
  const revokeAll = useMutation(api.security.revokeAllOtherSessions);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const handleRevoke = async (sessionId: Id<"userSessions">) => {
    if (!confirm(t("revokeSessionConfirm"))) return;
    setRevokingId(sessionId);
    try {
      await revokeSession({ sessionId });
      toast.success(t("sessionRevokedSuccess"));
    } catch {
      toast.error(t("sessionRevokedError"));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm(t("revokeAllSessionsConfirm"))) return;
    setRevokingAll(true);
    try {
      const result = await revokeAll();
      toast.success(t("allSessionsRevokedSuccess", { count: String(result?.revokedCount ?? 0) }));
    } catch {
      toast.error(t("allSessionsRevokedError"));
    } finally {
      setRevokingAll(false);
    }
  };

  if (sessions === undefined) {
    return <LoadingState type="table" rows={3} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-primary">{t("sessionsTitle")}</h3>
          <p className="mt-0.5 text-sm text-tertiary">{t("sessionsDescription")}</p>
        </div>
        {sessions.length > 1 && (
          <Button
            color="secondary"
            size="sm"
            onClick={handleRevokeAll}
            isLoading={revokingAll}
          >
            {t("revokeAllSessions")}
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
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("sessionDevice")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("sessionIpAddress")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("sessionLastActive")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("sessionCreated")}</th>
                <th className="pb-3 font-medium text-tertiary" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, index) => (
                <tr
                  key={session._id}
                  className="border-b border-secondary last:border-0"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary">
                        {session.deviceLabel || t("unknownDevice")}
                      </span>
                      {index === 0 && (
                        <Badge size="sm" type="pill-color" color="success">
                          {t("sessionCurrent")}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-tertiary">
                    {session.ipAddress || t("unknownIp")}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-tertiary">
                    {new Date(session.lastActiveAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-tertiary">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    {index > 0 && (
                      <Button
                        color="primary-destructive"
                        size="sm"
                        iconLeading={Trash01}
                        onClick={() => handleRevoke(session._id as Id<"userSessions">)}
                        isLoading={revokingId === session._id}
                      >
                        {t("revokeSession")}
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

// ─── Login History Table ─────────────────────────────────────────────

function LoginHistoryTable() {
  const t = useTranslations("settings");
  const history = useQuery(api.security.getLoginHistory, { limit: 50 });

  if (history === undefined) {
    return <LoadingState type="table" rows={5} />;
  }

  const methodLabel = (method: string) => {
    const labels: Record<string, string> = {
      password: t("loginMethodPassword"),
      google: t("loginMethodGoogle"),
      email_link: t("loginMethodEmailLink"),
      unknown: t("loginMethodUnknown"),
    };
    return labels[method] || method;
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-primary">{t("loginHistoryTitle")}</h3>
        <p className="mt-0.5 text-sm text-tertiary">{t("loginHistoryDescription")}</p>
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
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("loginHistoryDate")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("loginHistoryMethod")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("loginHistoryDevice")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("loginHistoryIp")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("loginHistoryStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={entry._id}
                  className="border-b border-secondary last:border-0"
                >
                  <td className="whitespace-nowrap py-3 pr-4 text-primary">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-tertiary">
                    {methodLabel(entry.method)}
                  </td>
                  <td className="py-3 pr-4 text-tertiary">
                    {entry.deviceLabel || t("unknownDevice")}
                  </td>
                  <td className="py-3 pr-4 text-tertiary">
                    {entry.ipAddress || t("unknownIp")}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge
                      size="sm"
                      type="pill-color"
                      color={entry.success ? "success" : "error"}
                    >
                      {entry.success ? t("loginSuccess") : t("loginFailed")}
                    </Badge>
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

// ─── Combined Session Management Section ─────────────────────────────

export function SessionManagementSection() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <ActiveSessionsList />
      <div className="border-t border-secondary" />
      <LoginHistoryTable />
    </div>
  );
}
