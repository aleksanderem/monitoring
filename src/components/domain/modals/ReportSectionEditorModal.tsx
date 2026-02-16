"use client";

import { useState, useMemo, useCallback } from "react";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Button } from "@/components/base/buttons/button";
import { Heading as AriaHeading } from "react-aria-components";
import { ChevronDown, ChevronUp, CheckDone01 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type ReportConfig,
  type ReportSectionConfig,
  SECTION_REGISTRY,
} from "@/lib/reportSections";

interface ReportSectionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ReportConfig;
  onSave: (config: ReportConfig) => void;
}

// ─── Drag Handle Icon ──────────────────────────────────────────
function DragHandle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-quaternary">
      <circle cx="5.5" cy="3.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="3.5" r="1" fill="currentColor" />
      <circle cx="5.5" cy="8" r="1" fill="currentColor" />
      <circle cx="10.5" cy="8" r="1" fill="currentColor" />
      <circle cx="5.5" cy="12.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="12.5" r="1" fill="currentColor" />
    </svg>
  );
}

// ─── Sortable Section Item ─────────────────────────────────────
function SortableSectionItem({
  section,
  sectionDef,
  onToggle,
  onToggleSubElement,
  t,
}: {
  section: ReportSectionConfig;
  sectionDef: (typeof SECTION_REGISTRY)[number];
  onToggle: () => void;
  onToggleSubElement: (subId: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  const hasSubElements = sectionDef.subElements.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border transition-colors ${
        section.enabled
          ? "border-secondary bg-primary"
          : "border-secondary/50 bg-disabled_subtle"
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <DragHandle />
        </button>

        {/* Toggle switch */}
        <button
          type="button"
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            section.enabled ? "bg-brand-500" : "bg-quaternary"
          }`}
        >
          <span
            className={`inline-block size-3.5 rounded-full bg-white transition-transform ${
              section.enabled ? "translate-x-[18px]" : "translate-x-[3px]"
            }`}
          />
        </button>

        {/* Section name */}
        <span className={`flex-1 text-sm font-medium ${section.enabled ? "text-primary" : "text-disabled"}`}>
          {t(sectionDef.labelKey as any)}
        </span>

        {/* Expand/collapse */}
        {hasSubElements && section.enabled && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-0.5 text-tertiary hover:text-primary"
            title={t("reportEditorExpandSection" as any)}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        )}
      </div>

      {/* Sub-elements */}
      {hasSubElements && section.enabled && expanded && (
        <div className="border-t border-secondary/50 px-3 py-2.5 pl-[52px]">
          <div className="space-y-2">
            {sectionDef.subElements.map((sub) => {
              const isChecked = section.subElements?.[sub.id] !== false;
              return (
                <label
                  key={sub.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-secondary"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleSubElement(sub.id)}
                    className="size-3.5 rounded border-secondary accent-brand-500"
                  />
                  {t(sub.labelKey as any)}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Editor Modal ──────────────────────────────────────────────
export function ReportSectionEditorModal({
  isOpen,
  onClose,
  config,
  onSave,
}: ReportSectionEditorModalProps) {
  const t = useTranslations("competitors");
  const tc = useTranslations("common");

  // Local draft state — only saved on confirm
  const [draft, setDraft] = useState<ReportConfig>(config);

  // Reset draft when modal opens with new config
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDraft(config);
      } else {
        onClose();
      }
    },
    [config, onClose]
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sectionIds = useMemo(() => draft.sections.map((s) => s.id), [draft]);

  const sectionDefMap = useMemo(() => {
    const map = new Map<string, (typeof SECTION_REGISTRY)[number]>();
    for (const def of SECTION_REGISTRY) {
      map.set(def.id, def);
    }
    return map;
  }, []);

  const enabledCount = draft.sections.filter((s) => s.enabled).length;

  const handleToggleSection = useCallback((sectionId: string) => {
    setDraft((prev) => ({
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  }, []);

  const handleToggleSubElement = useCallback((sectionId: string, subId: string) => {
    setDraft((prev) => ({
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const current = s.subElements?.[subId] !== false;
        return {
          ...s,
          subElements: { ...s.subElements, [subId]: !current },
        };
      }),
    }));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDraft((prev) => {
      const oldIndex = prev.sections.findIndex((s) => s.id === active.id);
      const newIndex = prev.sections.findIndex((s) => s.id === over.id);
      return { sections: arrayMove(prev.sections, oldIndex, newIndex) };
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft);
    onClose();
  }, [draft, onSave, onClose]);

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={handleOpenChange} isDismissable>
      <Modal>
        <Dialog className="overflow-hidden">
          <div className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-md">
            <CloseButton
              onClick={onClose}
              theme="light"
              size="lg"
              className="absolute top-3 right-3 z-10"
            />

            {/* Header */}
            <div className="border-b border-secondary px-6 py-4">
              <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                {t("reportProfileCustom" as any)}
              </AriaHeading>
              <p className="mt-1 text-sm text-tertiary">
                {t("reportEditorDragHint" as any)}
              </p>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                  <div className="max-h-[400px] space-y-1.5 overflow-y-auto">
                    {draft.sections.map((section) => {
                      const def = sectionDefMap.get(section.id);
                      if (!def) return null;
                      return (
                        <SortableSectionItem
                          key={section.id}
                          section={section}
                          sectionDef={def}
                          onToggle={() => handleToggleSection(section.id)}
                          onToggleSubElement={(subId) =>
                            handleToggleSubElement(section.id, subId)
                          }
                          t={t}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
              <span className="text-xs text-tertiary">
                {t("reportProfileSections", { count: enabledCount })}
              </span>
              <div className="flex gap-2">
                <Button size="md" color="secondary" onClick={onClose}>
                  {tc("cancel")}
                </Button>
                <Button
                  size="md"
                  color="primary"
                  iconLeading={CheckDone01}
                  onClick={handleSave}
                  isDisabled={enabledCount === 0}
                >
                  {tc("save")}
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
