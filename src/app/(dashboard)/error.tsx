"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { AlertFloating } from "@/components/application/alerts/alerts";

const BACKOFF_BASE_MS = 1000;
const MAX_AUTO_RETRIES = 3;

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const doRetry = useCallback(() => {
    setCountdown(null);
    setRetryCount((c) => c + 1);
    reset();
  }, [reset]);

  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  useEffect(() => {
    if (retryCount >= MAX_AUTO_RETRIES) return;

    const delayMs = BACKOFF_BASE_MS * Math.pow(2, retryCount);
    const seconds = Math.ceil(delayMs / 1000);
    setCountdown(seconds);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      doRetry();
    }, delayMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [retryCount, doRetry]);

  const description = (
    <>
      {error.message || t("errorDescription")}
      {countdown !== null && retryCount < MAX_AUTO_RETRIES && (
        <span className="ml-1 text-tertiary">
          — {t("retrying", { seconds: countdown })}
        </span>
      )}
    </>
  );

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md">
        <AlertFloating
          color="error"
          title={t("errorTitle")}
          description={description}
          confirmLabel={countdown !== null ? t("retryNow") : t("tryAgain")}
          onConfirm={doRetry}
        />
      </div>
    </div>
  );
}
