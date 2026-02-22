"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, RefreshCw05 } from "@untitledui/icons";
import { useTranslations } from "next-intl";

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

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        role="alert"
        className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-utility-error-200 bg-utility-error-50 p-8 text-center dark:border-utility-error-700 dark:bg-utility-error-950"
      >
        <AlertTriangle className="h-10 w-10 text-utility-error-600" />
        <div>
          <h2 className="text-base font-semibold text-utility-error-700 dark:text-utility-error-300">
            {t("errorTitle")}
          </h2>
          <p className="mt-1 text-sm text-utility-error-600 dark:text-utility-error-400">
            {error.message || t("errorDescription")}
          </p>
          {countdown !== null && retryCount < MAX_AUTO_RETRIES && (
            <p className="mt-2 text-xs text-utility-error-500 dark:text-utility-error-400">
              {t("retrying", { seconds: countdown })}
            </p>
          )}
        </div>
        <button
          onClick={doRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-utility-error-300 bg-white px-4 py-2 text-sm font-medium text-utility-error-700 transition-colors hover:bg-utility-error-50 dark:border-utility-error-600 dark:bg-utility-error-900 dark:text-utility-error-300 dark:hover:bg-utility-error-800"
        >
          <RefreshCw05 className="h-4 w-4" />
          {countdown !== null ? t("retryNow") : t("tryAgain")}
        </button>
      </div>
    </div>
  );
}
