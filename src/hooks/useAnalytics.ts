"use client";

import { useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  ANALYTICS_CATEGORIES,
  type AnalyticsCategory,
  type AnalyticsEventName,
  generateSessionId,
} from "@/lib/analytics";

/**
 * Hook for tracking analytics events.
 * Provides a simple `trackEvent` function that sends events to the backend.
 */
export function useAnalytics() {
  const track = useAction(api.analytics.track);
  const sessionIdRef = useRef<string>(generateSessionId());

  const trackEvent = useCallback(
    (
      eventName: AnalyticsEventName | string,
      category: AnalyticsCategory = ANALYTICS_CATEGORIES.FEATURE,
      properties?: Record<string, unknown>
    ) => {
      track({
        eventName,
        category,
        properties: properties ?? undefined,
        sessionId: sessionIdRef.current,
        timestamp: Date.now(),
      }).catch(() => {
        // Silently ignore analytics failures — they should never break the app
      });
    },
    [track]
  );

  return { trackEvent, sessionId: sessionIdRef.current };
}
