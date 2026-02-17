"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Save01,
  Plus,
  Edit05,
  Trash01,
  Shield01,
  CheckCircle,
  XCircle,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";

// ─── Types ──────────────────────────────────────────────────────────

interface RoleDoc {
  _id: Id<"roles">;
  name: string;
  key: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  organizationId?: Id<"organizations">;
}

interface PermissionsData {
  permissions: Record<string, string>;
  categories: Record<string, { label: string; permissions: string[] }>;
}

// ─── Permissions Grid ───────────────────────────────────────────────

function PermissionsGrid({
  categories,
  permissionLabels,
  selectedPermissions,
  onToggle,
  readOnly = false,
}: {
  categories: Record<string, { label: string; permissions: string[] }>;
  permissionLabels: Record<string, string>;
  selectedPermissions: Set<string>;
  onToggle?: (permission: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries(categories).map(([catKey, category]) => (
        <div
          key={catKey}
          className="rounded-lg border border-secondary p-3"
        >
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tertiary">
            {category.label}
          </h4>
          <div className="flex flex-col gap-1.5">
            {category.permissions.map((perm) => {
              const isSelected = selectedPermissions.has(perm);
              const label = permissionLabels[perm] || perm;

              if (readOnly) {
                return (
                  <div key={perm} className="flex items-center gap-2 text-sm">
                    {isSelected ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-success-500" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-quaternary" />
                    )}
                    <span className={isSelected ? "text-primary" : "text-quaternary"}>
                      {label}
                    </span>
                  </div>
                );
              }

              return (
                <Checkbox
                  key={perm}
                  size="sm"
                  label={label}
                  isSelected={isSelected}
                  onChange={() => onToggle?.(perm)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Create / Edit Role Form ────────────────────────────────────────

function RoleForm({
  categories,
  permissionLabels,
  organizationId,
  existingRole,
  onDone,
}: {
  categories: Record<string, { label: string; permissions: string[] }>;
  permissionLabels: Record<string, string>;
  organizationId: Id<"organizations">;
  existingRole?: RoleDoc;
  onDone: () => void;
}) {
  const t = useTranslations("settings");
  const createRole = useMutation(api.permissions.createRole);
  const updateRole = useMutation(api.permissions.updateRole);

  const [name, setName] = useState(existingRole?.name ?? "");
  const [description, setDescription] = useState(existingRole?.description ?? "");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    new Set(existingRole?.permissions ?? [])
  );
  const [isSaving, setIsSaving] = useState(false);

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      if (existingRole) {
        await updateRole({
          roleId: existingRole._id,
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: Array.from(selectedPerms),
        });
        toast.success(t("updateRoleSuccess"));
      } else {
        await createRole({
          organizationId,
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: Array.from(selectedPerms),
        });
        toast.success(t("createRoleSuccess"));
      }
      onDone();
    } catch (e: any) {
      toast.error(e?.message || (existingRole ? t("updateRoleFailed") : t("createRoleFailed")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-brand-200 bg-primary p-4 dark:border-brand-800">
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t("roleName")}
          size="sm"
          placeholder={t("roleNamePlaceholder")}
          value={name}
          onChange={(v) => setName(v)}
        />
        <Input
          label={t("roleDescriptionLabel")}
          size="sm"
          placeholder={t("roleDescriptionPlaceholder")}
          value={description}
          onChange={(v) => setDescription(v)}
        />
      </div>

      <h4 className="mb-3 text-sm font-medium text-secondary">
        {t("selectPermissions")}
      </h4>

      <PermissionsGrid
        categories={categories}
        permissionLabels={permissionLabels}
        selectedPermissions={selectedPerms}
        onToggle={togglePerm}
      />

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button color="secondary" size="sm" onClick={onDone}>
          {t("cancelRole")}
        </Button>
        <Button
          color="primary"
          size="sm"
          iconLeading={Save01}
          onClick={handleSave}
          isLoading={isSaving}
          isDisabled={!name.trim()}
        >
          {t("saveRole")}
        </Button>
      </div>
    </div>
  );
}

// ─── System Roles Section ───────────────────────────────────────────

// Hardcoded fallback permissions matching convex/permissions.ts SYSTEM_ROLE_PERMISSIONS
const FALLBACK_SYSTEM_ROLES: {
  key: string;
  nameKey: string;
  descKey: string;
  color: "brand" | "blue" | "success" | "gray";
  permissionsMode: "all" | "list";
  permissions?: string[];
}[] = [
  {
    key: "owner",
    nameKey: "roleOwner",
    descKey: "roleOwnerDescription",
    color: "brand",
    permissionsMode: "all",
  },
  {
    key: "admin",
    nameKey: "roleAdmin",
    descKey: "roleAdminDescription",
    color: "blue",
    permissionsMode: "all",
  },
  {
    key: "member",
    nameKey: "roleMember",
    descKey: "roleMemberDescription",
    color: "success",
    permissionsMode: "list",
    permissions: [
      "org.settings.view", "org.limits.view",
      "members.view",
      "projects.view", "projects.create", "projects.edit",
      "domains.view", "domains.create", "domains.edit",
      "keywords.view", "keywords.add", "keywords.remove", "keywords.refresh",
      "reports.view", "reports.create", "reports.edit",
      "backlinks.view", "backlinks.analyze",
      "audit.view", "audit.run",
      "competitors.view", "competitors.add", "competitors.analyze",
      "ai.research", "ai.strategy",
      "forecasts.view", "forecasts.generate",
      "links.view", "links.manage",
    ],
  },
  {
    key: "viewer",
    nameKey: "roleViewer",
    descKey: "roleViewerDescription",
    color: "gray",
    permissionsMode: "list",
    permissions: [
      "org.settings.view", "org.limits.view",
      "members.view",
      "projects.view",
      "domains.view",
      "keywords.view",
      "reports.view",
      "backlinks.view",
      "audit.view",
      "competitors.view",
      "forecasts.view",
      "links.view",
    ],
  },
];

function SystemRolesSection({
  roles,
  categories,
  permissionLabels,
}: {
  roles: RoleDoc[];
  categories: Record<string, { label: string; permissions: string[] }>;
  permissionLabels: Record<string, string>;
}) {
  const t = useTranslations("settings");
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const allPermissionKeys = Object.keys(permissionLabels);

  // If DB has system roles, use their permission data; otherwise use fallback
  const dbSystemRoles = roles.filter((r) => r.isSystem);
  const dbRolesByKey = new Map(dbSystemRoles.map((r) => [r.key, r]));

  return (
    <div className="mb-8">
      <div className="mb-2">
        <h3 className="text-base font-semibold text-primary">
          {t("systemRolesTitle")}
        </h3>
        <p className="mt-0.5 text-xs text-tertiary">
          {t("systemRolesDescription")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {FALLBACK_SYSTEM_ROLES.map((fallback) => {
          const dbRole = dbRolesByKey.get(fallback.key);
          const perms =
            fallback.permissionsMode === "all"
              ? allPermissionKeys
              : dbRole?.permissions ?? fallback.permissions ?? [];
          const isExpanded = expandedRole === fallback.key;

          return (
            <div key={fallback.key} className="rounded-lg border border-secondary">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Shield01 className="h-4 w-4 shrink-0 text-tertiary" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">
                        {t(fallback.nameKey as any)}
                      </span>
                      <Badge size="sm" type="pill-color" color={fallback.color}>
                        {fallback.permissionsMode === "all"
                          ? t("allPermissions")
                          : t("permissionsCount", { count: perms.length })}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-tertiary">
                      {t(fallback.descKey as any)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedRole(isExpanded ? null : fallback.key)}
                  className="flex shrink-0 items-center gap-1 text-xs text-brand-600 hover:underline"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      {t("hidePermissions")}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      {t("showPermissions")}
                    </>
                  )}
                </button>
              </div>
              {isExpanded && (
                <div className="border-t border-secondary px-4 py-3">
                  <PermissionsGrid
                    categories={categories}
                    permissionLabels={permissionLabels}
                    selectedPermissions={new Set(perms)}
                    readOnly
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Custom Roles Section ───────────────────────────────────────────

function CustomRolesSection({
  roles,
  categories,
  permissionLabels,
  organizationId,
}: {
  roles: RoleDoc[];
  categories: Record<string, { label: string; permissions: string[] }>;
  permissionLabels: Record<string, string>;
  organizationId: Id<"organizations">;
}) {
  const t = useTranslations("settings");
  const deleteRoleMutation = useMutation(api.permissions.deleteRole);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDoc | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const customRoles = roles.filter((r) => !r.isSystem);

  const handleDelete = async (roleId: Id<"roles">) => {
    if (!confirm(t("deleteRoleConfirm"))) return;
    try {
      await deleteRoleMutation({ roleId });
      toast.success(t("deleteRoleSuccess"));
    } catch (e: any) {
      toast.error(e?.message || t("deleteRoleFailed"));
    }
  };

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-primary">
          {t("customRolesTitle")}
        </h3>
        {!showCreateForm && !editingRole && (
          <Button
            color="primary"
            size="sm"
            iconLeading={Plus}
            onClick={() => setShowCreateForm(true)}
          >
            {t("createRole")}
          </Button>
        )}
      </div>

      {showCreateForm && (
        <div className="mb-4">
          <RoleForm
            categories={categories}
            permissionLabels={permissionLabels}
            organizationId={organizationId}
            onDone={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {editingRole && (
        <div className="mb-4">
          <RoleForm
            categories={categories}
            permissionLabels={permissionLabels}
            organizationId={organizationId}
            existingRole={editingRole}
            onDone={() => setEditingRole(null)}
          />
        </div>
      )}

      {customRoles.length === 0 && !showCreateForm ? (
        <p className="text-sm text-tertiary">{t("noCustomRoles")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {customRoles.map((role) => {
            const isExpanded = expandedRole === role._id;

            return (
              <div
                key={role._id}
                className="rounded-lg border border-secondary"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Shield01 className="h-4 w-4 text-tertiary" />
                    <div>
                      <span className="text-sm font-medium text-primary">
                        {role.name}
                      </span>
                      {role.description && (
                        <p className="text-xs text-tertiary">{role.description}</p>
                      )}
                    </div>
                    <Badge size="sm" type="pill-color" color="purple">
                      {t("permissionsCount", { count: role.permissions.length })}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedRole(isExpanded ? null : role._id)}
                      className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          {t("hidePermissions")}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          {t("showPermissions")}
                        </>
                      )}
                    </button>
                    <Button
                      color="secondary"
                      size="sm"
                      iconLeading={Edit05}
                      onClick={() => {
                        setEditingRole(role);
                        setShowCreateForm(false);
                      }}
                    >
                      {t("editRole")}
                    </Button>
                    <Button
                      color="primary-destructive"
                      size="sm"
                      iconLeading={Trash01}
                      onClick={() => handleDelete(role._id)}
                    >
                      {t("deleteRoleBtn")}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-secondary px-4 py-3">
                    <PermissionsGrid
                      categories={categories}
                      permissionLabels={permissionLabels}
                      selectedPermissions={new Set(role.permissions)}
                      readOnly
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Member Row with Permissions ────────────────────────────────────

function MemberRow({
  member,
  roles,
  categories,
  permissionLabels,
  onSave,
}: {
  member: {
    _id: string;
    role: string;
    roleId?: string;
    joinedAt: number;
    user?: { name?: string; email?: string } | null;
  };
  roles: RoleDoc[];
  categories: Record<string, { label: string; permissions: string[] }>;
  permissionLabels: Record<string, string>;
  onSave: (membershipId: string, role: string, roleId?: string) => Promise<void>;
}) {
  const t = useTranslations("settings");
  const [selectedRole, setSelectedRole] = useState(member.role);
  const [selectedRoleId, setSelectedRoleId] = useState(member.roleId ?? "");
  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = member.role === "owner";
  const hasChanged = selectedRole !== member.role || (selectedRole === "custom" && selectedRoleId !== (member.roleId ?? ""));

  const customRoles = roles.filter((r) => !r.isSystem);

  // Get permissions for the currently selected role
  const getSelectedRolePermissions = (): string[] => {
    const effectiveRole = hasChanged ? selectedRole : member.role;
    const effectiveRoleId = hasChanged ? selectedRoleId : member.roleId;

    if (effectiveRole === "owner" || effectiveRole === "admin") {
      return Object.keys(permissionLabels);
    }
    if (effectiveRole === "custom" && effectiveRoleId) {
      const customRole = roles.find((r) => r._id === effectiveRoleId);
      return customRole?.permissions ?? [];
    }
    // member or viewer — find system role
    const systemRole = roles.find((r) => r.isSystem && r.key === effectiveRole);
    return systemRole?.permissions ?? [];
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(member._id, selectedRole, selectedRole === "custom" ? selectedRoleId : undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      owner: t("roleOwner"),
      admin: t("roleAdmin"),
      member: t("roleMember"),
      viewer: t("roleViewer"),
      custom: t("roleCustom"),
    };
    return map[role] || role;
  };

  return (
    <>
      <tr className="border-b border-secondary last:border-0">
        <td className="py-3 pr-4 font-medium text-primary">
          {member.user?.name || "—"}
        </td>
        <td className="py-3 pr-4 text-tertiary">
          {member.user?.email || "—"}
        </td>
        <td className="py-3 pr-4">
          {isOwner ? (
            <Badge size="sm" type="pill-color" color="brand">
              {roleLabel("owner")}
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value);
                  if (e.target.value !== "custom") setSelectedRoleId("");
                }}
                className="rounded-md border border-secondary bg-primary px-2 py-1 text-sm text-primary dark:bg-utility-gray-800 dark:text-utility-gray-100"
              >
                <option value="admin">{roleLabel("admin")}</option>
                <option value="member">{roleLabel("member")}</option>
                <option value="viewer">{roleLabel("viewer")}</option>
                {customRoles.length > 0 && (
                  <option value="custom">{roleLabel("custom")}</option>
                )}
              </select>

              {selectedRole === "custom" && (
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="rounded-md border border-secondary bg-primary px-2 py-1 text-sm text-primary dark:bg-utility-gray-800 dark:text-utility-gray-100"
                >
                  <option value="">{t("selectCustomRole")}</option>
                  {customRoles.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}

              {hasChanged && (
                <Button
                  color="primary"
                  size="sm"
                  iconLeading={Save01}
                  onClick={handleSave}
                  isLoading={isSaving}
                  isDisabled={selectedRole === "custom" && !selectedRoleId}
                >
                  {t("saveRole")}
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
                  <ChevronUp className="h-4 w-4" /> {t("hidePermissions")}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" /> {t("showPermissions")}
                </>
              )}
            </button>
          )}
        </td>
      </tr>
      {expanded && !isOwner && (
        <tr className="border-b border-secondary last:border-0">
          <td colSpan={5} className="px-4 py-4">
            <PermissionsGrid
              categories={categories}
              permissionLabels={permissionLabels}
              selectedPermissions={new Set(getSelectedRolePermissions())}
              readOnly
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function RoleManagement() {
  const t = useTranslations("settings");
  const { permissions: callerPermissions, plan } = usePermissions();

  const orgs = useQuery(api.organizations.getUserOrganizations);
  const orgId = orgs?.[0]?._id;

  const members = useQuery(
    api.organizations.getOrganizationMembers,
    orgId ? { organizationId: orgId } : "skip"
  );

  const roles = useQuery(
    api.permissions.getRoles,
    orgId ? { organizationId: orgId } : "skip"
  ) as RoleDoc[] | undefined;

  const permissionsData = useQuery(
    api.permissions.getPermissionsList
  ) as PermissionsData | undefined;

  const assignRole = useMutation(api.permissions.assignMemberRole);

  const handleSave = async (membershipId: string, role: string, roleId?: string) => {
    try {
      await assignRole({
        membershipId: membershipId as Id<"organizationMembers">,
        role: role as "admin" | "member" | "viewer" | "custom",
        roleId: roleId ? (roleId as Id<"roles">) : undefined,
      });
      toast.success(t("roleAssignedSuccess"));
    } catch (e: any) {
      toast.error(e?.message || t("roleAssignedFailed"));
    }
  };

  if (members === undefined || orgs === undefined || roles === undefined || permissionsData === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-tertiary">{t("loading")}</div>
      </div>
    );
  }

  const categories = permissionsData.categories;
  const permissionLabels = permissionsData.permissions;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-primary">
          {t("rolesTitle")}
        </h2>
        <p className="mt-1 text-sm text-tertiary">
          {t("rolesDescription")}
        </p>
      </div>

      {plan && (
        <div className="mb-6 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-950">
          <p className="text-sm text-brand-700 dark:text-brand-300">
            {t("planLimitedNote")} ({plan.name})
          </p>
        </div>
      )}

      {/* System roles (read-only) */}
      <SystemRolesSection
        roles={roles}
        categories={categories}
        permissionLabels={permissionLabels}
      />

      {/* Custom roles management */}
      {orgId && (
        <CustomRolesSection
          roles={roles}
          categories={categories}
          permissionLabels={permissionLabels}
          organizationId={orgId}
        />
      )}

      {/* Members table */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-primary">
          {t("membersTitle")}
        </h3>

        {!members || members.length === 0 ? (
          <p className="py-8 text-center text-sm text-tertiary">
            {t("noMembers")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-secondary">
                  <th className="pb-3 pr-4 font-medium text-tertiary">{t("memberColumnName")}</th>
                  <th className="pb-3 pr-4 font-medium text-tertiary">{t("memberColumnEmail")}</th>
                  <th className="pb-3 pr-4 font-medium text-tertiary">{t("memberColumnRole")}</th>
                  <th className="pb-3 pr-4 font-medium text-tertiary">{t("memberColumnJoined")}</th>
                  <th className="pb-3 font-medium text-tertiary" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <MemberRow
                    key={member._id}
                    member={member}
                    roles={roles}
                    categories={categories}
                    permissionLabels={permissionLabels}
                    onSave={handleSave}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
