"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Badge } from "@/components/base/badges/badges";
import { FileSearch02, CheckCircle } from "@untitledui/icons";
import { toast } from "sonner";
import { Heading } from "react-aria-components";
import { useTranslations } from "next-intl";

interface CreateCompetitorReportModalProps {
  domainId: Id<"domains">;
  keywordId: Id<"keywords">;
  keyword: string;
  isOpen: boolean;
  onClose: () => void;
  onReportCreated?: () => void;
}

export function CreateCompetitorReportModal({
  domainId,
  keywordId,
  keyword,
  isOpen,
  onClose,
  onReportCreated,
}: CreateCompetitorReportModalProps) {
  const t = useTranslations("competitors");
  const tc = useTranslations("common");
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Fetch SERP results for this keyword
  const serpResults = useQuery(
    api.keywords.getSerpResultsForKeyword,
    isOpen && keywordId ? { keywordId, limit: 20 } : "skip"
  );

  const createReport = useMutation(api.competitorAnalysisReports.createAnalysisReport);

  const handleToggleCompetitor = (result: any) => {
    const key = `${result.domain}|${result.url}|${result.position}`;
    const newSelected = new Set(selectedCompetitors);

    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      // Limit to 3 competitors max
      if (newSelected.size >= 3) {
        toast.error(t("maxCompetitorsSelected"));
        return;
      }
      newSelected.add(key);
    }

    setSelectedCompetitors(newSelected);
  };

  const handleCreateReport = async () => {
    if (selectedCompetitors.size === 0) {
      toast.error(t("selectAtLeastOneCompetitor"));
      return;
    }

    setIsCreating(true);

    try {
      // Parse selected competitors
      const competitorPages = Array.from(selectedCompetitors).map(key => {
        const [domain, url, position] = key.split('|');
        return { domain, url, position: parseInt(position) };
      });

      // Find user's page if ranking
      const userResult = serpResults?.results.find((r: any) => r.isYourDomain);
      const userPage = userResult ? {
        url: userResult.url,
        position: userResult.position,
      } : undefined;

      // Create report
      await createReport({
        domainId,
        keywordId,
        keyword,
        competitorPages,
        userPage,
      });

      toast.success(t("reportCreatedAnalyzing", { count: selectedCompetitors.size }));
      setSelectedCompetitors(new Set());
      onClose();
      onReportCreated?.();
    } catch (error: any) {
      toast.error(error.message || t("reportCreateFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  const isSelected = (result: any) => {
    const key = `${result.domain}|${result.url}|${result.position}`;
    return selectedCompetitors.has(key);
  };

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onClose} isDismissable style={{ zIndex: 9999 }}>
      <Modal>
        <Dialog className="overflow-hidden">
          <div className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-4xl">
            <CloseButton
              onClick={onClose}
              theme="light"
              size="lg"
              className="absolute top-3 right-3 z-10"
            />

            {/* Header */}
            <div className="border-b border-secondary px-6 py-4">
              <Heading slot="title" className="text-lg font-semibold text-primary">
                {t("createReportTitle")}
              </Heading>
              <p className="mt-1 text-sm text-tertiary">
                {t("createReportForKeyword")}: <span className="font-medium text-primary">{keyword}</span>
              </p>
              <p className="mt-1 text-xs text-tertiary">
                {t("createReportSelectHint")}
              </p>
            </div>

            {/* Content */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {!serpResults ? (
                <div className="text-center py-8 text-tertiary">{t("createReportLoadingSerp")}</div>
              ) : serpResults.results.length === 0 ? (
                <div className="text-center py-12">
                  <FileSearch02 className="h-12 w-12 text-quaternary mx-auto mb-4" />
                  <p className="text-tertiary mb-2">{t("createReportNoSerpResults")}</p>
                  <p className="text-sm text-quaternary">
                    {t("createReportFetchSerpFirst")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {serpResults.results
                    .filter((r: any) => !r.isYourDomain) // Don't show user's own domain
                    .map((result: any, idx: number) => {
                      const selected = isSelected(result);

                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleCompetitor(result)}
                          className={`
                            relative p-4 border rounded-lg cursor-pointer transition-all
                            ${selected
                              ? 'border-brand-primary bg-brand-subtle/20'
                              : 'border-secondary hover:bg-secondary/50'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <div className="flex-shrink-0 pt-1">
                              <div className={`
                                w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                                ${selected
                                  ? 'border-brand-primary bg-brand-primary'
                                  : 'border-utility-gray-300'
                                }
                              `}>
                                {selected && <CheckCircle className="w-4 h-4 text-white" />}
                              </div>
                            </div>

                            {/* Position Badge */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-utility-gray-100 flex items-center justify-center">
                              <span className="text-sm font-semibold text-utility-gray-700">
                                {result.position}
                              </span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-sm font-medium text-primary">
                                  {result.domain}
                                </span>
                                {result.isFeaturedSnippet && (
                                  <Badge color="brand" size="sm">{t("featuredSnippetBadge")}</Badge>
                                )}
                              </div>

                              {result.title && (
                                <p className="text-sm text-primary mb-1 line-clamp-2">
                                  {result.title}
                                </p>
                              )}

                              {result.description && (
                                <p className="text-xs text-tertiary line-clamp-2 mb-1">
                                  {result.description}
                                </p>
                              )}

                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-utility-blue-600 hover:underline break-all"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {result.url}
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
              <div className="text-sm text-tertiary">
                {selectedCompetitors.size > 0 && (
                  <span className="font-medium text-primary">
                    {t("createReportCompetitorsSelected", { count: selectedCompetitors.size })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button color="secondary" size="md" onClick={onClose}>
                  {tc("cancel")}
                </Button>
                <Button
                  color="primary"
                  size="md"
                  onClick={handleCreateReport}
                  isDisabled={selectedCompetitors.size === 0 || isCreating}
                >
                  {isCreating ? t("createReportCreating") : t("createReportButton")}
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
