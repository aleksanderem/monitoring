"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ArrowLeft, BarChart03, Hash01, Link03, Activity, Settings01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { toast } from "sonner";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { LoadingState } from "@/components/shared/LoadingState";
import { ProjectOverviewSection } from "@/components/project/sections/ProjectOverviewSection";
import { ProjectPositionMonitoring } from "@/components/project/sections/ProjectPositionMonitoring";
import { ProjectBacklinksOverview } from "@/components/project/sections/ProjectBacklinksOverview";
import { ProjectDomainsTable } from "@/components/project/tables/ProjectDomainsTable";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";

function ProjectLimitsSection({ projectId, currentLimits }: { projectId: Id<"projects">; currentLimits?: { maxDomains?: number; maxKeywordsPerDomain?: number; maxDailyRefreshes?: number } }) {
  const t = useTranslations("projects");
  const updateProjectLimits = useMutation(api.limits.updateProjectLimits);

  const [maxDomains, setMaxDomains] = useState<number | null>(null);
  const [maxKeywordsPerDomain, setMaxKeywordsPerDomain] = useState<number | null>(null);
  const [maxDailyRefreshes, setMaxDailyRefreshes] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentMaxDomains = maxDomains ?? currentLimits?.maxDomains ?? 0;
  const currentMaxKeywords = maxKeywordsPerDomain ?? currentLimits?.maxKeywordsPerDomain ?? 0;
  const currentMaxDaily = maxDailyRefreshes ?? currentLimits?.maxDailyRefreshes ?? 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProjectLimits({
        projectId,
        limits: {
          maxDomains: currentMaxDomains || null,
          maxKeywordsPerDomain: currentMaxKeywords || null,
          maxDailyRefreshes: currentMaxDaily || null,
        },
      });
      toast.success(t("limitsUpdated"));
    } catch {
      toast.error(t("limitsUpdateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const fields = [
    { label: t("maxDomainsLabel"), hint: t("maxDomainsHint"), value: currentMaxDomains, onChange: setMaxDomains },
    { label: t("maxKeywordsPerDomainLabel"), hint: t("maxKeywordsPerDomainHint"), value: currentMaxKeywords, onChange: setMaxKeywordsPerDomain },
    { label: t("maxDailyRefreshesLabel"), hint: t("maxDailyRefreshesHint"), value: currentMaxDaily, onChange: setMaxDailyRefreshes },
  ];

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-primary">{t("projectLimitsTitle")}</h2>
        <p className="mt-1 text-sm text-tertiary">{t("projectLimitsDescription")}</p>
      </div>

      <div className="flex flex-col gap-4">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-secondary">{field.label}</label>
            <input
              type="number"
              min={0}
              value={field.value}
              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
              className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
            />
            <p className="text-xs text-tertiary">{field.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button color="primary" size="sm" onClick={handleSave} isLoading={isSaving}>
          {t("limitsSave")}
        </Button>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
    const t = useTranslations("projects");

    const tabs = [
        { id: "overview", label: t("tabOverview"), icon: BarChart03 },
        { id: "keywords", label: t("tabKeywords"), icon: Hash01 },
        { id: "backlinks", label: t("tabBacklinks"), icon: Link03 },
        { id: "monitoring", label: t("tabMonitoring"), icon: Activity },
        { id: "settings", label: t("tabSettings"), icon: Settings01 },
    ];
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as Id<"projects">;

    const project = useQuery(api.projects.getProject, { projectId });
    usePageTitle(project?.name);

    if (project === undefined) {
        return <LoadingState />;
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <p className="text-lg font-medium text-primary">{t("projectNotFound")}</p>
                <button onClick={() => router.push("/projects")} className="mt-4 text-sm text-brand-primary hover:underline">
                    {t("backToProjects")}
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-container flex-col gap-6 px-4 py-8 lg:px-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.push("/projects")} className="rounded-lg border border-secondary p-2 hover:bg-primary-hover">
                    <ArrowLeft className="h-5 w-5 text-fg-quaternary" />
                </button>
                <div>
                    <h1 className="text-2xl font-semibold text-primary">{project.name}</h1>
                    <p className="text-sm text-tertiary">
                        {t("domainKeywordSummary", { domains: project.domainCount, keywords: project.keywordCount })}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs>
                <TabList size="sm" type="line" items={tabs} />

                {/* Overview Tab */}
                <TabPanel id="overview">
                    <div className="flex flex-col gap-6">
                        <ProjectOverviewSection projectId={projectId} />
                        <ProjectDomainsTable projectId={projectId} />
                    </div>
                </TabPanel>

                {/* Keywords Tab */}
                <TabPanel id="keywords">
                    <div className="flex flex-col gap-6">
                        <ProjectPositionMonitoring projectId={projectId} />
                    </div>
                </TabPanel>

                {/* Backlinks Tab */}
                <TabPanel id="backlinks">
                    <ProjectBacklinksOverview projectId={projectId} />
                </TabPanel>

                {/* Monitoring Tab */}
                <TabPanel id="monitoring">
                    <ProjectPositionMonitoring projectId={projectId} />
                </TabPanel>

                {/* Settings Tab */}
                <TabPanel id="settings">
                    <ProjectLimitsSection projectId={projectId} currentLimits={project.limits} />
                </TabPanel>
            </Tabs>
        </div>
    );
}
