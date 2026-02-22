"use client";

import { useTranslations } from "next-intl";

export function OAuthDivider() {
  const t = useTranslations("auth");

  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-sm text-tertiary">{t("orContinueWith")}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}
