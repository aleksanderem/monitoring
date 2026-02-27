"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { Globe01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { GoogleIcon } from "@/components/shared/GoogleIcon";

interface GscConnectionPanelProps {
  organizationId: Id<"organizations">;
}

export function GscConnectionPanel({ organizationId }: GscConnectionPanelProps) {
  const t = useTranslations("settings");
  const connection = useQuery(api.gsc.getGscConnection, { organizationId });
  const initiate = useMutation(api.gsc.initiateGscConnection);
  const disconnect = useMutation(api.gsc.disconnectGsc);
  const exchangeCode = useAction(api.actions.gscSync.exchangeGscCode);
  const triggerSync = useAction(api.actions.gscSync.triggerGscSync);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Listen for OAuth callback from popup window
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "gsc-callback") return;

      const { code, state } = event.data;
      if (!code || !state) return;

      setIsConnecting(true);
      try {
        const stateData = JSON.parse(atob(state));
        const redirectUri = `${window.location.origin}/auth/gsc-callback`;

        await exchangeCode({
          organizationId: stateData.organizationId,
          code,
          redirectUri,
        });
      } catch (err) {
        console.error("GSC exchange failed:", err);
      } finally {
        setIsConnecting(false);
      }
    },
    [exchangeCode]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Loading state
  if (connection === undefined) {
    return <div className="animate-pulse h-32 rounded-lg bg-primary" />;
  }

  // Not connected
  if (!connection) {
    return (
      <div className="rounded-lg border border-secondary p-5">
        <div className="mb-1 flex items-center gap-2">
          <GoogleIcon />
          <h3 className="font-medium text-primary">{t("gscTitle")}</h3>
        </div>
        <p className="mb-3 text-sm text-tertiary">{t("gscDescription")}</p>
        <Button
          size="sm"
          onClick={async () => {
            const result = await initiate({ organizationId });
            if (result?.authUrl) {
              const popup = window.open(result.authUrl, "gsc-auth", "width=600,height=700");
              if (!popup) {
                window.location.href = result.authUrl;
              }
            }
          }}
          disabled={isConnecting}
        >
          {isConnecting ? t("gscConnecting") : t("gscConnect")}
        </Button>
      </div>
    );
  }

  // Connected
  return (
    <div className="rounded-lg border border-secondary p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GoogleIcon />
          <h3 className="font-medium text-primary">{t("gscTitle")}</h3>
        </div>
        <Badge color="success" size="sm">
          {t("gscConnected")}
        </Badge>
      </div>

      <p className="text-sm text-tertiary">{connection.googleEmail}</p>
      {connection.lastSyncAt && (
        <p className="mt-1 text-xs text-quaternary">
          {t("gscLastSync")}: {new Date(connection.lastSyncAt).toLocaleString()}
        </p>
      )}

      {/* Properties list */}
      {connection.properties && connection.properties.length > 0 && (
        <div className="mt-4 divide-y divide-secondary rounded-lg border border-secondary">
          {connection.properties.map((prop) => {
            const isDomain = prop.url.startsWith("sc-domain:");
            const displayUrl = isDomain ? prop.url.replace("sc-domain:", "") : prop.url;

            return (
              <div key={prop.url} className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-secondary bg-secondary">
                  <Globe01 className="size-4 text-tertiary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{displayUrl}</p>
                </div>
                <Badge color={isDomain ? "blue" : "gray"} size="sm">
                  {isDomain ? "Domain" : "URL prefix"}
                </Badge>
                <Badge color={prop.type === "siteOwner" ? "success" : "warning"} size="sm">
                  {prop.type === "siteOwner" ? "Owner" : "Unverified"}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          color="secondary"
          onClick={async () => {
            setIsSyncing(true);
            try {
              await triggerSync({ organizationId });
            } catch (err) {
              console.error("GSC sync failed:", err);
            } finally {
              setIsSyncing(false);
            }
          }}
          disabled={isSyncing}
        >
          {isSyncing ? t("gscSyncing") : t("gscSyncNow")}
        </Button>
        <Button
          size="sm"
          color="secondary-destructive"
          onClick={() => disconnect({ organizationId })}
        >
          {t("gscDisconnect")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-quaternary">
        {t("gscHistoricalNote")}
      </p>
    </div>
  );
}
