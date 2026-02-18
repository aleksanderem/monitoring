"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SearchLg, Stars01, RefreshCw01 } from "@untitledui/icons";
import { Calendar } from "@/components/application/calendar/calendar";
import type { CalendarEvent } from "@/components/application/calendar/calendar";
import type { EventViewColor } from "@/components/application/calendar/base-components/calendar-month-view-event";
import { TabList, Tabs } from "@/components/application/tabs/tabs";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { useTranslations } from "next-intl";

// Category filter tabs
const CATEGORY_TABS = [
  { id: "all", label: "Wszystkie" },
  { id: "ranking_drop", label: "Spadki pozycji" },
  { id: "ranking_opportunity", label: "Szanse" },
  { id: "content_plan", label: "Treści" },
  { id: "link_building", label: "Link building" },
  { id: "audit_task", label: "Audyty" },
];

// Map backend color strings to EventViewColor
const COLOR_MAP: Record<string, EventViewColor> = {
  blue: "blue",
  pink: "pink",
  green: "green",
  purple: "purple",
  indigo: "indigo",
  orange: "orange",
  yellow: "yellow",
  gray: "gray",
  brand: "brand",
};

export default function CalendarPage() {
  const t = useTranslations("nav");
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedDomainId, setSelectedDomainId] = useState<
    Id<"domains"> | null
  >(null);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch user's domains
  const domains = useQuery(api.domains.list);

  // Auto-select first domain
  const activeDomainId =
    selectedDomainId ?? (domains?.[0]?._id as Id<"domains"> | undefined);

  // Stable date range — computed once on mount, not on every render
  const dateRangeRef = useRef({
    start: Date.now() - 35 * 24 * 60 * 60 * 1000,
    end: Date.now() + 35 * 24 * 60 * 60 * 1000,
  });

  const rawEvents = useQuery(
    api.calendarEvents.getEvents,
    activeDomainId
      ? {
          domainId: activeDomainId,
          startDate: dateRangeRef.current.start,
          endDate: dateRangeRef.current.end,
          category: selectedTab !== "all" ? selectedTab : undefined,
        }
      : "skip"
  );

  const runStrategist = useAction(api.actions.aiSeoStrategist.runStrategist);

  // Transform Convex events to Calendar component format
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    if (!rawEvents) return [];
    return rawEvents.map((event) => ({
      id: event._id,
      title: event.title,
      start: new Date(event.scheduledAt),
      end: new Date(event.scheduledEndAt ?? event.scheduledAt + 60 * 60 * 1000),
      color: COLOR_MAP[event.color ?? "blue"] ?? "blue",
      dot: event.priority === "critical" || event.priority === "high",
    }));
  }, [rawEvents]);

  const handleRunStrategist = async () => {
    if (!activeDomainId || isRunning) return;
    setIsRunning(true);
    try {
      await runStrategist({ domainId: activeDomainId });
    } finally {
      // Reset after a short delay (events will stream in via reactivity)
      setTimeout(() => setIsRunning(false), 3000);
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col bg-primary pt-8 pb-12">
      <div className="mx-auto mb-8 flex w-full max-w-container flex-col gap-5 px-4 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-0.5 md:gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-primary lg:text-display-xs">
                AI SEO Strategist
              </h1>
              <Stars01 className="size-6 text-utility-brand-500" />
            </div>
            <p className="text-md text-tertiary">
              Inteligentny kalendarz SEO — AI automatycznie planuje i
              priorytetyzuje zadania.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Domain selector */}
            {domains && domains.length > 1 && (
              <select
                className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary dark:bg-utility-gray-800 dark:border-utility-gray-700 dark:text-utility-gray-100"
                value={activeDomainId ?? ""}
                onChange={(e) =>
                  setSelectedDomainId(e.target.value as Id<"domains">)
                }
              >
                {domains.map((d: any) => (
                  <option key={d._id} value={d._id}>
                    {d.domain}
                  </option>
                ))}
              </select>
            )}
            {/* Generate events button */}
            <Button
              color="primary"
              size="sm"
              iconLeading={isRunning ? RefreshCw01 : Stars01}
              onClick={handleRunStrategist}
              isDisabled={!activeDomainId || isRunning}
            >
              {isRunning ? "Generowanie..." : "Generuj plan"}
            </Button>
          </div>
        </div>

        {/* Category filter tabs */}
        <Tabs
          orientation="horizontal"
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as string)}
          className="w-max self-start"
        >
          <TabList size="sm" type="button-minimal" items={CATEGORY_TABS} />
        </Tabs>
      </div>

      {/* Calendar */}
      <div className="mx-auto flex w-full max-w-container flex-col px-4 lg:px-8">
        {!activeDomainId ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-secondary_subtle p-16 text-center">
            <Stars01 className="mb-4 size-12 text-tertiary" />
            <h3 className="text-lg font-semibold text-primary">
              Brak domen
            </h3>
            <p className="mt-1 text-sm text-tertiary">
              Dodaj domenę, aby AI SEO Strategist mógł zaplanować działania.
            </p>
          </div>
        ) : (
          <Calendar events={calendarEvents} view="month" />
        )}
      </div>
    </div>
  );
}
