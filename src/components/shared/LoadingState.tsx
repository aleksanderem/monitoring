"use client";

import { Skeleton } from "@/components/base/skeleton/skeleton";

export interface LoadingStateProps {
  type?: "table" | "card" | "list" | "detail";
  rows?: number;
  /** Optional message shown below the skeleton. */
  message?: string;
}

export function LoadingState({ type = "table", rows = 5, message }: LoadingStateProps) {
  if (type === "detail") {
    return (
      <div className="space-y-6 p-6">
        {/* Header area */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        {/* Content area */}
        <Skeleton className="h-64 w-full rounded-lg" />
        {message && (
          <p className="text-center text-sm text-tertiary">{message}</p>
        )}
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="space-y-3">
        {/* Table header */}
        <Skeleton className="h-10 w-full" />

        {/* Table rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
        {message && (
          <p className="text-center text-sm text-tertiary">{message}</p>
        )}
      </div>
    );
  }

  if (type === "card") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
        {message && (
          <p className="col-span-full text-center text-sm text-tertiary">{message}</p>
        )}
      </div>
    );
  }

  // List type
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
      {message && (
        <p className="text-center text-sm text-tertiary">{message}</p>
      )}
    </div>
  );
}
