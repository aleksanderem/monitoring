"use client";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSearchParams } from "next/navigation";

export default function GscCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const complete = useMutation(api.gsc.completeGscConnection);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setStatus("error");
      return;
    }

    // Parse state to get organizationId
    try {
      const stateData = JSON.parse(atob(state));
      complete({
        organizationId: stateData.organizationId,
        code,
        state,
        googleEmail: stateData.email || "unknown@gmail.com",
        properties: [],
      })
        .then(() => {
          setStatus("success");
          setTimeout(() => window.close(), 2000);
        })
        .catch(() => setStatus("error"));
    } catch {
      setStatus("error");
    }
  }, [searchParams, complete]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {status === "processing" && <p>Connecting Google Search Console...</p>}
        {status === "success" && (
          <p className="text-green-600">Connected! This window will close automatically.</p>
        )}
        {status === "error" && (
          <p className="text-red-600">Connection failed. Please try again.</p>
        )}
      </div>
    </div>
  );
}
