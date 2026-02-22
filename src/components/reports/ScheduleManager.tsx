"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScheduleForm, type ScheduleFormData } from "./ScheduleForm";
import { toast } from "sonner";

interface ScheduleManagerProps {
  orgId: Id<"organizations">;
  domainId?: Id<"domains">;
}

export function ScheduleManager({ orgId, domainId }: ScheduleManagerProps) {
  const t = useTranslations("scheduledReports");
  const schedules = useQuery(api.scheduledReports.getSchedules, { orgId });
  const createSchedule = useMutation(api.scheduledReports.createSchedule);
  const updateScheduleMutation = useMutation(api.scheduledReports.updateSchedule);
  const deleteScheduleMutation = useMutation(api.scheduledReports.deleteSchedule);
  const toggleScheduleMutation = useMutation(api.scheduledReports.toggleSchedule);
  const runNowMutation = useMutation(api.scheduledReports.runScheduleNow);

  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<string | null>(null);

  // Filter by domain if provided
  const filteredSchedules = domainId
    ? schedules?.filter((s) => s.domainId === domainId)
    : schedules;

  const handleCreate = async (data: ScheduleFormData) => {
    try {
      await createSchedule({
        orgId,
        domainId: domainId!,
        name: data.name,
        reportType: data.reportType,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        recipients: data.recipients,
      });
      toast.success(t("scheduleCreated"));
      setShowForm(false);
    } catch (error) {
      toast.error("Failed to create schedule");
    }
  };

  const handleUpdate = async (scheduleId: string, data: ScheduleFormData) => {
    try {
      await updateScheduleMutation({
        scheduleId: scheduleId as Id<"reportSchedules">,
        name: data.name,
        reportType: data.reportType,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        recipients: data.recipients,
      });
      toast.success(t("scheduleUpdated"));
      setEditingSchedule(null);
    } catch (error) {
      toast.error("Failed to update schedule");
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      await deleteScheduleMutation({
        scheduleId: scheduleId as Id<"reportSchedules">,
      });
      setDeletingSchedule(null);
    } catch (error) {
      toast.error("Failed to delete schedule");
    }
  };

  const handleToggle = async (scheduleId: string, isActive: boolean) => {
    try {
      await toggleScheduleMutation({
        scheduleId: scheduleId as Id<"reportSchedules">,
        isActive,
      });
    } catch (error) {
      toast.error("Failed to toggle schedule");
    }
  };

  const handleRunNow = async (scheduleId: string) => {
    if (!confirm(t("confirmRunNow"))) return;
    try {
      await runNowMutation({
        scheduleId: scheduleId as Id<"reportSchedules">,
      });
    } catch (error) {
      toast.error("Failed to run schedule");
    }
  };

  const getReportTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      executive: t("executive"),
      keyword: t("keyword"),
      competitor: t("competitor"),
      monthly: t("monthlyReport"),
      custom: t("custom"),
    };
    return map[type] ?? type;
  };

  const getFrequencyLabel = (freq: string) => {
    const map: Record<string, string> = {
      weekly: t("weekly"),
      biweekly: t("biweekly"),
      monthly: t("monthly"),
    };
    return map[freq] ?? freq;
  };

  // Loading state
  if (schedules === undefined) {
    return <div data-testid="loading-state">Loading...</div>;
  }

  return (
    <div data-testid="schedule-manager" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => setShowForm(true)} data-testid="add-schedule-btn">
          {t("addSchedule")}
        </Button>
      </div>

      {/* Add Schedule Form */}
      {showForm && (
        <div className="border rounded-lg p-4" data-testid="create-form-container">
          <ScheduleForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Empty State */}
      {filteredSchedules && filteredSchedules.length === 0 && !showForm && (
        <div className="text-center py-12 text-muted-foreground" data-testid="empty-state">
          {t("noSchedules")}
        </div>
      )}

      {/* Schedule List */}
      {filteredSchedules && filteredSchedules.length > 0 && (
        <div className="space-y-3" data-testid="schedules-list">
          {filteredSchedules.map((schedule) => (
            <div
              key={schedule._id}
              className="border rounded-lg p-4 flex items-center justify-between"
              data-testid={`schedule-${schedule._id}`}
            >
              {editingSchedule === schedule._id ? (
                <div className="w-full">
                  <ScheduleForm
                    initialData={{
                      name: schedule.name,
                      reportType: schedule.reportType,
                      frequency: schedule.frequency,
                      dayOfWeek: schedule.dayOfWeek,
                      dayOfMonth: schedule.dayOfMonth,
                      recipients: schedule.recipients,
                    }}
                    onSubmit={(data) => handleUpdate(schedule._id, data)}
                    onCancel={() => setEditingSchedule(null)}
                    isEdit
                  />
                </div>
              ) : deletingSchedule === schedule._id ? (
                <div className="w-full">
                  <p className="mb-3">{t("confirmDelete")}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(schedule._id)}
                      data-testid="confirm-delete-btn"
                    >
                      {t("deleteSchedule")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingSchedule(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{schedule.name}</span>
                      <Badge variant={schedule.isActive ? "default" : "secondary"}>
                        {schedule.isActive ? t("active") : t("paused")}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {getReportTypeLabel(schedule.reportType)} &middot;{" "}
                      {getFrequencyLabel(schedule.frequency)} &middot;{" "}
                      {schedule.recipients.length} {t("recipients").toLowerCase()}
                    </div>
                    {schedule.nextRunAt && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {t("nextRun")}: {new Date(schedule.nextRunAt).toLocaleDateString()}
                      </div>
                    )}
                    {schedule.lastRunAt && (
                      <div className="text-xs text-muted-foreground">
                        {t("lastRun")}: {new Date(schedule.lastRunAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(schedule._id, !schedule.isActive)}
                      data-testid={`toggle-${schedule._id}`}
                    >
                      {schedule.isActive ? t("paused") : t("active")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunNow(schedule._id)}
                      data-testid={`run-now-${schedule._id}`}
                    >
                      {t("runNow")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSchedule(schedule._id)}
                      data-testid={`edit-${schedule._id}`}
                    >
                      {t("editSchedule")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingSchedule(schedule._id)}
                      data-testid={`delete-${schedule._id}`}
                    >
                      {t("deleteSchedule")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
