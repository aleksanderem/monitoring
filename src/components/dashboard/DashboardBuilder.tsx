"use client";

import React, { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { WidgetCard, type WidgetConfig, type WidgetType } from "./WidgetCard";

const WIDGET_TYPES: { type: WidgetType; labelKey: string }[] = [
  { type: "keywordOverview", labelKey: "widgets.keywordOverview" },
  { type: "positionChart", labelKey: "widgets.positionChart" },
  { type: "competitorTable", labelKey: "widgets.competitorTable" },
  { type: "visibilityTrend", labelKey: "widgets.visibilityTrend" },
  { type: "alertsFeed", labelKey: "widgets.alertsFeed" },
  { type: "backlinkSummary", labelKey: "widgets.backlinkSummary" },
];

interface DashboardBuilderProps {
  /** Initial widget list from a saved layout */
  initialWidgets?: WidgetConfig[];
  /** Called when user saves the layout */
  onSave?: (name: string, widgets: WidgetConfig[]) => void;
  /** Called when user resets to default */
  onReset?: () => void;
  /** Layout name for existing layouts */
  layoutName?: string;
}

export function DashboardBuilder({
  initialWidgets = [],
  onSave,
  onReset,
  layoutName = "",
}: DashboardBuilderProps) {
  const t = useTranslations("dashboards");

  const [isEditMode, setIsEditMode] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(initialWidgets);
  const [name, setName] = useState(layoutName);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);

  const handleAddWidget = useCallback((type: WidgetType) => {
    const newWidget: WidgetConfig = {
      id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      x: 0,
      y: widgets.length,
      w: 6,
      h: 4,
    };
    setWidgets((prev) => [...prev, newWidget]);
    setShowWidgetSelector(false);
  }, [widgets.length]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(name, widgets);
  }, [name, widgets, onSave]);

  const handleReset = useCallback(() => {
    setWidgets(initialWidgets);
    setName(layoutName);
    setIsEditMode(false);
    onReset?.();
  }, [initialWidgets, layoutName, onReset]);

  return (
    <div className="flex flex-col gap-6" data-testid="dashboard-builder">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-primary">{t("title")}</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {isEditMode ? t("editMode") : t("viewMode")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isEditMode && (
            <>
              <button
                type="button"
                className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary_subtle"
                onClick={() => setShowWidgetSelector(true)}
                data-testid="add-widget-btn"
              >
                {t("addWidget")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-tertiary hover:bg-secondary_subtle"
                onClick={handleReset}
                data-testid="reset-default-btn"
              >
                {t("resetDefault")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                onClick={handleSave}
                data-testid="save-layout-btn"
              >
                {t("saveLayout")}
              </button>
            </>
          )}
          <button
            type="button"
            className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary_subtle"
            onClick={() => setIsEditMode(!isEditMode)}
            data-testid="toggle-edit-mode-btn"
          >
            {isEditMode ? t("viewMode") : t("editMode")}
          </button>
        </div>
      </div>

      {/* Layout name input in edit mode */}
      {isEditMode && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-secondary">{t("layoutName")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("enterLayoutName")}
            className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
            data-testid="layout-name-input"
          />
        </div>
      )}

      {/* Widget selector modal */}
      {showWidgetSelector && (
        <div className="rounded-xl border border-secondary bg-primary p-4 shadow-lg" data-testid="widget-selector">
          <h3 className="mb-3 text-sm font-semibold text-primary">{t("selectWidgetType")}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {WIDGET_TYPES.map(({ type, labelKey }) => (
              <button
                key={type}
                type="button"
                className="rounded-lg border border-secondary px-3 py-2 text-left text-sm text-primary hover:bg-secondary_subtle"
                onClick={() => handleAddWidget(type)}
                data-testid={`add-widget-${type}`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 text-sm text-tertiary hover:text-primary"
            onClick={() => setShowWidgetSelector(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Widgets grid */}
      {widgets.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-secondary text-sm text-quaternary" data-testid="no-widgets">
          {t("noWidgets")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="widgets-grid">
          {widgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              isEditMode={isEditMode}
              onRemove={handleRemoveWidget}
            />
          ))}
        </div>
      )}
    </div>
  );
}
