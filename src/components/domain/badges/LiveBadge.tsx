import { cx } from "@/utils/cx";

interface LiveBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LiveBadge({ size = "md", className }: LiveBadgeProps) {
  const dotSizes = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-3 w-3",
  };

  return (
    <div className={cx("flex items-center", className)}>
      <span className={cx("relative flex", dotSizes[size])}>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error-solid opacity-75"></span>
        <span className={cx("relative inline-flex rounded-full bg-error-solid", dotSizes[size])}></span>
      </span>
    </div>
  );
}
