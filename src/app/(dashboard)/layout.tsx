"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SidebarNavigationSectionDividers } from "@/components/application/app-navigation/sidebar-navigation/sidebar-section-dividers";
import { TopBar } from "@/components/application/app-navigation/TopBar";
import {
  Calendar,
  Folder,
  Globe01,
  LayersThree01,
  Settings01,
} from "@untitledui/icons";
import { usePathname } from "next/navigation";
import { GlobalJobStatus } from "@/components/domain/job-status/GlobalJobStatus";
import { JobCompletionNotifier } from "@/components/domain/job-status/JobCompletionNotifier";
import { SidebarUsageIndicator } from "@/components/domain/SidebarUsageIndicator";
import { AlertFullWidth } from "@/components/application/alerts/alerts";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProductTour } from "@/components/tours/ProductTour";
import { TOUR_GETTING_STARTED } from "@/components/tours/tourDefinitions";
import { useTranslations } from "next-intl";
import type { Id } from "../../../convex/_generated/dataModel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const pathname = usePathname();

  const onboardingStatus = useQuery(
    api.onboarding.getUserOnboardingStatus,
    isAuthenticated ? {} : "skip"
  );

  const userOrgs = useQuery(
    api.organizations.getUserOrganizations,
    isAuthenticated ? {} : "skip"
  );

  const impersonatingOrgId =
    typeof window !== "undefined"
      ? localStorage.getItem("impersonatingOrgId")
      : null;

  const activeOrgId = impersonatingOrgId
    ? (impersonatingOrgId as Id<"organizations">)
    : userOrgs?.[0]?._id;

  const usage = useQuery(
    api.limits.getUsageStats,
    activeOrgId ? { organizationId: activeOrgId } : "skip"
  );

  const isOverLimit = usage && (
    (usage.keywords.limit !== null && usage.keywords.current > usage.keywords.limit) ||
    (usage.domains.limit !== null && usage.domains.current > usage.domains.limit) ||
    (usage.projects.limit !== null && usage.projects.current > usage.projects.limit)
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Redirect new users to onboarding flow
  useEffect(() => {
    if (
      isAuthenticated &&
      onboardingStatus !== undefined &&
      onboardingStatus !== null &&
      !onboardingStatus.hasCompletedOnboarding
    ) {
      router.push("/onboarding");
    }
  }, [isAuthenticated, onboardingStatus, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-tertiary">{tc("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <PermissionsProvider organizationId={activeOrgId}>
      <div className="flex min-h-screen bg-primary">
        {/* Sidebar */}
        <SidebarNavigationSectionDividers
          activeUrl={pathname}
          footer={<SidebarUsageIndicator />}
          items={[
            {
              label: t("projects"),
              href: "/projects",
              icon: Folder,
            },
            {
              label: t("domains"),
              href: "/domains",
              icon: Globe01,
            },
            {
              label: t("jobs"),
              href: "/jobs",
              icon: LayersThree01,
            },
            {
              label: t("calendar"),
              href: "/calendar",
              icon: Calendar,
            },
            { divider: true },
            {
              label: t("settings"),
              href: "/settings",
              icon: Settings01,
            },
          ]}
        />

        {/* Main content area (right of sidebar) */}
        <main className="min-w-0 flex-1 flex flex-col">
          <ImpersonationBanner />
          <TopBar activeUrl={pathname} />
          {isOverLimit && (
            <AlertFullWidth
              color="warning"
              title="Plan limit exceeded"
              description="You've exceeded your plan limits. Upgrade your plan or remove excess resources to continue adding new items."
              confirmLabel="Upgrade plan"
              onConfirm={() => router.push("/pricing")}
              actionType="button"
            />
          )}
          <ErrorBoundary label="Page">
            {children}
          </ErrorBoundary>
        </main>

        {/* Global job status indicator */}
        <GlobalJobStatus />

        {/* Job completion notifications */}
        <JobCompletionNotifier />

        {/* Getting started product tour */}
        <ProductTour tourId={TOUR_GETTING_STARTED.id} steps={TOUR_GETTING_STARTED.steps} />
      </div>
    </PermissionsProvider>
  );
}
