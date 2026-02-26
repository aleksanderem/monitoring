"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertFloating } from "@/components/application/alerts/alerts";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <AlertFloating
          color="error"
          title={t("somethingWentWrong")}
          description={error.message || t("unexpectedError")}
          confirmLabel={t("tryAgain")}
          onConfirm={reset}
        />
      </div>
    </div>
  );
}
