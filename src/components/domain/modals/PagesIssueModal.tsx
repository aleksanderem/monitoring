"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { XClose, ArrowUpRight, AlertCircle, CheckCircle } from "@untitledui/icons";
import { useEscapeClose } from "@/hooks/useEscapeClose";

interface PagesIssueModalProps {
  scanId: Id<"onSiteScans">;
  isOpen: boolean;
  onClose: () => void;
  checkType: string;
  title: string;
  description: string;
}

export function PagesIssueModal({
  scanId,
  isOpen,
  onClose,
  checkType,
  title,
  description,
}: PagesIssueModalProps) {
  const t = useTranslations('onsite');
  useEscapeClose(onClose, isOpen);

  const pages = useQuery(
    api.seoAudit_queries.getPagesWithFailedCheck,
    isOpen ? { scanId, checkCategory: checkType } : "skip"
  );

  if (!isOpen) return null;

  const loading = pages === undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[5vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-secondary px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-primary">{title}</h2>
            <p className="mt-0.5 text-sm text-tertiary">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-quaternary hover:bg-secondary hover:text-fg-primary"
          >
            <XClose className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
              <p className="mt-4 text-sm text-tertiary">{t('loadingPages')}</p>
            </div>
          )}

          {!loading && pages.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-success-50 rounded-full p-4 mb-4 inline-block">
                <CheckCircle className="w-8 h-8 text-success-600" />
              </div>
              <h3 className="text-sm font-semibold text-primary mb-2">
                {t('allPagesPass')}
              </h3>
              <p className="text-sm text-tertiary">
                {t('noPagesFailingCheck', { title })}
              </p>
            </div>
          )}

          {!loading && pages.length > 0 && (
            <div className="space-y-2">
              {pages.map((page) => {
                // Find the specific failing check details
                const checks = page.checks as any[] | undefined;
                const failedCheck = Array.isArray(checks)
                  ? checks.find(
                      (c: any) => c.check === checkType && !c.passed
                    )
                  : null;

                return (
                  <div
                    key={page._id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-secondary hover:bg-secondary/30 transition-colors"
                  >
                    <div className="bg-error-50 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-error-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:text-brand-primary flex items-center gap-1 group"
                      >
                        <span className="truncate">{page.url}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </a>
                      {failedCheck?.result && (
                        <p className="text-xs text-tertiary mt-0.5 truncate">
                          {failedCheck.result}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-quaternary">
                        {page.onpageScore !== undefined && (
                          <span>{t('score')}: {page.onpageScore}/100</span>
                        )}
                        <span>
                          {t('issueCount', { count: page.issueCount })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && pages && pages.length > 0 && (
          <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
            <span className="text-sm text-tertiary">
              {t('pagesAffected', { count: pages.length })}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg border border-secondary px-3 py-1.5 text-sm font-medium text-secondary hover:bg-secondary"
            >
              {t('close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
