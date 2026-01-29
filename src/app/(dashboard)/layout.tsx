"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { SidebarNavigationSectionDividers } from "@/components/application/app-navigation/sidebar-navigation/sidebar-section-dividers";
import { TopBar } from "@/components/application/app-navigation/TopBar";
import {
  BarChartSquare02,
  Folder,
  Globe01,
  SearchSm,
  Settings01,
  Users01,
} from "@untitledui/icons";
import { usePathname } from "next/navigation";
import { GlobalJobStatus } from "@/components/domain/job-status/GlobalJobStatus";
import { JobCompletionNotifier } from "@/components/domain/job-status/JobCompletionNotifier";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          <p className="mt-4 text-sm text-tertiary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-primary">
      {/* Top bar with only right-side elements */}
      <TopBar activeUrl={pathname} />

      {/* Sidebar + Content */}
      <div className="flex flex-1">
        <SidebarNavigationSectionDividers
          activeUrl={pathname}
          items={[
            {
              label: "Dashboard",
              href: "/dashboard",
              icon: BarChartSquare02,
            },
            {
              label: "Projects",
              href: "/projects",
              icon: Folder,
            },
            {
              label: "Domains",
              href: "/domains",
              icon: Globe01,
            },
            {
              label: "Keywords",
              href: "/keywords",
              icon: SearchSm,
            },
            { divider: true },
            {
              label: "Teams",
              href: "/teams",
              icon: Users01,
            },
            {
              label: "Settings",
              href: "/settings",
              icon: Settings01,
            },
          ]}
        />

        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      {/* Global job status indicator */}
      <GlobalJobStatus />

      {/* Job completion notifications */}
      <JobCompletionNotifier />
    </div>
  );
}
