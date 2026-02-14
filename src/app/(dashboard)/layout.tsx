"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { SidebarNavigationSectionDividers } from "@/components/application/app-navigation/sidebar-navigation/sidebar-section-dividers";
import { TopBar } from "@/components/application/app-navigation/TopBar";
import {
  Folder,
  Globe01,
  LayersThree01,
  Settings01,
} from "@untitledui/icons";
import { usePathname } from "next/navigation";
import { GlobalJobStatus } from "@/components/domain/job-status/GlobalJobStatus";
import { JobCompletionNotifier } from "@/components/domain/job-status/JobCompletionNotifier";
import { SidebarUsageIndicator } from "@/components/domain/SidebarUsageIndicator";
import { useTranslations } from "next-intl";

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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

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
        <TopBar activeUrl={pathname} />
        {children}
      </main>

      {/* Global job status indicator */}
      <GlobalJobStatus />

      {/* Job completion notifications */}
      <JobCompletionNotifier />
    </div>
  );
}
