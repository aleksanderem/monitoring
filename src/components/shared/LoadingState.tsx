"use client";

import { Skeleton } from "@/components/base/skeleton/skeleton";

export interface LoadingStateProps {
  type?: "table" | "card" | "list";
  rows?: number;
}

export function LoadingState({ type = "table", rows = 5 }: LoadingStateProps) {
  if (type === "table") {
    return (
      <div className="space-y-3">
        {/* Table header */}
        <Skeleton className="h-10 w-full" />

        {/* Table rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (type === "card") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // List type
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
