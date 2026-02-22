"use client";

import { use } from "react";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ReportGenerationWizard } from "@/components/domain/reports/ReportGenerationWizard";
import { GeneratedReportsList } from "@/components/domain/reports/GeneratedReportsList";

interface PageProps {
  params: Promise<{
    domainId: Id<"domains">;
  }>;
}

export default function ReportsPage({ params }: PageProps) {
  const { domainId } = use(params);
  const t = useTranslations("domains");
  usePageTitle(t("tabReports"));

  return (
    <div className="mx-auto w-full max-w-container space-y-6 px-4 py-8 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">{t("reportsTitle")}</h1>
        <p className="mt-1 text-sm text-tertiary">{t("reportsDescription")}</p>
      </div>

      <ReportGenerationWizard domainId={domainId} />
      <GeneratedReportsList domainId={domainId} />
    </div>
  );
}
