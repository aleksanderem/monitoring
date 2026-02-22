"use client";

import React from "react";
import { useTranslations } from "next-intl";

export type WidgetType =
  | "keywordOverview"
  | "positionChart"
  | "competitorTable"
  | "visibilityTrend"
  | "alertsFeed"
  | "backlinkSummary";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

interface WidgetCardProps {
  widget: WidgetConfig;
  isEditMode: boolean;
  onRemove?: (widgetId: string) => void;
  children?: React.ReactNode;
}

const WIDGET_LABELS: Record<WidgetType, string> = {
  keywordOverview: "widgets.keywordOverview",
  positionChart: "widgets.positionChart",
  competitorTable: "widgets.competitorTable",
  visibilityTrend: "widgets.visibilityTrend",
  alertsFeed: "widgets.alertsFeed",
  backlinkSummary: "widgets.backlinkSummary",
};

export function WidgetCard({ widget, isEditMode, onRemove, children }: WidgetCardProps) {
  const t = useTranslations("dashboards");

  return (
    <div
      className="relative rounded-xl border border-secondary bg-primary shadow-sm"
      data-testid={`widget-card-${widget.id}`}
      data-widget-type={widget.type}
    >
      {/* Widget header */}
      <div className="flex items-center justify-between border-b border-secondary px-4 py-2.5">
        <div className="flex items-center gap-2">
          {isEditMode && (
            <button
              type="button"
              className="cursor-grab text-quaternary hover:text-secondary"
              aria-label={t("dragToReorder")}
              data-testid={`drag-handle-${widget.id}`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5 3h2v2H5V3zm4 0h2v2H9V3zM5 7h2v2H5V7zm4 0h2v2H9V7zm-4 4h2v2H5v-2zm4 0h2v2H9v-2z" />
              </svg>
            </button>
          )}
          <span className="text-sm font-medium text-primary">
            {t(WIDGET_LABELS[widget.type])}
          </span>
        </div>

        {isEditMode && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded p-1 text-quaternary hover:bg-error-50 hover:text-error-600"
              onClick={() => onRemove?.(widget.id)}
              aria-label={t("removeWidget")}
              data-testid={`remove-widget-${widget.id}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Widget content */}
      <div className="p-4">
        {children ?? (
          <div className="flex h-32 items-center justify-center text-sm text-quaternary">
            {t(WIDGET_LABELS[widget.type])}
          </div>
        )}
      </div>
    </div>
  );
}
