"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Save01 } from "@untitledui/icons";

const PERMISSION_CATEGORIES: Record<
  string,
  { label: string; permissions: string[] }
> = {
  org: {
    label: "Organizacja",
    permissions: [
      "org.settings.view",
      "org.settings.edit",
      "org.limits.view",
      "org.limits.edit",
    ],
  },
  members: {
    label: "Czlonkowie",
    permissions: [
      "members.view",
      "members.invite",
      "members.remove",
      "members.roles.edit",
    ],
  },
  projects: {
    label: "Projekty",
    permissions: [
      "projects.view",
      "projects.create",
      "projects.edit",
      "projects.delete",
    ],
  },
  domains: {
    label: "Domeny",
    permissions: [
      "domains.view",
      "domains.create",
      "domains.edit",
      "domains.delete",
    ],
  },
  keywords: {
    label: "Slowa kluczowe",
    permissions: [
      "keywords.view",
      "keywords.add",
      "keywords.remove",
      "keywords.refresh",
    ],
  },
  reports: {
    label: "Raporty",
    permissions: [
      "reports.view",
      "reports.create",
      "reports.edit",
      "reports.share",
    ],
  },
  backlinks: {
    label: "Backlinki",
    permissions: ["backlinks.view", "backlinks.analyze"],
  },
  audit: {
    label: "Audyt SEO",
    permissions: ["audit.view", "audit.run"],
  },
  competitors: {
    label: "Konkurenci",
    permissions: [
      "competitors.view",
      "competitors.add",
      "competitors.analyze",
    ],
  },
  ai: {
    label: "AI",
    permissions: ["ai.research", "ai.strategy"],
  },
  forecasts: {
    label: "Prognozy",
    permissions: ["forecasts.view", "forecasts.generate"],
  },
  links: {
    label: "Link Building",
    permissions: ["links.view", "links.manage"],
  },
};

const SYSTEM_ROLES = ["owner", "admin", "member", "viewer", "custom"] as const;

const ROLE_LABELS: Record<string, string> = {
  owner: "Wlasciciel",
  admin: "Administrator",
  member: "Czlonek",
  viewer: "Obserwator",
  custom: "Niestandardowa",
};

interface MemberRowProps {
  member: {
    _id: string;
    role: string;
    joinedAt: number;
    user?: { name?: string; email?: string } | null;
  };
  callerPermissions: string[];
  onSave: (membershipId: string, role: string) => Promise<void>;
}

function MemberRow({ member, callerPermissions, onSave }: MemberRowProps) {
  const [selectedRole, setSelectedRole] = useState(member.role);
  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = member.role === "owner";
  const hasChanged = selectedRole !== member.role;
  const callerIsWildcard = callerPermissions.includes("*");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(member._id, selectedRole);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <tr className="border-b border-secondary last:border-0">
      <td className="py-3 pr-4 font-medium text-primary">
        {member.user?.name || "--"}
      </td>
      <td className="py-3 pr-4 text-tertiary">
        {member.user?.email || "--"}
      </td>
      <td className="py-3 pr-4">
        {isOwner ? (
          <Badge size="sm" type="pill-color" color="brand">
            {ROLE_LABELS.owner}
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="rounded-md border border-secondary bg-primary px-2 py-1 text-sm text-primary dark:bg-utility-gray-800 dark:text-utility-gray-100"
            >
              {SYSTEM_ROLES.filter((r) => r !== "owner").map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            {hasChanged && (
              <Button
                color="primary"
                size="sm"
                iconLeading={Save01}
                onClick={handleSave}
                isLoading={isSaving}
              >
                Zapisz
              </Button>
            )}
          </div>
        )}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-tertiary">
        {new Date(member.joinedAt).toLocaleDateString()}
      </td>
      <td className="py-3">
        {!isOwner && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" /> Ukryj uprawnienia
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" /> Pokaz uprawnienia
              </>
            )}
          </button>
        )}
      </td>
    </tr>
  );
}

export function RoleManagement() {
  const { permissions: callerPermissions, can, plan } = usePermissions();

  const orgs = useQuery(api.organizations.getUserOrganizations);
  const orgId = orgs?.[0]?._id;
  const members = useQuery(
    api.organizations.getOrganizationMembers,
    orgId ? { organizationId: orgId } : "skip"
  );
  const assignRole = useMutation(api.permissions.assignMemberRole);

  const handleSave = async (membershipId: string, role: string) => {
    try {
      await assignRole({
        membershipId: membershipId as Id<"organizationMembers">,
        role: role as "admin" | "member" | "viewer" | "custom",
      });
      toast.success("Rola zostala zaktualizowana");
    } catch (e: any) {
      toast.error(e?.message || "Nie udalo sie zaktualizowac roli");
    }
  };

  if (members === undefined || orgs === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-tertiary">Ladowanie...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-primary">
          Role i uprawnienia
        </h2>
        <p className="mt-1 text-sm text-tertiary">
          Zarzadzaj rolami czlonkow organizacji i ich uprawnieniami.
        </p>
      </div>

      {plan && (
        <div className="mb-6 rounded-lg border border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 px-4 py-3">
          <p className="text-sm text-brand-700 dark:text-brand-300">
            Plan: <strong>{plan.name}</strong> — uprawnienia ograniczone
            planem
          </p>
        </div>
      )}

      {!members || members.length === 0 ? (
        <p className="py-8 text-center text-sm text-tertiary">
          Brak czlonkow w organizacji
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-secondary">
                <th className="pb-3 pr-4 font-medium text-tertiary">Imie</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">Email</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">Rola</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">
                  Dolaczyl
                </th>
                <th className="pb-3 font-medium text-tertiary" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <MemberRow
                  key={member._id}
                  member={member}
                  callerPermissions={callerPermissions}
                  onSave={handleSave}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
