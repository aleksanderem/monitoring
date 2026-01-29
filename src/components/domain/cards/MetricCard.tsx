"use client";

import type { FC, ReactNode } from "react";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { MetricChangeIndicator } from "@/components/application/metrics/metrics";
import { cx } from "@/utils/cx";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: ReactNode;
  icon?: FC<{ className?: string }>;
  trend?: "positive" | "negative" | null;
  change?: string;
  changeDescription?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  change,
  changeDescription,
  badge,
  actions,
  className,
}: MetricCardProps) {
  return (
    <div className={cx("rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset", className)}>
      <div className="relative flex flex-col gap-4 px-4 py-5 md:gap-5 md:px-5">
        {icon && (
          <FeaturedIcon
            color="gray"
            theme="modern"
            icon={icon}
            size="lg"
          />
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-tertiary">{title}</h3>
            {badge}
          </div>

          <div className="flex items-center gap-3">
            <p className="text-2xl font-semibold text-primary lg:text-3xl">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {trend && change && (
              <MetricChangeIndicator type="modern" trend={trend} value={change} />
            )}
          </div>

          {(subtitle || changeDescription) && (
            <div className="flex gap-2">
              {trend && change && changeDescription && (
                <span className="text-sm font-medium text-tertiary">{changeDescription}</span>
              )}
              {subtitle && !changeDescription && (
                <p className="text-sm text-tertiary">{subtitle}</p>
              )}
            </div>
          )}
        </div>

        {actions && (
          <div className="absolute top-4 right-4 md:top-5 md:right-5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
