"use client";

import { useState } from "react";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Link01, ChevronLeft, ChevronRight, AlertCircle } from "@untitledui/icons";

interface Backlink {
  _id: string;
  domainFrom?: string; // Optional for backwards compatibility
  urlFrom: string;
  urlTo: string;
  anchor?: string;
  dofollow?: boolean; // Optional for backwards compatibility
  rank?: number;
  domainFromRank?: number;
  backlink_spam_score?: number;
  itemType?: string;
  firstSeen?: string;
  lastSeen?: string;
  domainFromCountry?: string;
  tldFrom?: string;
}

interface BacklinksTableProps {
  backlinks: {
    total: number;
    items: Backlink[];
    stats: {
      totalDofollow: number;
      totalNofollow: number;
      avgRank: number;
      avgSpamScore: number;
    };
  } | null;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  pageSize?: number;
}

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSpamScoreBadge(score?: number) {
  if (score === undefined || score === null) return { color: "gray" as const, label: "—" };
  if (score === 0) return { color: "success" as const, label: "Clean" };
  if (score < 10) return { color: "success" as const, label: `${score}%` };
  if (score < 30) return { color: "warning" as const, label: `${score}%` };
  return { color: "error" as const, label: `${score}%` };
}

export function BacklinksTable({
  backlinks,
  isLoading,
  onPageChange,
  currentPage = 1,
  pageSize = 50,
}: BacklinksTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
          <div className="mt-1 h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (!backlinks || backlinks.total === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">Individual Backlinks</h3>
          <p className="text-sm text-tertiary">Detailed list of referring links</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Link01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">No backlinks data available</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(backlinks.total / pageSize);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-semibold text-primary">Individual Backlinks</h3>
          <p className="text-sm text-tertiary">
            Showing {backlinks.items.length} of {backlinks.total.toLocaleString()} backlinks
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-xs text-tertiary">Dofollow</p>
            <p className="text-sm font-semibold text-success-600">
              {backlinks.stats.totalDofollow}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-tertiary">Avg Spam</p>
            <p className="text-sm font-semibold text-primary">
              {backlinks.stats.avgSpamScore.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary-subtle">
            <tr className="border-b border-secondary">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-secondary">
                Referring Domain
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-secondary">
                Anchor Text
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-secondary">
                Type
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-secondary">
                Link Type
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-secondary">
                Rank
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-secondary">
                Spam Score
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-secondary">
                Last Seen
              </th>
            </tr>
          </thead>
          <tbody>
            {backlinks.items.map((backlink, index) => {
              const spamBadge = getSpamScoreBadge(backlink.backlink_spam_score);

              return (
                <tr
                  key={backlink._id}
                  className={`border-b border-secondary ${
                    index % 2 === 0 ? "bg-primary" : "bg-secondary-subtle"
                  } hover:bg-secondary-subtle`}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <a
                        href={backlink.urlFrom}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        {backlink.domainFrom || new URL(backlink.urlFrom).hostname}
                      </a>
                      {backlink.tldFrom && (
                        <span className="text-xs text-tertiary">.{backlink.tldFrom}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-xs truncate text-sm text-secondary" title={backlink.anchor}>
                      {backlink.anchor || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge size="sm" color={backlink.dofollow === true ? "success" : "gray"}>
                      {backlink.dofollow === true ? "Dofollow" : "Nofollow"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm capitalize text-secondary">
                      {backlink.itemType || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-primary">
                      {backlink.rank?.toLocaleString() || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge size="sm" color={spamBadge.color}>
                      {spamBadge.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-secondary">
                      {formatDate(backlink.lastSeen)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-secondary pt-4">
          <p className="text-sm text-secondary">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              color="secondary"
              iconLeading={ChevronLeft}
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              size="sm"
              color="secondary"
              iconTrailing={ChevronRight}
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
