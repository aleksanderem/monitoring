"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  Folder,
  Globe01,
  SearchSm,
  Key01,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ResultItem = {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  href: string;
  category: string;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query backend search
  const results = useQuery(
    api.search.searchAll,
    debouncedTerm.trim().length > 0 ? { query: debouncedTerm } : "skip"
  );

  // Build flat list of result items for keyboard navigation
  const flatItems: ResultItem[] = [];
  if (results) {
    for (const domain of results.domains) {
      flatItems.push({
        id: domain.id,
        label: domain.name,
        sublabel: domain.projectName,
        icon: <Globe01 className="h-4 w-4 text-quaternary" />,
        href: `/domains/${domain.id}`,
        category: t("domains"),
      });
    }
    for (const keyword of results.keywords) {
      flatItems.push({
        id: keyword.id,
        label: keyword.phrase,
        sublabel: keyword.domainName,
        icon: <Key01 className="h-4 w-4 text-quaternary" />,
        href: `/domains/${keyword.domainId}`,
        category: t("keywords"),
      });
    }
    for (const project of results.projects) {
      flatItems.push({
        id: project.id,
        label: project.name,
        icon: <Folder className="h-4 w-4 text-quaternary" />,
        href: `/projects/${project.id}`,
        category: t("projects"),
      });
    }
  }

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedTerm]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setDebouncedTerm("");
      setActiveIndex(0);
      // Small delay to let the DOM render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      onOpenChange(false);
    },
    [router, onOpenChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" && flatItems[activeIndex]) {
        e.preventDefault();
        navigate(flatItems[activeIndex].href);
        return;
      }
    },
    [flatItems, activeIndex, navigate, onOpenChange]
  );

  if (!open) return null;

  const hasQuery = debouncedTerm.trim().length > 0;
  const hasResults = flatItems.length > 0;

  // Group results by category for display
  const grouped = new Map<string, ResultItem[]>();
  for (const item of flatItems) {
    const group = grouped.get(item.category) ?? [];
    group.push(item);
    grouped.set(item.category, group);
  }

  // Track flat index for active state
  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-overlay/70 backdrop-blur"
      onClick={() => onOpenChange(false)}
      data-testid="command-palette-overlay"
    >
      <div
        className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-lg rounded-xl bg-primary shadow-xl ring-1 ring-border-secondary"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        data-testid="command-palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-primary">
          <SearchSm className="h-5 w-5 text-quaternary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("placeholder")}
            className="w-full bg-transparent text-primary placeholder:text-placeholder outline-none"
            data-testid="command-palette-input"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-quaternary bg-secondary rounded border border-primary">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {hasQuery && !hasResults && results !== undefined && (
            <div className="px-3 py-8 text-center text-sm text-tertiary" data-testid="no-results">
              {t("noResults")}
            </div>
          )}

          {hasQuery && results === undefined && (
            <div className="px-3 py-8 text-center text-sm text-tertiary">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            </div>
          )}

          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category} className="mb-2">
              <div className="px-3 py-1.5 text-xs font-medium text-quaternary uppercase tracking-wider">
                {category}
              </div>
              {items.map((item) => {
                const currentIndex = flatIndex++;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                      currentIndex === activeIndex
                        ? "bg-primary_hover text-primary"
                        : "text-secondary hover:bg-primary_hover"
                    }`}
                    data-testid={`result-${item.id}`}
                  >
                    {item.icon}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{item.label}</div>
                      {item.sublabel && (
                        <div className="truncate text-xs text-tertiary">
                          {item.sublabel}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}

          {!hasQuery && (
            <div className="px-3 py-4 text-center text-sm text-tertiary">
              {t("placeholder")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
