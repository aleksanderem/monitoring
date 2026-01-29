"use client";

import { SidebarNavigationSectionDividers } from "@/components/application/app-navigation/sidebar-navigation/sidebar-section-dividers";
import {
  BarChartSquare02,
  Folder,
  Globe01,
  SearchSm,
  Settings01,
  Users01,
} from "@untitledui/icons";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-primary">
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
  );
}
