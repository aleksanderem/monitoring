"use client";

import { AppLogo } from "@/components/foundations/logo/app-logo";
import { Button } from "@/components/base/buttons/button";
import { XCircle } from "@untitledui/icons";
import Link from "next/link";

export default function PricingCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 rounded-xl border border-white/10 bg-gray-900/80 p-8 text-center backdrop-blur-sm">
        <Link href="/">
          <AppLogo variant="white" className="h-8" />
        </Link>

        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-50/10">
            <XCircle className="h-6 w-6 text-fg-warning-primary" />
          </div>
          <h1 className="text-display-xs font-semibold text-white">
            Checkout canceled
          </h1>
          <p className="text-sm text-gray-400">
            No worries &mdash; you can upgrade anytime from your settings.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button color="primary" size="lg" href="/pricing" className="w-full">
            Back to pricing
          </Button>
          <Button color="secondary" size="lg" href="/domains" className="w-full">
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
