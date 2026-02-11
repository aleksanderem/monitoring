"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();

  const isSuperAdmin = useQuery(
    api.admin.checkIsSuperAdmin,
    isAuthenticated ? {} : "skip"
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }

    if (!authLoading && isAuthenticated && isSuperAdmin === false) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, authLoading, isSuperAdmin, router]);

  if (authLoading || isSuperAdmin === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-solid" />
      </div>
    );
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 bg-secondary">{children}</main>
    </div>
  );
}
