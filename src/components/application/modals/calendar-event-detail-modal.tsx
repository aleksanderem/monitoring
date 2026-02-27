"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Heading as AriaHeading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { CheckCircle, Play, XClose, Trash01, Clock, Tag01, AlertCircle, Hash01, File06 } from "@untitledui/icons";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface CalendarEventData {
  _id: Id<"calendarEvents">;
  title: string;
  description?: string;
  category: string;
  priority: string;
  status: string;
  scheduledAt: number;
  scheduledEndAt?: number;
  keywordPhrase?: string;
  aiReasoning?: string;
  aiActionItems?: string[];
  sourceType: string;
  color?: string;
}

interface CalendarEventDetailModalProps {
  event: CalendarEventData | null;
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITY_COLORS: Record<string, "error" | "warning" | "brand" | "gray"> = {
  critical: "error",
  high: "warning",
  medium: "brand",
  low: "gray",
};

const STATUS_COLORS: Record<string, "success" | "brand" | "gray" | "error"> = {
  scheduled: "gray",
  in_progress: "brand",
  completed: "success",
  dismissed: "gray",
  auto_resolved: "gray",
};

const CATEGORY_LABELS: Record<string, string> = {
  ranking_drop: "categoryRankingDrop",
  ranking_opportunity: "categoryRankingOpportunity",
  content_plan: "categoryContentPlan",
  link_building: "categoryLinkBuilding",
  audit_task: "categoryAuditTask",
  custom: "categoryAll",
};

export function CalendarEventDetailModal({ event, isOpen, onClose }: CalendarEventDetailModalProps) {
  const t = useTranslations("calendar");
  const updateStatus = useMutation(api.calendarEvents.updateEventStatus);
  const deleteEvent = useMutation(api.calendarEvents.deleteEvent);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!event) return null;

  const handleStatusChange = async (newStatus: string, successMessage: string) => {
    setIsUpdating(true);
    try {
      await updateStatus({ eventId: event._id, status: newStatus });
      toast.success(successMessage);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update event");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    try {
      await deleteEvent({ eventId: event._id });
      toast.success(t("eventDeleted"));
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete event");
    } finally {
      setIsUpdating(false);
    }
  };

  const scheduledDate = new Date(event.scheduledAt);
  const endDate = event.scheduledEndAt ? new Date(event.scheduledEndAt) : null;
  const isActionable = event.status === "scheduled" || event.status === "in_progress";

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onClose()} isDismissable={!isUpdating}>
      <Modal>
        <Dialog>
          <div className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-md">
            <CloseButton
              onClick={onClose}
              theme="light"
              size="lg"
              className="absolute top-3 right-3 z-10"
              isDisabled={isUpdating}
            />

            {/* Header */}
            <div className="flex flex-col gap-3 p-5 pb-0">
              <AriaHeading slot="title" className="pr-8 text-lg font-semibold text-primary">
                {event.title}
              </AriaHeading>

              <div className="flex flex-wrap items-center gap-2">
                <BadgeWithDot size="sm" type="modern" color={PRIORITY_COLORS[event.priority] ?? "gray"}>
                  {t(`priority${event.priority.charAt(0).toUpperCase()}${event.priority.slice(1)}` as any)}
                </BadgeWithDot>
                <BadgeWithDot size="sm" type="modern" color={STATUS_COLORS[event.status] ?? "gray"}>
                  {t(`eventStatus${event.status.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("")}` as any)}
                </BadgeWithDot>
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 p-5">
              {/* Schedule */}
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-fg-quaternary" />
                <div className="text-sm text-secondary">
                  <div>{scheduledDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
                  <div className="text-tertiary">
                    {scheduledDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    {endDate && ` – ${endDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                </div>
              </div>

              {/* Category */}
              <div className="flex items-center gap-3">
                <Tag01 className="h-4 w-4 shrink-0 text-fg-quaternary" />
                <span className="text-sm text-secondary">
                  {t(CATEGORY_LABELS[event.category] as any ?? "categoryAll")}
                </span>
              </div>

              {/* Keyword */}
              {event.keywordPhrase && (
                <div className="flex items-center gap-3">
                  <Hash01 className="h-4 w-4 shrink-0 text-fg-quaternary" />
                  <span className="text-sm font-medium text-primary">{event.keywordPhrase}</span>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div className="flex items-start gap-3">
                  <File06 className="mt-0.5 h-4 w-4 shrink-0 text-fg-quaternary" />
                  <p className="text-sm text-secondary">{event.description}</p>
                </div>
              )}

              {/* AI Reasoning */}
              {event.aiReasoning && (
                <div className="rounded-lg border border-secondary bg-secondary_subtle p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-tertiary">{t("eventAiReasoning")}</p>
                  <p className="text-sm text-secondary">{event.aiReasoning}</p>
                </div>
              )}

              {/* AI Action Items */}
              {event.aiActionItems && event.aiActionItems.length > 0 && (
                <div className="rounded-lg border border-secondary bg-secondary_subtle p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-tertiary">{t("eventActionItems")}</p>
                  <ul className="flex flex-col gap-1.5">
                    {event.aiActionItems.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-secondary">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-solid" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions */}
            {isActionable && (
              <div className="flex flex-wrap gap-2 border-t border-secondary p-4">
                {event.status === "scheduled" && (
                  <Button
                    size="sm"
                    color="secondary"
                    iconLeading={Play}
                    onClick={() => handleStatusChange("in_progress", t("eventStarted"))}
                    isDisabled={isUpdating}
                  >
                    {t("eventMarkInProgress")}
                  </Button>
                )}
                <Button
                  size="sm"
                  color="primary"
                  iconLeading={CheckCircle}
                  onClick={() => handleStatusChange("completed", t("eventCompleted"))}
                  isDisabled={isUpdating}
                >
                  {t("eventMarkComplete")}
                </Button>
                <Button
                  size="sm"
                  color="tertiary"
                  iconLeading={XClose}
                  onClick={() => handleStatusChange("dismissed", t("eventDismissed"))}
                  isDisabled={isUpdating}
                >
                  {t("eventDismiss")}
                </Button>
                <Button
                  size="sm"
                  color="secondary-destructive"
                  iconLeading={Trash01}
                  onClick={handleDelete}
                  isDisabled={isUpdating}
                >
                  {t("eventDelete")}
                </Button>
              </div>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
