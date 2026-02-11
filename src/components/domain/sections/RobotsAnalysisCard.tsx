"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ShieldTick, CheckCircle, XCircle } from "@untitledui/icons";

interface RobotsAnalysisCardProps {
  domainId: Id<"domains">;
}

function formatDirectiveValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : formatDirectiveValue(v))).join(", ");
  }
  if (value && typeof value === "object") {
    // For nested user-agent blocks, flatten key: value
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${formatDirectiveValue(v)}`)
      .join("; ");
  }
  return "";
}

interface DirectiveGroup {
  userAgent: string;
  allow: string[];
  disallow: string[];
  other: Array<[string, string]>;
}

function parseDirectiveGroups(directives: Record<string, unknown>): {
  groups: DirectiveGroup[];
  sitemaps: string[];
  crawlDelay?: string;
} {
  const sitemaps: string[] = [];
  let crawlDelay: string | undefined;
  const groups: DirectiveGroup[] = [];

  // Check if structure is user-agent keyed (e.g., {"*": {"allow": [...], "disallow": [...]}})
  const isUserAgentKeyed = Object.values(directives).some(
    (v) => v && typeof v === "object" && !Array.isArray(v) && ("allow" in (v as Record<string, unknown>) || "disallow" in (v as Record<string, unknown>))
  );

  if (isUserAgentKeyed) {
    for (const [key, value] of Object.entries(directives)) {
      if (key === "sitemap" || key === "sitemaps") {
        if (Array.isArray(value)) sitemaps.push(...value.map(String));
        else if (typeof value === "string") sitemaps.push(value);
        continue;
      }
      if (key === "raw" || key === "url") continue;

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const agentRules = value as Record<string, unknown>;
        const group: DirectiveGroup = {
          userAgent: key,
          allow: [],
          disallow: [],
          other: [],
        };
        for (const [ruleKey, ruleVal] of Object.entries(agentRules)) {
          const vals = Array.isArray(ruleVal) ? ruleVal.map(String) : [String(ruleVal)];
          if (ruleKey === "allow") group.allow = vals;
          else if (ruleKey === "disallow") group.disallow = vals;
          else if (ruleKey === "crawl-delay" || ruleKey === "crawl_delay") crawlDelay = vals[0];
          else group.other.push([ruleKey, vals.join(", ")]);
        }
        groups.push(group);
      }
    }
  } else {
    // Flat structure: {user_agent: [...], allow: [...], disallow: [...], sitemap: [...]}
    const userAgents = Array.isArray(directives.user_agent)
      ? directives.user_agent.map(String)
      : directives.user_agent ? [String(directives.user_agent)] : ["*"];

    const allow = Array.isArray(directives.allow)
      ? directives.allow.map(String)
      : directives.allow ? [String(directives.allow)] : [];

    const disallow = Array.isArray(directives.disallow)
      ? directives.disallow.map(String)
      : directives.disallow ? [String(directives.disallow)] : [];

    if (directives.sitemap) {
      if (Array.isArray(directives.sitemap)) sitemaps.push(...directives.sitemap.map(String));
      else sitemaps.push(String(directives.sitemap));
    }

    if (directives.crawl_delay || directives["crawl-delay"]) {
      crawlDelay = String(directives.crawl_delay || directives["crawl-delay"]);
    }

    for (const ua of userAgents) {
      groups.push({ userAgent: ua, allow, disallow, other: [] });
    }
  }

  return { groups, sitemaps, crawlDelay };
}

export function RobotsAnalysisCard({ domainId }: RobotsAnalysisCardProps) {
  const t = useTranslations('onsite');
  const robotsData = useQuery(api.seoAudit_queries.getRobotsData, {
    domainId,
  });

  if (!robotsData) {
    return (
      <div className="bg-primary rounded-lg border border-secondary p-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldTick className="w-4 h-4 text-tertiary" />
          <h3 className="text-sm font-medium text-tertiary">{t('robotsTxt')}</h3>
        </div>
        <p className="text-sm text-quaternary">
          {t('noRobotsTxtData')}
        </p>
      </div>
    );
  }

  const directives = robotsData.directives as Record<string, unknown> | undefined;
  const { groups, sitemaps, crawlDelay } = directives
    ? parseDirectiveGroups(directives)
    : { groups: [], sitemaps: [], crawlDelay: undefined };

  return (
    <div className="bg-primary rounded-lg border border-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldTick className="w-4 h-4 text-tertiary" />
          <h3 className="text-sm font-medium text-tertiary">{t('robotsTxt')}</h3>
        </div>
        <span className="text-xs text-quaternary">
          {t('fetched')} {new Date(robotsData.fetchedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="space-y-4">
        <div className="text-xs text-quaternary truncate" title={robotsData.robotsUrl}>
          {t('source')}: {robotsData.robotsUrl}
        </div>

        {groups.length > 0 ? (
          <div className="space-y-3 pt-3 border-t border-secondary">
            {groups.map((group, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="text-xs font-medium text-primary">
                  {t('userAgent')}: {group.userAgent}
                </div>

                {group.allow.length > 0 && (
                  <div className="flex flex-wrap gap-1 ml-3">
                    {group.allow.map((path, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-success-50 text-success-700">
                        <CheckCircle className="w-2.5 h-2.5" />
                        {path}
                      </span>
                    ))}
                  </div>
                )}

                {group.disallow.length > 0 && (
                  <div className="flex flex-wrap gap-1 ml-3">
                    {group.disallow.map((path, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-error-50 text-error-700">
                        <XCircle className="w-2.5 h-2.5" />
                        {path}
                      </span>
                    ))}
                  </div>
                )}

                {group.other.length > 0 && (
                  <div className="ml-3 space-y-0.5">
                    {group.other.map(([key, val], i) => (
                      <div key={i} className="text-[11px] text-tertiary">
                        {key}: {val}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {sitemaps.length > 0 && (
              <div className="pt-2 border-t border-secondary">
                <div className="text-xs font-medium text-secondary mb-1">{t('sitemaps')}</div>
                {sitemaps.map((url, i) => (
                  <div key={i} className="text-[11px] text-tertiary truncate" title={url}>
                    {url}
                  </div>
                ))}
              </div>
            )}

            {crawlDelay && (
              <div className="text-[11px] text-tertiary">
                {t('crawlDelay')}: {crawlDelay}s
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-quaternary pt-3 border-t border-secondary">
            {t('noDirectivesFound')}
          </p>
        )}
      </div>
    </div>
  );
}
