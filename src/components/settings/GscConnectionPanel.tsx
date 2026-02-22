"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";

interface GscConnectionPanelProps {
  organizationId: Id<"organizations">;
}

export function GscConnectionPanel({ organizationId }: GscConnectionPanelProps) {
  const t = useTranslations("settings");
  const connection = useQuery(api.gsc.getGscConnection, { organizationId });
  const initiate = useMutation(api.gsc.initiateGscConnection);
  const disconnect = useMutation(api.gsc.disconnectGsc);

  // Loading state
  if (connection === undefined) {
    return <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
  }

  // Not connected
  if (!connection) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-2">{t("gscTitle")}</h3>
        <p className="text-sm text-gray-500 mb-4">{t("gscDescription")}</p>
        <button
          onClick={async () => {
            const result = await initiate({ organizationId });
            if (result?.authUrl) {
              window.open(result.authUrl, "_blank", "width=600,height=700");
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t("gscConnect")}
        </button>
      </div>
    );
  }

  // Connected
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{t("gscTitle")}</h3>
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          {t("gscConnected")}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-2">{connection.googleEmail}</p>
      {connection.lastSyncAt && (
        <p className="text-xs text-gray-400 mb-4">
          {t("gscLastSync")}: {new Date(connection.lastSyncAt).toLocaleString()}
        </p>
      )}

      <button
        onClick={() => disconnect({ organizationId })}
        className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        {t("gscDisconnect")}
      </button>
    </div>
  );
}
