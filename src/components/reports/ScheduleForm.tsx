"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REPORT_TYPES = ["executive", "keyword", "competitor", "monthly", "custom"] as const;
const FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export interface ScheduleFormData {
  name: string;
  reportType: (typeof REPORT_TYPES)[number];
  frequency: (typeof FREQUENCIES)[number];
  dayOfWeek?: number;
  dayOfMonth?: number;
  recipients: string[];
}

interface ScheduleFormProps {
  initialData?: Partial<ScheduleFormData>;
  onSubmit: (data: ScheduleFormData) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

export function ScheduleForm({ initialData, onSubmit, onCancel, isEdit }: ScheduleFormProps) {
  const t = useTranslations("scheduledReports");

  const [name, setName] = useState(initialData?.name ?? "");
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]>(
    initialData?.reportType ?? "executive"
  );
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>(
    initialData?.frequency ?? "weekly"
  );
  const [dayOfWeek, setDayOfWeek] = useState<number>(initialData?.dayOfWeek ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(initialData?.dayOfMonth ?? 1);
  const [recipients, setRecipients] = useState<string[]>(initialData?.recipients ?? []);
  const [recipientInput, setRecipientInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addRecipient = () => {
    const email = recipientInput.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors((prev) => ({ ...prev, recipient: "Invalid email address" }));
      return;
    }
    if (recipients.includes(email)) return;
    setRecipients((prev) => [...prev, email]);
    setRecipientInput("");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.recipient;
      return next;
    });
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Name is required";
    if (recipients.length === 0) newErrors.recipients = "At least one recipient is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      name: name.trim(),
      reportType,
      frequency,
      dayOfWeek: frequency !== "monthly" ? dayOfWeek : undefined,
      dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
      recipients,
    });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="schedule-form" className="space-y-4">
      {/* Schedule Name */}
      <div>
        <Label htmlFor="schedule-name">{t("scheduleName")}</Label>
        <Input
          id="schedule-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("scheduleName")}
          data-testid="schedule-name-input"
        />
        {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* Report Type */}
      <div>
        <Label htmlFor="report-type">{t("reportType")}</Label>
        <select
          id="report-type"
          value={reportType}
          onChange={(e) => setReportType(e.target.value as typeof reportType)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="report-type-select"
        >
          {REPORT_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {t(rt === "monthly" ? "monthlyReport" : rt)}
            </option>
          ))}
        </select>
      </div>

      {/* Frequency */}
      <div>
        <Label htmlFor="frequency">{t("frequency")}</Label>
        <select
          id="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as typeof frequency)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="frequency-select"
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {t(f)}
            </option>
          ))}
        </select>
      </div>

      {/* Day Selector */}
      {frequency !== "monthly" ? (
        <div>
          <Label htmlFor="day-of-week">{t("dayOfWeek")}</Label>
          <select
            id="day-of-week"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="day-of-week-select"
          >
            {DAYS_OF_WEEK.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <Label htmlFor="day-of-month">{t("dayOfMonth")}</Label>
          <select
            id="day-of-month"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="day-of-month-select"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Recipients */}
      <div>
        <Label>{t("recipients")}</Label>
        <div className="flex gap-2">
          <Input
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            placeholder="email@example.com"
            data-testid="recipient-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRecipient();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addRecipient}
            data-testid="add-recipient-btn"
          >
            {t("addRecipient")}
          </Button>
        </div>
        {errors.recipient && <p className="text-sm text-red-500 mt-1">{errors.recipient}</p>}
        {errors.recipients && <p className="text-sm text-red-500 mt-1">{errors.recipients}</p>}
        {recipients.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2" data-testid="recipients-list">
            {recipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  data-testid={`remove-recipient-${email}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("deleteSchedule") ? "Cancel" : "Cancel"}
        </Button>
        <Button type="submit" data-testid="submit-schedule-btn">
          {isEdit ? t("editSchedule") : t("addSchedule")}
        </Button>
      </div>
    </form>
  );
}
