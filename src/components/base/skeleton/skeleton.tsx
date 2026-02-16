"use client";

import { cx } from "@/utils/cx";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-800",
        className
      )}
      {...props}
    />
  );
}
