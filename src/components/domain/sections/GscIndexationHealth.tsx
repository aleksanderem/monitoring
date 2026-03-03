"use client";

import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface IndexationHealthData {
  total: number;
  indexed: number;
  blocked: number;
  mobileFriendly: number;
  notMobileFriendly: number;
  richResultsCount: number;
  richErrorsCount: number;
  blockedUrls: { url: string; state: string; coverage: string }[];
}

function Stat({
  label,
  value,
  warn,
  color,
}: {
  label: string;
  value: number;
  warn?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="text-xs text-tertiary">{label}</span>
      <span
        className={`text-xs font-mono ${warn ? "text-red-600 font-semibold" : color ?? "text-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function GscIndexationHealth({
  domainId,
}: {
  domainId: Id<"domains">;
}) {
  const connectionInfo = useQuery(api.gsc.getGscPropertiesForDomain, {
    domainId,
  });
  const fetchHealth = useAction(api.actions.gscAnalytics.getIndexationHealth);
  const [health, setHealth] = useState<IndexationHealthData | null | undefined>(
    undefined,
  );

  const isGscConnected =
    connectionInfo?.connected && connectionInfo?.selectedPropertyUrl;

  useEffect(() => {
    if (!isGscConnected) return;
    let cancelled = false;
    fetchHealth({ domainId })
      .then((data) => {
        if (!cancelled) setHealth(data as IndexationHealthData);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isGscConnected, domainId, fetchHealth]);

  if (connectionInfo === undefined || !isGscConnected || health === undefined) {
    return null;
  }

  if (health === null) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-secondary">
        <div className="px-4 py-3">
          <h3 className="text-sm font-medium text-primary flex items-center gap-2">
            GSC Indexation Health
            {health.blocked > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {health.blocked} blocked
              </span>
            )}
          </h3>
        </div>
        <div className="border-t border-secondary px-4 py-3">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-4">
            <Stat label="Total inspected" value={health.total} />
            <Stat
              label="Indexed"
              value={health.indexed}
              color="text-emerald-600"
            />
            <Stat
              label="Blocked"
              value={health.blocked}
              warn={health.blocked > 0}
            />
            <Stat
              label="Mobile friendly"
              value={health.mobileFriendly}
              color="text-emerald-600"
            />
          </div>

          {(health.richResultsCount > 0 || health.richErrorsCount > 0) && (
            <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-4">
              <Stat
                label="Rich results (valid)"
                value={health.richResultsCount}
              />
              <Stat
                label="Rich result errors"
                value={health.richErrorsCount}
                warn={health.richErrorsCount > 0}
              />
            </div>
          )}

          {health.blockedUrls.length > 0 && (
            <div className="mt-3 border-t border-secondary pt-3">
              <p className="mb-2 text-xs font-medium text-secondary">
                Blocked URLs
              </p>
              <div className="max-h-[200px] space-y-1.5 overflow-y-auto">
                {health.blockedUrls.map((item, i) => (
                  <div
                    key={i}
                    className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs dark:border-red-800 dark:bg-red-950/30"
                  >
                    <span className="break-all font-mono text-red-800 dark:text-red-300">
                      {item.url}
                    </span>
                    <div className="mt-0.5 flex gap-2">
                      <span className="font-medium text-red-700 dark:text-red-400">
                        {item.state}
                      </span>
                      {item.coverage && (
                        <span className="text-red-600 dark:text-red-400">
                          — {item.coverage}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
