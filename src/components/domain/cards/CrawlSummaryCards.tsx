"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Globe01,
  File01,
  Speedometer01,
  Link01,
  LinkExternal01,
  ArrowsRight,
  Image01,
} from "@untitledui/icons";

interface CrawlSummaryCardsProps {
  domainId: Id<"domains">;
}

export function CrawlSummaryCards({ domainId }: CrawlSummaryCardsProps) {
  const linkAnalysis = useQuery(api.seoAudit_queries.getLinkAnalysis, { domainId });
  const redirectAnalysis = useQuery(api.seoAudit_queries.getRedirectAnalysis, { domainId });
  const imageAnalysis = useQuery(api.seoAudit_queries.getImageAnalysis, { domainId });
  const latestAnalysis = useQuery(api.seoAudit_queries.getLatestAnalysis, { domainId });

  const hasData = linkAnalysis || redirectAnalysis || imageAnalysis || latestAnalysis?.avgWordCount;
  if (!hasData) return null;

  const cards = [
    {
      label: "Avg Word Count",
      value: latestAnalysis?.avgWordCount ?? "—",
      icon: File01,
      color: "text-primary-600",
      bgColor: "bg-primary-50",
      warn: latestAnalysis?.avgWordCount !== undefined && latestAnalysis.avgWordCount < 300,
    },
    {
      label: "Avg Performance",
      value: latestAnalysis?.avgPerformance ?? "—",
      icon: Speedometer01,
      color: latestAnalysis?.avgPerformance != null && latestAnalysis.avgPerformance >= 90 ? "text-success-600" : latestAnalysis?.avgPerformance != null && latestAnalysis.avgPerformance >= 50 ? "text-warning-600" : "text-primary-600",
      bgColor: latestAnalysis?.avgPerformance != null && latestAnalysis.avgPerformance >= 90 ? "bg-success-50" : latestAnalysis?.avgPerformance != null && latestAnalysis.avgPerformance >= 50 ? "bg-warning-50" : "bg-primary-50",
      warn: latestAnalysis?.avgPerformance !== undefined && latestAnalysis.avgPerformance < 50,
    },
    {
      label: "Internal Links",
      value: linkAnalysis?.internalLinks ?? "—",
      icon: Link01,
      color: "text-brand-600",
      bgColor: "bg-brand-50",
    },
    {
      label: "External Links",
      value: linkAnalysis?.externalLinks ?? "—",
      icon: LinkExternal01,
      color: "text-primary-600",
      bgColor: "bg-primary-50",
    },
    {
      label: "Redirect Chains",
      value: redirectAnalysis?.totalRedirects ?? "—",
      icon: ArrowsRight,
      color: redirectAnalysis && redirectAnalysis.totalRedirects > 0 ? "text-warning-600" : "text-primary-600",
      bgColor: redirectAnalysis && redirectAnalysis.totalRedirects > 0 ? "bg-warning-50" : "bg-primary-50",
    },
    {
      label: "Missing Alt",
      value: imageAnalysis?.missingAltCount ?? "—",
      icon: Image01,
      color: imageAnalysis && imageAnalysis.missingAltCount > 0 ? "text-warning-600" : "text-success-600",
      bgColor: imageAnalysis && imageAnalysis.missingAltCount > 0 ? "bg-warning-50" : "bg-success-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-primary rounded-lg border border-secondary p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`${card.bgColor} rounded-full p-1.5`}>
                <Icon className={`w-3.5 h-3.5 ${card.color}`} />
              </div>
              <span className="text-xs font-medium text-tertiary">
                {card.label}
              </span>
            </div>
            <div className={`text-xl font-bold ${card.warn ? "text-warning-600" : "text-primary"}`}>
              {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
