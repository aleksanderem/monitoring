"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AlertTriangle, ArrowUpRight } from "@untitledui/icons";

interface ImageAnalysisTableProps {
  domainId: Id<"domains">;
}

export function ImageAnalysisTable({ domainId }: ImageAnalysisTableProps) {
  const imageData = useQuery(api.seoAudit_queries.getImageAnalysis, { domainId });
  const [missingAltOnly, setMissingAltOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const images = useMemo(() => {
    if (!imageData?.images) return [];
    let items = imageData.images as any[];
    if (missingAltOnly) items = items.filter((img: any) => img.missingAlt);
    return items;
  }, [imageData, missingAltOnly]);

  const totalPages = Math.ceil(images.length / pageSize);
  const paginatedImages = images.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (!imageData) return null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-tertiary">
          <span>Total images: <strong className="text-primary">{imageData.totalImages}</strong></span>
          <span>Missing alt: <strong className={imageData.missingAltCount > 0 ? "text-warning-600" : "text-success-600"}>{imageData.missingAltCount}</strong></span>
        </div>
        <label className="flex items-center gap-2 text-sm text-tertiary cursor-pointer">
          <input
            type="checkbox"
            checked={missingAltOnly}
            onChange={(e) => { setMissingAltOnly(e.target.checked); setCurrentPage(1); }}
            className="rounded"
          />
          Missing alt only
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-secondary">
          <thead className="bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Page URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Image URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Alt Text</th>
            </tr>
          </thead>
          <tbody className="bg-primary divide-y divide-secondary">
            {paginatedImages.map((img: any, i: number) => (
              <tr key={i} className={`hover:bg-primary_hover transition-colors ${img.missingAlt ? "bg-warning-50/30" : ""}`}>
                <td className="px-4 py-3 text-sm text-primary max-w-[250px] truncate" title={img.pageUrl}>
                  {img.pageUrl}
                </td>
                <td className="px-4 py-3 text-sm max-w-[250px]">
                  <a
                    href={img.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline flex items-center gap-1 truncate"
                    title={img.imageUrl}
                  >
                    <span className="truncate">{img.imageUrl}</span>
                    <ArrowUpRight className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </a>
                </td>
                <td className="px-4 py-3 text-sm">
                  {img.missingAlt ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning-50 text-warning-700">
                      <AlertTriangle className="w-3 h-3" />
                      Missing
                    </span>
                  ) : (
                    <span className="text-tertiary max-w-[200px] truncate block" title={img.alt}>
                      {img.alt}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paginatedImages.length === 0 && (
          <div className="text-center py-8 text-sm text-tertiary">No images found</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-tertiary">{images.length} images</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-secondary rounded-lg text-sm disabled:opacity-50 hover:bg-secondary"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-tertiary">{currentPage} / {totalPages}</span>
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
