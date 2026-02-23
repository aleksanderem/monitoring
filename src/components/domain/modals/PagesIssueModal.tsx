"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ArrowUpRight, AlertCircle, CheckCircle, AlertTriangle } from "@untitledui/icons";
import { DialogTrigger, ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { Heading as AriaHeading } from "react-aria-components";

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

  const pages = useQuery(
    api.seoAudit_queries.getPagesWithFailedCheck,
    isOpen ? { scanId, checkCategory: checkType } : "skip"
  );

  const loading = pages === undefined;

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalOverlay isDismissable>
        <Modal className="max-w-4xl">
          <Dialog>
            <div className="relative w-full overflow-hidden rounded-2xl bg-primary shadow-xl sm:max-w-4xl">
              <CloseButton onPress={onClose} theme="light" size="lg" className="absolute top-3 right-3 z-10" />

              {/* Header */}
              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max">
                  <FeaturedIcon color="error" size="lg" theme="light" icon={AlertTriangle} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">{title}</AriaHeading>
                  <p className="text-sm text-tertiary">{description}</p>
                </div>
              </div>

              {/* Content */}
              <div className="max-h-[70vh] overflow-y-auto px-4 pt-4 sm:px-6">
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
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
