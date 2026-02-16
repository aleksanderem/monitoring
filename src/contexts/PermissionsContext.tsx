"use client";

import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface PermissionsContextValue {
  permissions: string[];
  modules: string[];
  role: string | null;
  plan: { name: string; key: string } | null;
  isLoading: boolean;
  can: (permission: string) => boolean;
  hasModule: (module: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: [],
  modules: [],
  role: null,
  plan: null,
  isLoading: true,
  can: () => false,
  hasModule: () => false,
});

export function PermissionsProvider({
  organizationId,
  children,
}: {
  organizationId: Id<"organizations"> | undefined;
  children: ReactNode;
}) {
  const context = useQuery(
    api.permissions.getMyContext,
    organizationId ? { organizationId } : "skip"
  );

  const value = useMemo<PermissionsContextValue>(() => {
    if (!context) {
      return {
        permissions: [],
        modules: [],
        role: null,
        plan: null,
        isLoading: context === undefined,
        can: () => false,
        hasModule: () => false,
      };
    }

    const perms = context.permissions;
    const isWildcard = perms.includes("*");

    return {
      permissions: perms,
      modules: context.modules,
      role: context.role,
      plan: context.plan,
      isLoading: false,
      can: (permission: string) => isWildcard || perms.includes(permission),
      hasModule: (module: string) => context.modules.includes(module),
    };
  }, [context]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
