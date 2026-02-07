"use client";

import { XClose } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { KeywordDetailCard } from "../cards/KeywordDetailCard";
import { MonthlySearchTrendChart } from "../charts/MonthlySearchTrendChart";
import { useEscapeClose } from "@/hooks/useEscapeClose";

interface KeywordDetailModalProps {
  keyword: any;
  isOpen: boolean;
  onClose: () => void;
}

export function KeywordDetailModal({ keyword, isOpen, onClose }: KeywordDetailModalProps) {
  useEscapeClose(onClose, isOpen);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="rounded-xl border border-secondary bg-primary shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-secondary p-6">
            <div>
              <h2 className="text-xl font-semibold text-primary">{keyword.keyword}</h2>
              <div className="flex items-center gap-3 mt-2">
                {keyword.bestPosition !== null && keyword.bestPosition !== 999 && (
                  <span className="inline-flex items-center rounded-full bg-utility-success-50 px-3 py-1 text-sm font-medium text-utility-success-700">
                    Position #{keyword.bestPosition}
                  </span>
                )}
                {keyword.searchVolume && (
                  <span className="text-sm text-tertiary">
                    {keyword.searchVolume.toLocaleString()} monthly searches
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              color="secondary"
              iconLeading={XClose}
              onClick={onClose}
            >
              Close
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Monthly Search Trend Chart */}
            {keyword.monthlySearches && keyword.monthlySearches.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-primary mb-4">Search Volume Trend</h3>
                <MonthlySearchTrendChart monthlySearches={keyword.monthlySearches} />
              </div>
            )}

            {/* Keyword Detail Cards */}
            <div>
              <h3 className="text-base font-semibold text-primary mb-4">Keyword Metrics</h3>
              <KeywordDetailCard keyword={keyword} />
            </div>

            {/* URL if available */}
            {keyword.url && (
              <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                <p className="text-xs font-medium text-tertiary mb-1">Ranking URL</p>
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
                <h4 className="text-sm font-semibold text-primary">SERP Preview</h4>
                {keyword.title && (
                  <div>
                    <p className="text-xs font-medium text-tertiary mb-1">Title</p>
                    <p className="text-sm text-primary">{keyword.title}</p>
                  </div>
                )}
                {keyword.description && (
                  <div>
                    <p className="text-xs font-medium text-tertiary mb-1">Description</p>
                    <p className="text-sm text-tertiary">{keyword.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
