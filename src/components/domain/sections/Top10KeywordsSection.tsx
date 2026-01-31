"use client";

import { TrendUp02 } from "@untitledui/icons";

interface Keyword {
  _id: string;
  phrase: string;
  position: number | null;
  volume: number;
  previousPosition: number | null;
}

interface Top10KeywordsSectionProps {
  keywords: Keyword[];
  isLoading?: boolean;
}

function getPositionColor(position: number): string {
  if (position <= 3) return "bg-utility-success-500";
  if (position <= 10) return "bg-utility-success-400";
  if (position <= 20) return "bg-utility-warning-500";
  return "bg-utility-gray-400";
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function Top10KeywordsSection({ keywords, isLoading }: Top10KeywordsSectionProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-8 text-center">
        <TrendUp02 className="mx-auto h-12 w-12 text-fg-quaternary" />
        <p className="mt-4 text-sm text-tertiary">No top keywords found</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">Top 10 Keywords</h3>
        <p className="text-sm text-tertiary">Best performing keywords by position</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {keywords.slice(0, 10).map((keyword, index) => {
          const change =
            keyword.position && keyword.previousPosition
              ? keyword.previousPosition - keyword.position
              : 0;

          return (
            <div
              key={keyword._id}
              className="group relative overflow-hidden rounded-lg border border-secondary bg-primary p-4 transition-all hover:border-primary hover:shadow-md"
            >
              {/* Rank Badge */}
              <div className="absolute right-2 top-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${getPositionColor(
                    keyword.position || 999
                  )} text-xs font-bold text-white`}
                >
                  {keyword.position || "—"}
                </div>
              </div>

              {/* Keyword Phrase */}
              <div className="pr-10">
                <p className="text-sm font-semibold text-primary line-clamp-2">
                  {keyword.phrase}
                </p>
              </div>

              {/* Stats */}
              <div className="mt-3 flex items-center justify-between">
                {/* Change */}
                {change !== 0 && (
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${
                      change > 0
                        ? "text-utility-success-600"
                        : "text-utility-error-600"
                    }`}
                  >
                    <span>{change > 0 ? "+" : ""}{change}</span>
                  </div>
                )}

                {/* Volume */}
                {keyword.volume && (
                  <div className="text-xs text-tertiary">
                    {formatNumber(keyword.volume)} searches
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
