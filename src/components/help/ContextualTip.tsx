"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";

interface ContextualTipProps {
  /** The tip text to display. */
  content: string;
  /** Optional link to a KB article slug. */
  articleSlug?: string;
  /** Size of the icon in pixels. Defaults to 16. */
  size?: number;
}

export function ContextualTip({ content, articleSlug, size = 16 }: ContextualTipProps) {
  const t = useTranslations("help");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        style={{ width: size + 8, height: size + 8 }}
        aria-label={t("contextualHelp")}
        data-testid="contextual-tip-trigger"
      >
        <span className="text-xs font-bold" style={{ fontSize: size * 0.7 }}>?</span>
      </button>

      {isOpen && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 p-3"
          role="tooltip"
          data-testid="contextual-tip-popover"
        >
          <p className="text-sm text-gray-700 dark:text-gray-300">{content}</p>
          {articleSlug && (
            <a
              href={`/help?article=${articleSlug}`}
              className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
              data-testid="contextual-tip-link"
            >
              {t("readMore")} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
