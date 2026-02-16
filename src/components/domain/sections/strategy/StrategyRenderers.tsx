"use client";

import React, { useState, useMemo } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import {
  Stars01,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  InfoCircle,
  Target04,
  FileCheck02,
  Link03,
  BarChart07,
  LayersThree01,
  Grid01,
  TrendUp02,
  CheckCircle,
  Rocket01,
  Edit05,
} from "@untitledui/icons";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { EzIcon } from "@/components/foundations/ez-icon";
import { toast } from "sonner";

// ─── Markdown Block Parser & Renderer ────────────────────────────
// Parses AI-generated markdown into structured blocks, then renders
// each with proper React components for visual hierarchy.

type MdBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "callout"; text: string };

function parseTableRow(line: string): string[] {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:?-]+(\|[\s:?-]+)+\|?\s*$/.test(line);
}

function parseMarkdownBlocks(md: string): MdBlock[] {
  const lines = md.split("\n");
  const blocks: MdBlock[] = [];
  let listBuf: { type: "ul" | "ol"; items: string[] } | null = null;
  let i = 0;

  const flushList = () => {
    if (listBuf) {
      blocks.push({ type: listBuf.type, items: listBuf.items });
      listBuf = null;
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Blank line — flush list
    if (!line.trim()) { flushList(); i++; continue; }

    // Horizontal rule
    if (/^---+\s*$/.test(line.trim()) || /^\*\*\*+\s*$/.test(line.trim())) {
      flushList();
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Callout / blockquote (> text)
    if (/^>\s/.test(line)) {
      flushList();
      let text = line.replace(/^>\s*/, "");
      i++;
      while (i < lines.length && /^>\s/.test(lines[i])) {
        text += " " + lines[i].replace(/^>\s*/, "");
        i++;
      }
      blocks.push({ type: "callout", text });
      continue;
    }

    // Markdown table detection: line starts with |, next line is separator
    if (/^\|.+\|/.test(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushList();
      const headers = parseTableRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|/.test(lines[i].trimEnd())) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // ## or ### heading
    if (/^#{2,3}\s/.test(line)) {
      flushList();
      const isH2 = line.startsWith("## ");
      const text = line.replace(/^#{2,4}\s+/, "");
      blocks.push({ type: isH2 ? "h2" : "h3", text });
      i++;
      continue;
    }

    // Unordered list item
    if (/^\s*[-*]\s/.test(line)) {
      const item = line.replace(/^\s*[-*]\s+/, "");
      if (!listBuf || listBuf.type !== "ul") { flushList(); listBuf = { type: "ul", items: [] }; }
      listBuf.items.push(item);
      i++;
      continue;
    }

    // Ordered list item
    if (/^\s*\d+\.\s/.test(line)) {
      const item = line.replace(/^\s*\d+\.\s+/, "");
      if (!listBuf || listBuf.type !== "ol") { flushList(); listBuf = { type: "ol", items: [] }; }
      listBuf.items.push(item);
      i++;
      continue;
    }

    // Plain text — merge consecutive lines into a paragraph
    flushList();
    const last = blocks[blocks.length - 1];
    if (last?.type === "paragraph") {
      last.text += " " + line.trim();
    } else {
      blocks.push({ type: "paragraph", text: line.trim() });
    }
    i++;
  }
  flushList();
  return blocks;
}

/** Render inline markdown (bold, italic) within a text string */
function InlineMarkdown({ text }: { text: string }) {
  // Split on **bold** and *italic* patterns, render as spans
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

    // Pick the earliest match
    const boldIdx = boldMatch?.index ?? Infinity;
    const italicIdx = italicMatch?.index ?? Infinity;

    if (boldIdx === Infinity && italicIdx === Infinity) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (boldIdx <= italicIdx && boldMatch) {
      if (boldIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, boldIdx)}</span>);
      parts.push(<strong key={key++} className="font-semibold text-primary">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    } else if (italicMatch) {
      const idx = italicMatch.index!;
      if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
      parts.push(<em key={key++} className="italic">{italicMatch[1]}</em>);
      remaining = remaining.slice(idx + italicMatch[0].length);
    }
  }

  return <>{parts}</>;
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <div key={i} className="mt-5 mb-2 first:mt-0 pb-1 border-b border-secondary">
                <h3 className="text-[15px] font-bold text-primary leading-snug">
                  <InlineMarkdown text={block.text} />
                </h3>
              </div>
            );
          case "h3":
            return (
              <h4 key={i} className="text-sm font-semibold text-primary mt-4 mb-1">
                <InlineMarkdown text={block.text} />
              </h4>
            );
          case "paragraph":
            return (
              <p key={i} className="text-sm text-secondary leading-relaxed">
                <InlineMarkdown text={block.text} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="space-y-1.5 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-sm text-secondary leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                    <span><InlineMarkdown text={item} /></span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol className="space-y-1.5 pl-1" key={i}>
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-sm text-secondary leading-relaxed">
                    <span className="mt-px shrink-0 w-5 text-xs font-semibold text-brand-600 tabular-nums text-right">{j + 1}.</span>
                    <span><InlineMarkdown text={item} /></span>
                  </li>
                ))}
              </ol>
            );
          case "table": {
            const timeCol = detectTimeColumn(block.headers, block.rows);
            if (timeCol !== null && block.rows.length >= 2) {
              return (
                <TimelineGantt
                  key={i}
                  headers={block.headers}
                  rows={block.rows}
                  timeCol={timeCol}
                />
              );
            }
            return (
              <div key={i} className="rounded-lg border border-secondary overflow-hidden my-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary_subtle">
                      {block.headers.map((h, hi) => (
                        <th key={hi} className="text-left px-3 py-2 font-semibold text-tertiary uppercase tracking-wider text-[10px] border-b border-secondary">
                          <InlineMarkdown text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary">
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 1 ? "bg-secondary_subtle/50" : ""}>
                        {row.map((cell, ci) => (
                          <td key={ci} className={`px-3 py-2 text-sm ${ci === 0 ? "font-medium text-primary" : "text-secondary"}`}>
                            <InlineMarkdown text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case "hr":
            return <hr key={i} className="border-secondary my-4" />;
          case "callout":
            return (
              <div key={i} className="my-2">
                <StrategyCallout color="brand">
                  <p className="text-sm text-primary leading-relaxed">
                    <InlineMarkdown text={block.text} />
                  </p>
                </StrategyCallout>
              </div>
            );
        }
      })}
    </div>
  );
}

// ─── Strategy Callout (AlertFloating-style, no truncation) ──────

type CalloutColor = "brand" | "gray" | "error" | "warning" | "success";

const CALLOUT_ICON_MAP: Record<CalloutColor, React.FC<{ className?: string }>> = {
  brand: InfoCircle,
  gray: InfoCircle,
  error: AlertCircle,
  warning: AlertCircle,
  success: CheckCircle,
};

export function StrategyCallout({ color, title, children }: { color: CalloutColor; title?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-primary bg-primary_alt p-4 shadow-xs">
      <FeaturedIcon icon={CALLOUT_ICON_MAP[color]} color={color} theme="outline" size="sm" />
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-secondary mb-1">{title}</p>}
        <div className="text-sm text-tertiary leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

// ─── Timeline Gantt for Markdown Tables ─────────────────────────
// Detects tables with a time-period column (M1/M2, Week 1, Day 1, etc.)
// and renders them as a horizontal Gantt chart instead of a plain table.

const TIME_PERIOD_PATTERNS = [
  /^M\d+$/i,                          // M1, M2, M3
  /^month\s*\d+$/i,                   // Month 1, Month 2
  /^miesi[aąe]c\s*\d+$/i,            // Miesiąc 1
  /^W\d+$/i,                          // W1, W2
  /^week\s*\d+$/i,                    // Week 1
  /^tydzie[nń]\s*\d+$/i,             // Tydzień 1
  /^D\d+$/i,                          // D1, D2
  /^day\s*\d+$/i,                     // Day 1
  /^dzie[nń]\s*\d+$/i,               // Dzień 1
  /^Q\d+$/i,                          // Q1, Q2
  /^quarter\s*\d+$/i,                 // Quarter 1
  /^kwarta[lł]\s*\d+$/i,             // Kwartał 1
  /^sprint\s*\d+$/i,                  // Sprint 1
  /^faz[ae]\s*\d+$/i,                // Faza 1
  /^phase\s*\d+$/i,                   // Phase 1
  /^etap\s*\d+$/i,                    // Etap 1
];

function isTimePeriodValue(val: string): boolean {
  const trimmed = val.replace(/\*\*/g, "").trim();
  return TIME_PERIOD_PATTERNS.some((p) => p.test(trimmed));
}

function detectTimeColumn(headers: string[], rows: string[][]): number | null {
  // Check each column: if majority of cell values match time patterns, it's a time column
  for (let col = 0; col < headers.length; col++) {
    const values = rows.map((r) => r[col] ?? "").filter(Boolean);
    if (values.length === 0) continue;
    const matches = values.filter(isTimePeriodValue).length;
    if (matches >= values.length * 0.6) return col;
  }
  return null;
}

const GANTT_BAR_COLORS = [
  { bar: "bg-brand-500",              text: "text-white" },
  { bar: "bg-utility-success-500",    text: "text-white" },
  { bar: "bg-utility-warning-500",    text: "text-white" },
  { bar: "bg-blue-500",               text: "text-white" },
  { bar: "bg-purple-500",             text: "text-white" },
  { bar: "bg-pink-500",               text: "text-white" },
  { bar: "bg-teal-500",               text: "text-white" },
  { bar: "bg-orange-500",             text: "text-white" },
];

function TimelineGantt({
  headers,
  rows,
  timeCol,
}: {
  headers: string[];
  rows: string[][];
  timeCol: number;
}) {
  // Extract time periods as column labels for the Gantt header
  const timePeriods = rows.map((r) => (r[timeCol] ?? "").replace(/\*\*/g, "").trim());
  const totalPeriods = timePeriods.length;

  // Other columns become the "data" columns — each gets a bar per row
  const dataCols = headers
    .map((h, i) => ({ header: h, index: i }))
    .filter((_, i) => i !== timeCol);

  // Pick which column to use as primary label on the bar
  // Prefer a column with short-ish text that describes the activity/focus
  const focusCol = dataCols.find((c) => {
    const h = c.header.toLowerCase();
    return (
      h.includes("focus") || h.includes("strateg") || h.includes("akcj") ||
      h.includes("action") || h.includes("task") || h.includes("zadanie") ||
      h.includes("activit") || h.includes("opis") || h.includes("description")
    );
  }) ?? dataCols[0];

  // Other data columns shown as detail chips below each bar
  const detailCols = dataCols.filter((c) => c.index !== focusCol?.index);

  return (
    <div className="rounded-xl border border-secondary overflow-hidden my-2">
      {/* Header row with time periods */}
      <div className="flex border-b border-secondary bg-secondary_subtle">
        <div className="w-[32%] min-w-[140px] shrink-0" />
        <div className="flex-1 flex">
          {timePeriods.map((label, i) => (
            <div
              key={i}
              className="flex-1 text-center py-2.5 text-xs font-bold text-tertiary uppercase tracking-wider border-l border-secondary"
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* One row per data column */}
      {dataCols.map((col, colIdx) => {
        const color = GANTT_BAR_COLORS[colIdx % GANTT_BAR_COLORS.length];
        return (
          <div
            key={col.index}
            className={`flex items-stretch border-b border-secondary last:border-b-0 ${
              colIdx % 2 === 0 ? "bg-primary" : "bg-secondary_subtle/50"
            }`}
          >
            {/* Left label — column header */}
            <div className="w-[32%] min-w-[140px] shrink-0 px-4 py-3 flex items-center">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${color.bar}`} />
                <span className="text-xs font-semibold text-primary truncate">
                  <InlineMarkdown text={col.header} />
                </span>
              </div>
            </div>

            {/* Cells — one per time period */}
            <div className="flex-1 flex">
              {rows.map((row, ri) => {
                const cellValue = (row[col.index] ?? "").trim();
                const isEmpty = !cellValue || cellValue === "-" || cellValue === "—" || cellValue === "0";
                return (
                  <div
                    key={ri}
                    className="flex-1 border-l border-secondary px-1.5 py-2 flex items-center"
                  >
                    {!isEmpty && (
                      <div className={`w-full rounded-md ${color.bar} px-2 py-1.5 shadow-sm`}>
                        <span className={`text-[11px] font-semibold ${color.text} line-clamp-2 leading-tight`}>
                          {cellValue.replace(/\*\*/g, "")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface QuickWin {
  keyword: string;
  currentPosition: number;
  targetPosition: number;
  difficulty: number;
  searchVolume: number;
  estimatedTrafficGain: string;
  actionItems: string[];
  existingPage?: string | null;
}

export interface ContentStrategyItem {
  targetKeyword: string;
  opportunityScore: number;
  searchVolume: number;
  suggestedContentType: string;
  competitorsCovering: string[];
  estimatedImpact: string;
  existingPage?: string | null;
}

export interface CompetitorItem {
  domain: string;
  strengths: string[];
  weaknesses: string[];
  threatsToUs: string[];
  opportunitiesAgainstThem: string[];
}

export interface RiskItem {
  risk: string;
  severity: "high" | "medium" | "low";
  impact: string;
  mitigation: string;
}

export interface ClusterItem {
  clusterName: string;
  theme: string;
  keywords: string[];
  suggestedContentPiece: string;
  totalSearchVolume: number;
  avgDifficulty: number;
  existingPage?: string | null;
}

export interface ActionPlanItem {
  priority: number;
  action: string;
  category: string;
  expectedImpact: string;
  effort: string;
  timeframe: string;
}

export interface ActionableStep {
  title: string;
  type: string;
  goal: string;
  existingPage?: string | null;
  specs: {
    minWordCount?: number;
    targetKeywords?: string[];
    keywordDensity?: string;
    internalLinks?: number;
    externalLinks?: number;
    headingStructure?: string;
    metaTitle?: string;
    metaDescription?: string;
    callToAction?: string;
    [key: string]: any;
  };
  notes?: string;
  mockup?: Array<{
    type: string;
    heading: string;
    content?: string;
    items?: string[];
  }>;
}

export interface BacklinkContentExample {
  type: string;
  title: string;
  description: string;
  targetSites: string;
  suggestedAnchorText: string;
  emailSubject: string;
  category: string;
}

export interface Strategy {
  executiveSummary: string;
  quickWins: QuickWin[];
  contentStrategy: ContentStrategyItem[];
  competitorAnalysis: CompetitorItem[];
  backlinkStrategy: {
    profileAssessment: string;
    toxicCleanup: { description: string; priority: string; count: number };
    linkBuildingPriorities: string[];
    prospectRecommendations: string;
    topProspects?: Array<{
      domain: string;
      domainRank: number;
      linksToCompetitors: number;
      competitors: string[];
      score: number;
      difficulty: string;
      channel: string;
    }>;
  };
  technicalSEO: {
    healthScore: number;
    criticalFixes: string[];
    warnings: string[];
    healthScoreTarget: number;
    improvementSteps: string[];
  };
  riskAssessment: RiskItem[];
  keywordClustering: ClusterItem[];
  roiForecast: {
    currentEstimatedTraffic: number;
    projectedTraffic30d: number;
    projectedTraffic90d: number;
    keyDrivers: string[];
    assumptions: string[];
  };
  actionPlan: ActionPlanItem[];
  actionableSteps: ActionableStep[];
  backlinkContentExamples?: BacklinkContentExample[];
}

export interface StrategySession {
  _id: Id<"aiStrategySessions">;
  domainId: Id<"domains">;
  businessDescription: string;
  targetCustomer: string;
  dataSnapshot: any;
  strategy: Strategy | null;
  drillDowns: Array<{
    sectionKey: string;
    question?: string;
    response: string;
    createdAt: number;
  }>;
  status: "initializing" | "collecting" | "analyzing" | "completed" | "failed";
  progress?: number;
  currentStep?: string;
  steps?: Array<{
    name: string;
    status: "pending" | "running" | "completed" | "skipped" | "failed";
    startedAt?: number;
    completedAt?: number;
  }>;
  focusKeywords?: string[];
  generateBacklinkContent?: boolean;
  generateContentMockups?: boolean;
  error?: string;
  createdAt: number;
  completedAt?: number;
  taskStatuses?: Array<{
    index: number;
    completed: boolean;
    completedAt?: number;
  }>;
  stepStatuses?: Array<{
    index: number;
    completed: boolean;
    completedAt?: number;
  }>;
}

// ─── Section Config ──────────────────────────────────────────────

export const SECTION_CONFIG: Array<{
  key: keyof Strategy;
  icon: typeof Stars01;
  countKey?: string;
  getCount?: (s: Strategy) => number;
}> = [
  { key: "executiveSummary", icon: FileCheck02 },
  { key: "quickWins", icon: Target04, countKey: "quickWinsCount", getCount: (s) => s.quickWins?.length ?? 0 },
  { key: "contentStrategy", icon: LayersThree01, countKey: "contentStrategyCount", getCount: (s) => s.contentStrategy?.length ?? 0 },
  { key: "competitorAnalysis", icon: BarChart07, countKey: "competitorAnalysisCount", getCount: (s) => s.competitorAnalysis?.length ?? 0 },
  { key: "backlinkStrategy", icon: Link03 },
  { key: "backlinkContentExamples", icon: Edit05, countKey: "backlinkContentCount", getCount: (s) => s.backlinkContentExamples?.length ?? 0 },
  { key: "technicalSEO", icon: FileCheck02 },
  { key: "riskAssessment", icon: AlertTriangle, countKey: "riskCount", getCount: (s) => s.riskAssessment?.length ?? 0 },
  { key: "keywordClustering", icon: Grid01, countKey: "clusterCount", getCount: (s) => s.keywordClustering?.length ?? 0 },
  { key: "roiForecast", icon: TrendUp02 },
  { key: "actionPlan", icon: CheckCircle, countKey: "actionPlanCount", getCount: (s) => s.actionPlan?.length ?? 0 },
  { key: "actionableSteps", icon: Rocket01, countKey: "actionableStepsCount", getCount: (s) => s.actionableSteps?.length ?? 0 },
];

export const EFFORT_STYLES: Record<string, string> = {
  low: "bg-utility-success-50 dark:bg-utility-success-950 text-utility-success-700 dark:text-utility-success-300",
  medium: "bg-utility-warning-50 dark:bg-utility-warning-950 text-utility-warning-700 dark:text-utility-warning-300",
  high: "bg-utility-error-50 dark:bg-utility-error-950 text-utility-error-700 dark:text-utility-error-300",
};

export const TIMEFRAME_STYLES: Record<string, string> = {
  immediate: "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300",
  "short-term": "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  "long-term": "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

// ─── Section Renderers ───────────────────────────────────────────

export function ExecutiveSummaryRenderer({ data }: { data: string }) {
  return (
    <StrategyCallout color="brand">
      <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">{data}</p>
    </StrategyCallout>
  );
}

function QuickWinsSummaryTable({ data, t }: { data: QuickWin[]; t: any }) {
  const totalTrafficGain = data.reduce((sum, d) => {
    const match = d.estimatedTrafficGain?.match(/[\d,]+/);
    return sum + (match ? parseInt(match[0].replace(/,/g, "")) : 0);
  }, 0);
  const avgDifficulty = Math.round(data.reduce((s, d) => s + (d.difficulty ?? 0), 0) / data.length);
  const totalVolume = data.reduce((s, d) => s + (d.searchVolume ?? 0), 0);

  return (
    <div className="rounded-xl border border-secondary overflow-hidden mb-4">
      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-px bg-secondary">
        {[
          { label: t("quickWins"), value: String(data.length), sub: t("quickWinsCount", { count: data.length }) },
          { label: t("searchVolume"), value: totalVolume.toLocaleString(), sub: "total" },
          { label: t("difficulty"), value: String(avgDifficulty), sub: "avg" },
          { label: t("estimatedTrafficGain"), value: totalTrafficGain > 0 ? `+${totalTrafficGain.toLocaleString()}` : "—", sub: "total" },
        ].map((m, i) => (
          <div key={i} className="bg-primary px-4 py-3 text-center">
            <div className="text-lg font-bold tabular-nums text-primary">{m.value}</div>
            <div className="text-[10px] text-tertiary uppercase tracking-wider">{m.label}</div>
          </div>
        ))}
      </div>
      {/* Compact table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary_subtle border-t border-secondary">
            <th className="text-left px-4 py-2.5 font-semibold text-tertiary uppercase tracking-wider text-[10px]">Keyword</th>
            <th className="text-center px-2 py-2.5 font-semibold text-tertiary uppercase tracking-wider text-[10px]">{t("currentPosition")}</th>
            <th className="text-center px-2 py-2.5 font-semibold text-tertiary uppercase tracking-wider text-[10px]">{t("targetPosition")}</th>
            <th className="text-center px-2 py-2.5 font-semibold text-tertiary uppercase tracking-wider text-[10px]">{t("difficulty")}</th>
            <th className="text-right px-2 py-2.5 font-semibold text-tertiary uppercase tracking-wider text-[10px]">{t("searchVolume")}</th>
            <th className="text-right px-4 py-2.5 font-semibold text-tertiary uppercase tracking-wider text-[10px]">{t("estimatedTrafficGain")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary">
          {data.map((item, i) => (
            <tr key={i} className="hover:bg-secondary_subtle transition-colors">
              <td className="px-4 py-2 font-medium text-primary">{item.keyword}</td>
              <td className="text-center px-2 py-2 tabular-nums text-primary">#{item.currentPosition}</td>
              <td className="text-center px-2 py-2 tabular-nums text-utility-success-600 dark:text-utility-success-400 font-semibold">#{item.targetPosition}</td>
              <td className="text-center px-2 py-2">
                <div className="inline-flex items-center gap-1.5">
                  <div className="h-1.5 w-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className={`h-full rounded-full ${item.difficulty >= 70 ? "bg-utility-error-500" : item.difficulty >= 40 ? "bg-utility-warning-500" : "bg-utility-success-500"}`} style={{ width: `${item.difficulty}%` }} />
                  </div>
                  <span className="tabular-nums text-primary">{item.difficulty}</span>
                </div>
              </td>
              <td className="text-right px-2 py-2 tabular-nums text-primary">{item.searchVolume?.toLocaleString()}</td>
              <td className="text-right px-4 py-2 text-utility-success-600 dark:text-utility-success-400 font-medium">{item.estimatedTrafficGain}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuickWinsRenderer({ data, t }: { data: QuickWin[]; t: any }) {
  if (!data?.length) return null;
  return (
    <div className="space-y-3">
      <QuickWinsSummaryTable data={data} t={t} />
      {data.map((item, i) => {
        const posGain = item.currentPosition - item.targetPosition;
        return (
          <div key={i} className="rounded-lg border border-secondary p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-utility-success-50 dark:bg-utility-success-950">
                  <TrendUp02 className="h-4.5 w-4.5 text-utility-success-600 dark:text-utility-success-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-primary break-words block">{item.keyword}</span>
                  {item.estimatedTrafficGain && (
                    <span className="text-xs text-utility-success-600 dark:text-utility-success-400 font-medium">{item.estimatedTrafficGain}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-utility-success-50 dark:bg-utility-success-950 px-3 py-1">
                <span className="text-sm font-bold tabular-nums text-primary">#{item.currentPosition}</span>
                <span className="text-utility-success-600 dark:text-utility-success-400 text-xs font-medium">→ #{item.targetPosition}</span>
                {posGain > 0 && (
                  <span className="text-[10px] font-bold text-utility-success-600 dark:text-utility-success-400">+{posGain}</span>
                )}
              </div>
            </div>
            {item.existingPage && (
              <div className="flex items-center gap-2 mb-3 rounded-md bg-utility-brand-50 dark:bg-utility-brand-950 border border-utility-brand-200 dark:border-utility-brand-800 px-3 py-1.5">
                <FileCheck02 className="h-3.5 w-3.5 shrink-0 text-utility-brand-600 dark:text-utility-brand-400" />
                <span className="text-xs text-utility-brand-700 dark:text-utility-brand-300 truncate">{item.existingPage}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-tertiary mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1">
                {t("difficulty")}: <span className="tabular-nums font-semibold text-primary">{item.difficulty}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1">
                {t("searchVolume")}: <span className="tabular-nums font-semibold text-primary">{item.searchVolume?.toLocaleString()}</span>
              </span>
            </div>
            {item.actionItems?.length > 0 && (
              <div className="border-t border-secondary pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-2">{t("actionItems")}</p>
                <ul className="space-y-1.5">
                  {item.actionItems.map((a, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-secondary">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-utility-success-500 mt-0.5" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OpportunityBar({ score }: { score: number }) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const barColor = clampedScore >= 70 ? "bg-utility-success-500" : clampedScore >= 40 ? "bg-utility-warning-500" : "bg-utility-error-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${clampedScore}%` }} />
      </div>
      <span className="text-xs tabular-nums font-semibold text-primary">{score}</span>
    </div>
  );
}

function ContentOpportunityChart({ data, t }: { data: ContentStrategyItem[]; t: any }) {
  const sorted = [...data].sort((a, b) => b.opportunityScore - a.opportunityScore);
  const maxScore = Math.max(...data.map((d) => d.opportunityScore), 1);

  return (
    <div className="rounded-xl border border-secondary overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-secondary bg-secondary_subtle">
        <h4 className="text-xs font-semibold text-primary">Opportunity Ranking</h4>
      </div>
      <div className="divide-y divide-secondary">
        {sorted.map((item, i) => {
          const pct = (item.opportunityScore / maxScore) * 100;
          const barColor = item.opportunityScore >= 70 ? "bg-utility-success-500" : item.opportunityScore >= 40 ? "bg-utility-warning-500" : "bg-utility-error-500";
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-tertiary">{i + 1}</span>
              <div className="w-[30%] min-w-[100px] truncate">
                <span className="text-xs font-medium text-primary">{item.targetKeyword}</span>
              </div>
              <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs tabular-nums font-bold text-primary w-8 text-right">{item.opportunityScore}</span>
              <span className="text-[10px] text-tertiary w-16 text-right tabular-nums">{item.searchVolume?.toLocaleString()}</span>
              <Badge size="sm" color="gray">{item.suggestedContentType}</Badge>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 px-4 py-2 border-t border-secondary bg-secondary_subtle text-[10px] text-tertiary">
        <span>Score</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-utility-success-500" />
          <span>70+</span>
          <span className="h-2 w-2 rounded-sm bg-utility-warning-500 ml-1" />
          <span>40-70</span>
          <span className="h-2 w-2 rounded-sm bg-utility-error-500 ml-1" />
          <span>&lt;40</span>
        </div>
        <span className="ml-auto">{t("searchVolume")} →</span>
      </div>
    </div>
  );
}

export function ContentStrategyRenderer({ data, t }: { data: ContentStrategyItem[]; t: any }) {
  if (!data?.length) return null;
  return (
    <div className="space-y-4">
      <ContentOpportunityChart data={data} t={t} />
      <div className="grid gap-3 sm:grid-cols-2">
      {data.map((item, i) => (
        <div key={i} className="rounded-lg border border-secondary p-4 overflow-hidden">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-sm font-semibold text-primary break-words min-w-0 flex-1">{item.targetKeyword}</span>
            <Badge size="sm" color={item.suggestedContentType === "optimize" ? "warning" : "brand"}>{item.suggestedContentType}</Badge>
          </div>
          {item.existingPage && (
            <div className="flex items-center gap-2 mb-2 rounded-md bg-utility-brand-50 dark:bg-utility-brand-950 border border-utility-brand-200 dark:border-utility-brand-800 px-2.5 py-1">
              <FileCheck02 className="h-3 w-3 shrink-0 text-utility-brand-600 dark:text-utility-brand-400" />
              <span className="text-[11px] text-utility-brand-700 dark:text-utility-brand-300 truncate">{item.existingPage}</span>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-tertiary mb-3">
            <span className="inline-flex items-center gap-1.5">
              {t("searchVolume")}: <span className="tabular-nums font-semibold text-primary">{item.searchVolume?.toLocaleString()}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              Score: <OpportunityBar score={item.opportunityScore} />
            </span>
          </div>
          <div className="rounded-md bg-gray-50 dark:bg-gray-800/50 px-3 py-2 mb-2">
            <p className="text-xs text-secondary">{item.estimatedImpact}</p>
          </div>
          {item.competitorsCovering?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold mr-1 self-center">{t("competitors")}:</span>
              {item.competitorsCovering.map((c, j) => (
                <span key={j} className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">{c}</span>
              ))}
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}

function CompetitorQuadrant({ label, items, dotColor }: { label: string; items: string[]; dotColor: string }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-lg bg-gray-50/50 dark:bg-gray-800/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <h5 className="text-[10px] font-semibold uppercase tracking-wider text-tertiary">{label}</h5>
      </div>
      <ul className="space-y-1">
        {items.map((s, j) => (
          <li key={j} className="text-xs text-secondary leading-relaxed">{s}</li>
        ))}
      </ul>
    </div>
  );
}

export function CompetitorAnalysisRenderer({ data, t }: { data: CompetitorItem[]; t: any }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  if (!data?.length) return null;
  return (
    <div className="space-y-3">
      {data.map((comp, i) => (
        <div key={i} className="rounded-lg border border-secondary">
          <button
            onClick={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
            className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary_subtle transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <BarChart07 className="h-3.5 w-3.5 text-tertiary" />
              </div>
              <span className="text-sm font-semibold text-primary">{comp.domain}</span>
            </div>
            {expanded[i] ? <ChevronUp className="h-4 w-4 text-tertiary" /> : <ChevronDown className="h-4 w-4 text-tertiary" />}
          </button>
          {expanded[i] && (
            <div className="grid gap-3 border-t border-secondary p-4 sm:grid-cols-2">
              <CompetitorQuadrant label={t("strengths")} items={comp.strengths} dotColor="bg-utility-success-500" />
              <CompetitorQuadrant label={t("weaknesses")} items={comp.weaknesses} dotColor="bg-utility-error-500" />
              <CompetitorQuadrant label={t("threats")} items={comp.threatsToUs} dotColor="bg-utility-warning-500" />
              <CompetitorQuadrant label={t("opportunities")} items={comp.opportunitiesAgainstThem} dotColor="bg-brand-500" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function BacklinkStrategyRenderer({ data, t }: { data: Strategy["backlinkStrategy"]; t: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <StrategyCallout color="brand" title={t("profileAssessment")}>
        <p className="text-sm text-primary leading-relaxed">{data.profileAssessment}</p>
      </StrategyCallout>
      {data.toxicCleanup && (
        <StrategyCallout color={data.toxicCleanup.priority === "high" ? "error" : data.toxicCleanup.priority === "medium" ? "warning" : "gray"}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-secondary">{t("toxicCleanup")}</span>
            <span className="rounded-full bg-white/60 dark:bg-black/20 px-2 py-0.5 text-xs tabular-nums font-bold text-primary">{data.toxicCleanup.count}</span>
          </div>
          <p className="text-xs text-secondary leading-relaxed">{data.toxicCleanup.description}</p>
        </StrategyCallout>
      )}
      {data.linkBuildingPriorities?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-2">{t("linkBuildingPriorities")}</p>
          <ul className="space-y-1.5">
            {data.linkBuildingPriorities.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-primary">
                <Link03 className="h-3.5 w-3.5 shrink-0 text-blue-500 mt-1" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.prospectRecommendations && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-1">{t("prospectRecommendations")}</p>
          <p className="text-sm text-primary leading-relaxed">{data.prospectRecommendations}</p>
        </div>
      )}
      {data.topProspects && data.topProspects.length > 0 && (
        <div>
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary">{t("backlinkGapProspects")}</p>
            <p className="text-xs text-tertiary">{t("backlinkGapProspectsDesc")}</p>
          </div>
          <div className="space-y-2">
            {data.topProspects.map((p, i) => {
              const scoreColor = p.score >= 70 ? "text-utility-success-600" : p.score >= 40 ? "text-utility-warning-600" : "text-utility-error-600";
              const scoreBg = p.score >= 70 ? "bg-utility-success-100 dark:bg-utility-success-900/30" : p.score >= 40 ? "bg-utility-warning-100 dark:bg-utility-warning-900/30" : "bg-utility-error-100 dark:bg-utility-error-900/30";
              return (
                <div key={i} className="rounded-lg border border-secondary p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-primary truncate">{p.domain}</span>
                      <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-tertiary">{t("domainRank")} {p.domainRank}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-secondary">
                      <span>{t("linksToCompetitors")}: {p.linksToCompetitors}</span>
                      <span className="text-tertiary">·</span>
                      <span>{p.competitors.slice(0, 3).join(", ")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-tertiary capitalize">{p.channel}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${scoreBg} ${scoreColor}`}>{p.score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const CONTENT_TYPE_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  "guest-post": { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300", icon: "pencil-edit-02" },
  "resource": { bg: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-300", icon: "library" },
  "data-study": { bg: "bg-purple-50 dark:bg-purple-950", text: "text-purple-700 dark:text-purple-300", icon: "chart-bar-line" },
  "infographic": { bg: "bg-pink-50 dark:bg-pink-950", text: "text-pink-700 dark:text-pink-300", icon: "image-02" },
  "tool": { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300", icon: "wrench-01" },
  "expert-roundup": { bg: "bg-indigo-50 dark:bg-indigo-950", text: "text-indigo-700 dark:text-indigo-300", icon: "voice" },
};

function BacklinkContentExamplesRenderer({ data, t }: { data: BacklinkContentExample[]; t: any }) {
  if (!data?.length) return null;
  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const style = CONTENT_TYPE_STYLES[item.type] ?? CONTENT_TYPE_STYLES["resource"];
        return (
          <div key={i} className="rounded-xl border border-secondary overflow-hidden">
            <div className="flex items-start gap-3 px-5 py-4 bg-secondary_subtle/50">
              <span className={`shrink-0 ${style.text}`}><EzIcon name={style.icon} size={18} /></span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-primary leading-snug">{item.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>{item.type}</span>
                  <span className="text-xs text-tertiary">{item.category}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-secondary px-5 py-3 space-y-2">
              <p className="text-sm text-primary leading-relaxed">{item.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-lg bg-secondary_subtle px-3 py-2">
                  <p className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">{t("backlinkTargetSites")}</p>
                  <p className="text-xs text-primary mt-0.5 font-medium">{item.targetSites}</p>
                </div>
                <div className="rounded-lg bg-secondary_subtle px-3 py-2">
                  <p className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">{t("backlinkAnchorText")}</p>
                  <p className="text-xs text-primary mt-0.5 font-medium">{item.suggestedAnchorText}</p>
                </div>
                <div className="rounded-lg bg-secondary_subtle px-3 py-2">
                  <p className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">{t("backlinkEmailSubject")}</p>
                  <p className="text-xs text-primary mt-0.5 font-medium">{item.emailSubject}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HealthScoreGauge({ score, target, t }: { score: number; target: number; t: any }) {
  const barColor = score >= 70 ? "bg-utility-success-500" : score >= 40 ? "bg-utility-warning-500" : "bg-utility-error-500";
  const textColor = score >= 70 ? "text-utility-success-600" : score >= 40 ? "text-utility-warning-600" : "text-utility-error-600";
  return (
    <div className="rounded-lg border border-secondary p-4">
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary">{t("healthScore")}</p>
          <span className={`text-3xl font-bold tabular-nums ${textColor}`}>{score}</span>
          <span className="text-sm text-tertiary font-medium">/100</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-tertiary">Target</p>
          <span className="text-lg font-bold tabular-nums text-primary">{target}</span>
          <span className="text-xs text-tertiary">/100</span>
        </div>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(100, score)}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-gray-400 dark:bg-gray-500" style={{ left: `${Math.min(100, target)}%` }} />
      </div>
    </div>
  );
}

export function TechnicalSEORenderer({ data, t }: { data: Strategy["technicalSEO"]; t: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <HealthScoreGauge score={data.healthScore} target={data.healthScoreTarget} t={t} />
      {data.criticalFixes?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-utility-error-600 mb-2">{t("criticalFixes")}</p>
          <ul className="space-y-1.5">
            {data.criticalFixes.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-primary">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-utility-error-500 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.warnings?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-utility-warning-600 mb-2">{t("warnings")}</p>
          <ul className="space-y-1.5">
            {data.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-primary">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-utility-warning-500 mt-0.5" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.improvementSteps?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-2">{t("improvementSteps")}</p>
          <ol className="space-y-1.5">
            {data.improvementSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-primary">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950 text-[10px] font-bold text-brand-700 dark:text-brand-300">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function RiskSeverityDistribution({ data, t }: { data: RiskItem[]; t: any }) {
  const counts = { high: 0, medium: 0, low: 0 };
  data.forEach((r) => { if (counts[r.severity] !== undefined) counts[r.severity]++; });
  const total = data.length;

  return (
    <div className="rounded-xl border border-secondary overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-secondary bg-secondary_subtle">
        <h4 className="text-xs font-semibold text-primary">{t("riskAssessment")} — {t("severity")} distribution</h4>
      </div>
      <div className="px-4 py-4">
        {/* Stacked bar */}
        <div className="h-6 w-full rounded-full overflow-hidden flex mb-3">
          {counts.high > 0 && (
            <div className="bg-utility-error-500 h-full flex items-center justify-center" style={{ width: `${(counts.high / total) * 100}%` }}>
              <span className="text-[10px] font-bold text-white">{counts.high}</span>
            </div>
          )}
          {counts.medium > 0 && (
            <div className="bg-utility-warning-500 h-full flex items-center justify-center" style={{ width: `${(counts.medium / total) * 100}%` }}>
              <span className="text-[10px] font-bold text-white">{counts.medium}</span>
            </div>
          )}
          {counts.low > 0 && (
            <div className="bg-gray-400 dark:bg-gray-500 h-full flex items-center justify-center" style={{ width: `${(counts.low / total) * 100}%` }}>
              <span className="text-[10px] font-bold text-white">{counts.low}</span>
            </div>
          )}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-5">
          {([
            { key: "high", color: "bg-utility-error-500", label: "High", count: counts.high },
            { key: "medium", color: "bg-utility-warning-500", label: "Medium", count: counts.medium },
            { key: "low", color: "bg-gray-400 dark:bg-gray-500", label: "Low", count: counts.low },
          ] as const).map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
              <span className="text-xs text-tertiary">{s.label}: <span className="font-semibold text-primary tabular-nums">{s.count}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RiskAssessmentRenderer({ data, t }: { data: RiskItem[]; t: any }) {
  if (!data?.length) return null;
  return (
    <div className="space-y-3">
      <RiskSeverityDistribution data={data} t={t} />
      {data.map((item, i) => {
        const riskColor: CalloutColor = item.severity === "high" ? "error" : item.severity === "medium" ? "warning" : "gray";
        return (
          <StrategyCallout key={i} color={riskColor}>
            <div className="flex items-center gap-2 mb-2">
              <Badge size="sm" color={item.severity === "high" ? "error" : item.severity === "medium" ? "warning" : "gray"}>
                {item.severity}
              </Badge>
              <span className="text-sm font-semibold text-primary">{item.risk}</span>
            </div>
            <div className="space-y-2 mt-3">
              <div className="rounded-md bg-white/50 dark:bg-black/10 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-0.5">{t("impact")}</p>
                <p className="text-xs text-secondary">{item.impact}</p>
              </div>
              <div className="rounded-md bg-white/50 dark:bg-black/10 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-utility-success-600 dark:text-utility-success-400 mb-0.5">{t("mitigation")}</p>
                <p className="text-xs text-secondary">{item.mitigation}</p>
              </div>
            </div>
          </StrategyCallout>
        );
      })}
    </div>
  );
}

function ClusterComparisonChart({ data, t }: { data: ClusterItem[]; t: any }) {
  const maxVolume = Math.max(...data.map((c) => c.totalSearchVolume ?? 0), 1);
  const sorted = [...data].sort((a, b) => (b.totalSearchVolume ?? 0) - (a.totalSearchVolume ?? 0));

  return (
    <div className="rounded-xl border border-secondary overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-secondary bg-secondary_subtle">
        <h4 className="text-xs font-semibold text-primary">{t("searchVolume")} vs {t("difficulty")}</h4>
      </div>
      <div className="divide-y divide-secondary">
        {sorted.map((cluster, i) => {
          const volPct = ((cluster.totalSearchVolume ?? 0) / maxVolume) * 100;
          const diffColor = cluster.avgDifficulty >= 70 ? "bg-utility-error-500" : cluster.avgDifficulty >= 40 ? "bg-utility-warning-500" : "bg-utility-success-500";
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-[30%] min-w-[100px] truncate">
                <span className="text-xs font-medium text-primary">{cluster.clusterName}</span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-4 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                  <div className="h-full rounded bg-brand-500 transition-all" style={{ width: `${volPct}%` }} />
                </div>
                <span className="text-xs tabular-nums font-semibold text-primary w-16 text-right">{(cluster.totalSearchVolume ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 w-20">
                <div className="h-3 w-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-full rounded-full ${diffColor}`} style={{ width: `${cluster.avgDifficulty}%` }} />
                </div>
                <span className="text-xs tabular-nums font-medium text-tertiary">{cluster.avgDifficulty}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-6 px-4 py-2 border-t border-secondary bg-secondary_subtle">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />
          <span className="text-[10px] text-tertiary">{t("searchVolume")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-utility-success-500" />
          <span className="text-[10px] text-tertiary">&lt;40</span>
          <span className="h-2.5 w-2.5 rounded-sm bg-utility-warning-500 ml-1" />
          <span className="text-[10px] text-tertiary">40-70</span>
          <span className="h-2.5 w-2.5 rounded-sm bg-utility-error-500 ml-1" />
          <span className="text-[10px] text-tertiary">&gt;70</span>
          <span className="text-[10px] text-quaternary ml-1">({t("difficulty")})</span>
        </div>
      </div>
    </div>
  );
}

export function KeywordClusteringRenderer({ data, t }: { data: ClusterItem[]; t: any }) {
  if (!data?.length) return null;
  return (
    <div className="space-y-4">
      <ClusterComparisonChart data={data} t={t} />
      {data.map((cluster, i) => (
        <div key={i} className="rounded-lg border border-secondary p-4 overflow-hidden">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <Grid01 className="h-4 w-4 shrink-0 text-brand-500" />
              <span className="text-sm font-semibold text-primary">{cluster.clusterName}</span>
            </div>
            <Badge size="sm" color="gray">{cluster.theme}</Badge>
          </div>
          {cluster.existingPage && (
            <div className="flex items-center gap-2 mt-1.5 mb-2 rounded-md bg-utility-brand-50 dark:bg-utility-brand-950 border border-utility-brand-200 dark:border-utility-brand-800 px-2.5 py-1">
              <FileCheck02 className="h-3 w-3 shrink-0 text-utility-brand-600 dark:text-utility-brand-400" />
              <span className="text-[11px] text-utility-brand-700 dark:text-utility-brand-300 truncate">{cluster.existingPage}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 my-3">
            {cluster.keywords?.map((kw, j) => (
              <span key={j} className="rounded-full bg-brand-50 dark:bg-brand-950 px-2.5 py-0.5 text-xs text-brand-700 dark:text-brand-300 truncate max-w-[200px]">{kw}</span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-tertiary mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1">
              {t("searchVolume")}: <span className="tabular-nums font-semibold text-primary">{cluster.totalSearchVolume?.toLocaleString()}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1">
              {t("difficulty")}: <span className="tabular-nums font-semibold text-primary">{cluster.avgDifficulty}</span>
            </span>
          </div>
          <div className="rounded-md bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-0.5">Content suggestion</p>
            <p className="text-xs text-secondary">{cluster.suggestedContentPiece}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrafficGrowthChart({ data, t }: { data: Strategy["roiForecast"]; t: any }) {
  const current = data.currentEstimatedTraffic ?? 0;
  const d30 = data.projectedTraffic30d ?? 0;
  const d90 = data.projectedTraffic90d ?? 0;
  const max = Math.max(current, d30, d90, 1);
  const pct30 = current > 0 ? Math.round(((d30 - current) / current) * 100) : 0;
  const pct90 = current > 0 ? Math.round(((d90 - current) / current) * 100) : 0;

  const bars = [
    { label: t("projectedTraffic"), value: current, pct: 0, color: "bg-gray-400 dark:bg-gray-500" },
    { label: t("in30Days"), value: d30, pct: pct30, color: "bg-utility-warning-500" },
    { label: t("in90Days"), value: d90, pct: pct90, color: "bg-utility-success-500" },
  ];

  return (
    <div className="rounded-xl border border-secondary overflow-hidden mb-4">
      <div className="px-5 py-3 border-b border-secondary bg-secondary_subtle">
        <h4 className="text-xs font-semibold text-primary">{t("projectedTraffic")}</h4>
      </div>
      <div className="px-5 py-4">
        {/* Vertical bar chart */}
        <div className="flex items-end justify-center gap-6 h-36 mb-3">
          {bars.map((bar, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 max-w-[120px]">
              <span className="text-xs font-bold tabular-nums text-primary">{bar.value.toLocaleString()}</span>
              {bar.pct > 0 && (
                <span className="text-[10px] font-bold text-utility-success-600 dark:text-utility-success-400">+{bar.pct}%</span>
              )}
              <div className="w-full flex justify-center" style={{ height: `${Math.max((bar.value / max) * 100, 5)}%` }}>
                <div className={`w-12 rounded-t-md ${bar.color} transition-all`} style={{ height: "100%" }} />
              </div>
            </div>
          ))}
        </div>
        {/* Labels */}
        <div className="flex justify-center gap-6">
          {bars.map((bar, i) => (
            <div key={i} className="flex-1 max-w-[120px] text-center">
              <span className="text-[10px] text-tertiary font-medium">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ROIForecastRenderer({ data, t }: { data: Strategy["roiForecast"]; t: any }) {
  if (!data) return null;
  const current = data.currentEstimatedTraffic || 0;
  const pct30 = current > 0 ? Math.round(((data.projectedTraffic30d - current) / current) * 100) : 0;
  const pct90 = current > 0 ? Math.round(((data.projectedTraffic90d - current) / current) * 100) : 0;
  return (
    <div className="space-y-4">
      <TrafficGrowthChart data={data} t={t} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-secondary p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-1">{t("projectedTraffic")}</p>
          <div className="text-2xl font-bold text-primary tabular-nums">{current.toLocaleString()}</div>
          <div className="text-xs text-tertiary">now</div>
        </div>
        <div className="rounded-lg border border-secondary p-4 text-center bg-utility-success-50 dark:bg-utility-success-950">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-1">{t("in30Days")}</p>
          <div className="text-2xl font-bold text-utility-success-600 dark:text-utility-success-400 tabular-nums">{data.projectedTraffic30d?.toLocaleString()}</div>
          {pct30 > 0 && (
            <div className="inline-flex items-center gap-0.5 mt-1 rounded-full bg-utility-success-100 dark:bg-utility-success-900 px-2 py-0.5">
              <TrendUp02 className="h-3 w-3 text-utility-success-600 dark:text-utility-success-400" />
              <span className="text-xs font-bold tabular-nums text-utility-success-600 dark:text-utility-success-400">+{pct30}%</span>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-secondary p-4 text-center bg-utility-success-50 dark:bg-utility-success-950">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-1">{t("in90Days")}</p>
          <div className="text-2xl font-bold text-utility-success-600 dark:text-utility-success-400 tabular-nums">{data.projectedTraffic90d?.toLocaleString()}</div>
          {pct90 > 0 && (
            <div className="inline-flex items-center gap-0.5 mt-1 rounded-full bg-utility-success-100 dark:bg-utility-success-900 px-2 py-0.5">
              <TrendUp02 className="h-3 w-3 text-utility-success-600 dark:text-utility-success-400" />
              <span className="text-xs font-bold tabular-nums text-utility-success-600 dark:text-utility-success-400">+{pct90}%</span>
            </div>
          )}
        </div>
      </div>
      {data.keyDrivers?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-2">{t("keyDrivers")}</p>
          <ul className="space-y-1.5">
            {data.keyDrivers.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-primary">
                <TrendUp02 className="h-3.5 w-3.5 shrink-0 text-utility-success-500 mt-0.5" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.assumptions?.length > 0 && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-1.5">{t("assumptions")}</p>
          <ul className="space-y-1">
            {data.assumptions.map((a, i) => (
              <li key={i} className="text-xs text-tertiary leading-relaxed">{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Gantt Timeline ──────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  content:   { bar: "bg-brand-500",              text: "text-white",       bg: "bg-brand-50 dark:bg-brand-950" },
  technical: { bar: "bg-utility-warning-500",    text: "text-white",       bg: "bg-utility-warning-50 dark:bg-utility-warning-950" },
  links:     { bar: "bg-utility-success-500",    text: "text-white",       bg: "bg-utility-success-50 dark:bg-utility-success-950" },
  keywords:  { bar: "bg-blue-500",               text: "text-white",       bg: "bg-blue-50 dark:bg-blue-950" },
};

const TIMEFRAME_TO_MONTHS: Record<string, [number, number]> = {
  immediate:    [0, 1],    // Month 1
  "short-term": [1, 3],   // Month 2-3
  "long-term":  [3, 6],   // Month 4-6
};

const EFFORT_WIDTH: Record<string, number> = {
  low: -0.5,     // shrink bar by half month
  medium: 0,     // default
  high: 0.5,     // extend bar by half month
};

const MONTH_LABELS = ["M1", "M2", "M3", "M4", "M5", "M6"];

export function ActionPlanGantt({ data, t }: { data: ActionPlanItem[]; t: any }) {
  const sorted = [...data].sort((a, b) => a.priority - b.priority);
  const totalMonths = 6;

  return (
    <div className="rounded-xl border border-secondary overflow-hidden">
      {/* Header row */}
      <div className="flex border-b border-secondary bg-secondary_subtle">
        <div className="w-[40%] min-w-[180px] shrink-0 px-4 py-2.5 text-xs font-semibold text-tertiary uppercase tracking-wider">
          {t("action")}
        </div>
        <div className="flex-1 flex">
          {MONTH_LABELS.map((label, i) => (
            <div
              key={label}
              className={`flex-1 text-center py-2.5 text-xs font-semibold text-tertiary ${
                i < totalMonths - 1 ? "border-l border-secondary" : "border-l border-secondary"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {sorted.map((item, i) => {
        const [start, end] = TIMEFRAME_TO_MONTHS[item.timeframe] ?? [0, 2];
        const effortAdj = EFFORT_WIDTH[item.effort] ?? 0;
        const barStart = Math.max(0, start);
        const barEnd = Math.min(totalMonths, end + effortAdj);
        const leftPct = (barStart / totalMonths) * 100;
        const widthPct = ((barEnd - barStart) / totalMonths) * 100;
        const cat = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.content;

        return (
          <div
            key={i}
            className={`flex items-center border-b border-secondary last:border-b-0 ${
              i % 2 === 0 ? "bg-primary" : "bg-secondary_subtle"
            }`}
          >
            {/* Label */}
            <div className="w-[40%] min-w-[180px] shrink-0 px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-tertiary">
                  {item.priority}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary leading-snug line-clamp-2">{item.action}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${cat.bar}`} />
                    <span className="text-[10px] text-tertiary">{item.category}</span>
                    <span className="text-[10px] text-quaternary mx-0.5">·</span>
                    <span className="text-[10px] text-tertiary">{item.effort}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline area */}
            <div className="flex-1 relative h-10">
              {/* Month grid lines */}
              {MONTH_LABELS.map((_, mi) => (
                <div
                  key={mi}
                  className="absolute top-0 bottom-0 border-l border-secondary"
                  style={{ left: `${(mi / totalMonths) * 100}%` }}
                />
              ))}
              {/* Bar */}
              <div
                className={`absolute top-2 h-6 rounded-md ${cat.bar} flex items-center px-2 shadow-sm transition-all`}
                style={{
                  left: `${leftPct}%`,
                  width: `${Math.max(widthPct, 100 / totalMonths * 0.5)}%`,
                }}
              >
                <span className={`text-[10px] font-semibold ${cat.text} truncate`}>
                  {item.timeframe}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-secondary bg-secondary_subtle">
        {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${colors.bar}`} />
            <span className="text-[10px] font-medium text-tertiary capitalize">{cat}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-quaternary">
          <span>▪ {t("effort")}: {t("ganttLegendLow")}</span>
          <span>▪ {t("ganttLegendHigh")}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Action Plan Renderer ────────────────────────────────────────

export function ActionPlanRenderer({ data, t }: { data: ActionPlanItem[]; t: any }) {
  const [tab, setTab] = useState<"list" | "gantt">("gantt");
  if (!data?.length) return null;
  const sorted = [...data].sort((a, b) => a.priority - b.priority);
  const priorityColors = [
    "bg-brand-600 text-white",
    "bg-brand-500 text-white",
    "bg-brand-400 text-white",
    "bg-brand-200 dark:bg-brand-800 text-brand-800 dark:text-brand-200",
    "bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300",
  ];
  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center rounded-lg border border-secondary bg-primary p-0.5 w-fit">
        <button
          onClick={() => setTab("list")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "list"
              ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
              : "text-tertiary hover:text-primary"
          }`}
        >
          {t("actionPlan")}
        </button>
        <button
          onClick={() => setTab("gantt")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "gantt"
              ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
              : "text-tertiary hover:text-primary"
          }`}
        >
          {t("timeline")}
        </button>
      </div>

      {tab === "gantt" ? (
        <ActionPlanGantt data={data} t={t} />
      ) : (
        <div className="space-y-2">
          {sorted.map((item, i) => (
            <div key={i} className="rounded-lg border border-secondary p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${priorityColors[Math.min(i, priorityColors.length - 1)]}`}>
                  #{item.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary">{item.action}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EFFORT_STYLES[item.effort] ?? EFFORT_STYLES.medium}`}>
                      {t("effort")}: {item.effort}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIMEFRAME_STYLES[item.timeframe] ?? TIMEFRAME_STYLES["short-term"]}`}>
                      {item.timeframe}
                    </span>
                    <Badge size="sm" color="gray">{item.category}</Badge>
                  </div>
                </div>
              </div>
              {item.expectedImpact && (
                <div className="mt-3 ml-11 rounded-md bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-0.5">{t("impact")}</p>
                  <p className="text-xs text-secondary">{item.expectedImpact}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Actionable Steps Renderer (read-only, used in Generator tab) ──

const STEP_TYPE_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  landing:   { bg: "bg-brand-50 dark:bg-brand-950",                                       text: "text-brand-700 dark:text-brand-300",                              icon: "target-01" },
  blog:      { bg: "bg-blue-50 dark:bg-blue-950",                                         text: "text-blue-700 dark:text-blue-300",                                icon: "pencil-edit-02" },
  guide:     { bg: "bg-purple-50 dark:bg-purple-950",                                     text: "text-purple-700 dark:text-purple-300",                            icon: "book-open-01" },
  technical: { bg: "bg-utility-warning-50 dark:bg-utility-warning-950",                    text: "text-utility-warning-700 dark:text-utility-warning-300",          icon: "settings-01" },
  outreach:  { bg: "bg-utility-success-50 dark:bg-utility-success-950",                    text: "text-utility-success-700 dark:text-utility-success-300",          icon: "link-05" },
  cleanup:   { bg: "bg-utility-error-50 dark:bg-utility-error-950",                        text: "text-utility-error-700 dark:text-utility-error-300",              icon: "clean" },
  optimize:  { bg: "bg-amber-50 dark:bg-amber-950",                                        text: "text-amber-700 dark:text-amber-300",                              icon: "magic-wand-03" },
};

const SPEC_LABELS: Record<string, string> = {
  minWordCount:     "Min. Words",
  targetKeywords:   "Keywords",
  keywordDensity:   "Density",
  internalLinks:    "Internal Links",
  externalLinks:    "External Links",
  headingStructure: "Headings",
  metaTitle:        "Meta Title",
  metaDescription:  "Meta Description",
  callToAction:     "CTA",
};

const MOCKUP_SECTION_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  hero: { bg: "bg-brand-50 dark:bg-brand-950/40", border: "border-brand-200 dark:border-brand-800", icon: "house-01" },
  features: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", icon: "magic-wand-03" },
  content: { bg: "bg-gray-50 dark:bg-gray-800/40", border: "border-gray-200 dark:border-gray-700", icon: "document-validation" },
  faq: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", icon: "help-circle" },
  cta: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-200 dark:border-green-800", icon: "target-01" },
  testimonials: { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800", icon: "bubble-chat" },
  stats: { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-800", icon: "chart-bar-line" },
  comparison: { bg: "bg-pink-50 dark:bg-pink-950/40", border: "border-pink-200 dark:border-pink-800", icon: "git-compare" },
  steps: { bg: "bg-teal-50 dark:bg-teal-950/40", border: "border-teal-200 dark:border-teal-800", icon: "arrange-by-numbers-1-9" },
  gallery: { bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", icon: "image-02" },
};

function MockupSection({ section, isFirst }: { section: { type: string; heading: string; content?: string; items?: string[] }; isFirst: boolean }) {
  const style = MOCKUP_SECTION_STYLES[section.type] ?? MOCKUP_SECTION_STYLES.content;
  return (
    <div className={`${style.bg} border-b last:border-b-0 ${style.border} px-4 py-3`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-tertiary"><EzIcon name={style.icon} size={12} /></span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-tertiary">{section.type}</span>
      </div>
      <p className={`font-bold text-primary leading-snug ${isFirst ? "text-base" : "text-sm"}`}>{section.heading}</p>
      {section.content && (
        <p className="text-xs text-secondary mt-1 leading-relaxed">{section.content}</p>
      )}
      {section.items && section.items.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {section.items.map((item, j) => (
            <span key={j} className={`rounded-md px-2 py-0.5 text-xs ${section.type === "cta" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium" : "bg-white/70 dark:bg-black/20 text-secondary"}`}>
              {section.type === "faq" ? `${j + 1}. ${item}` : item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionableStepsRenderer({ data, t }: { data: ActionableStep[]; t: any; sessionId?: any; stepStatuses?: any }) {
  if (!data?.length) return null;

  return (
    <div className="space-y-4">
      {data.map((step, i) => {
        const typeStyle = STEP_TYPE_STYLES[step.type] ?? STEP_TYPE_STYLES.landing;
        const specs = step.specs ?? {};
        const specEntries = Object.entries(specs).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0));

        return (
          <div key={i} className="rounded-xl border border-secondary overflow-hidden">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 bg-secondary_subtle/50">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white text-xs font-bold">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-primary leading-snug">{step.title}</h4>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                    <EzIcon name={typeStyle.icon} size={12} /> {step.type}
                  </span>
                  {step.goal && (
                    <span className="text-xs text-secondary truncate">{step.goal}</span>
                  )}
                </div>
                {step.existingPage && (
                  <div className="flex items-center gap-2 mt-2 rounded-md bg-utility-brand-50 dark:bg-utility-brand-950 border border-utility-brand-200 dark:border-utility-brand-800 px-2.5 py-1">
                    <FileCheck02 className="h-3 w-3 shrink-0 text-utility-brand-600 dark:text-utility-brand-400" />
                    <span className="text-[11px] text-utility-brand-700 dark:text-utility-brand-300 truncate">{step.existingPage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Specs grid */}
            {specEntries.length > 0 && (
              <div className="border-t border-secondary px-5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-2">{t("stepSpecs")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {specEntries.map(([key, value]) => {
                    const displayLabel = SPEC_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").trim();
                    const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
                    return (
                      <div key={key} className="rounded-lg bg-secondary_subtle px-3 py-2">
                        <p className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">{displayLabel}</p>
                        <p className="text-xs text-primary mt-0.5 font-medium leading-snug">{displayValue}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            {step.notes && (
              <div className="border-t border-secondary px-5 py-3">
                <StrategyCallout color="gray">
                  <p className="text-xs text-primary leading-relaxed">{step.notes}</p>
                </StrategyCallout>
              </div>
            )}

            {/* Mockup — visual wireframe */}
            {step.mockup && Array.isArray(step.mockup) && step.mockup.length > 0 && (
              <div className="border-t border-secondary px-5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-2">{t("mockup")}</p>
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 overflow-hidden">
                  {step.mockup.map((section, si) => (
                    <MockupSection key={si} section={section} isFirst={si === 0} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Section Card (Accordion) ────────────────────────────────────

export function StrategySectionCard({
  sectionKey,
  icon: Icon,
  strategy,
  drillDowns,
  sessionId,
  t,
  countKey,
  getCount,
  stepStatuses,
}: {
  sectionKey: keyof Strategy;
  icon: typeof Stars01;
  strategy: Strategy;
  drillDowns: StrategySession["drillDowns"];
  sessionId: Id<"aiStrategySessions">;
  t: any;
  countKey?: string;
  getCount?: (s: Strategy) => number;
  stepStatuses?: StrategySession["stepStatuses"];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [drillDownQuestion, setDrillDownQuestion] = useState("");
  const [isDrilling, setIsDrilling] = useState(false);
  const drillDownAction = useAction(api.actions.aiStrategy.drillDownSection);

  const sectionDrillDowns = drillDowns?.filter((d) => d.sectionKey === sectionKey) ?? [];
  const data = strategy[sectionKey];

  const handleDrillDown = async (question?: string) => {
    setIsDrilling(true);
    try {
      const result = await drillDownAction({
        sessionId,
        sectionKey: sectionKey as string,
        question: question || undefined,
      });
      if (!result.success) {
        toast.error(result.error || "Drill-down failed");
      }
      setDrillDownQuestion("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsDrilling(false);
    }
  };

  const renderSection = () => {
    switch (sectionKey) {
      case "executiveSummary": return <ExecutiveSummaryRenderer data={data as string} />;
      case "quickWins": return <QuickWinsRenderer data={data as QuickWin[]} t={t} />;
      case "contentStrategy": return <ContentStrategyRenderer data={data as ContentStrategyItem[]} t={t} />;
      case "competitorAnalysis": return <CompetitorAnalysisRenderer data={data as CompetitorItem[]} t={t} />;
      case "backlinkStrategy": return <BacklinkStrategyRenderer data={data as Strategy["backlinkStrategy"]} t={t} />;
      case "backlinkContentExamples": return <BacklinkContentExamplesRenderer data={data as BacklinkContentExample[]} t={t} />;
      case "technicalSEO": return <TechnicalSEORenderer data={data as Strategy["technicalSEO"]} t={t} />;
      case "riskAssessment": return <RiskAssessmentRenderer data={data as RiskItem[]} t={t} />;
      case "keywordClustering": return <KeywordClusteringRenderer data={data as ClusterItem[]} t={t} />;
      case "roiForecast": return <ROIForecastRenderer data={data as Strategy["roiForecast"]} t={t} />;
      case "actionPlan": return <ActionPlanRenderer data={data as ActionPlanItem[]} t={t} />;
      case "actionableSteps": return <ActionableStepsRenderer data={data as ActionableStep[]} t={t} sessionId={sessionId} stepStatuses={stepStatuses} />;
      default: return <p className="text-sm text-tertiary">{JSON.stringify(data, null, 2)}</p>;
    }
  };

  return (
    <div className="rounded-xl border border-secondary bg-primary">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-secondary_subtle transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-brand-600 shrink-0" />
          <span className="text-sm font-semibold text-primary">{t(sectionKey)}</span>
          {countKey && getCount && (
            <Badge size="sm" color="gray">{t(countKey, { count: getCount(strategy) })}</Badge>
          )}
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-tertiary" /> : <ChevronDown className="h-4 w-4 text-tertiary" />}
      </button>

      {isOpen && (
        <div className="border-t border-secondary">
          <div className="px-6 py-4">{renderSection()}</div>

          {/* Drill-down results */}
          {sectionDrillDowns.length > 0 && (
            <div className="border-t border-secondary px-6 py-5 space-y-5">
              {sectionDrillDowns.map((dd, i) => (
                <div key={i} className="rounded-xl border border-secondary bg-primary">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-secondary bg-secondary_subtle rounded-t-xl">
                    <Stars01 className="h-4 w-4 text-brand-500 shrink-0" />
                    <span className="text-xs font-semibold text-primary">
                      {dd.question ? dd.question : t("drillDown")}
                    </span>
                    <span className="ml-auto text-xs text-quaternary">
                      {new Date(dd.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {/* Body */}
                  <div className="px-5 py-4">
                    <MarkdownContent content={dd.response} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drill-down input */}
          <div className="flex items-center gap-2 border-t border-secondary px-6 py-3">
            <input
              type="text"
              value={drillDownQuestion}
              onChange={(e) => setDrillDownQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isDrilling) handleDrillDown(drillDownQuestion); }}
              placeholder={t("drillDownQuestion")}
              className="flex-1 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              disabled={isDrilling}
            />
            <Button
              size="sm"
              color="secondary"
              onClick={() => handleDrillDown(drillDownQuestion)}
              isDisabled={isDrilling}
              isLoading={isDrilling}
            >
              {isDrilling ? t("drillDownLoading") : t("drillDownSubmit")}
            </Button>
            <Button
              size="sm"
              color="primary"
              iconLeading={Stars01}
              onClick={() => handleDrillDown()}
              isDisabled={isDrilling}
              isLoading={isDrilling}
            >
              {t("drillDown")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
