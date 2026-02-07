"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ArrowRight, AlertTriangle } from "@untitledui/icons";

interface RedirectChainsTableProps {
  domainId: Id<"domains">;
}

function getStatusColor(code: number) {
  if (code >= 200 && code < 300) return "bg-success-50 text-success-700";
  if (code >= 300 && code < 400) return "bg-warning-50 text-warning-700";
  return "bg-error-50 text-error-700";
}

export function RedirectChainsTable({ domainId }: RedirectChainsTableProps) {
  const redirectData = useQuery(api.seoAudit_queries.getRedirectAnalysis, { domainId });

  if (!redirectData) return null;

  const redirects = (redirectData.redirects as any[]) || [];
  const sorted = [...redirects].sort((a, b) => (b.chainLength || 1) - (a.chainLength || 1));

  return (
    <div className="space-y-4">
      <div className="text-sm text-tertiary">
        Total redirect chains: <strong className="text-primary">{redirectData.totalRedirects}</strong>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-secondary">
          <thead className="bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Source URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Final URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">Chain Length</th>
            </tr>
          </thead>
          <tbody className="bg-primary divide-y divide-secondary">
            {sorted.map((redirect: any, i: number) => {
              const chainLength = redirect.chainLength || 1;
              const isLong = chainLength > 2;

              return (
                <tr key={i} className={`hover:bg-primary_hover transition-colors ${isLong ? "bg-warning-50/30" : ""}`}>
                  <td className="px-4 py-3 text-sm text-primary max-w-[300px] truncate" title={redirect.sourceUrl}>
                    {redirect.sourceUrl}
                  </td>
                  <td className="px-4 py-3 text-sm text-primary max-w-[300px] truncate" title={redirect.targetUrl}>
                    {redirect.targetUrl}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(redirect.statusCode || 301)}`}>
                      {redirect.statusCode || 301}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1.5">
                      {isLong && <AlertTriangle className="w-3.5 h-3.5 text-warning-600" />}
                      <span className={isLong ? "text-warning-700 font-medium" : "text-primary"}>
                        {chainLength} {chainLength === 1 ? "hop" : "hops"}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-sm text-tertiary">No redirects found</div>
        )}
      </div>
    </div>
  );
}
