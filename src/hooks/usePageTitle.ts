import { useEffect } from "react";

/**
 * Sets the document title following the pattern: doseo | segment1 | segment2 | ...
 * Pass one or more segments (e.g. domain name, module name).
 * Falsy segments are filtered out.
 */
export function usePageTitle(...segments: (string | null | undefined)[]) {
  useEffect(() => {
    const parts = segments.filter(Boolean) as string[];
    document.title = parts.length > 0 ? `doseo | ${parts.join(" | ")}` : "doseo";
  }, [segments.join("|")]);
}
