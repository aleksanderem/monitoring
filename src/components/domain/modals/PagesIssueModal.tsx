"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dialog, Modal, ModalOverlay, DialogTrigger } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Button } from "@/components/base/buttons/button";
import { AlertCircle, ArrowUpRight } from "@untitledui/icons";
import { Heading } from "react-aria-components";

interface PagesIssueModalProps {
  scanId: Id<"onSiteScans">;
  isOpen: boolean;
  onClose: () => void;
  issueType: "brokenLinks" | "missingTitles" | "missingMetaDescriptions" | "missingH1" | "slowPages" | "duplicateContent" | "thinContent";
  title: string;
  description: string;
}

const ISSUE_TYPE_CONFIG = {
  brokenLinks: {
    action: api.onSite_actions.getBrokenLinksDetails,
    emptyMessage: "No pages with broken links",
  },
  missingTitles: {
    action: api.onSite_actions.getMissingTitlesDetails,
    emptyMessage: "No pages missing titles",
  },
  missingMetaDescriptions: {
    action: api.onSite_actions.getMissingMetaDescriptionsDetails,
    emptyMessage: "No pages missing meta descriptions",
  },
  missingH1: {
    action: api.onSite_actions.getMissingH1Details,
    emptyMessage: "No pages missing H1 tags",
  },
  slowPages: {
    action: api.onSite_actions.getSlowPagesDetails,
    emptyMessage: "No slow pages detected",
  },
  duplicateContent: {
    action: api.onSite_actions.getDuplicateContentDetails,
    emptyMessage: "No duplicate content detected",
  },
  thinContent: {
    action: api.onSite_actions.getThinContentDetails,
    emptyMessage: "No thin content detected",
  },
};

export function PagesIssueModal({ scanId, isOpen, onClose, issueType, title, description }: PagesIssueModalProps) {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const config = ISSUE_TYPE_CONFIG[issueType];
  const fetchDetails = useAction(config.action);

  const handleOpen = async () => {
    if (loaded) return; // Already loaded

    setLoading(true);
    setError(null);

    try {
      const result = await fetchDetails({ scanId });

      if (result.error) {
        setError(result.error);
      } else {
        setPages(result.pages || []);
        setLoaded(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch page details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => {
      if (open) {
        handleOpen();
      } else {
        onClose();
      }
    }}>
      <ModalOverlay isDismissable>
        <Modal>
          <Dialog className="overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-xl bg-white shadow-xl sm:max-w-3xl">
              <CloseButton
                onClick={onClose}
                theme="light"
                size="lg"
                className="absolute top-3 right-3 z-10"
              />

              {/* Header */}
              <div className="border-b border-gray-200 px-6 py-4">
                <Heading slot="title" className="text-lg font-semibold text-gray-900">
                  {title}
                </Heading>
                <p className="mt-1 text-sm text-gray-600">
                  {description}
                </p>
              </div>

              {/* Content */}
              <div className="max-h-[600px] overflow-y-auto px-6 py-4">
                {loading && (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="mt-4 text-sm text-gray-600">Loading pages...</p>
                  </div>
                )}

                {error && (
                  <div className="text-center py-12">
                    <div className="bg-error-50 rounded-full p-4 mb-4 inline-block">
                      <AlertCircle className="w-8 h-8 text-error-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Error Loading Pages
                    </h3>
                    <p className="text-sm text-gray-600">{error}</p>
                  </div>
                )}

                {!loading && !error && pages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="bg-success-50 rounded-full p-4 mb-4 inline-block">
                      <AlertCircle className="w-8 h-8 text-success-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      {config.emptyMessage}
                    </h3>
                    <p className="text-sm text-gray-600">
                      All pages meet this requirement.
                    </p>
                  </div>
                )}

                {!loading && !error && pages.length > 0 && (
                  <div className="space-y-2">
                    {pages.map((page, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-900 hover:text-primary-600 flex items-center gap-1 group"
                          >
                            <span className="truncate">{page.url}</span>
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </a>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                            {page.meta?.title && (
                              <span className="truncate">Title: {page.meta.title}</span>
                            )}
                            {page.checks?.broken_links !== undefined && page.checks.broken_links > 0 && (
                              <span className="text-error-600 font-medium">{page.checks.broken_links} broken link{page.checks.broken_links > 1 ? 's' : ''}</span>
                            )}
                            {page.page_timing?.time_to_interactive && (
                              <span>{(page.page_timing.time_to_interactive / 1000).toFixed(2)}s load</span>
                            )}
                            {page.content_encoding?.plain_text_word_count !== undefined && (
                              <span>{page.content_encoding.plain_text_word_count} words</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {!loading && !error && pages.length > 0 && (
                <div className="border-t border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Total: {pages.length} pages</span>
                    <Button
                      color="secondary"
                      size="sm"
                      onClick={onClose}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
