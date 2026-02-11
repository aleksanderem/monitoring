"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Table, TableCard } from "@/components/application/table/table";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { Modal } from "@/components/base/modal/modal";
import {
  Users02,
  Trash01,
  UserPlus01,
  UserMinus01,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building01,
  UserCheck01,
  Activity,
} from "@untitledui/icons";
import type { Selection } from "react-aria-components";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface UserWithStats {
  _id: Id<"users">;
  email: string | null;
  name: string | null;
  createdAt: number;
  isSuperAdmin: boolean;
  suspended: boolean;
  organizationCount: number;
  organizations: {
    organizationId: Id<"organizations">;
    organizationName: string;
    role: string;
  }[];
}

interface UserDetails {
  _id: Id<"users">;
  email: string;
  name: string | null;
  createdAt: number;
  isSuperAdmin: boolean;
  suspended: boolean;
  suspendedAt?: number;
  organizations: Array<{
    organizationId: Id<"organizations">;
    organizationName: string;
    role: string;
    joinedAt: number;
  }>;
  teams: Array<{
    teamId: Id<"teams">;
    teamName: string;
    organizationId: Id<"organizations">;
    organizationName: string;
    role: string;
    joinedAt: number;
  }>;
}

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "super_admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [isSlideoutOpen, setIsSlideoutOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
  const [activeTab, setActiveTab] = useState("overview");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImpersonateModalOpen, setIsImpersonateModalOpen] = useState(false);

  const users = useQuery(api.admin.listAllUsers, { search: search || undefined, limit: 100 });
  const userDetails = useQuery(api.admin.getUserDetails, selectedUserId ? { userId: selectedUserId } : "skip");
  const auditLogs = useQuery(api.admin.getAdminAuditLogs, { limit: 50 });

  const grantSuperAdmin = useMutation(api.admin.grantSuperAdmin);
  const revokeSuperAdmin = useMutation(api.admin.revokeSuperAdmin);
  const suspendUser = useMutation(api.admin.adminSuspendUser);
  const activateUser = useMutation(api.admin.adminActivateUser);
  const impersonateUser = useMutation(api.admin.adminImpersonateUser);
  const deleteUser = useMutation(api.admin.adminDeleteUser);

  const filteredUsers = users?.users.filter((user) => {
    if (roleFilter === "super_admin" && !user.isSuperAdmin) return false;
    if (roleFilter === "user" && user.isSuperAdmin) return false;
    if (statusFilter === "active" && user.suspended) return false;
    if (statusFilter === "suspended" && !user.suspended) return false;
    return true;
  });

  const handleRowClick = (userId: Id<"users">) => {
    setSelectedUserId(userId);
    setIsSlideoutOpen(true);
    setActiveTab("overview");
  };

  const handleChangeRole = async (userId: Id<"users">, isSuperAdmin: boolean) => {
    try {
      if (isSuperAdmin) {
        await revokeSuperAdmin({ userId });
        toast.success(t("superAdminRevoked"));
      } else {
        await grantSuperAdmin({ userId });
        toast.success(t("superAdminGranted"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedChangeRole"));
    }
  };

  const handleToggleSuspend = async (userId: Id<"users">, suspended: boolean) => {
    try {
      if (suspended) {
        await activateUser({ userId });
        toast.success(t("userActivated"));
      } else {
        await suspendUser({ userId });
        toast.success(t("userSuspended"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedUpdateStatus"));
    }
  };

  const handleImpersonate = async () => {
    if (!selectedUserId) return;
    try {
      await impersonateUser({ userId: selectedUserId });
      toast.success(t("impersonationLogged"));
      setIsImpersonateModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedImpersonate"));
    }
  };

  const handleDelete = async () => {
    if (!selectedUserId) return;
    try {
      await deleteUser({ userId: selectedUserId });
      toast.success(t("userDeleted"));
      setIsSlideoutOpen(false);
      setIsDeleteModalOpen(false);
      setSelectedUserId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedDeleteUser"));
    }
  };

  const handleBulkSuspend = async () => {
    if (typeof selectedKeys === "string" || selectedKeys.size === 0) return;
    const selectedIds = Array.from(selectedKeys) as Id<"users">[];
    let successCount = 0;
    let errorCount = 0;
    for (const userId of selectedIds) {
      try { await suspendUser({ userId }); successCount++; } catch { errorCount++; }
    }
    if (successCount > 0) toast.success(t("bulkSuspendSuccess", { count: successCount }));
    if (errorCount > 0) toast.error(t("bulkSuspendError", { count: errorCount }));
    setSelectedKeys(new Set());
  };

  const userActivityLogs = auditLogs?.filter(
    (log) => log.targetType === "user" && log.targetId === selectedUserId
  );

  const hasSelection = selectedKeys !== "all" && selectedKeys.size > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-6">
        <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{t("navUsers")}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-utility-brand-50 flex items-center justify-center">
            <Users02 className="w-7 h-7 text-utility-brand-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-primary">{t("navUsers")}</h1>
            <p className="mt-0.5 text-sm text-tertiary">{t("usersDescription")}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder={t("searchUsersPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-primary rounded-lg bg-primary text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-solid"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="px-4 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
        >
          <option value="all">{t("allRoles")}</option>
          <option value="super_admin">{t("roleSuperAdmin")}</option>
          <option value="user">{t("roleUser")}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-4 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
        >
          <option value="all">{t("allStatus")}</option>
          <option value="active">{t("statusActive")}</option>
          <option value="suspended">{t("statusSuspended")}</option>
        </select>
      </div>

      {hasSelection && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 bg-utility-gray-50 border border-primary rounded-lg">
          <span className="text-sm text-secondary">{t("usersSelected", { count: selectedKeys.size })}</span>
          <div className="flex items-center gap-2">
            <Button color="tertiary-destructive" size="sm" onClick={handleBulkSuspend}>
              <UserMinus01 className="w-4 h-4 mr-1" />
              {t("suspendSelected")}
            </Button>
          </div>
        </div>
      )}

      <TableCard.Root size="md">
        <TableCard.Header title={t("allUsers")} badge={filteredUsers?.length ?? 0} description={t("usersTableDescription")} />
        <Table
          aria-label={t("allUsers")}
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onRowAction={(key) => handleRowClick(key as Id<"users">)}
        >
          <Table.Header>
            <Table.Head label={t("columnEmail")} isRowHeader allowsSorting />
            <Table.Head label={t("navOrganizations")} allowsSorting />
            <Table.Head label={t("columnRole")} allowsSorting />
            <Table.Head label={t("columnStatus")} allowsSorting />
            <Table.Head label={t("columnCreated")} allowsSorting />
          </Table.Header>
          <Table.Body items={filteredUsers ?? []}>
            {(user) => (
              <Table.Row id={user._id} className="cursor-pointer">
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-utility-gray-100 flex items-center justify-center">
                      <span className="text-utility-gray-600 font-medium text-sm">
                        {(user.name || user.email || "U").substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-primary">{user.name || user.email || t("unknown")}</div>
                      <div className="text-xs text-tertiary">{user.email}</div>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell><span className="text-sm text-secondary">{user.organizationCount}</span></Table.Cell>
                <Table.Cell>
                  {user.isSuperAdmin ? (
                    <Badge color="error" size="sm">{t("roleSuperAdmin")}</Badge>
                  ) : (
                    <Badge color="gray" size="sm">{t("roleUser")}</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {user.suspended ? (
                    <Badge color="warning" size="sm">{t("statusSuspended")}</Badge>
                  ) : (
                    <Badge color="success" size="sm">{t("statusActive")}</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-secondary">
                    {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </TableCard.Root>

      <SlideoutMenu
        isOpen={isSlideoutOpen}
        onOpenChange={(open) => { setIsSlideoutOpen(open); if (!open) setSelectedUserId(null); }}
      >
        <SlideoutMenu.Header onClose={() => setIsSlideoutOpen(false)}>
          <div className="flex items-center gap-3">
            <Users02 className="w-12 h-12 text-utility-brand-700" />
            <h2 className="text-lg font-semibold text-primary">{t("userDetails")}</h2>
          </div>
        </SlideoutMenu.Header>

        <SlideoutMenu.Content>
          {userDetails && (
            <div className="flex flex-col h-full">
              <div className="flex items-start gap-4 pb-6 border-b border-primary">
                <div className="w-14 h-14 rounded-full bg-utility-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-utility-gray-600 font-medium text-lg">
                    {(userDetails.name || userDetails.email || "U").substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-primary">{userDetails.name || t("unknown")}</h3>
                  <p className="text-sm text-secondary mt-0.5">{userDetails.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {userDetails.isSuperAdmin && <Badge color="error" size="sm">{t("roleSuperAdmin")}</Badge>}
                    {userDetails.suspended ? (
                      <Badge color="warning" size="sm">{t("statusSuspended")}</Badge>
                    ) : (
                      <Badge color="success" size="sm">{t("statusActive")}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 border-b border-primary">
                {[
                  { key: "overview", label: t("tabOverview"), Icon: UserCheck01 },
                  { key: "organizations", label: t("navOrganizations"), Icon: Building01 },
                  { key: "teams", label: t("tabTeams"), Icon: Users02 },
                  { key: "activity", label: t("tabActivity"), Icon: Activity },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-brand-solid text-brand-solid"
                        : "border-transparent text-tertiary hover:text-secondary"
                    }`}
                  >
                    <tab.Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto mt-6">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    {[
                      { label: t("columnEmail"), value: userDetails.email },
                      { label: t("columnStatus"), value: userDetails.suspended ? t("statusSuspended") : t("statusActive") },
                      { label: t("systemRole"), value: userDetails.isSuperAdmin ? t("roleSuperAdmin") : t("roleUser") },
                      { label: t("columnCreated"), value: new Date(userDetails.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
                      { label: t("navOrganizations"), value: String(userDetails.organizations.length) },
                      { label: t("tabTeams"), value: String(userDetails.teams.length) },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-xs font-medium text-tertiary uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm text-primary mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "organizations" && (
                  <div className="space-y-3">
                    {userDetails.organizations.length === 0 ? (
                      <p className="text-sm text-tertiary">{t("notMemberOfOrgs")}</p>
                    ) : (
                      userDetails.organizations.map((org, idx) =>
                        org ? (
                          <div key={`${org.organizationId}-${idx}`} className="p-3 border border-primary rounded-lg">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-primary">{org.organizationName}</p>
                              <Badge color="gray" size="sm">{org.role}</Badge>
                            </div>
                            <p className="text-xs text-tertiary mt-1">Joined {new Date(org.joinedAt).toLocaleDateString()}</p>
                          </div>
                        ) : null
                      )
                    )}
                  </div>
                )}

                {activeTab === "teams" && (
                  <div className="space-y-3">
                    {userDetails.teams.length === 0 ? (
                      <p className="text-sm text-tertiary">{t("notMemberOfTeams")}</p>
                    ) : (
                      userDetails.teams.map((team, idx) =>
                        team ? (
                          <div key={`${team.teamId}-${idx}`} className="p-3 border border-primary rounded-lg">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-primary">{team.teamName}</p>
                              <Badge color="gray" size="sm">{team.role}</Badge>
                            </div>
                            <p className="text-xs text-tertiary mt-1">{team.organizationName}</p>
                            <p className="text-xs text-tertiary">Joined {new Date(team.joinedAt).toLocaleDateString()}</p>
                          </div>
                        ) : null
                      )
                    )}
                  </div>
                )}

                {activeTab === "activity" && (
                  <div className="space-y-3">
                    {!userActivityLogs || userActivityLogs.length === 0 ? (
                      <p className="text-sm text-tertiary">{t("noActivityLogs")}</p>
                    ) : (
                      userActivityLogs.map((log) => (
                        <div key={log._id} className="p-3 border border-primary rounded-lg">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium text-primary">{log.action.replace(/_/g, " ")}</p>
                            <p className="text-xs text-tertiary">{new Date(log.createdAt).toLocaleDateString()}</p>
                          </div>
                          <p className="text-xs text-secondary mt-1">By: {log.adminEmail}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-primary pt-6 mt-6 space-y-3">
                <Button
                  color={userDetails.isSuperAdmin ? "tertiary" : "secondary"}
                  onClick={() => handleChangeRole(userDetails._id, userDetails.isSuperAdmin)}
                  className="w-full"
                >
                  <UserPlus01 className="w-4 h-4 mr-1" />
                  {userDetails.isSuperAdmin ? t("revokeSuperAdmin") : t("grantSuperAdmin")}
                </Button>
                <Button
                  color={userDetails.suspended ? "secondary" : "tertiary"}
                  onClick={() => handleToggleSuspend(userDetails._id, userDetails.suspended)}
                  className="w-full"
                >
                  {userDetails.suspended ? (
                    <><CheckCircle className="w-4 h-4 mr-1" />{t("activateUser")}</>
                  ) : (
                    <><XCircle className="w-4 h-4 mr-1" />{t("suspendUser")}</>
                  )}
                </Button>
                <Button color="tertiary" onClick={() => setIsImpersonateModalOpen(true)} className="w-full">
                  <Eye className="w-4 h-4 mr-1" />{t("impersonateUser")}
                </Button>
                <Button color="tertiary-destructive" onClick={() => setIsDeleteModalOpen(true)} className="w-full">
                  <Trash01 className="w-4 h-4 mr-1" />{t("deleteUser")}
                </Button>
              </div>
            </div>
          )}
        </SlideoutMenu.Content>
      </SlideoutMenu>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title={t("deleteUser")} size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-utility-error-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-primary">{t("deleteUserConfirmation")}</p>
              <p className="text-sm text-tertiary mt-2">{t("deleteUserWarning")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Button color="secondary" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">{tc("cancel")}</Button>
            <Button color="primary-destructive" onClick={handleDelete} className="flex-1">{t("deleteUser")}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isImpersonateModalOpen} onClose={() => setIsImpersonateModalOpen(false)} title={t("impersonateUser")} size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-utility-warning-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-primary">{t("impersonateWarning")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Button color="secondary" onClick={() => setIsImpersonateModalOpen(false)} className="flex-1">{tc("cancel")}</Button>
            <Button color="primary" onClick={handleImpersonate} className="flex-1">
              <Eye className="w-4 h-4 mr-1" />{t("impersonate")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
