"use client";

import { useTranslations } from "next-intl";
import { SearchLg } from "@untitledui/icons";
import { DialogTrigger, ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { Heading as AriaHeading } from "react-aria-components";
import { KeywordDetailCard } from "../cards/KeywordDetailCard";
import { MonthlySearchTrendChart } from "../charts/MonthlySearchTrendChart";

interface KeywordDetailModalProps {
  keyword: any;
  isOpen: boolean;
  onClose: () => void;
}

export function KeywordDetailModal({ keyword, isOpen, onClose }: KeywordDetailModalProps) {
  const t = useTranslations('keywords');
  const tc = useTranslations('common');

  if (!keyword) return null;

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
                  <FeaturedIcon color="brand" size="lg" theme="light" icon={SearchLg} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">
                    {keyword.keyword}
                  </AriaHeading>
                  <div className="flex items-center gap-3">
                    {keyword.bestPosition !== null && keyword.bestPosition !== 999 && (
                      <span className="inline-flex items-center rounded-full bg-utility-success-50 px-3 py-1 text-sm font-medium text-utility-success-700">
                        {t('positionHash', { position: keyword.bestPosition })}
                      </span>
                    )}
                    {keyword.searchVolume && (
                      <span className="text-sm text-tertiary">
                        {t('monthlySearches', { count: keyword.searchVolume.toLocaleString() })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Content - scrollable */}
              <div className="max-h-[70vh] overflow-y-auto px-4 pt-4 sm:px-6 pb-6">
                <div className="space-y-6">
                  {/* Monthly Search Trend Chart */}
                  {keyword.monthlySearches && keyword.monthlySearches.length > 0 && (
                    <div>
                      <h3 className="text-base font-semibold text-primary mb-4">{t('searchVolumeTrend')}</h3>
                      <MonthlySearchTrendChart monthlySearches={keyword.monthlySearches} />
                    </div>
                  )}

                  {/* Keyword Detail Cards */}
                  <div>
                    <h3 className="text-base font-semibold text-primary mb-4">{t('keywordMetrics')}</h3>
                    <KeywordDetailCard keyword={keyword} />
                  </div>

                  {/* URL if available */}
                  {keyword.url && (
                    <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                      <p className="text-xs font-medium text-tertiary mb-1">{t('rankingUrl')}</p>
                      <a
                        href={keyword.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-utility-blue-600 hover:text-utility-blue-700 hover:underline break-all"
                      >
                        {keyword.url}
                      </a>
                    </div>
                  )}

                  {/* SERP Title & Description */}
                  {(keyword.title || keyword.description) && (
                    <div className="rounded-lg border border-secondary bg-secondary/30 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-primary">{t('serpPreview')}</h4>
                      {keyword.title && (
                        <div>
                          <p className="text-xs font-medium text-tertiary mb-1">{t('serpTitle')}</p>
                          <p className="text-sm text-primary">{keyword.title}</p>
                        </div>
                      )}
                      {keyword.description && (
                        <div>
                          <p className="text-xs font-medium text-tertiary mb-1">{tc('description')}</p>
                          <p className="text-sm text-tertiary">{keyword.description}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
