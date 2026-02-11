"use client";

import { Button } from "@/components/base/buttons/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { signOut } = useAuthActions();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    toast.success(tc("signedOutSuccess"));
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display-sm font-semibold text-primary">
            {t("dashboard")}
          </h1>
          <p className="text-md text-tertiary mt-1">
            {tc("welcomeToDashboard")}
          </p>
        </div>

        <Button
          color="secondary"
          size="md"
          onClick={handleSignOut}
        >
          {tc("signOut")}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-tertiary">{tc("totalProjects")}</p>
          <p className="text-display-sm font-semibold text-primary mt-2">0</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-tertiary">{tc("totalDomains")}</p>
          <p className="text-display-sm font-semibold text-primary mt-2">0</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-tertiary">{tc("totalKeywords")}</p>
          <p className="text-display-sm font-semibold text-primary mt-2">0</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-tertiary">{tc("avgPosition")}</p>
          <p className="text-display-sm font-semibold text-primary mt-2">-</p>
        </div>
      </div>
    </div>
  );
}
