"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { RefreshCcw01, X, ChevronDown, ChevronUp } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import { Button } from "@/components/base/buttons/button";

export function GlobalJobStatus() {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get all active jobs across all domains
  const activeJobs = useQuery(api.keywordCheckJobs.getAllActiveJobs);

  // Don't render if no active jobs
  if (!activeJobs || activeJobs.length === 0) {
    return null;
  }

  const totalJobs = activeJobs.length;
  const processingJobs = activeJobs.filter(j => j.status === "processing");

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 rounded-lg border border-secondary bg-primary shadow-xl">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 rounded-t-lg border-b border-secondary bg-secondary-subtle px-4 py-3 text-left transition-colors hover:bg-primary_hover"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50">
          <RefreshCcw01 className="h-4 w-4 animate-spin text-brand-600" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-primary">
            {totalJobs} {totalJobs === 1 ? "job" : "jobs"} running
          </div>
          <div className="text-xs text-tertiary">
            {processingJobs.length} processing, {totalJobs - processingJobs.length} pending
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-quaternary" />
        ) : (
          <ChevronUp className="h-5 w-5 text-quaternary" />
        )}
      </button>

      {/* Expanded view with job details */}
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto p-4">
          <div className="space-y-3">
            {activeJobs.map((job) => {
              const progress = job.totalKeywords > 0
                ? (job.processedKeywords / job.totalKeywords) * 100
                : 0;
              const remainingKeywords = job.totalKeywords - job.processedKeywords;

              return (
                <div
                  key={job._id}
                  className="rounded-lg border border-secondary bg-primary p-3"
                >
                  {/* Domain info */}
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-primary">
                        {job.domainName || "Unknown domain"}
                      </div>
                      <div className="mt-0.5 text-xs text-tertiary">
                        {job.processedKeywords} / {job.totalKeywords} keywords
                        {job.failedKeywords > 0 && (
                          <span className="ml-1 text-error-600">
                            ({job.failedKeywords} failed)
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={cx(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        job.status === "processing"
                          ? "bg-brand-50 text-brand-700"
                          : "bg-gray-100 text-gray-700"
                      )}
                    >
                      {job.status}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-brand-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Progress text */}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-tertiary">
                      {Math.round(progress)}% complete
                    </span>
                    {job.status === "processing" && remainingKeywords > 0 && (
                      <span className="text-quaternary">
                        ~{Math.ceil(remainingKeywords * 3 / 60)} min remaining
                      </span>
                    )}
                  </div>

                  {/* Current keyword being processed */}
                  {job.status === "processing" && job.currentKeywordPhrase && (
                    <div className="mt-2 flex items-center gap-2 rounded bg-secondary-subtle px-2 py-1">
                      <RefreshCcw01 className="h-3 w-3 animate-spin text-brand-600" />
                      <span className="text-xs text-tertiary">
                        Checking: <span className="font-medium text-secondary">{job.currentKeywordPhrase}</span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
