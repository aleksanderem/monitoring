"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

/**
 * Component that monitors job completion and shows toast notifications
 * Should be mounted once in the app layout
 */
export function JobCompletionNotifier() {
  const t = useTranslations("jobs");
  const allJobs = useQuery(api.keywordCheckJobs.getRecentCompletedJobs);
  const notifiedJobsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!allJobs) return;

    allJobs.forEach((job) => {
      const jobId = job._id;

      // Skip if already notified
      if (notifiedJobsRef.current.has(jobId)) {
        return;
      }

      // Mark as notified
      notifiedJobsRef.current.add(jobId);

      // Show appropriate toast based on status
      if (job.status === "completed") {
        const successCount = job.totalKeywords - job.failedKeywords;
        toast.success(
          t("refreshCompleted", { domain: job.domainName || t("domainFallback") }),
          {
            description: t("refreshCompletedDescription", { success: successCount, total: job.totalKeywords, failed: job.failedKeywords }),
            duration: 5000,
          }
        );
      } else if (job.status === "failed") {
        toast.error(
          t("refreshFailed", { domain: job.domainName || t("domainFallback") }),
          {
            description: job.error || t("unknownError"),
            duration: 7000,
          }
        );
      } else if (job.status === "cancelled") {
        toast.info(
          t("refreshCancelled", { domain: job.domainName || t("domainFallback") }),
          {
            description: t("refreshCancelledDescription", { processed: job.processedKeywords, total: job.totalKeywords }),
            duration: 4000,
          }
        );
      }
    });
  }, [allJobs]);

  // Component doesn't render anything
  return null;
}
