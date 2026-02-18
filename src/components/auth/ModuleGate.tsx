"use client";

import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface ModuleGateProps {
  module: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ModuleGate({ module, children, fallback }: ModuleGateProps) {
  const { hasModule, isLoading, plan } = usePermissions();

  if (isLoading) return null;

  if (!hasModule(module)) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-lg font-semibold text-primary mb-2">
          Modul niedostepny w Twoim planie
        </div>
        <p className="text-sm text-tertiary max-w-md">
          Aktualny plan: <strong>{plan?.name ?? "Brak"}</strong>.
          Skontaktuj sie z administratorem, aby uzyskac dostep do tej funkcji.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
