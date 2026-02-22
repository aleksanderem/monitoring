"use client";

import { useEffect, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ANALYTICS_CATEGORIES, EVENTS, generateSessionId } from "@/lib/analytics";

/**
 * Hook that reports Web Vitals (LCP, FID, CLS, FCP, TTFB) to the analytics backend.
 * Should be mounted once, typically in the root layout or a global provider.
 */
export function useWebVitals() {
  const track = useAction(api.analytics.track);
  const sessionIdRef = useRef<string>(generateSessionId());
  const reportedRef = useRef(false);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;

    import("web-vitals").then(({ onLCP, onFID, onCLS, onFCP, onTTFB }) => {
      const reportMetric = (name: string, value: number) => {
        track({
          eventName: EVENTS.WEB_VITAL,
          category: ANALYTICS_CATEGORIES.PERFORMANCE,
          properties: { metric: name, value },
          sessionId: sessionIdRef.current,
          timestamp: Date.now(),
        }).catch(() => {
          // Silently ignore
        });
      };

      onLCP((metric) => reportMetric("LCP", metric.value));
      onFID((metric) => reportMetric("FID", metric.value));
      onCLS((metric) => reportMetric("CLS", metric.value));
      onFCP((metric) => reportMetric("FCP", metric.value));
      onTTFB((metric) => reportMetric("TTFB", metric.value));
    });
  }, [track]);
}
