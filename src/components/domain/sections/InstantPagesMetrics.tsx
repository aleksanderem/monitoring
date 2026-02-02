"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LighthouseScoresCard } from "../cards/LighthouseScoresCard";
import { CoreWebVitalsCard } from "../cards/CoreWebVitalsCard";

interface InstantPagesMetricsProps {
  domainId: Id<"domains">;
  scanId?: Id<"onSiteScans">;
}

export function InstantPagesMetrics({ domainId, scanId }: InstantPagesMetricsProps) {
  // Query to get pages with Lighthouse data
  const pagesData = useQuery(
    api.onSite_queries.getPagesList,
    scanId ? { domainId, scanId, limit: 100, offset: 0 } : "skip"
  );

  if (!pagesData || !scanId) {
    return null;
  }

  const pages = pagesData.pages || [];

  // Filter pages that have Lighthouse scores
  const pagesWithLighthouse = pages.filter(
    (page: any) => page.lighthouseScores && Object.keys(page.lighthouseScores).length > 0
  );

  // Filter pages that have Core Web Vitals
  const pagesWithVitals = pages.filter(
    (page: any) => page.coreWebVitals && Object.keys(page.coreWebVitals).length > 0
  );

  if (pagesWithLighthouse.length === 0 && pagesWithVitals.length === 0) {
    return null;
  }

  // Calculate average Lighthouse scores
  let averageLighthouseScores = undefined;
  if (pagesWithLighthouse.length > 0) {
    const totals = pagesWithLighthouse.reduce(
      (acc: any, page: any) => {
        acc.performance += page.lighthouseScores.performance || 0;
        acc.accessibility += page.lighthouseScores.accessibility || 0;
        acc.bestPractices += page.lighthouseScores.bestPractices || 0;
        acc.seo += page.lighthouseScores.seo || 0;
        return acc;
      },
      { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }
    );

    const count = pagesWithLighthouse.length;
    averageLighthouseScores = {
      performance: Math.round(totals.performance / count),
      accessibility: Math.round(totals.accessibility / count),
      bestPractices: Math.round(totals.bestPractices / count),
      seo: Math.round(totals.seo / count),
    };
  }

  // Calculate average Core Web Vitals
  let averageVitals = undefined;
  if (pagesWithVitals.length > 0) {
    const totals = pagesWithVitals.reduce(
      (acc: any, page: any) => {
        acc.largestContentfulPaint += page.coreWebVitals.largestContentfulPaint || 0;
        acc.firstInputDelay += page.coreWebVitals.firstInputDelay || 0;
        acc.timeToInteractive += page.coreWebVitals.timeToInteractive || 0;
        acc.domComplete += page.coreWebVitals.domComplete || 0;
        if (page.coreWebVitals.cumulativeLayoutShift !== undefined) {
          acc.cumulativeLayoutShift += page.coreWebVitals.cumulativeLayoutShift;
          acc.clsCount += 1;
        }
        return acc;
      },
      {
        largestContentfulPaint: 0,
        firstInputDelay: 0,
        timeToInteractive: 0,
        domComplete: 0,
        cumulativeLayoutShift: 0,
        clsCount: 0,
      }
    );

    const count = pagesWithVitals.length;
    averageVitals = {
      largestContentfulPaint: Math.round(totals.largestContentfulPaint / count),
      firstInputDelay: Math.round(totals.firstInputDelay / count),
      timeToInteractive: Math.round(totals.timeToInteractive / count),
      domComplete: Math.round(totals.domComplete / count),
      cumulativeLayoutShift:
        totals.clsCount > 0
          ? totals.cumulativeLayoutShift / totals.clsCount
          : undefined,
    };
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {averageLighthouseScores && (
        <LighthouseScoresCard scores={averageLighthouseScores} />
      )}
      {averageVitals && <CoreWebVitalsCard vitals={averageVitals} />}
    </div>
  );
}
