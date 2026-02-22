"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { TourStepDef } from "./tourDefinitions";

interface TourStepProps {
  step: TourStepDef;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
}

interface Position {
  top: number;
  left: number;
}

function getTooltipPosition(
  rect: DOMRect,
  placement: TourStepDef["placement"]
): Position {
  const gap = 12;
  switch (placement) {
    case "top":
      return { top: rect.top - gap, left: rect.left + rect.width / 2 };
    case "bottom":
      return { top: rect.bottom + gap, left: rect.left + rect.width / 2 };
    case "left":
      return { top: rect.top + rect.height / 2, left: rect.left - gap };
    case "right":
      return { top: rect.top + rect.height / 2, left: rect.right + gap };
  }
}

export function TourStep({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onClose,
}: TourStepProps) {
  const t = useTranslations("help");
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(step.target);
    if (!el) {
      // Target not found — position center of viewport
      setPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
      setTargetRect(null);
      return;
    }

    el.scrollIntoView?.({ behavior: "smooth", block: "center" });

    const updatePosition = () => {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      setPosition(getTooltipPosition(rect, step.placement));
    };

    // Small delay for scroll to settle
    const timer = setTimeout(updatePosition, 100);
    return () => clearTimeout(timer);
  }, [step.target, step.placement]);

  if (!position) return null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50"
        data-testid="tour-overlay"
        onClick={onClose}
      />

      {/* Highlight cutout for target element */}
      {targetRect && (
        <div
          className="fixed z-[9999] rounded-md ring-2 ring-blue-500 ring-offset-2 pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
          data-testid="tour-highlight"
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={step.title}
        className="fixed z-[10000] w-80 rounded-lg bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-4"
        style={{
          top: position.top,
          left: position.left,
          transform:
            step.placement === "top"
              ? "translate(-50%, -100%)"
              : step.placement === "bottom"
                ? "translate(-50%, 0)"
                : step.placement === "left"
                  ? "translate(-100%, -50%)"
                  : "translate(0, -50%)",
        }}
        data-testid="tour-tooltip"
      >
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400" data-testid="tour-progress">
            {t("tourStepOf", { current: currentIndex + 1, total: totalSteps })}
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
            aria-label={t("tourClose")}
            data-testid="tour-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {t(step.title.replace("help.", "") as any)}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t(step.content.replace("help.", "") as any)}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            data-testid="tour-skip-btn"
          >
            {t("tourSkip")}
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                data-testid="tour-prev-btn"
              >
                {t("tourPrev")}
              </button>
            )}
            <button
              onClick={onNext}
              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
              data-testid="tour-next-btn"
            >
              {isLast ? t("tourComplete") : t("tourNext")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
