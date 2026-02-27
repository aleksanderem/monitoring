"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { GoogleIcon } from "@/components/shared/GoogleIcon";
import { Badge } from "@/components/base/badges/badges";

interface GscOnboardingStepProps {
  organizationId: Id<"organizations">;
  onComplete: () => void;
  onSkip: () => void;
}

export function GscOnboardingStep({ organizationId, onComplete, onSkip }: GscOnboardingStepProps) {
  const t = useTranslations("onboarding");
  const connection = useQuery(api.gsc.getGscConnection, { organizationId });
  const initiate = useMutation(api.gsc.initiateGscConnection);
  const exchangeCode = useAction(api.actions.gscSync.exchangeGscCode);
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

  // Once connected, auto-proceed after a brief delay so user sees the success state
  const isConnected = connection != null && connection !== undefined;
  useEffect(() => {
    if (isConnected) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, onComplete]);

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-utility-success-50 dark:bg-utility-success-950">
        <GoogleIcon />
      </div>

      <h2 className="text-xl font-semibold text-primary mb-2">
        {t("gscConnect.heading")}
      </h2>
      <p className="text-sm text-tertiary mb-6">
        {t("gscConnect.description")}
      </p>

      {isConnected ? (
        <div className="flex flex-col items-center gap-3">
          <Badge color="success" size="md">
            {t("gscConnect.connected")}
          </Badge>
          <p className="text-sm text-tertiary">{t("gscConnect.syncing")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            className="w-full"
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
            {isConnecting ? t("gscConnect.connecting") : t("gscConnect.cta")}
          </Button>

          <button
            className="text-sm text-tertiary hover:text-secondary transition-colors"
            onClick={onSkip}
          >
            {t("gscConnect.skipForNow")}
          </button>
        </div>
      )}

      <div className="mt-6 rounded-lg bg-secondary p-4 text-left">
        <p className="text-xs text-tertiary leading-relaxed">
          {t("gscConnect.whyConnect")}
        </p>
      </div>
    </div>
  );
}
