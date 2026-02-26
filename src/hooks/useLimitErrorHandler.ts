import { useState, useCallback } from "react";
import { parseLimitError, type LimitError } from "@/lib/limitErrors";

export function useLimitErrorHandler() {
  const [limitError, setLimitError] = useState<LimitError | null>(null);

  const handleError = useCallback((error: unknown): boolean => {
    const parsed = parseLimitError(error);
    if (parsed) {
      setLimitError(parsed);
      return true;
    }
    return false;
  }, []);

  const clearLimitError = useCallback(() => {
    setLimitError(null);
  }, []);

  return { limitError, handleError, clearLimitError };
}
