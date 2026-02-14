"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { Button } from "@/components/base/buttons/button";
import { Modal } from "@/components/base/modal/modal";
import { CheckCircle, AlertCircle, Loading02 } from "@untitledui/icons";

interface RefreshConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  domainId: Id<"domains">;
  actionType: "refresh" | "serp";
  keywordCount: number;
}

export function RefreshConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  domainId,
  actionType,
  keywordCount,
}: RefreshConfirmModalProps) {
  const t = useTranslations("keywords");
  const tc = useTranslations("common");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = useQuery(
    api.limits.getRefreshLimitStatus,
    isOpen ? { domainId, keywordCount } : "skip"
  );

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // errors handled by caller via toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = actionType === "refresh" ? t("refreshConfirmTitle") : t("serpConfirmTitle");
  const estimatedCost = (keywordCount * 0.003).toFixed(2);
  const description =
    actionType === "refresh"
      ? t("refreshConfirmDescription", { count: keywordCount })
      : t("serpConfirmDescription", { count: keywordCount });

  const hasAnyLimit =
    status && (status.cooldown || status.orgDaily || status.userDaily || status.projectDaily || status.domainDaily || status.bulkCap);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button size="sm" color="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          {status?.canRefresh !== false && (
            <Button
              size="sm"
              color="primary"
              onClick={handleConfirm}
              disabled={isSubmitting || !status}
            >
              {isSubmitting ? tc("loading") : t("confirmRefresh")}
            </Button>
          )}
        </>
      }
    >
      {!status ? (
        <div className="flex items-center justify-center py-6">
          <Loading02 className="h-5 w-5 animate-spin text-tertiary" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-utility-brand-200 bg-utility-brand-50 px-3 py-2">
            <p className="text-sm text-utility-brand-700">
              {t("refreshCostEstimate", { count: keywordCount, cost: estimatedCost })}
            </p>
          </div>

          <p className="text-xs font-medium text-tertiary uppercase tracking-wide">
            {t("limitStatus")}
          </p>

          {!hasAnyLimit ? (
            <p className="text-sm text-tertiary">{t("noLimitsConfigured")}</p>
          ) : (
            <div className="space-y-2">
              {status.cooldown && (
                <LimitRow
                  label={t("limitCooldown")}
                  blocked={status.cooldown.blocked}
                  detail={
                    status.cooldown.blocked && status.cooldown.canRefreshAt
                      ? t("limitCooldownWait", {
                          time: new Date(status.cooldown.canRefreshAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                        })
                      : t("limitCooldownReady")
                  }
                />
              )}
              {status.orgDaily && (
                <LimitRow
                  label={t("limitOrgDaily")}
                  blocked={status.orgDaily.blocked}
                  detail={t("limitUsage", {
                    used: status.orgDaily.used,
                    limit: status.orgDaily.limit ?? 0,
                  })}
                />
              )}
              {status.userDaily && (
                <LimitRow
                  label={t("limitUserDaily")}
                  blocked={status.userDaily.blocked}
                  detail={t("limitUsage", {
                    used: status.userDaily.used,
                    limit: status.userDaily.limit ?? 0,
                  })}
                />
              )}
              {status.projectDaily && (
                <LimitRow
                  label={t("limitProjectDaily")}
                  blocked={status.projectDaily.blocked}
                  detail={t("limitUsage", {
                    used: status.projectDaily.used,
                    limit: status.projectDaily.limit ?? 0,
                  })}
                />
              )}
              {status.domainDaily && (
                <LimitRow
                  label={t("limitDomainDaily")}
                  blocked={status.domainDaily.blocked}
                  detail={t("limitUsage", {
                    used: status.domainDaily.used,
                    limit: status.domainDaily.limit ?? 0,
                  })}
                />
              )}
              {status.bulkCap && (
                <LimitRow
                  label={t("limitBulkCap")}
                  blocked={status.bulkCap.blocked}
                  detail={
                    status.bulkCap.blocked
                      ? t("limitBulkCapExceeded", {
                          limit: status.bulkCap.limit ?? 0,
                          count: status.bulkCap.count,
                        })
                      : t("limitUsage", {
                          used: status.bulkCap.count,
                          limit: status.bulkCap.limit ?? 0,
                        })
                  }
                />
              )}
            </div>
          )}

          {status.canRefresh === false && (
            <div className="rounded-lg border border-utility-error-200 bg-utility-error-50 px-3 py-2">
              <p className="text-sm font-medium text-utility-error-700">
                {t("cannotRefresh")}
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function LimitRow({
  label,
  blocked,
  detail,
}: {
  label: string;
  blocked: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-secondary px-3 py-2">
      <div className="flex items-center gap-2">
        {blocked ? (
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-utility-error-500" />
        ) : (
          <CheckCircle className="h-4 w-4 flex-shrink-0 text-utility-success-500" />
        )}
        <span className="text-sm text-primary">{label}</span>
      </div>
      <span
        className={`text-sm font-medium ${
          blocked ? "text-utility-error-600" : "text-utility-success-600"
        }`}
      >
        {detail}
      </span>
    </div>
  );
}
