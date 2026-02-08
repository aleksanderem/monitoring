"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CheckCircle, XCircle } from "@untitledui/icons";

interface RobotsTestResultsCardProps {
  domainId: Id<"domains">;
}

export function RobotsTestResultsCard({ domainId }: RobotsTestResultsCardProps) {
  const t = useTranslations('onsite');
  const robotsData = useQuery(api.seoAudit_queries.getRobotsTestResults, { domainId });

  const groupedResults = useMemo(() => {
    if (!robotsData?.results) return {};
    const grouped: Record<string, { urlPath: string; canFetch: boolean }[]> = {};
    for (const result of robotsData.results) {
      if (!grouped[result.userAgent]) {
        grouped[result.userAgent] = [];
      }
      grouped[result.userAgent].push({
        urlPath: result.urlPath,
        canFetch: result.canFetch,
      });
    }
    return grouped;
  }, [robotsData]);

  if (!robotsData) return null;

  const userAgents = Object.keys(groupedResults);

  return (
    <div className="space-y-4">
      <div className="text-sm text-tertiary">
        {t('robotsTxtLabel')}: <strong className="text-primary">{robotsData.robotstxtUrl}</strong>
      </div>

      {userAgents.map((ua) => {
        const results = groupedResults[ua];
        const blockedCount = results.filter((r) => !r.canFetch).length;

        return (
          <div key={ua} className="border border-secondary rounded-lg overflow-hidden">
            <div className="bg-secondary px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-primary">{ua}</span>
              <div className="flex items-center gap-3 text-xs text-tertiary">
                <span className="text-success-600">{results.length - blockedCount} {t('allowed')}</span>
                {blockedCount > 0 && (
                  <span className="text-error-600">{blockedCount} {t('blocked')}</span>
                )}
              </div>
            </div>
            <div className="divide-y divide-secondary">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`px-4 py-2 flex items-center justify-between text-sm ${
                    !result.canFetch ? "bg-error-50/30" : ""
                  }`}
                >
                  <span className="text-tertiary truncate max-w-[400px]" title={result.urlPath}>
                    {result.urlPath}
                  </span>
                  {result.canFetch ? (
                    <CheckCircle className="w-4 h-4 text-success-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-error-600 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {userAgents.length === 0 && (
        <div className="text-center py-8 text-sm text-tertiary">
          {t('noRobotsTestResults')}
        </div>
      )}
    </div>
  );
}
