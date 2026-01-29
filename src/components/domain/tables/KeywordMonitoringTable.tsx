"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { Hash01, ChevronUp, ChevronDown, ChevronsUpDown } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { MiniSparkline } from "@/components/domain/charts/MiniSparkline";
import { cx } from "@/utils/cx";

interface KeywordMonitoringTableProps {
  domainId: Id<"domains">;
}

type SortColumn = "phrase" | "currentPosition" | "change" | "status" | "potential" | "searchVolume" | "difficulty";
type SortDirection = "asc" | "desc";

// Helper: Format numbers with K/M abbreviations
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Helper: Get position badge styles
function getPositionBadgeClass(position: number | null): string {
  if (!position) return "bg-utility-gray-50 text-utility-gray-600";
  if (position <= 3) return "bg-utility-success-50 text-utility-success-600";
  if (position <= 10) return "bg-utility-success-25 text-utility-success-500";
  if (position <= 20) return "bg-utility-warning-50 text-utility-warning-600";
  if (position <= 50) return "bg-utility-gray-50 text-utility-gray-600";
  if (position <= 100) return "bg-utility-gray-25 text-utility-gray-500";
  return "bg-utility-error-50 text-utility-error-600";
}

// Helper: Get difficulty badge
function getDifficultyBadge(difficulty: number) {
  if (difficulty <= 30) return { label: "Easy", color: "success" as const };
  if (difficulty <= 60) return { label: "Medium", color: "warning" as const };
  return { label: "Hard", color: "error" as const };
}

// Helper: Get status badge
function getStatusBadge(status: string) {
  switch (status) {
    case "rising": return { label: "Rising", color: "success" as const };
    case "falling": return { label: "Falling", color: "error" as const };
    case "new": return { label: "New", color: "blue" as const };
    default: return { label: "Stable", color: "gray" as const };
  }
}

export function KeywordMonitoringTable({ domainId }: KeywordMonitoringTableProps) {
  // Will be completed in next steps
  return <div>Table structure coming next</div>;
}
