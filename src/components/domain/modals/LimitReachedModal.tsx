"use client";

import { useTranslations } from "next-intl";
import { Modal } from "@/components/base/modal/modal";
import { Button } from "@/components/base/buttons/button";
import type { LimitError } from "@/lib/limitErrors";
import { AlertCircle } from "@untitledui/icons";

interface LimitReachedModalProps {
  limitError: LimitError | null;
  onClose: () => void;
}

export function LimitReachedModal({ limitError, onClose }: LimitReachedModalProps) {
  const t = useTranslations("keywords");

  if (!limitError) return null;

  const { title, description } = getLimitContent(limitError, t);

  return (
    <Modal
      isOpen={!!limitError}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <Button size="sm" color="secondary" onClick={onClose}>
          OK
        </Button>
      }
    >
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-utility-warning-500 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm text-primary">{description}</p>
          {limitError.type === "cooldown" && limitError.waitMinutes && (
            <p className="text-sm text-tertiary">
              {t("limitReachedCooldownDetail", { minutes: limitError.waitMinutes })}
            </p>
          )}
          {(limitError.type === "org_daily" ||
            limitError.type === "user_daily" ||
            limitError.type === "project_daily" ||
            limitError.type === "domain_daily") && (
            <p className="text-sm text-tertiary">{t("limitReachedDailyDetail")}</p>
          )}
          {limitError.type === "bulk_cap" && (
            <p className="text-sm text-tertiary">{t("limitReachedBulkCapDetail")}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function getLimitContent(
  error: LimitError,
  t: ReturnType<typeof useTranslations<"keywords">>
): { title: string; description: string } {
  const title = t("limitReachedTitle");

  switch (error.type) {
    case "cooldown":
      return { title, description: t("limitReachedCooldown") };
    case "org_daily":
      return { title, description: t("limitReachedDailyOrg") };
    case "user_daily":
      return { title, description: t("limitReachedDailyUser") };
    case "project_daily":
      return { title, description: t("limitReachedDailyProject") };
    case "domain_daily":
      return { title, description: t("limitReachedDailyDomain") };
    case "bulk_cap":
      return { title, description: t("limitReachedBulkCap") };
    default:
      return { title, description: t("limitReachedDailyOrg") };
  }
}
