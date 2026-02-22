"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FirstTimeFlow } from "@/components/onboarding/FirstTimeFlow";

export default function OnboardingPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();

  const onboardingStatus = useQuery(
    api.onboarding.getUserOnboardingStatus,
    isAuthenticated ? {} : "skip"
  );

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Redirect users who've already completed onboarding
  useEffect(() => {
    if (onboardingStatus?.hasCompletedOnboarding) {
      router.push("/domains");
    }
  }, [onboardingStatus, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
      </div>
    );
  }

  if (onboardingStatus === undefined) {
    // Query still loading
    return (
      <div className="flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
      </div>
    );
  }

  if (onboardingStatus?.hasCompletedOnboarding) {
    return null; // Will redirect via useEffect
  }

  return <FirstTimeFlow />;
}
