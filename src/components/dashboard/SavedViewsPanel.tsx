"use client";

import React, { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

export interface SavedView {
  _id: string;
  name: string;
  targetTable: string;
  filters: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  columns: string[];
  isShared: boolean;
  userId: string;
}

interface SavedViewsPanelProps {
  views: SavedView[];
  currentUserId?: string;
  onApply?: (view: SavedView) => void;
  onSave?: (name: string, isShared: boolean) => void;
  onDelete?: (viewId: string) => void;
  onToggleShare?: (viewId: string, isShared: boolean) => void;
}

export function SavedViewsPanel({
  views,
  currentUserId,
  onApply,
  onSave,
  onDelete,
  onToggleShare,
}: SavedViewsPanelProps) {
  const t = useTranslations("dashboards");

  const [isOpen, setIsOpen] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewShared, setNewViewShared] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    if (!newViewName.trim()) return;
    onSave?.(newViewName.trim(), newViewShared);
    setNewViewName("");
    setNewViewShared(false);
    setShowSaveForm(false);
  }, [newViewName, newViewShared, onSave]);

  const handleDelete = useCallback((viewId: string) => {
    onDelete?.(viewId);
    setConfirmDeleteId(null);
  }, [onDelete]);

  return (
    <div className="relative" data-testid="saved-views-panel">
      {/* Dropdown trigger */}
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary_subtle"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="saved-views-trigger"
      >
        <svg className="h-4 w-4 text-quaternary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        {t("savedViews")}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-1 w-80 rounded-xl border border-secondary bg-primary p-3 shadow-lg"
          data-testid="saved-views-dropdown"
        >
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-primary">{t("savedViews")}</h4>
            <button
              type="button"
              className="rounded px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
              onClick={() => setShowSaveForm(!showSaveForm)}
              data-testid="save-view-btn"
            >
              {t("saveView")}
            </button>
          </div>

          {/* Save form */}
          {showSaveForm && (
            <div className="mb-3 rounded-lg border border-secondary bg-secondary_subtle p-2.5" data-testid="save-view-form">
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder={t("enterViewName")}
                className="mb-2 w-full rounded-md border border-secondary bg-primary px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
                data-testid="view-name-input"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-secondary">
                  <input
                    type="checkbox"
                    checked={newViewShared}
                    onChange={(e) => setNewViewShared(e.target.checked)}
                    className="rounded border-secondary"
                    data-testid="share-toggle"
                  />
                  {t("shareView")}
                </label>
                <button
                  type="button"
                  className="rounded bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                  onClick={handleSave}
                  data-testid="confirm-save-view-btn"
                >
                  {t("saveView")}
                </button>
              </div>
            </div>
          )}

          {/* Views list */}
          {views.length === 0 ? (
            <p className="py-4 text-center text-sm text-quaternary" data-testid="no-saved-views">
              {t("noSavedViews")}
            </p>
          ) : (
            <div className="flex flex-col gap-1" data-testid="views-list">
              {views.map((view) => (
                <div
                  key={view._id}
                  className="group flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-secondary_subtle"
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 text-left"
                    onClick={() => {
                      onApply?.(view);
                      setIsOpen(false);
                    }}
                    data-testid={`apply-view-${view._id}`}
                  >
                    <span className="text-sm font-medium text-primary">{view.name}</span>
                    {view.isShared && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" data-testid={`shared-badge-${view._id}`}>
                        {t("shared")}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {view.userId === currentUserId && (
                      <>
                        <button
                          type="button"
                          className="rounded p-1 text-quaternary hover:text-primary"
                          onClick={() => onToggleShare?.(view._id, !view.isShared)}
                          title={t("shareView")}
                          data-testid={`toggle-share-${view._id}`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </button>
                        {confirmDeleteId === view._id ? (
                          <button
                            type="button"
                            className="rounded bg-error-600 px-2 py-0.5 text-xs text-white"
                            onClick={() => handleDelete(view._id)}
                            data-testid={`confirm-delete-${view._id}`}
                          >
                            {t("deleteView")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded p-1 text-quaternary hover:text-error-600"
                            onClick={() => setConfirmDeleteId(view._id)}
                            data-testid={`delete-view-${view._id}`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
