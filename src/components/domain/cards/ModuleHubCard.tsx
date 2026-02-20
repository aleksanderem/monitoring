"use client";

import { useState, useRef, useId, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EzIcon } from "@/components/foundations/ez-icon";
import type { ModuleState } from "@/hooks/useModuleReadiness";
import { cx } from "@/utils/cx";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import {
  ReactFlowProvider,
  useReactFlow,
  Panel,
  type Node as RFNode,
  type Edge as RFEdge,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import { Canvas } from "@/components/ai/canvas";

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
  onNavigateToTab?: (tabId: string) => void;
  data?: ModuleHubData;
  benefitText?: string;
  benefitLabel?: string;
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
  // Dependency diagram
  "flow.title": "Setup Path",
  "flow.startHere": "Start here",
  "flow.currentModule": "You are here",
  "flow.noPrereqs": "This is the starting point — no prerequisites needed.",
  // Edge labels: what data flows between modules
  "edge.settings>monitoring": "Keywords & domain config",
  "edge.settings>competitors": "Domain URL",
  "edge.settings>backlinks": "Domain to crawl",
  "edge.settings>on-site": "Domain URL to audit",
  "edge.settings>ai-research": "Domain context & niche",
  "edge.settings>generators": "Domain info & schema",
  "edge.monitoring>keyword-map": "Keyword positions & intent",
  "edge.monitoring>visibility": "Position data for all keywords",
  "edge.monitoring>content-gaps": "Your tracked keywords",
  "edge.monitoring>insights": "Ranking data & trends",
  "edge.monitoring>strategy": "Current rankings",
  "edge.monitoring>keyword-analysis": "Keywords to analyze",
  "edge.competitors>content-gaps": "Competitor domains & rankings",
  "edge.competitors>insights": "Competition metrics",
  "edge.backlinks>link-building": "Backlink profile & gaps",
  "edge.on-site>insights": "Health score & audit issues",
  "edge.insights>strategy": "AI recommendations & priorities",
  "flow.viewModule": "This module",
  "flow.viewSystem": "Full system",
  // Module descriptions — what each module does, for Marcin from Bydgoszcz
  "desc.settings": "Set up your domain, pick keywords to track, choose search engine & location.",
  "desc.monitoring": "Check daily keyword positions — see who's rising or falling in Google.",
  "desc.keyword-map": "Keywords organized by topic — spot clusters and find content opportunities.",
  "desc.visibility": "One score showing how visible your site is in search results overall.",
  "desc.competitors": "See which competitors rank for your keywords and how you compare.",
  "desc.content-gaps": "Find keywords your competitors rank for but you don't — easy wins.",
  "desc.link-building": "Discover websites that could link to you and track outreach progress.",
  "desc.backlinks": "All links pointing to your site — their quality, type, and growth.",
  "desc.on-site": "Scan your site for technical problems — broken links, speed, meta tags.",
  "desc.insights": "AI reads all your data and tells you exactly what to fix first.",
  "desc.ai-research": "AI suggests new keywords you should target based on your niche.",
  "desc.strategy": "Prioritized to-do list: what to fix, create, and optimize — step by step.",
  "desc.keyword-analysis": "Deep metrics for each keyword — search volume, difficulty, cost per click.",
  "desc.generators": "Auto-generate schema markup and structured data for rich snippets.",
  // Lock reasons
  "lockReasonAddKeywordsAndCheck": "Add keywords and run first position check",
  "lockReasonRunSerpCheck": "Run first SERP check to unlock",
  "lockReasonAddCompetitors": "Add 2-3 competitors to unlock",
  "lockReasonRunAnalysis": "Add competitors and run analysis first",
  "lockReasonFetchBacklinks": "Fetch backlinks data to unlock",
  "lockReasonRunAudit": "Run first site audit to unlock",
  "lockReasonSetContext": "Set business context to unlock",
  "lockReasonAddKeywords": "Add keywords first to unlock",
  "lockMoreInfo": "How does it work?",
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
  // Dependency diagram
  "flow.title": "Ścieżka konfiguracji",
  "flow.startHere": "Zacznij tutaj",
  "flow.currentModule": "Jesteś tutaj",
  "flow.noPrereqs": "To jest punkt startowy — brak wymagań wstępnych.",
  // Edge labels
  "edge.settings>monitoring": "Słowa kluczowe i konfiguracja domeny",
  "edge.settings>competitors": "URL domeny",
  "edge.settings>backlinks": "Domena do analizy",
  "edge.settings>on-site": "URL domeny do audytu",
  "edge.settings>ai-research": "Kontekst domeny i niszy",
  "edge.settings>generators": "Dane domeny i schemat",
  "edge.monitoring>keyword-map": "Pozycje słów i intencje",
  "edge.monitoring>visibility": "Dane pozycji wszystkich słów",
  "edge.monitoring>content-gaps": "Twoje śledzone słowa kluczowe",
  "edge.monitoring>insights": "Dane rankingowe i trendy",
  "edge.monitoring>strategy": "Aktualne pozycje",
  "edge.monitoring>keyword-analysis": "Słowa kluczowe do analizy",
  "edge.competitors>content-gaps": "Domeny konkurencji i rankingi",
  "edge.competitors>insights": "Metryki konkurencji",
  "edge.backlinks>link-building": "Profil backlinków i luki",
  "edge.on-site>insights": "Wynik zdrowia i błędy audytu",
  "edge.insights>strategy": "Rekomendacje AI i priorytety",
  "flow.viewModule": "Ten moduł",
  "flow.viewSystem": "Cały system",
  // Module descriptions
  "desc.settings": "Skonfiguruj domenę, wybierz słowa kluczowe, wyszukiwarkę i lokalizację.",
  "desc.monitoring": "Sprawdzaj dzienne pozycje słów kluczowych — kto rośnie, kto spada w Google.",
  "desc.keyword-map": "Słowa kluczowe pogrupowane tematycznie — znajdź klastry i szanse na treści.",
  "desc.visibility": "Jeden wynik pokazujący jak widoczna jest Twoja strona w wynikach wyszukiwania.",
  "desc.competitors": "Zobacz kto konkuruje o Twoje frazy i jak wypadasz na ich tle.",
  "desc.content-gaps": "Znajdź frazy na które rankują konkurenci, ale nie Ty — łatwe wygrane.",
  "desc.link-building": "Odkryj strony które mogą linkować do Ciebie, śledź postępy outreach.",
  "desc.backlinks": "Wszystkie linki do Twojej strony — jakość, typ i wzrost w czasie.",
  "desc.on-site": "Skanuj stronę pod kątem problemów technicznych — linki, szybkość, meta tagi.",
  "desc.insights": "AI analizuje wszystkie dane i mówi co naprawić w pierwszej kolejności.",
  "desc.ai-research": "AI podpowiada nowe słowa kluczowe dopasowane do Twojej niszy.",
  "desc.strategy": "Lista priorytetów: co naprawić, stworzyć i zoptymalizować — krok po kroku.",
  "desc.keyword-analysis": "Szczegółowe metryki słów — wolumen, trudność, koszt za kliknięcie.",
  "desc.generators": "Automatyczne generowanie schema markup dla lepszych rich snippets.",
  // Lock reasons
  "lockReasonAddKeywordsAndCheck": "Dodaj słowa kluczowe i uruchom pierwszy check pozycji",
  "lockReasonRunSerpCheck": "Uruchom pierwszy check SERP aby odblokować",
  "lockReasonAddCompetitors": "Dodaj 2-3 konkurentów aby odblokować",
  "lockReasonRunAnalysis": "Dodaj konkurentów i uruchom analizę",
  "lockReasonFetchBacklinks": "Pobierz dane backlinków aby odblokować",
  "lockReasonRunAudit": "Uruchom pierwszy audyt strony aby odblokować",
  "lockReasonSetContext": "Ustaw kontekst biznesowy aby odblokować",
  "lockReasonAddKeywords": "Dodaj słowa kluczowe aby odblokować",
  "lockMoreInfo": "Jak to działa?",
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

// ─── Module dependency graph ─────────────────────────────────────────

const MODULE_COLORS: Record<string, [string, string]> = {
  monitoring:         ["#6366f1", "#818cf8"],  // indigo
  "keyword-map":      ["#8b5cf6", "#a78bfa"],  // violet
  visibility:         ["#0ea5e9", "#38bdf8"],  // sky
  competitors:        ["#f43f5e", "#fb7185"],  // rose
  "content-gaps":     ["#f59e0b", "#fbbf24"],  // amber
  "link-building":    ["#10b981", "#34d399"],  // emerald
  backlinks:          ["#14b8a6", "#2dd4bf"],  // teal
  "on-site":          ["#ec4899", "#f472b6"],  // pink
  insights:           ["#a855f7", "#c084fc"],  // purple
  "ai-research":      ["#3b82f6", "#60a5fa"],  // blue
  strategy:           ["#ef4444", "#f87171"],  // red
  "keyword-analysis": ["#06b6d4", "#22d3ee"],  // cyan
  generators:         ["#84cc16", "#a3e635"],  // lime
  settings:           ["#64748b", "#94a3b8"],  // slate
};

const MODULE_ICONS: Record<string, string> = {
  monitoring: "activity-04",
  "keyword-map": "map-pin",
  visibility: "eye",
  competitors: "user-group",
  "content-gaps": "puzzle",
  "link-building": "share-08",
  backlinks: "link-06",
  "on-site": "audit-01",
  insights: "idea",
  "ai-research": "ai-magic",
  strategy: "strategy",
  "keyword-analysis": "search-02",
  generators: "code",
  settings: "settings-05",
};

interface DepEdge {
  from: string;
  dataKey: string;
}

const MODULE_DEPS: Record<string, DepEdge[]> = {
  settings: [],
  monitoring: [{ from: "settings", dataKey: "edge.settings>monitoring" }],
  "keyword-map": [{ from: "monitoring", dataKey: "edge.monitoring>keyword-map" }],
  visibility: [{ from: "monitoring", dataKey: "edge.monitoring>visibility" }],
  competitors: [{ from: "settings", dataKey: "edge.settings>competitors" }],
  "content-gaps": [
    { from: "competitors", dataKey: "edge.competitors>content-gaps" },
    { from: "monitoring", dataKey: "edge.monitoring>content-gaps" },
  ],
  "link-building": [{ from: "backlinks", dataKey: "edge.backlinks>link-building" }],
  backlinks: [{ from: "settings", dataKey: "edge.settings>backlinks" }],
  "on-site": [{ from: "settings", dataKey: "edge.settings>on-site" }],
  insights: [
    { from: "monitoring", dataKey: "edge.monitoring>insights" },
    { from: "competitors", dataKey: "edge.competitors>insights" },
    { from: "on-site", dataKey: "edge.on-site>insights" },
  ],
  "ai-research": [{ from: "settings", dataKey: "edge.settings>ai-research" }],
  strategy: [
    { from: "insights", dataKey: "edge.insights>strategy" },
    { from: "monitoring", dataKey: "edge.monitoring>strategy" },
  ],
  "keyword-analysis": [{ from: "monitoring", dataKey: "edge.monitoring>keyword-analysis" }],
  generators: [{ from: "settings", dataKey: "edge.settings>generators" }],
};

// Maps lockReason → module(s) where the user needs to take action
const LOCK_PREREQS: Record<string, string[]> = {
  lockReasonAddKeywordsAndCheck: ["settings"],
  lockReasonRunSerpCheck:        ["monitoring"],
  lockReasonAddCompetitors:      ["settings"],
  lockReasonRunAnalysis:         ["competitors"],
  lockReasonFetchBacklinks:      ["settings"],
  lockReasonRunAudit:            ["settings"],
  lockReasonSetContext:           ["settings"],
  lockReasonAddKeywords:          ["settings"],
};

function resolveChain(tabId: string): string[] {
  const visited = new Set<string>();
  const order: string[] = [];
  function dfs(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    for (const dep of MODULE_DEPS[id] ?? []) dfs(dep.from);
    order.push(id);
  }
  dfs(tabId);
  return order;
}

// ─── ReactFlow custom node for the dependency diagram ────────────────

interface ModuleNodeData {
  label: string;
  icon: string;
  isCurrent: boolean;
  isStart: boolean;
  color1?: string;
  color2?: string;
  locale?: string;
  description?: string;
  stepNumber?: number;
  horizontal?: boolean;
  [key: string]: unknown;
}

function ModuleFlowNode({ data }: { data: ModuleNodeData }) {
  const { label, icon, isCurrent, isStart, color1, color2, locale, description, stepNumber, horizontal } = data;

  const targetPos = horizontal ? Position.Left : Position.Top;
  const sourcePos = horizontal ? Position.Right : Position.Bottom;

  const hdl = "!bg-neutral-300 !border-none !w-1.5 !h-1.5 dark:!bg-neutral-600";

  return (
    <>
      {/* Target handles — edges arrive here */}
      <Handle type="target" id="t-top" position={Position.Top} className={hdl} />
      <Handle type="target" id="t-bottom" position={Position.Bottom} className={hdl} />
      <Handle type="target" id="t-left" position={Position.Left} className={hdl} style={{ top: "50%" }} />
      <Handle type="target" id="t-right" position={Position.Right} className={hdl} style={{ top: "50%" }} />

      <div
        className={cx(
          "relative flex items-center gap-2.5 rounded-xl",
          description ? "px-4 py-3.5" : "px-3 py-2.5",
          isCurrent
            ? ""
            : !color1
              ? "border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
              : ""
        )}
        style={
          isCurrent && color1 && color2
            ? {
                background: `linear-gradient(135deg, ${color1}15, ${color2}08)`,
                boxShadow: `0 0 0 2px ${color1}50`,
                borderRadius: 12,
              }
            : !isCurrent && color1 && color2
              ? {
                  background: `linear-gradient(135deg, ${color1}0a, ${color2}06)`,
                  border: `1.5px solid ${color1}30`,
                  borderRadius: 12,
                }
              : undefined
        }
      >
        {/* Step number badge */}
        {stepNumber != null && (
          <div
            className="absolute -left-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shadow-sm"
            style={
              isCurrent && color1
                ? { background: color1, color: "white" }
                : { background: "#e5e7eb", color: "#525252" }
            }
          >
            {stepNumber}
          </div>
        )}

        <div
          className={cx(
            "flex shrink-0 items-center justify-center rounded-lg",
            description ? "h-9 w-9" : "h-7 w-7",
            isCurrent || color1 ? "" : "bg-neutral-100 dark:bg-neutral-800"
          )}
          style={
            isCurrent && color1 && color2
              ? { background: `linear-gradient(135deg, ${color1}, ${color2})` }
              : !isCurrent && color1 && color2
                ? { background: `linear-gradient(135deg, ${color1}25, ${color2}18)` }
                : undefined
          }
        >
          <EzIcon
            name={icon}
            size={description ? 18 : 14}
            color={isCurrent ? "white" : color1 ?? "#525252"}
            strokeColor={isCurrent ? "white" : color1 ?? "#525252"}
          />
        </div>
        <div className="flex flex-col">
          {isStart && !isCurrent && (
            <span className="text-[7px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
              {loc("flow.startHere", locale)}
            </span>
          )}
          {isCurrent && (
            <span
              className="text-[7px] font-bold uppercase tracking-wider"
              style={{ color: color1 }}
            >
              {loc("flow.currentModule", locale)}
            </span>
          )}
          <p
            className={cx(
              "whitespace-nowrap font-semibold leading-tight",
              description ? "text-[12px]" : "text-[11px]",
              isCurrent ? "text-neutral-900 dark:text-white" : "text-neutral-800 dark:text-neutral-200"
            )}
          >
            {label}
          </p>
          {description && (
            <p className="mt-0.5 max-w-[220px] text-[10px] leading-snug text-neutral-600 dark:text-neutral-300">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Source handles — edges depart from here */}
      <Handle type="source" id="s-top" position={Position.Top} className={hdl} />
      <Handle type="source" id="s-bottom" position={Position.Bottom} className={hdl} />
      <Handle type="source" id="s-left" position={Position.Left} className={hdl} style={{ top: "50%" }} />
      <Handle type="source" id="s-right" position={Position.Right} className={hdl} style={{ top: "50%" }} />
    </>
  );
}

const FLOW_NODE_TYPES = { module: ModuleFlowNode };
const ALL_MODULES = Object.keys(MODULE_DEPS);

// ─── Build ReactFlow nodes & edges from the dependency chain ─────────

function buildFlowGraph(
  tabId: string,
  locale: string | undefined,
  colors: [number, number, number][],
): { nodes: RFNode<ModuleNodeData>[]; edges: RFEdge[] } {
  const edgesDef = MODULE_DEPS[tabId];
  if (!edgesDef || edgesDef.length === 0) return { nodes: [], edges: [] };

  const chain = resolveChain(tabId);

  // Depth map
  const depthMap: Record<string, number> = {};
  function getDepth(id: string): number {
    if (depthMap[id] !== undefined) return depthMap[id];
    const deps = MODULE_DEPS[id] ?? [];
    if (deps.length === 0) { depthMap[id] = 0; return 0; }
    depthMap[id] = Math.max(...deps.map((e) => getDepth(e.from))) + 1;
    return depthMap[id];
  }
  for (const id of chain) getDepth(id);

  const maxDepth = depthMap[tabId];
  const levels: string[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    levels.push(chain.filter((id) => depthMap[id] === d));
  }

  const c1 = gradientFrom(colors);
  const c2 = gradientTo(colors);

  // Wider layout for detailed nodes with descriptions
  const NODE_W = 280;
  const NODE_GAP = 60;
  const LEVEL_Y_GAP = 220;

  const nodes: RFNode<ModuleNodeData>[] = [];
  for (let lIdx = 0; lIdx < levels.length; lIdx++) {
    const level = levels[lIdx];
    const totalW = level.length * NODE_W + (level.length - 1) * NODE_GAP;
    const startX = -totalW / 2;

    for (let nIdx = 0; nIdx < level.length; nIdx++) {
      const moduleId = level[nIdx];
      const isCurrent = moduleId === tabId;
      const isStart = lIdx === 0;

      const [mc1, mc2] = MODULE_COLORS[moduleId] ?? ["#64748b", "#94a3b8"];
      nodes.push({
        id: moduleId,
        type: "module",
        position: {
          x: startX + nIdx * (NODE_W + NODE_GAP),
          y: lIdx * LEVEL_Y_GAP,
        },
        data: {
          label: loc(`shell.${moduleId}`, locale),
          icon: MODULE_ICONS[moduleId] ?? "settings-05",
          isCurrent,
          isStart,
          color1: isCurrent ? c1 : mc1,
          color2: isCurrent ? c2 : mc2,
          locale,
          description: loc(`desc.${moduleId}`, locale),
          stepNumber: lIdx + 1,
        },
        selectable: false,
        connectable: false,
      });
    }
  }

  // Build position lookup for handle assignment
  const posMap: Record<string, { x: number }> = {};
  for (const n of nodes) posMap[n.id] = { x: n.position.x + NODE_W / 2 };

  // Upstream edges — use side handles so edges fan out/in naturally
  const flowEdges: RFEdge[] = [];
  for (const moduleId of chain) {
    for (const dep of MODULE_DEPS[moduleId] ?? []) {
      const srcCx = posMap[dep.from]?.x ?? 0;
      const tgtCx = posMap[moduleId]?.x ?? 0;
      const dx = tgtCx - srcCx;
      const threshold = NODE_W * 0.4;

      // Pick handles based on relative X: side handles for offset nodes, bottom/top for aligned
      let sourceHandle: string;
      let targetHandle: string;
      if (dx < -threshold) {
        sourceHandle = "s-left";
        targetHandle = "t-right";
      } else if (dx > threshold) {
        sourceHandle = "s-right";
        targetHandle = "t-left";
      } else {
        sourceHandle = "s-bottom";
        targetHandle = "t-top";
      }

      const [ec1] = MODULE_COLORS[moduleId] ?? ["#9ca3af"];

      flowEdges.push({
        id: `${dep.from}->${moduleId}`,
        source: dep.from,
        target: moduleId,
        sourceHandle,
        targetHandle,
        type: "smoothstep",
        animated: false,
        label: loc(dep.dataKey, locale),
        labelStyle: { fontSize: 10, fontWeight: 600, fill: `${ec1}` },
        labelShowBg: true,
        labelBgStyle: { fill: "#ffffff", stroke: `${ec1}30`, strokeWidth: 1, rx: 8, ry: 8 },
        labelBgPadding: [12, 5] as [number, number],
        style: { stroke: `${ec1}70`, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: `${ec1}70` },
        pathOptions: { borderRadius: 16 },
      } as RFEdge);
    }
  }

  // Downstream nodes + edges: modules that consume data FROM the current module
  const chainSet = new Set(chain);
  const downstream: { moduleId: string; dep: DepEdge }[] = [];
  for (const mid of ALL_MODULES) {
    if (chainSet.has(mid)) continue; // already shown
    for (const dep of MODULE_DEPS[mid] ?? []) {
      if (dep.from === tabId) downstream.push({ moduleId: mid, dep });
    }
  }

  if (downstream.length > 0) {
    const dsY = (maxDepth + 1) * LEVEL_Y_GAP + 100;
    const dsTotalW = downstream.length * NODE_W + (downstream.length - 1) * NODE_GAP;
    const dsStartX = -dsTotalW / 2;

    for (let i = 0; i < downstream.length; i++) {
      const { moduleId: dsId, dep } = downstream[i];
      const [dsC1, dsC2] = MODULE_COLORS[dsId] ?? ["#64748b", "#94a3b8"];
      const dsPosX = dsStartX + i * (NODE_W + NODE_GAP);
      nodes.push({
        id: dsId,
        type: "module",
        className: "flow-ds",
        position: { x: dsPosX, y: dsY },
        data: {
          label: loc(`shell.${dsId}`, locale),
          icon: MODULE_ICONS[dsId] ?? "settings-05",
          isCurrent: false,
          isStart: false,
          locale,
          description: loc(`desc.${dsId}`, locale),
          color1: dsC1,
          color2: dsC2,
        },
        selectable: false,
        connectable: false,
      });
      // Use side handles for offset downstream nodes
      const srcCx = posMap[tabId]?.x ?? 0;
      const dsCx = dsPosX + NODE_W / 2;
      const dsDx = dsCx - srcCx;
      let dsSrcH = "s-bottom";
      let dsTgtH = "t-top";
      if (dsDx < -NODE_W * 0.4) { dsSrcH = "s-left"; dsTgtH = "t-right"; }
      else if (dsDx > NODE_W * 0.4) { dsSrcH = "s-right"; dsTgtH = "t-left"; }

      flowEdges.push({
        id: `${tabId}->${dsId}`,
        source: tabId,
        target: dsId,
        sourceHandle: dsSrcH,
        targetHandle: dsTgtH,
        className: "flow-ds",
        type: "smoothstep",
        animated: false,
        label: loc(dep.dataKey, locale),
        labelStyle: { fontSize: 9, fontWeight: 600, fill: `${dsC1}` },
        labelShowBg: true,
        labelBgStyle: { fill: "#ffffff", stroke: `${dsC1}30`, strokeWidth: 1, rx: 6, ry: 6 },
        labelBgPadding: [10, 4] as [number, number],
        style: { stroke: `${dsC1}50`, strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: `${dsC1}50` },
        pathOptions: { borderRadius: 12 },
      } as RFEdge);
    }
  }

  return { nodes, edges: flowEdges };
}

// ─── Full system graph (all modules + all edges) ─────────────────────

function buildFullSystemGraph(
  highlightTabId: string,
  locale: string | undefined,
  colors: [number, number, number][],
): { nodes: RFNode<ModuleNodeData>[]; edges: RFEdge[] } {
  // Compute depths for all modules
  const depthMap: Record<string, number> = {};
  function getDepth(id: string): number {
    if (depthMap[id] !== undefined) return depthMap[id];
    const deps = MODULE_DEPS[id] ?? [];
    if (deps.length === 0) { depthMap[id] = 0; return 0; }
    depthMap[id] = Math.max(...deps.map((e) => getDepth(e.from))) + 1;
    return depthMap[id];
  }
  for (const id of ALL_MODULES) getDepth(id);

  const maxDepth = Math.max(...Object.values(depthMap));
  const levels: string[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    levels.push(ALL_MODULES.filter((id) => depthMap[id] === d));
  }

  const c1 = gradientFrom(colors);
  const c2 = gradientTo(colors);

  // HORIZONTAL layout: columns go left-to-right, nodes stack vertically within each column
  const COLUMN_X_GAP = 420;   // horizontal gap between depth columns
  const NODE_Y_GAP = 140;     // vertical gap within same column

  // Find which modules are in the highlighted module's dependency chain
  const highlightChain = new Set(resolveChain(highlightTabId));

  const nodes: RFNode<ModuleNodeData>[] = [];
  for (let lIdx = 0; lIdx < levels.length; lIdx++) {
    const level = levels[lIdx];
    const totalH = level.length * 50 + (level.length - 1) * NODE_Y_GAP;
    const startY = -totalH / 2;

    for (let nIdx = 0; nIdx < level.length; nIdx++) {
      const moduleId = level[nIdx];
      const isCurrent = moduleId === highlightTabId;
      const inChain = highlightChain.has(moduleId);
      const [mc1, mc2] = MODULE_COLORS[moduleId] ?? ["#64748b", "#94a3b8"];

      nodes.push({
        id: moduleId,
        type: "module",
        position: {
          x: lIdx * COLUMN_X_GAP,
          y: startY + nIdx * (50 + NODE_Y_GAP),
        },
        data: {
          label: loc(`shell.${moduleId}`, locale),
          icon: MODULE_ICONS[moduleId] ?? "settings-05",
          isCurrent,
          isStart: false,
          color1: isCurrent ? c1 : mc1,
          color2: isCurrent ? c2 : mc2,
          locale,
          horizontal: true,
        },
        selectable: false,
        connectable: false,
        style: !inChain ? { opacity: 0.45 } : undefined,
      });
    }
  }

  // Position lookup for handle assignment (horizontal layout)
  const NODE_H_APPROX = 50;
  const sysPosMap: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) sysPosMap[n.id] = { x: n.position.x, y: n.position.y + NODE_H_APPROX / 2 };

  // All edges in the system — horizontal flow (left to right)
  // Side handles used for off-axis edges, top/bottom for cross-level routing.
  const flowEdges: RFEdge[] = [];
  for (const moduleId of ALL_MODULES) {
    for (const dep of MODULE_DEPS[moduleId] ?? []) {
      const inChain = highlightChain.has(moduleId) && highlightChain.has(dep.from);
      const depthDiff = depthMap[moduleId] - depthMap[dep.from];
      const crossLevel = depthDiff > 1;

      const srcP = sysPosMap[dep.from];
      const tgtP = sysPosMap[moduleId];
      const dy = (tgtP?.y ?? 0) - (srcP?.y ?? 0);
      const yThreshold = NODE_H_APPROX * 1.2;

      let sourceHandle: string;
      let targetHandle: string;

      if (crossLevel) {
        // Route above or below intermediate columns
        if (dy < 0) { sourceHandle = "s-top"; targetHandle = "t-top"; }
        else if (dy > 0) { sourceHandle = "s-bottom"; targetHandle = "t-bottom"; }
        else { sourceHandle = "s-top"; targetHandle = "t-top"; }
      } else if (Math.abs(dy) < yThreshold) {
        // Nearly same row — straight horizontal
        sourceHandle = "s-right"; targetHandle = "t-left";
      } else if (dy < 0) {
        // Target is above source
        sourceHandle = "s-top"; targetHandle = "t-bottom";
      } else {
        // Target is below source
        sourceHandle = "s-bottom"; targetHandle = "t-top";
      }

      const [ec1] = MODULE_COLORS[moduleId] ?? ["#9ca3af"];

      flowEdges.push({
        id: `${dep.from}->${moduleId}`,
        source: dep.from,
        target: moduleId,
        sourceHandle,
        targetHandle,
        type: "smoothstep",
        animated: false,
        label: loc(dep.dataKey, locale),
        labelStyle: {
          fontSize: 9,
          fontWeight: 600,
          fill: inChain ? `${ec1}` : `${ec1}60`,
        },
        labelShowBg: true,
        labelBgStyle: {
          fill: "#ffffff",
          stroke: inChain ? `${ec1}30` : "#e5e5e5",
          strokeWidth: 1,
          rx: 6,
          ry: 6,
        },
        labelBgPadding: [10, 4] as [number, number],
        style: {
          stroke: inChain ? `${ec1}90` : "#e5e7eb",
          strokeWidth: inChain ? 1.5 : 1,
          opacity: inChain ? 1 : 0.35,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: inChain ? `${ec1}90` : "#e5e7eb",
        },
        pathOptions: { borderRadius: 12 },
      } as RFEdge);
    }
  }

  return { nodes, edges: flowEdges };
}

// ─── Zoom controls for ReactFlow canvas ──────────────────────────────

function FlowZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white";

  return (
    <Panel position="top-right">
      <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white/80 p-1 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80">
        <button type="button" className={btn} onClick={() => zoomIn({ duration: 200 })} aria-label="Zoom in">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 7h6M7 4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className={btn} onClick={() => zoomOut({ duration: 200 })} aria-label="Zoom out">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 7h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className={btn} onClick={() => fitView({ duration: 300, padding: 0.2 })} aria-label="Fit view">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 5V3a1 1 0 011-1h2M9 2h2a1 1 0 011 1v2M12 9v2a1 1 0 01-1 1H9M5 12H3a1 1 0 01-1-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </Panel>
  );
}

// ─── DependencyDiagram with ReactFlow Canvas ─────────────────────────

function DependencyDiagram({
  tabId,
  locale,
  colors,
  highlightNodes,
}: {
  tabId: string;
  locale?: string;
  colors: [number, number, number][];
  highlightNodes?: string[];
}) {
  const [view, setView] = useState<"module" | "system">("module");
  const [fullscreen, setFullscreen] = useState(false);
  const depEdges = MODULE_DEPS[tabId];
  const hasModuleDeps = depEdges && depEdges.length > 0;

  const moduleGraph = useMemo(
    () =>
      hasModuleDeps
        ? buildFlowGraph(tabId, locale, colors)
        : { nodes: [], edges: [] },
    [hasModuleDeps, tabId, locale, colors],
  );
  const systemGraph = useMemo(
    () => buildFullSystemGraph(tabId, locale, colors),
    [tabId, locale, colors],
  );

  const isSystem = view === "system";
  const nodes = isSystem ? systemGraph.nodes : moduleGraph.nodes;
  const edges = isSystem ? systemGraph.edges : moduleGraph.edges;

  // ── Hover-based path highlighting (pure DOM, no re-render) ──────
  const depCanvasRef = useRef<HTMLDivElement>(null);

  const edgeLookup = useMemo(() => {
    const m = new Map<string, { source: string; target: string }>();
    for (const e of edges) m.set(e.id, { source: e.source, target: e.target });
    return m;
  }, [edges]);

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      const container = depCanvasRef.current;
      if (!container) return;
      const chain = new Set(resolveChain(node.id));
      container.classList.add("is-hovering");
      container.querySelectorAll<HTMLElement>(".react-flow__node").forEach((el) => {
        const nid = el.getAttribute("data-id");
        el.classList.toggle("flow-lit", !!nid && chain.has(nid));
      });
      container.querySelectorAll<HTMLElement>(".react-flow__edge").forEach((el) => {
        const eid = el.getAttribute("data-id");
        const edge = eid ? edgeLookup.get(eid) : undefined;
        el.classList.toggle(
          "flow-lit",
          !!edge && chain.has(edge.source) && chain.has(edge.target),
        );
      });
    },
    [edgeLookup],
  );

  const onNodeMouseLeave = useCallback(() => {
    const container = depCanvasRef.current;
    if (!container) return;
    container.classList.remove("is-hovering");
    container.querySelectorAll(".flow-lit").forEach((el) => el.classList.remove("flow-lit"));
  }, []);

  // Click-to-highlight downstream nodes
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      const container = depCanvasRef.current;
      if (!container) return;
      const el = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${node.id}"]`);
      if (!el || !el.classList.contains("flow-ds")) {
        // Clicked a non-downstream node — clear selection
        container.classList.remove("has-ds-active");
        container.querySelectorAll(".flow-active").forEach((e) => e.classList.remove("flow-active"));
        return;
      }
      // Toggle: if already active, deactivate
      if (el.classList.contains("flow-active")) {
        container.classList.remove("has-ds-active");
        container.querySelectorAll(".flow-active").forEach((e) => e.classList.remove("flow-active"));
        return;
      }
      // Activate this downstream node + its edge
      container.querySelectorAll(".flow-active").forEach((e) => e.classList.remove("flow-active"));
      container.classList.add("has-ds-active");
      el.classList.add("flow-active");
      // Find matching edge (tabId -> node.id)
      const edgeId = `${tabId}->${node.id}`;
      const edgeEl = container.querySelector<HTMLElement>(`.react-flow__edge[data-id="${edgeId}"]`);
      edgeEl?.classList.add("flow-active");
    },
    [tabId],
  );

  const onPaneClick = useCallback(() => {
    const container = depCanvasRef.current;
    if (!container) return;
    container.classList.remove("has-ds-active");
    container.querySelectorAll(".flow-active").forEach((e) => e.classList.remove("flow-active"));
  }, []);

  // Auto-highlight prerequisite nodes when opened from lock overlay
  useEffect(() => {
    if (!highlightNodes || highlightNodes.length === 0) return;
    const container = depCanvasRef.current;
    if (!container) return;
    // Small delay so ReactFlow renders DOM nodes first
    const timer = setTimeout(() => {
      const c = depCanvasRef.current;
      if (!c) return;
      // Build the full chain for each highlighted node so edges also light up
      const chain = new Set<string>();
      for (const nid of highlightNodes) {
        for (const id of resolveChain(nid)) chain.add(id);
      }
      c.classList.add("is-hovering");
      c.querySelectorAll<HTMLElement>(".react-flow__node").forEach((el) => {
        const nid = el.getAttribute("data-id");
        el.classList.toggle("flow-lit", !!nid && chain.has(nid));
      });
      c.querySelectorAll<HTMLElement>(".react-flow__edge").forEach((el) => {
        const eid = el.getAttribute("data-id");
        const edge = eid ? edgeLookup.get(eid) : undefined;
        el.classList.toggle("flow-lit", !!edge && chain.has(edge.source) && chain.has(edge.target));
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightNodes, edgeLookup]);

  // Module view canvas height (inline only)
  const canvasH = hasModuleDeps
    ? Math.max(300, moduleGraph.nodes.reduce((m, n) => Math.max(m, n.position.y), 0) + 200)
    : 60;

  const darkCss = `

    .dark-mode .dep-canvas .react-flow__edge-textbg { fill: #1c1c1e !important; }

    .dep-canvas .react-flow__node,
    .dep-canvas .react-flow__edge { transition: opacity 0.2s ease; }

    .dep-canvas.is-hovering .react-flow__node:not(.flow-lit):not(.flow-ds) { opacity: 0.12 !important; }
    .dep-canvas.is-hovering .react-flow__edge:not(.flow-lit):not(.flow-ds) { opacity: 0.06 !important; }
    .dep-canvas.is-hovering .react-flow__node.flow-lit,
    .dep-canvas.is-hovering .react-flow__node.flow-ds { opacity: 1 !important; }
    .dep-canvas.is-hovering .react-flow__edge.flow-lit,
    .dep-canvas.is-hovering .react-flow__edge.flow-ds { opacity: 1 !important; }

    .dep-canvas .react-flow__node.flow-ds,
    .dep-canvas .react-flow__edge.flow-ds { transition: opacity 0.2s ease, filter 0.2s ease; }

    .dep-canvas.has-ds-active .react-flow__node.flow-ds:not(.flow-active) { opacity: 0.3 !important; }
    .dep-canvas.has-ds-active .react-flow__edge.flow-ds:not(.flow-active) { opacity: 0.15 !important; }
    .dep-canvas.has-ds-active .react-flow__node.flow-ds.flow-active { opacity: 1 !important; filter: saturate(1.8) brightness(1.1); }
    .dep-canvas.has-ds-active .react-flow__edge.flow-ds.flow-active { opacity: 1 !important; }
    .dep-canvas.has-ds-active .react-flow__edge.flow-ds.flow-active path { stroke-width: 2.5 !important; stroke-dasharray: none !important; }
  `;

  const toggleButtons = (
    <div className="flex rounded-lg bg-neutral-200/60 p-0.5 dark:bg-neutral-700/60">
      {(["module", "system"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={(e) => { e.stopPropagation(); setView(v); }}
          className={cx(
            "rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
            view === v
              ? "bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-white"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          )}
        >
          {loc(v === "module" ? "flow.viewModule" : "flow.viewSystem", locale)}
        </button>
      ))}
    </div>
  );

  const expandBtn = (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setFullscreen((f) => !f); }}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white"
      aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
    >
      {fullscreen ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 2v3H2M9 2v3h3M5 12V9H2M9 12V9h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 5V3a1 1 0 011-1h2M9 2h2a1 1 0 011 1v2M12 9v2a1 1 0 01-1 1H9M5 12H3a1 1 0 01-1-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );

  // Shared canvas content
  const showEmpty = view === "module" && !hasModuleDeps;
  const canvasBlock = showEmpty ? (
    <div className="flex flex-1 items-center justify-center px-4 pb-4">
      <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
        {loc("flow.noPrereqs", locale)}
      </p>
    </div>
  ) : (
    <div className="flex-1" style={fullscreen ? undefined : { minHeight: canvasH }}>
      <ReactFlowProvider key={`${view}-${fullscreen}`}>
        <Canvas
          bgColor="transparent"
          nodes={nodes}
          edges={edges}
          nodeTypes={FLOW_NODE_TYPES}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          preventScrolling={false}
          fitView
          fitViewOptions={{ padding: isSystem ? 0.15 : 0.3 }}
          proOptions={{ hideAttribution: true }}
        >
          <FlowZoomControls />
        </Canvas>
      </ReactFlowProvider>
    </div>
  );

  // ── Fullscreen overlay ──────────────────────────────────────
  if (fullscreen) {
    return (
      <>
        <div ref={depCanvasRef} className="dep-canvas fixed inset-0 z-[120] flex flex-col bg-neutral-50 dark:bg-neutral-900">
          <style>{darkCss}</style>
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              {loc("flow.title", locale)}
            </p>
            <div className="flex items-center gap-2">
              {toggleButtons}
              {expandBtn}
            </div>
          </div>
          {canvasBlock}
        </div>
      </>
    );
  }

  // ── Inline card ─────────────────────────────────────────────
  return (
    <div ref={depCanvasRef} className="dep-canvas flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
      <style>{darkCss}</style>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          {loc("flow.title", locale)}
        </p>
        <div className="flex items-center gap-2">
          {toggleButtons}
          {expandBtn}
        </div>
      </div>
      {canvasBlock}
    </div>
  );
}

// ─── Close icon (Aceternity pattern) ─────────────────────────────────

function CloseIcon() {
  return (
    <motion.svg
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.05 } }}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </motion.svg>
  );
}

// ─── Main card component ────────────────────────────────────────────

export function ModuleHubCard({
  tabId,
  title,
  description,
  icon,
  state,
  colors,
  onClick,
  onNavigateToTab,
  data,
  benefitText,
  benefitLabel,
}: ModuleHubCardProps) {
  const isLocked = state.locked;
  const color1 = gradientFrom(colors);
  const color2 = gradientTo(colors);
  const SkeletonContent = SKELETON_MAP[tabId];

  const [active, setActive] = useState(false);
  const [lockHighlight, setLockHighlight] = useState<string[] | undefined>();
  const overlayRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useOutsideClick(overlayRef, () => { setActive(false); setLockHighlight(undefined); }, active);
  useEscapeClose(() => { setActive(false); setLockHighlight(undefined); }, active);

  return (
    <>
    {/* ── Aceternity expandable overlay ─────────────────────────── */}
    <AnimatePresence>
      {active && benefitText && (
        <div className="fixed inset-0 z-[100] grid place-items-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 h-full w-full bg-black/60 backdrop-blur-sm"
          />

          {/* Expanded card — uses same layoutId as the card below for morph */}
          <motion.div
            layoutId={`card-${tabId}-${id}`}
            ref={overlayRef}
            className="relative z-[110] flex h-full w-full max-w-[500px] flex-col overflow-hidden bg-white sm:rounded-3xl md:h-fit md:max-h-[90%] md:max-w-[960px] dark:bg-neutral-900"
          >
            {/* Close button */}
            <motion.button
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.05 } }}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-500 shadow-sm transition-colors hover:text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white"
              onClick={() => { setActive(false); setLockHighlight(undefined); }}
            >
              <CloseIcon />
            </motion.button>

            {/* Header with gradient — layoutId morph from card icon area */}
            <motion.div
              layoutId={`image-${tabId}-${id}`}
              className="relative overflow-hidden"
            >
              <div
                className="px-6 pb-5 pt-6"
                style={{ background: `linear-gradient(135deg, ${color1}20, ${color2}10)` }}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-md"
                    style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}
                  >
                    <EzIcon name={icon} size={24} color="white" strokeColor="white" />
                  </div>
                  <div>
                    <motion.h3
                      layoutId={`title-${tabId}-${id}`}
                      className="text-lg font-bold text-neutral-900 dark:text-white"
                    >
                      {title}
                    </motion.h3>
                    <motion.p
                      layoutId={`description-${tabId}-${id}`}
                      className="text-xs font-medium"
                      style={{ color: color1 }}
                    >
                      {benefitLabel || "Co mi to daje?"}
                    </motion.p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Benefit content — two-column: text left, diagram right */}
            <div className="relative flex-1 overflow-auto px-6 pb-6 pt-4">
              {/* Fade mask at top */}
              <div className="pointer-events-none sticky -top-4 left-0 right-0 -mt-4 h-6 bg-gradient-to-b from-white to-transparent dark:from-neutral-900" />

              <div className="flex flex-col gap-6 md:flex-row">
                {/* Left column: benefit text + CTA */}
                <div className="flex flex-col md:w-[340px] md:shrink-0">
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300"
                  >
                    {benefitText.split("\n\n").map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </motion.div>

                  {/* CTA button */}
                  <motion.button
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActive(false);
                      onClick();
                    }}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4 7h6M7 4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {title}
                  </motion.button>
                </div>

                {/* Right column: dependency diagram */}
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex-1 md:min-w-0"
                >
                  <DependencyDiagram tabId={tabId} locale={data?.locale} colors={colors} highlightNodes={lockHighlight} />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* ── Card in grid ──────────────────────────────────────────── */}
    <motion.div layoutId={`card-${tabId}-${id}`} className="group/card relative h-full">
      <div
        className={cx(
          "relative h-full rounded-2xl transition-all duration-200",
          isLocked
            ? "ring-1 ring-neutral-200 dark:ring-neutral-800"
            : "shadow-sm ring-1 ring-black/[0.08] hover:shadow-2xl hover:shadow-black/10 dark:ring-white/[0.06]"
        )}
      >
        {!isLocked && (
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        )}
      <button
        type="button"
        onClick={isLocked ? undefined : onClick}
        className={cx(
          "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl text-left",
          isLocked
            ? "cursor-default bg-neutral-50 dark:bg-neutral-900"
            : "cursor-pointer bg-neutral-50 dark:bg-neutral-800"
        )}
      >

      {/* Dotted background pattern */}
      <div
        className="pointer-events-none absolute inset-0 z-0 dark:hidden"
        style={{
          backgroundImage: "radial-gradient(circle at 0.5px 0.5px, rgb(255 255 255) 0.5px, #c6c6c6 0px)",
          backgroundSize: "8px 8px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden dark:block"
        style={{
          backgroundImage: "radial-gradient(circle at 0.5px 0.5px, rgb(255 255 255 / 11%) 0.5px, transparent 0px)",
          backgroundSize: "8px 8px",
        }}
      />

      {/* ── Top: 3D Skeleton (dominant, ~65% of card) ──────────────── */}
      <motion.div
        layoutId={`image-${tabId}-${id}`}
        className="relative h-72 overflow-hidden sm:h-56 md:h-72"
        style={{ perspective: "1200px", marginBottom: "-30px", zIndex: 0 }}
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
            maskImage: "radial-gradient(90% 85%, black 35%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(90% 85%, black 35%, transparent 80%)",
          }}
        >
          {/* 3D rotated skeleton */}
          <div
            className="mx-auto h-full w-[88%] translate-x-3 pt-2"
            style={{
              transform: "rotateY(20deg) rotateX(20deg) rotateZ(-10deg) scale(1.2) translate(0px, 50px)",
              transformOrigin: "center center",
            }}
          >
            {SkeletonContent && (
              <SkeletonShell
                title={skeletonLabel(tabId, data?.locale) ?? title}
                icon={
                  <EzIcon
                    name={icon}
                    size={10}
                    color={color1}
                    strokeColor={color1}
                  />
                }
              >
                <SkeletonContent
                  color={color1}
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

        {/* Lock overlay for blocked modules */}
        {isLocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-t-2xl bg-black/30 backdrop-blur-sm dark:bg-black/40 dark:backdrop-blur-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/90 shadow-lg dark:bg-white/90">
              <EzIcon name="square-lock-01" size={22} color="#525252" strokeColor="#525252" />
            </div>
            <p className="max-w-[220px] rounded-lg bg-black/50 px-3 py-1.5 text-center text-[12px] font-bold leading-snug text-white">
              {state.lockReason ? loc(state.lockReason, data?.locale) : ""}
            </p>
            {state.lockReason && (LOCK_PREREQS[state.lockReason] ?? []).length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 px-6">
                {(LOCK_PREREQS[state.lockReason] ?? []).map((mid) => (
                  <button
                    key={mid}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onNavigateToTab?.(mid); }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-black/70"
                  >
                    <EzIcon name={MODULE_ICONS[mid] ?? "settings-05"} size={12} color="#ffffff" strokeColor="#ffffff" />
                    {loc(`shell.${mid}`, data?.locale)}
                  </button>
                ))}
              </div>
            )}
            {benefitText && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLockHighlight(state.lockReason ? LOCK_PREREQS[state.lockReason] : undefined); setActive(true); }}
                className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[11px] font-bold text-neutral-800 shadow-lg transition-colors hover:bg-neutral-100"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M6.5 5.5V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="6.5" cy="3.75" r="0.75" fill="currentColor" />
                </svg>
                {loc("lockMoreInfo", data?.locale)}
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Bottom: Title + Description + CTA ──────────────────────── */}
      <div
        className="flex items-center justify-between px-5 pb-5 pt-5"
        style={{ marginTop: "-20px", background: "transparent", zIndex: 4, backdropFilter: "blur(4px)" }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm"
              style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}
            >
              <EzIcon name={icon} size={13} color="white" strokeColor="white" />
            </div>
            <div>
              <motion.h3
                layoutId={`title-${tabId}-${id}`}
                className={cx(
                  "text-sm font-bold leading-tight",
                  "text-neutral-900 dark:text-white"
                )}
              >
                {title}
              </motion.h3>
              {!isLocked && state.metric && (
                <motion.span
                  layoutId={`description-${tabId}-${id}`}
                  className="text-xs font-medium"
                  style={{ color: color1 }}
                >
                  {state.metric}
                </motion.span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Info button — "Co mi to daje?" — triggers expandable card */}
          {!isLocked && benefitText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setActive(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        setActive(true);
                      }
                    }}
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/80 dark:hover:border-neutral-600 dark:hover:text-neutral-300"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M6 5.5V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <circle cx="6" cy="3.75" r="0.75" fill="currentColor" />
                    </svg>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {benefitLabel || "Co mi to daje?"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* CTA circle button */}
          {!isLocked && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 transition-colors group-hover:border-neutral-300 dark:border-neutral-700 dark:group-hover:border-neutral-600">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4 7h6M7 4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-neutral-600 dark:text-neutral-300" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </button>
    </div>
    </motion.div>
    </>
  );
}
