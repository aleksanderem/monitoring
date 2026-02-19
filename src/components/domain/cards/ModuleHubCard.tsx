"use client";

import type { ReactNode } from "react";
import { EzIcon } from "@/components/foundations/ez-icon";
import type { ModuleState } from "@/hooks/useModuleReadiness";
import { cx } from "@/utils/cx";
import { GlowingEffect } from "@/components/ui/glowing-effect";

export interface ModuleHubData {
  domain?: string;
  keywords?: string[];
  competitors?: string[];
  keywordCount?: number;
  competitorCount?: number;
  gapCount?: number;
  backlinkCount?: number;
  referringDomains?: number;
  healthScore?: number;
  visibilityScore?: number;
  searchEngine?: string;
  location?: string;
  language?: string;
  locale?: string;
}

interface ModuleHubCardProps {
  tabId: string;
  title: string;
  description: string;
  icon: string;
  state: ModuleState;
  colors: [number, number, number][];
  onClick: () => void;
  data?: ModuleHubData;
}

function gradientFrom(colors: [number, number, number][]): string {
  const [r, g, b] = colors[0];
  return `rgb(${r},${g},${b})`;
}
function gradientTo(colors: [number, number, number][]): string {
  const c = colors[1] ?? colors[0];
  const [r, g, b] = c;
  return `rgb(${r},${g},${b})`;
}

// ─── Locale helper ──────────────────────────────────────────────────

const I18N: Record<string, string> = {
  // Skeleton shell titles
  "shell.monitoring":       "Live Positions",
  "shell.keyword-map":      "Topic Clusters",
  "shell.visibility":       "Visibility Score",
  "shell.competitors":      "Competitor Overview",
  "shell.content-gaps":     "Gap Analysis",
  "shell.link-building":    "Link Prospects",
  "shell.backlinks":        "Backlink Profile",
  "shell.on-site":          "Site Health",
  "shell.insights":         "AI Insights",
  "shell.ai-research":      "Keyword Discovery",
  "shell.strategy":         "Action Plan",
  "shell.keyword-analysis": "Keyword Metrics",
  "shell.generators":       "Schema Generator",
  "shell.settings":         "Domain Config",
  // Visibility
  "score": "Score",
  "keywords": "Keywords",
  "top3": "Top 3",
  // Backlinks
  "totalLinks": "Total Links",
  "refDomains": "Ref. Domains",
  "avgDR": "Avg DR",
  "velocity": "Velocity",
  // On-site
  "critical": "Critical",
  "warnings": "Warnings",
  "passed": "Passed",
  // Insights
  "ins.longtail": "Add long-tail keywords",
  "ins.backlinks": "Fix broken backlinks",
  "ins.speed": "Improve page speed",
  "ins.content": "Create pillar content",
  "ins.catKeywords": "Keywords",
  "ins.catLinks": "Links",
  "ins.catTechnical": "Technical",
  "ins.catContent": "Content",
  "high": "High",
  "med": "Med",
  "low": "Low",
  // Link building types
  "guestPost": "Guest Post",
  "resource": "Resource",
  "mention": "Mention",
  "outreach": "Outreach",
  // Strategy
  "str.optimize": "Optimize top 10 pages",
  "str.backlinks": "Build 20 quality backlinks",
  "str.audit": "Fix critical audit issues",
  "str.gaps": "Create content for gaps",
  "str.monitor": "Monitor position changes",
  // Settings
  "searchEngine": "Search Engine",
  "location": "Location",
  "language": "Language",
  "frequency": "Frequency",
  "daily": "Daily",
  // Generators
  "copy": "Copy",
  // Content gaps header
  "you": "You",
  // Keyword map legend
  "info": "info",
  "comm": "comm",
  "trans": "trans",
  "brand": "brand",
};

const I18N_PL: Record<string, string> = {
  "shell.monitoring":       "Pozycje na żywo",
  "shell.keyword-map":      "Klastry tematów",
  "shell.visibility":       "Wynik widoczności",
  "shell.competitors":      "Przegląd konkurencji",
  "shell.content-gaps":     "Analiza luk",
  "shell.link-building":    "Prospekty linków",
  "shell.backlinks":        "Profil backlinków",
  "shell.on-site":          "Zdrowie strony",
  "shell.insights":         "Wnioski AI",
  "shell.ai-research":      "Odkrywanie słów",
  "shell.strategy":         "Plan działania",
  "shell.keyword-analysis": "Metryki słów",
  "shell.generators":       "Generator schematów",
  "shell.settings":         "Konfiguracja",
  "score": "Wynik",
  "keywords": "Słowa",
  "top3": "Top 3",
  "totalLinks": "Linki",
  "refDomains": "Domeny",
  "avgDR": "Śr. DR",
  "velocity": "Tempo",
  "critical": "Krytyczne",
  "warnings": "Ostrzeżenia",
  "passed": "Poprawne",
  "ins.longtail": "Dodaj long-tail keywords",
  "ins.backlinks": "Napraw zepsute backlinki",
  "ins.speed": "Popraw szybkość strony",
  "ins.content": "Stwórz treści filarowe",
  "ins.catKeywords": "Słowa kluczowe",
  "ins.catLinks": "Linki",
  "ins.catTechnical": "Techniczne",
  "ins.catContent": "Treść",
  "high": "Wys",
  "med": "Śr",
  "low": "Nis",
  "guestPost": "Wpis gośc.",
  "resource": "Zasób",
  "mention": "Wzmianka",
  "outreach": "Outreach",
  "str.optimize": "Optymalizuj top 10 stron",
  "str.backlinks": "Zbuduj 20 backlinków",
  "str.audit": "Napraw krytyczne błędy",
  "str.gaps": "Stwórz treści na luki",
  "str.monitor": "Monitoruj zmiany pozycji",
  "searchEngine": "Wyszukiwarka",
  "location": "Lokalizacja",
  "language": "Język",
  "frequency": "Częstotliwość",
  "daily": "Codziennie",
  "copy": "Kopiuj",
  "you": "Ty",
  "info": "info",
  "comm": "handl",
  "trans": "trans",
  "brand": "marka",
};

function loc(key: string, locale?: string): string {
  if (locale === "pl") return I18N_PL[key] ?? I18N[key] ?? key;
  return I18N[key] ?? key;
}

// ─── Tiny reusable UI pieces ────────────────────────────────────────

function TinyBadge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      className="inline-flex rounded-full px-1 py-px text-[7px] font-semibold leading-tight"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function DividerLine() {
  return (
    <div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-neutral-800" />
  );
}

// ─── Skeleton shell: agenforce double-card pattern ──────────────────

function SkeletonShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-neutral-300 bg-neutral-100 p-2.5 shadow-2xl dark:border-neutral-700 dark:bg-neutral-800">
      {/* Header bar */}
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-medium text-neutral-800 dark:text-white">
          {title}
        </p>
      </div>

      {/* Double-card: pattern bg + floating white card on top */}
      <div className="relative flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-700">
        {/* Diagonal pattern */}
        <div
          className="absolute inset-0 bg-fixed"
          style={{
            backgroundImage:
              "repeating-linear-gradient(315deg, rgba(0,0,0,0.05) 0, rgba(0,0,0,0.05) 1px, transparent 0, transparent 50%)",
            backgroundSize: "10px 10px",
          }}
        />

        {/* Floating white card — offset, slides on hover */}
        <div className="absolute inset-0 translate-x-2 -translate-y-2 overflow-hidden rounded-lg border border-neutral-100 bg-white shadow-sm transition-all duration-300 group-hover:translate-x-0 group-hover:-translate-y-0 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="h-full w-full p-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton content per module ────────────────────────────────────

function SkeletonMonitoring({ color, data }: { color: string; data?: ModuleHubData }) {
  const kws = data?.keywords?.slice(0, 5) ?? ["seo audit tool", "keyword tracker", "serp checker", "rank monitor", "site analysis"];
  const rows = [
    { kw: kws[0], pos: "#1", change: "+2", posColor: "#16a34a", spark: [4, 3, 5, 2, 1] },
    { kw: kws[1], pos: "#4", change: "+1", posColor: "#2563eb", spark: [6, 5, 4, 5, 4] },
    { kw: kws[2], pos: "#12", change: "-3", posColor: "#f59e0b", spark: [3, 4, 6, 5, 7] },
    { kw: kws[3], pos: "#8", change: "0", posColor: "#2563eb", spark: [5, 5, 4, 5, 5] },
    { kw: kws[4], pos: "#23", change: "+5", posColor: "#f59e0b", spark: [7, 6, 5, 4, 3] },
  ];
  return (
    <>
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex items-center justify-between px-2.5 py-1">
            <div className="flex items-center gap-1.5">
              <TinyBadge label={r.pos} bg={`${r.posColor}18`} fg={r.posColor} />
              <p className="truncate text-[7px] font-medium text-neutral-500 dark:text-neutral-300">{r.kw}</p>
            </div>
            <div className="flex items-center gap-1 text-neutral-400">
              <svg width="20" height="8" className="shrink-0">
                {r.spark.map((h, j) => (
                  <rect key={j} x={j * 4.2} y={8 - h} width="3" height={h} rx="0.5" fill={color} opacity="0.45" />
                ))}
              </svg>
              <span className={cx("text-[7px] font-bold", r.change.startsWith("+") ? "text-green-500" : r.change.startsWith("-") ? "text-red-400" : "text-neutral-400")}>
                {r.change}
              </span>
            </div>
          </div>
          {i < rows.length - 1 && <DividerLine />}
        </div>
      ))}
    </>
  );
}

function SkeletonKeywordMap({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  // Scatter-plot style: bubbles with no text, axis grid, legend
  const bubbles = [
    { c: "#8b5cf6", size: 18, x: 15, y: 20, opacity: 0.7 },
    { c: "#8b5cf6", size: 10, x: 25, y: 35, opacity: 0.5 },
    { c: "#3b82f6", size: 22, x: 42, y: 15, opacity: 0.7 },
    { c: "#3b82f6", size: 12, x: 55, y: 55, opacity: 0.5 },
    { c: "#3b82f6", size: 8, x: 35, y: 65, opacity: 0.4 },
    { c: "#10b981", size: 16, x: 68, y: 42, opacity: 0.65 },
    { c: "#10b981", size: 10, x: 78, y: 28, opacity: 0.5 },
    { c: "#f59e0b", size: 14, x: 50, y: 38, opacity: 0.6 },
    { c: color, size: 20, x: 30, y: 48, opacity: 0.75 },
    { c: color, size: 12, x: 62, y: 68, opacity: 0.5 },
    { c: "#8b5cf6", size: 7, x: 80, y: 60, opacity: 0.4 },
    { c: "#3b82f6", size: 9, x: 20, y: 72, opacity: 0.4 },
    { c: "#10b981", size: 14, x: 45, y: 72, opacity: 0.5 },
  ];
  return (
    <div className="relative h-full p-3">
      {/* Legend */}
      <div className="mb-2 flex gap-3">
        {[
          { lbl: loc("info", l), c: "#3b82f6" },
          { lbl: loc("comm", l), c: "#8b5cf6" },
          { lbl: loc("trans", l), c: "#10b981" },
          { lbl: loc("brand", l), c: color },
        ].map((t, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.c }} />
            <span className="text-[9px] text-neutral-400">{t.lbl}</span>
          </div>
        ))}
      </div>
      {/* Axis grid lines */}
      <svg className="absolute inset-0 h-full w-full" style={{ top: 28, left: 12, right: 12, bottom: 8 }}>
        {[25, 50, 75].map((pct) => (
          <line key={`h${pct}`} x1="0" y1={`${pct}%`} x2="100%" y2={`${pct}%`} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" />
        ))}
        {[25, 50, 75].map((pct) => (
          <line key={`v${pct}`} x1={`${pct}%`} y1="0" x2={`${pct}%`} y2="100%" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" />
        ))}
      </svg>
      {/* Scatter bubbles — no labels */}
      {bubbles.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.x}%`,
            top: `${b.y}%`,
            backgroundColor: b.c,
            opacity: b.opacity,
          }}
        />
      ))}
    </div>
  );
}

function SkeletonVisibility({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  const score = data?.visibilityScore ?? 72.4;
  const kwCount = data?.keywordCount ?? 142;
  const points = [10, 15, 12, 18, 22, 20, 28, 32, 30, 38, 42, 45];
  const max = 50;
  const w = 100;
  const h = 36;
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * w},${h - (p / max) * h}`).join(" ");
  const areaD = `${pathD} L${w},${h} L0,${h} Z`;

  return (
    <div className="flex h-full flex-col px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-4">
          {[
            { label: loc("score", l), value: String(score) },
            { label: loc("keywords", l), value: String(kwCount) },
            { label: loc("top3", l), value: "18" },
          ].map((s, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-[9px] text-neutral-400">{s.label}</span>
              <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">{s.value}</span>
            </div>
          ))}
        </div>
        <span className="text-xs font-semibold text-green-500">+12%</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="flex-1">
        <defs>
          <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#vg)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
      </svg>
    </div>
  );
}

function SkeletonCompetitors({ color, data }: { color: string; data?: ModuleHubData }) {
  const domain = data?.domain ?? "yoursite.com";
  const comps = data?.competitors?.slice(0, 3) ?? ["competitor1.pl", "rival-seo.com", "seotools.io"];
  const competitors = [
    { domain, score: 78, isOwn: true },
    ...comps.map((d, i) => ({ domain: d, score: 65 - i * 12, isOwn: false })),
  ];
  return (
    <>
      {competitors.map((c, i) => (
        <div key={i}>
          <div className="flex items-center gap-3 px-4 py-2">
            <div
              className={cx("h-3 w-3 rounded-sm", c.isOwn ? "ring-1 ring-current" : "")}
              style={{ backgroundColor: c.isOwn ? color : `${color}40`, color: c.isOwn ? color : undefined }}
            />
            <span className={cx("w-24 truncate text-xs", c.isOwn ? "font-bold text-neutral-800 dark:text-white" : "text-neutral-500 dark:text-neutral-400")}>
              {c.domain}
            </span>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div className="h-2 rounded-full" style={{ width: `${c.score}%`, backgroundColor: c.isOwn ? color : `${color}50` }} />
              </div>
            </div>
            <span className="w-6 text-right text-xs font-bold text-neutral-600 dark:text-neutral-300">{c.score}</span>
          </div>
          {i < competitors.length - 1 && <DividerLine />}
        </div>
      ))}
    </>
  );
}

function SkeletonContentGaps({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  const gaps = [
    { kw: "seo audit free", you: false, c1: true, c2: true, vol: "2.4K" },
    { kw: "keyword research", you: true, c1: true, c2: false, vol: "8.1K" },
    { kw: "backlink checker", you: false, c1: true, c2: true, vol: "5.2K" },
    { kw: "site speed test", you: false, c1: false, c2: true, vol: "3.7K" },
  ];
  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-1.5">
        <span className="flex-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">Keyword</span>
        {[loc("you", l), "C1", "C2"].map((h, j) => (
          <div key={j} className="flex w-5 justify-center">
            <span className="text-[8px] font-semibold text-neutral-400">{h}</span>
          </div>
        ))}
        <span className="w-7 text-right text-[8px] font-semibold text-neutral-400">Vol</span>
      </div>
      <DividerLine />
      {gaps.map((g, i) => (
        <div key={i}>
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">{g.kw}</span>
            {[g.you, g.c1, g.c2].map((has, j) => (
              <div key={j} className="flex w-5 justify-center">
                <div className={cx("h-2.5 w-2.5 rounded-full", has ? "bg-green-400" : "bg-red-300 dark:bg-red-400/40")} />
              </div>
            ))}
            <span className="w-7 text-right text-[10px] font-medium text-neutral-400">{g.vol}</span>
          </div>
          {i < gaps.length - 1 && <DividerLine />}
        </div>
      ))}
    </>
  );
}

function SkeletonLinkBuilding({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  const prospects = [
    { domain: "blog.example.com", da: 62, type: loc("guestPost", l), done: true },
    { domain: "resources.io", da: 48, type: loc("resource", l), done: true },
    { domain: "news-portal.pl", da: 71, type: loc("mention", l), done: false },
    { domain: "techblog.com", da: 55, type: loc("outreach", l), done: false },
  ];
  return (
    <>
      {prospects.map((p, i) => (
        <div key={i}>
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ backgroundColor: p.da > 60 ? "#16a34a" : p.da > 40 ? "#f59e0b" : "#ef4444" }}
              >
                {p.da}
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{p.domain}</p>
                <p className="text-[9px] text-neutral-400">{p.type}</p>
              </div>
            </div>
            {p.done ? (
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" /></svg>
              </div>
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-neutral-300 dark:border-neutral-600" />
            )}
          </div>
          {i < prospects.length - 1 && <DividerLine />}
        </div>
      ))}
    </>
  );
}

function SkeletonBacklinks({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  const total = data?.backlinkCount ?? 1247;
  const domains = data?.referringDomains ?? 342;
  return (
    <div className="flex h-full flex-col px-4 py-3">
      <div className="mb-3 flex gap-4">
        {[
          { label: loc("totalLinks", l), value: total.toLocaleString() },
          { label: loc("refDomains", l), value: domains.toLocaleString() },
          { label: loc("avgDR", l), value: "38" },
        ].map((s, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-[9px] text-neutral-400">{s.label}</span>
            <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="mb-3">
        <div className="mb-1 flex justify-between">
          <span className="text-[9px] text-neutral-400">dofollow 78%</span>
          <span className="text-[9px] text-neutral-400">nofollow 22%</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full">
          <div className="h-full rounded-l-full" style={{ width: "78%", backgroundColor: color }} />
          <div className="h-full flex-1 rounded-r-full bg-neutral-200 dark:bg-neutral-700" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-neutral-400">{loc("velocity", l)}</span>
        <svg width="80" height="14" className="flex-1">
          {[2, 4, 3, 6, 5, 8, 4, 7, 9, 6].map((h, j) => (
            <rect key={j} x={j * 8} y={14 - h * 1.4} width="6" height={h * 1.4} rx="1" fill={color} opacity="0.5" />
          ))}
        </svg>
        <span className="text-xs font-semibold text-green-500">+12/d</span>
      </div>
    </div>
  );
}

function SkeletonOnSite({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  const score = data?.healthScore ?? 87;
  const pct = score / 100;
  return (
    <div className="flex h-full items-center gap-5 px-5 py-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <svg width="64" height="64" viewBox="0 0 64 64" className="absolute">
          <circle cx="32" cy="32" r="27" fill="none" stroke="#e5e7eb" strokeWidth="4" className="dark:stroke-neutral-700" />
          <circle
            cx="32" cy="32" r="27"
            fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${pct * 169.6} ${169.6}`}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
            opacity="0.8"
          />
        </svg>
        <span className="text-lg font-bold text-neutral-800 dark:text-white">{score}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {[
          { label: loc("critical", l), count: "3", c: "#ef4444" },
          { label: loc("warnings", l), count: "12", c: "#f59e0b" },
          { label: loc("passed", l), count: "45", c: "#22c55e" },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.c }} />
            <span className="flex-1 text-xs text-neutral-500 dark:text-neutral-400">{s.label}</span>
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonInsights({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  const insights = [
    { title: loc("ins.longtail", l), prio: loc("high", l), prioC: "#ef4444", cat: loc("ins.catKeywords", l) },
    { title: loc("ins.backlinks", l), prio: loc("med", l), prioC: "#f59e0b", cat: loc("ins.catLinks", l) },
    { title: loc("ins.speed", l), prio: loc("high", l), prioC: "#ef4444", cat: loc("ins.catTechnical", l) },
    { title: loc("ins.content", l), prio: loc("low", l), prioC: "#22c55e", cat: loc("ins.catContent", l) },
  ];
  return (
    <>
      {insights.map((ins, i) => (
        <div key={i}>
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ins.prioC }} />
              <div>
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{ins.title}</p>
                <p className="text-[9px] text-neutral-400">{ins.cat}</p>
              </div>
            </div>
            <TinyBadge label={ins.prio} bg={`${ins.prioC}15`} fg={ins.prioC} />
          </div>
          {i < insights.length - 1 && <DividerLine />}
        </div>
      ))}
    </>
  );
}

function SkeletonAiResearch({ color, data }: { color: string; data?: ModuleHubData }) {
  const domain = data?.domain ?? "yoursite.com";
  const keywords = [
    { kw: `best ${domain.split(".")[0]} alternatives`, intent: "comm", iC: "#8b5cf6", vol: "4.2K" },
    { kw: "how to improve seo", intent: "info", iC: "#3b82f6", vol: "12K" },
    { kw: "seo agency pricing", intent: "trans", iC: "#10b981", vol: "1.8K" },
    { kw: "google ranking tips", intent: "info", iC: "#3b82f6", vol: "6.5K" },
  ];
  return (
    <>
      {keywords.map((k, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="h-3 w-3 shrink-0 rounded-sm border border-neutral-300 dark:border-neutral-600" />
            <span className="flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">{k.kw}</span>
            <TinyBadge label={k.intent} bg={`${k.iC}15`} fg={k.iC} />
            <span className="w-7 text-right text-[10px] font-medium text-neutral-400">{k.vol}</span>
          </div>
          {i < keywords.length - 1 && <DividerLine />}
        </div>
      ))}
    </>
  );
}

function SkeletonStrategy({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  const steps = [
    { label: loc("str.optimize", l), done: true, time: "2d" },
    { label: loc("str.backlinks", l), done: true, time: "5d" },
    { label: loc("str.audit", l), done: false, time: "3d" },
    { label: loc("str.gaps", l), done: false, time: "7d" },
    { label: loc("str.monitor", l), done: false, time: "1d" },
  ];
  return (
    <>
      {steps.map((s, i) => (
        <div key={i}>
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              {s.done ? (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" /></svg>
                </div>
              ) : (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
              )}
              <p className={cx("text-xs font-medium", s.done ? "text-neutral-400 line-through dark:text-neutral-600" : "text-neutral-500 dark:text-neutral-300")}>{s.label}</p>
            </div>
            <p className="text-[10px] font-bold text-neutral-400">{s.time}</p>
          </div>
          {i < steps.length - 1 && <DividerLine />}
        </div>
      ))}
    </>
  );
}

function SkeletonKeywordAnalysis({ color }: { color: string }) {
  const kws = [
    { kw: "seo software", vol: "8.1K", kd: 62, cpc: "$4.20" },
    { kw: "rank tracker", vol: "5.4K", kd: 45, cpc: "$3.10" },
    { kw: "serp analysis", vol: "2.1K", kd: 38, cpc: "$2.80" },
    { kw: "position check", vol: "1.8K", kd: 29, cpc: "$1.50" },
  ];
  return (
    <>
      {kws.map((k, i) => (
        <div key={i}>
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">{k.kw}</span>
            <span className="w-7 text-right text-[10px] font-medium text-neutral-400">{k.vol}</span>
            <div className="w-8">
              <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div className="h-2 rounded-full" style={{ width: `${k.kd}%`, backgroundColor: k.kd > 50 ? "#ef4444" : k.kd > 30 ? "#f59e0b" : "#22c55e" }} />
              </div>
            </div>
            <span className="w-8 text-right text-[10px] font-medium text-neutral-400">{k.cpc}</span>
          </div>
          {i < kws.length - 1 && <DividerLine />}
        </div>
      ))}
    </>
  );
}

function SkeletonGenerators({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  const domain = data?.domain ?? "yoursite.com";
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 dark:border-neutral-800">
        <div className="flex gap-2">
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-[9px] font-medium text-green-400 dark:bg-neutral-700">JSON-LD</span>
          <span className="rounded px-2 py-0.5 text-[9px] text-neutral-400">LLMs.txt</span>
        </div>
        <div className="rounded border border-neutral-200 px-2 py-0.5 text-[9px] text-neutral-400 dark:border-neutral-700">{loc("copy", l)}</div>
      </div>
      <div className="flex-1 bg-neutral-950 px-4 py-3 dark:bg-neutral-800/50">
        {[
          { indent: 0, text: '{  "@context": "schema.org",' },
          { indent: 1, text: '"@type": "Organization",' },
          { indent: 1, text: `"name": "${domain}",` },
          { indent: 1, text: `"url": "https://${domain}",` },
          { indent: 1, text: '"sameAs": [...]' },
          { indent: 0, text: "}" },
        ].map((line, i) => (
          <div key={i} style={{ paddingLeft: line.indent * 12 }}>
            <span className="text-[10px] font-mono leading-relaxed text-green-400/70">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonSettings({ color, data }: { color: string; data?: ModuleHubData }) {
  const l = data?.locale;
  const fields = [
    { label: loc("searchEngine", l), value: data?.searchEngine ?? "Google" },
    { label: loc("location", l), value: data?.location ?? "Poland" },
    { label: loc("language", l), value: data?.language ?? "Polish" },
    { label: loc("frequency", l), value: loc("daily", l) },
  ];
  return (
    <>
      {fields.map((f, i) => (
        <div key={i}>
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{f.label}</span>
            <div className="flex items-center gap-1 rounded border border-neutral-200 px-2.5 py-1 dark:border-neutral-700">
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{f.value}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 4L5 6L7 4" stroke="currentColor" strokeWidth="1.2" className="text-neutral-400" />
              </svg>
            </div>
          </div>
          {i < fields.length - 1 && <DividerLine />}
        </div>
      ))}
    </>
  );
}

// ─── Maps ────────────────────────────────────────────────────────────

function skeletonLabel(tabId: string, locale?: string): string {
  return loc(`shell.${tabId}`, locale);
}

const SKELETON_MAP: Record<
  string,
  (props: { color: string; data?: ModuleHubData }) => ReactNode
> = {
  monitoring: SkeletonMonitoring,
  "keyword-map": SkeletonKeywordMap,
  visibility: SkeletonVisibility,
  competitors: SkeletonCompetitors,
  "content-gaps": SkeletonContentGaps,
  "link-building": SkeletonLinkBuilding,
  backlinks: SkeletonBacklinks,
  "on-site": SkeletonOnSite,
  insights: SkeletonInsights,
  "ai-research": SkeletonAiResearch,
  strategy: SkeletonStrategy,
  "keyword-analysis": SkeletonKeywordAnalysis,
  generators: SkeletonGenerators,
  settings: SkeletonSettings,
};

// ─── Main card component ────────────────────────────────────────────

export function ModuleHubCard({
  tabId,
  title,
  description,
  icon,
  state,
  colors,
  onClick,
  data,
}: ModuleHubCardProps) {
  const isLocked = state.locked;
  const color1 = gradientFrom(colors);
  const color2 = gradientTo(colors);
  const SkeletonContent = SKELETON_MAP[tabId];

  return (
    <div className="group/card relative h-full">
      <div
        className={cx(
          "relative h-full rounded-2xl transition-all duration-200",
          isLocked
            ? "opacity-60 ring-1 ring-neutral-200 dark:ring-neutral-800"
            : "shadow-sm ring-1 ring-black/[0.08] hover:shadow-2xl hover:shadow-black/10 dark:ring-white/[0.06]"
        )}
      >
        {!isLocked && (
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        )}
      <button
        type="button"
        onClick={isLocked ? undefined : onClick}
        disabled={isLocked}
        className={cx(
          "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl text-left",
          isLocked
            ? "cursor-not-allowed bg-neutral-50 dark:bg-neutral-900"
            : "bg-neutral-50 dark:bg-neutral-800"
        )}
      >

      {/* Dotted background pattern with diagonal fade */}
      <div
        className="pointer-events-none absolute inset-0 z-0 dark:hidden"
        style={{
          backgroundImage: "radial-gradient(circle at 0.5px 0.5px, rgba(0,0,0,0.15) 0.5px, transparent 0)",
          backgroundSize: "8px 8px",
          maskImage: "linear-gradient(to top left, black 0%, transparent 60%)",
          WebkitMaskImage: "linear-gradient(to top left, black 0%, transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden dark:block"
        style={{
          backgroundImage: "radial-gradient(circle at 0.5px 0.5px, rgba(255,255,255,0.15) 0.5px, transparent 0)",
          backgroundSize: "8px 8px",
          maskImage: "linear-gradient(to top left, black 0%, transparent 60%)",
          WebkitMaskImage: "linear-gradient(to top left, black 0%, transparent 60%)",
        }}
      />

      {/* ── Top: 3D Skeleton (dominant, ~65% of card) ──────────────── */}
      <div
        className="relative h-72 overflow-hidden sm:h-56 md:h-72"
        style={{ perspective: "1200px" }}
      >
        {/* Orange gradient — under skeleton, bottom half only */}
        <div
          className="pointer-events-none absolute z-0"
          style={{
            left: "-100px",
            right: "0",
            bottom: "0",
            top: "auto",
            height: "50%",
            transform: "scale(0.4, 1.56)",
            background: "radial-gradient(circle at 60% 20%, rgba(255, 192, 43, 0.6) 0%, rgba(238, 238, 238, 0) 45%)",
          }}
        />

        {/* Radial fade mask wrapping the 3D content */}
        <div
          className="absolute inset-0 z-10"
          style={{
            maskImage:
              "radial-gradient(ellipse 90% 85% at 50% 50%, black 35%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 85% at 50% 50%, black 35%, transparent 80%)",
          }}
        >
          {/* 3D rotated skeleton */}
          <div
            style={{
              transform: "rotateY(20deg) rotateX(20deg) rotateZ(-10deg)",
              transformOrigin: "center center",
            }}
            className="mx-auto h-full w-[88%] translate-x-3 pt-2"
          >
            {SkeletonContent && (
              <SkeletonShell
                title={skeletonLabel(tabId, data?.locale) ?? title}
                icon={
                  <EzIcon
                    name={icon}
                    size={10}
                    color={isLocked ? "#9ca3af" : color1}
                    strokeColor={isLocked ? "#9ca3af" : color1}
                  />
                }
              >
                <SkeletonContent
                  color={isLocked ? "#9ca3af" : color1}
                  data={data}
                />
              </SkeletonShell>
            )}
          </div>
        </div>

        {/* Orange semicircle backlight — inside skeleton container, clipped by overflow-hidden */}
        {!isLocked && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[-1] h-28"
          >
            <div
              className="absolute inset-x-[-10%] top-0 h-56 rounded-[50%] opacity-0 blur-2xl transition-all duration-500 group-hover/card:inset-x-[-20%] group-hover/card:opacity-40"
              style={{ background: "radial-gradient(ellipse at 50% 30%, #f97316, transparent 70%)" }}
            />
          </div>
        )}

        {/* Bottom gradient fade into card bg */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-neutral-50 to-transparent dark:from-neutral-800" />
      </div>

      {/* ── Bottom: Title + Description + CTA ──────────────────────── */}
      <div className="flex items-center justify-between px-5 pb-5 pt-1">
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm"
              style={
                isLocked
                  ? { background: "linear-gradient(135deg, #d1d5db, #9ca3af)" }
                  : { background: `linear-gradient(135deg, ${color1}, ${color2})` }
              }
            >
              {isLocked ? (
                <EzIcon name="lock-01" size={13} color="white" strokeColor="white" />
              ) : (
                <EzIcon name={icon} size={13} color="white" strokeColor="white" />
              )}
            </div>
            <div>
              <h3
                className={cx(
                  "text-sm font-bold leading-tight",
                  isLocked ? "text-neutral-400 dark:text-neutral-600" : "text-neutral-900 dark:text-white"
                )}
              >
                {title}
              </h3>
              {!isLocked && state.metric && (
                <span
                  className="text-xs font-medium"
                  style={{ color: color1 }}
                >
                  {state.metric}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CTA circle button */}
        {!isLocked && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 transition-colors group-hover:border-neutral-300 dark:border-neutral-700 dark:group-hover:border-neutral-600">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 7h6M7 4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-neutral-600 dark:text-neutral-300" />
            </svg>
          </div>
        )}
      </div>
    </button>
    </div>
    </div>
  );
}
