import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Shared debug logging utility for Convex actions.
 *
 * Usage:
 *   const debug = await createDebugLogger(ctx, "content_gap", args.domainId);
 *   const data = await debug.logStep("api_call", requestPayload, () => fetch(...));
 */

// Minimal ctx shape — works with both action and internalAction contexts
interface ActionCtx {
  runQuery: (ref: any, args: any) => Promise<any>;
  runMutation: (ref: any, args: any) => Promise<any>;
}

export interface DebugLogger {
  enabled: boolean;
  logStep: <T>(step: string, requestData: unknown, fn: () => Promise<T>) => Promise<T>;
}

export async function createDebugLogger(
  ctx: ActionCtx,
  action: string,
  domainId?: Id<"domains">,
): Promise<DebugLogger> {
  const enabled: boolean = await ctx.runQuery(internal.debugLog.isEnabled, {});

  return {
    enabled,
    logStep: async <T>(step: string, requestData: unknown, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now();
      try {
        const result = await fn();
        if (enabled) {
          await ctx.runMutation(internal.debugLog.saveLog, {
            domainId,
            action,
            step,
            request: JSON.stringify(requestData),
            response: JSON.stringify(result),
            durationMs: Date.now() - start,
            status: "success" as const,
          });
        }
        return result;
      } catch (error) {
        if (enabled) {
          await ctx.runMutation(internal.debugLog.saveLog, {
            domainId,
            action,
            step,
            request: JSON.stringify(requestData),
            response: "",
            durationMs: Date.now() - start,
            status: "error" as const,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    },
  };
}
