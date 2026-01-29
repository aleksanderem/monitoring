"use client";

import { Button } from "@/components/base/buttons/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DashboardPage() {
  const { signOut } = useAuthActions();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    toast.success("Signed out successfully");
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display-sm font-semibold text-primary">
            Dashboard
          </h1>
          <p className="text-md text-tertiary mt-1">
            Welcome to your SEO monitoring dashboard
          </p>
        </div>

        <Button
          color="secondary"
          size="md"
          onClick={handleSignOut}
        >
          Sign Out
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-tertiary">Total Projects</p>
          <p className="text-display-sm font-semibold text-primary mt-2">0</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-tertiary">Total Domains</p>
          <p className="text-display-sm font-semibold text-primary mt-2">0</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-tertiary">Total Keywords</p>
          <p className="text-display-sm font-semibold text-primary mt-2">0</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-tertiary">Avg. Position</p>
          <p className="text-display-sm font-semibold text-primary mt-2">-</p>
        </div>
      </div>
    </div>
  );
}
