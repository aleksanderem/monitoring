"use client";

import { useEffect } from "react";
import { Button } from "@/components/base/buttons/button";
import { AlertCircle } from "@untitledui/icons";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    // Log error to console (could send to logging service)
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>

        <h2 className="mb-2 text-2xl font-bold text-gray-900">
          {t("somethingWentWrong")}
        </h2>

        <p className="mb-6 text-gray-600">
          {error.message || t("unexpectedError")}
        </p>

        <Button onClick={reset}>{t("tryAgain")}</Button>
      </div>
    </div>
  );
}
