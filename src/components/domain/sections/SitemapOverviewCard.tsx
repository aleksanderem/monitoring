"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { File01, ChevronDown, ChevronUp } from "@untitledui/icons";
import { useState } from "react";

interface SitemapOverviewCardProps {
  domainId: Id<"domains">;
}

export function SitemapOverviewCard({ domainId }: SitemapOverviewCardProps) {
  const t = useTranslations('onsite');
  const sitemapData = useQuery(api.seoAudit_queries.getSitemapData, {
    domainId,
  });
  const [expanded, setExpanded] = useState(false);

  if (!sitemapData) {
    return (
      <div className="bg-primary rounded-lg border border-secondary p-6">
        <div className="flex items-center gap-2 mb-2">
          <File01 className="w-4 h-4 text-tertiary" />
          <h3 className="text-sm font-medium text-tertiary">{t('sitemap')}</h3>
        </div>
        <p className="text-sm text-quaternary">
          {t('noSitemapData')}
        </p>
      </div>
    );
  }

  const urls = sitemapData.urls || [];
  const previewUrls = expanded ? urls : urls.slice(0, 5);

  return (
    <div className="bg-primary rounded-lg border border-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <File01 className="w-4 h-4 text-tertiary" />
          <h3 className="text-sm font-medium text-tertiary">{t('sitemap')}</h3>
        </div>
        <span className="text-xs text-quaternary">
          {t('fetched')} {new Date(sitemapData.fetchedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-primary">
            {sitemapData.totalUrls}
          </span>
          <span className="text-sm text-tertiary">{t('urlsFound')}</span>
        </div>

        <div className="text-xs text-quaternary truncate" title={sitemapData.sitemapUrl}>
          {t('source')}: {sitemapData.sitemapUrl}
        </div>

        {urls.length > 0 && (
          <div className="pt-3 border-t border-secondary">
            <div className="space-y-1">
              {previewUrls.map((url, i) => (
                <div
                  key={i}
                  className="text-xs text-tertiary truncate"
                  title={url}
                >
                  {url}
                </div>
              ))}
            </div>

            {urls.length > 5 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    {t('showLess')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    {t('showAllUrls', { count: urls.length })}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
