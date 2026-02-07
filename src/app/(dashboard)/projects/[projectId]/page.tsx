"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ArrowLeft, BarChart03, Hash01, Link03, Activity } from "@untitledui/icons";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { LoadingState } from "@/components/shared/LoadingState";
import { ProjectOverviewSection } from "@/components/project/sections/ProjectOverviewSection";
import { ProjectPositionMonitoring } from "@/components/project/sections/ProjectPositionMonitoring";
import { ProjectBacklinksOverview } from "@/components/project/sections/ProjectBacklinksOverview";
import { ProjectDomainsTable } from "@/components/project/tables/ProjectDomainsTable";

const tabs = [
    { id: "overview", label: "Overview", icon: BarChart03 },
    { id: "keywords", label: "Keywords", icon: Hash01 },
    { id: "backlinks", label: "Backlinks", icon: Link03 },
    { id: "monitoring", label: "Monitoring", icon: Activity },
];

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as Id<"projects">;

    const project = useQuery(api.projects.getProject, { projectId });

    if (project === undefined) {
        return <LoadingState />;
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <p className="text-lg font-medium text-primary">Project not found</p>
                <button onClick={() => router.push("/projects")} className="mt-4 text-sm text-brand-primary hover:underline">
                    Back to projects
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto flex max-w-container flex-col gap-6 px-4 py-8 lg:px-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.push("/projects")} className="rounded-lg border border-secondary p-2 hover:bg-primary-hover">
                    <ArrowLeft className="h-5 w-5 text-fg-quaternary" />
                </button>
                <div>
                    <h1 className="text-2xl font-semibold text-primary">{project.name}</h1>
                    <p className="text-sm text-tertiary">
                        {project.domainCount} domains &middot; {project.keywordCount} keywords
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
            </Tabs>
        </div>
    );
}
