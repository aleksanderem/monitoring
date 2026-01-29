"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

/**
 * Component that monitors job completion and shows toast notifications
 * Should be mounted once in the app layout
 */
export function JobCompletionNotifier() {
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
          `✓ Position refresh completed for ${job.domainName || "domain"}`,
          {
            description: `${successCount}/${job.totalKeywords} keywords updated successfully${job.failedKeywords > 0 ? `. ${job.failedKeywords} failed.` : ""}`,
            duration: 5000,
          }
        );
      } else if (job.status === "failed") {
        toast.error(
          `✗ Position refresh failed for ${job.domainName || "domain"}`,
          {
            description: job.error || "Unknown error occurred",
            duration: 7000,
          }
        );
      } else if (job.status === "cancelled") {
        toast.info(
          `Position refresh cancelled for ${job.domainName || "domain"}`,
          {
            description: `${job.processedKeywords}/${job.totalKeywords} keywords were processed`,
            duration: 4000,
          }
        );
      }
    });
  }, [allJobs]);

  // Component doesn't render anything
  return null;
}
