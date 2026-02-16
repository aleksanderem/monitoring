"use client";

import { useEffect, useState } from "react";

export function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState<{
    orgId: string;
    orgName: string;
  } | null>(null);

  useEffect(() => {
    const orgId = localStorage.getItem("impersonatingOrgId");
    const orgName = localStorage.getItem("impersonatingOrgName");
    if (orgId && orgName) {
      setImpersonating({ orgId, orgName });
    }
  }, []);

  if (!impersonating) return null;

  const handleExit = () => {
    localStorage.removeItem("impersonatingOrgId");
    localStorage.removeItem("impersonatingOrgName");
    window.location.href = "/admin/organizations";
  };

  return (
    <div className="bg-warning-solid text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-4 z-50">
      <span>
        Przeglądasz jako: <strong>{impersonating.orgName}</strong>
      </span>
      <button
        onClick={handleExit}
        className="underline hover:no-underline font-semibold"
      >
        Powrót do panelu admina
      </button>
    </div>
  );
}
