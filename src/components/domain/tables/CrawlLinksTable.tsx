"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ArrowUpRight } from "@untitledui/icons";

interface CrawlLinksTableProps {
  domainId: Id<"domains">;
}

export function CrawlLinksTable({ domainId }: CrawlLinksTableProps) {
  const linkData = useQuery(api.seoAudit_queries.getLinkAnalysis, { domainId });
  const [filter, setFilter] = useState<"all" | "internal" | "external">("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const links = useMemo(() => {
    if (!linkData?.links) return [];
    let items = linkData.links as any[];
    if (filter === "internal") items = items.filter((l: any) => l.internal);
    if (filter === "external") items = items.filter((l: any) => !l.internal);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (l: any) =>
          l.sourceUrl?.toLowerCase().includes(q) ||
          l.targetUrl?.toLowerCase().includes(q) ||
          l.anchorText?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [linkData, filter, search]);

  const totalPages = Math.ceil(links.length / pageSize);
  const paginatedLinks = links.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (!linkData) return null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-tertiary">
        <span>Total: <strong className="text-primary">{linkData.totalLinks.toLocaleString()}</strong></span>
        <span>Internal: <strong className="text-brand-600">{linkData.internalLinks.toLocaleString()}</strong></span>
        <span>External: <strong className="text-primary">{linkData.externalLinks.toLocaleString()}</strong></span>
        <span>Nofollow: <strong className="text-warning-600">{linkData.nofollowLinks.toLocaleString()}</strong></span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search URLs or anchor text..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="flex-1 min-w-[200px] px-3 py-2 border border-secondary rounded-lg text-sm"
        />
        <div className="flex gap-1">
          {(["all", "internal", "external"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setCurrentPage(1); }}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                filter === f
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-tertiary hover:bg-secondary"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-secondary">
          <thead className="bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Source URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Target URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Anchor Text</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Type</th>
            </tr>
          </thead>
          <tbody className="bg-primary divide-y divide-secondary">
            {paginatedLinks.map((link: any, i: number) => (
              <tr key={i} className="hover:bg-primary_hover transition-colors">
                <td className="px-4 py-3 text-sm text-primary max-w-[250px] truncate" title={link.sourceUrl}>
                  {link.sourceUrl}
                </td>
                <td className="px-4 py-3 text-sm max-w-[250px]">
                  <a
                    href={link.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline flex items-center gap-1 truncate"
                    title={link.targetUrl}
                  >
                    <span className="truncate">{link.targetUrl}</span>
                    <ArrowUpRight className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-tertiary max-w-[180px] truncate" title={link.anchorText}>
                  {link.anchorText || "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      link.internal ? "bg-brand-50 text-brand-700" : "bg-primary-50 text-primary-700"
                    }`}>
                      {link.internal ? "Internal" : "External"}
                    </span>
                    {link.nofollow && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning-50 text-warning-700">
                        Nofollow
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paginatedLinks.length === 0 && (
          <div className="text-center py-8 text-sm text-tertiary">No links found</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-tertiary">
            {links.length.toLocaleString()} links
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-secondary rounded-lg text-sm disabled:opacity-50 hover:bg-secondary"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-tertiary">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-secondary rounded-lg text-sm disabled:opacity-50 hover:bg-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
