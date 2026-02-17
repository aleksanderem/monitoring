"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
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
  ArrowLeft,
  Mail01,
  Calendar,
  Shield01,
  Clock,
} from "@untitledui/icons";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function AdminUserDetailPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as Id<"users">;

  usePageTitle("Admin", "User Details");

  const [activeTab, setActiveTab] = useState("overview");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImpersonateModalOpen, setIsImpersonateModalOpen] = useState(false);

  const userDetails = useQuery(api.admin.getUserDetails, { userId });
  const auditLogs = useQuery(api.admin.getAdminAuditLogs, { limit: 50 });

  const grantSuperAdmin = useMutation(api.admin.grantSuperAdmin);
  const revokeSuperAdmin = useMutation(api.admin.revokeSuperAdmin);
  const suspendUser = useMutation(api.admin.adminSuspendUser);
  const activateUser = useMutation(api.admin.adminActivateUser);
  const impersonateUser = useMutation(api.admin.adminImpersonateUser);
  const deleteUser = useMutation(api.admin.adminDeleteUser);

  const handleChangeRole = async () => {
    if (!userDetails) return;
    try {
      if (userDetails.isSuperAdmin) {
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

  const handleToggleSuspend = async () => {
    if (!userDetails) return;
    try {
      if (userDetails.suspended) {
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
    try {
      await impersonateUser({ userId });
      toast.success(t("impersonationLogged"));
      setIsImpersonateModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedImpersonate"));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUser({ userId });
      toast.success(t("userDeleted"));
      router.push("/admin/users");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedDeleteUser"));
    }
  };

  const userActivityLogs = auditLogs?.filter(
    (log) => log.targetType === "user" && log.targetId === userId
  );

  if (userDetails === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6">
          <div className="h-5 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-8">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-3">
              <div className="h-7 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              <div className="flex gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!userDetails) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex flex-col items-center justify-center py-24">
          <Users02 className="h-12 w-12 text-quaternary" />
          <p className="mt-3 text-sm text-tertiary">{t("userNotFound")}</p>
          <Button color="secondary" size="sm" className="mt-4" onClick={() => router.push("/admin/users")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("backToUsers")}
          </Button>
        </div>
      </div>
    );
  }

  const initials = (userDetails.name || userDetails.email || "U").substring(0, 2).toUpperCase();
  const memberSince = new Date(userDetails.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const tabs = [
    { key: "overview", label: t("tabOverview"), Icon: UserCheck01 },
    { key: "organizations", label: t("navOrganizations"), Icon: Building01 },
    { key: "teams", label: t("tabTeams"), Icon: Users02 },
    { key: "activity", label: t("tabActivity"), Icon: Activity },
  ];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Breadcrumbs className="mb-6">
        <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/admin/users">{t("navUsers")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{userDetails.name || userDetails.email || t("unknown")}</Breadcrumbs.Item>
      </Breadcrumbs>

      <button
        onClick={() => router.push("/admin/users")}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-tertiary transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToUsers")}
      </button>

      {/* Header Card */}
      <div className="rounded-xl border border-secondary bg-primary p-6 sm:p-8">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-utility-brand-50 ring-4 ring-utility-brand-100">
            <span className="text-2xl font-bold text-utility-brand-700">{initials}</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              {userDetails.name || t("unknown")}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-secondary">
              <Mail01 className="h-3.5 w-3.5 text-quaternary" />
              {userDetails.email}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {userDetails.isSuperAdmin ? (
                <Badge color="error" size="sm">
                  <Shield01 className="mr-1 h-3 w-3" />
                  {t("roleSuperAdmin")}
                </Badge>
              ) : (
                <Badge color="gray" size="sm">{t("roleUser")}</Badge>
              )}
              {userDetails.suspended ? (
                <Badge color="warning" size="sm">
                  <XCircle className="mr-1 h-3 w-3" />
                  {t("statusSuspended")}
                </Badge>
              ) : (
                <Badge color="success" size="sm">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {t("statusActive")}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-secondary pt-5">
          <Button
            color={userDetails.isSuperAdmin ? "tertiary" : "secondary"}
            size="sm"
            iconLeading={UserPlus01}
            onClick={handleChangeRole}
          >
            {userDetails.isSuperAdmin ? t("revokeSuperAdmin") : t("grantSuperAdmin")}
          </Button>
          <Button
            color={userDetails.suspended ? "secondary" : "tertiary"}
            size="sm"
            iconLeading={userDetails.suspended ? CheckCircle : XCircle}
            onClick={handleToggleSuspend}
          >
            {userDetails.suspended ? t("activateUser") : t("suspendUser")}
          </Button>
          <Button
            color="tertiary"
            size="sm"
            iconLeading={Eye}
            onClick={() => setIsImpersonateModalOpen(true)}
          >
            {t("impersonateUser")}
          </Button>
          <div className="flex-1" />
          <Button
            color="tertiary-destructive"
            size="sm"
            iconLeading={Trash01}
            onClick={() => setIsDeleteModalOpen(true)}
          >
            {t("deleteUser")}
          </Button>
        </div>

        {/* Quick Stats Row */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-secondary pt-6 sm:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-utility-brand-50">
              <Building01 className="h-5 w-5 text-utility-brand-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-primary">{userDetails.organizations.length}</p>
              <p className="text-xs text-tertiary">{t("navOrganizations")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-utility-brand-50">
              <Users02 className="h-5 w-5 text-utility-brand-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-primary">{userDetails.teams.length}</p>
              <p className="text-xs text-tertiary">{t("tabTeams")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-utility-gray-50 dark:bg-gray-800">
              <Calendar className="h-5 w-5 text-utility-gray-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">{memberSince}</p>
              <p className="text-xs text-tertiary">{t("memberSince")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-utility-gray-50 dark:bg-gray-800">
              <Clock className="h-5 w-5 text-utility-gray-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">
                {userDetails.suspendedAt
                  ? new Date(userDetails.suspendedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "N/A"}
              </p>
              <p className="text-xs text-tertiary">{t("suspendedAt")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-secondary">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-brand-solid text-brand-solid"
                  : "text-tertiary hover:text-secondary"
              }`}
            >
              <tab.Icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "overview" && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-secondary bg-primary p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-tertiary">
                {t("accountInfo")}
              </h3>
              <dl className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail01 className="mt-0.5 h-4 w-4 flex-shrink-0 text-tertiary" />
                  <div>
                    <dt className="text-xs text-tertiary">{t("columnEmail")}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-primary">{userDetails.email}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserCheck01 className="mt-0.5 h-4 w-4 flex-shrink-0 text-tertiary" />
                  <div>
                    <dt className="text-xs text-tertiary">{t("columnName")}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-primary">{userDetails.name || "—"}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield01 className="mt-0.5 h-4 w-4 flex-shrink-0 text-tertiary" />
                  <div>
                    <dt className="text-xs text-tertiary">{t("systemRole")}</dt>
                    <dd className="mt-0.5">
                      {userDetails.isSuperAdmin ? (
                        <Badge color="error" size="sm">{t("roleSuperAdmin")}</Badge>
                      ) : (
                        <Badge color="gray" size="sm">{t("roleUser")}</Badge>
                      )}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Activity className="mt-0.5 h-4 w-4 flex-shrink-0 text-tertiary" />
                  <div>
                    <dt className="text-xs text-tertiary">{t("columnStatus")}</dt>
                    <dd className="mt-0.5">
                      {userDetails.suspended ? (
                        <Badge color="warning" size="sm">{t("statusSuspended")}</Badge>
                      ) : (
                        <Badge color="success" size="sm">{t("statusActive")}</Badge>
                      )}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-tertiary" />
                  <div>
                    <dt className="text-xs text-tertiary">{t("columnCreated")}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-primary">{memberSince}</dd>
                  </div>
                </div>
                {userDetails.suspendedAt && (
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-tertiary" />
                    <div>
                      <dt className="text-xs text-tertiary">{t("suspendedAt")}</dt>
                      <dd className="mt-0.5 text-sm font-medium text-utility-error-600">
                        {new Date(userDetails.suspendedAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-xl border border-secondary bg-primary p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-tertiary">
                {t("membershipSummary")}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-utility-gray-50 p-3 dark:bg-gray-800">
                  <div className="flex items-center gap-2.5">
                    <Building01 className="h-4 w-4 text-tertiary" />
                    <span className="text-sm text-secondary">{t("navOrganizations")}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">{userDetails.organizations.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-utility-gray-50 p-3 dark:bg-gray-800">
                  <div className="flex items-center gap-2.5">
                    <Users02 className="h-4 w-4 text-tertiary" />
                    <span className="text-sm text-secondary">{t("tabTeams")}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">{userDetails.teams.length}</span>
                </div>
                {userDetails.organizations.length > 0 && (
                  <div className="pt-2">
                    <p className="mb-2 text-xs font-medium text-tertiary">{t("recentOrganizations")}</p>
                    {userDetails.organizations.slice(0, 3).map((org, idx) =>
                      org ? (
                        <div key={`${org.organizationId}-${idx}`} className="flex items-center justify-between py-1.5">
                          <span className="text-sm text-primary">{org.organizationName}</span>
                          <Badge color="gray" size="sm">{org.role}</Badge>
                        </div>
                      ) : null
                    )}
                    {userDetails.organizations.length > 3 && (
                      <button
                        onClick={() => setActiveTab("organizations")}
                        className="mt-1 text-xs font-medium text-brand-solid hover:underline"
                      >
                        {t("viewAllOrganizations", { count: userDetails.organizations.length })}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "organizations" && (
          <div className="space-y-3">
            {userDetails.organizations.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary py-16">
                <Building01 className="h-10 w-10 text-quaternary" />
                <p className="mt-3 text-sm text-tertiary">{t("notMemberOfOrgs")}</p>
              </div>
            ) : (
              userDetails.organizations.map((org, idx) =>
                org ? (
                  <div
                    key={`${org.organizationId}-${idx}`}
                    className="flex items-center justify-between rounded-xl border border-secondary bg-primary p-4 transition-colors hover:bg-secondary"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-utility-brand-50">
                        <Building01 className="h-5 w-5 text-utility-brand-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">{org.organizationName}</p>
                        <p className="mt-0.5 text-xs text-tertiary">
                          {t("joinedDate", {
                            date: new Date(org.joinedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }),
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge color="gray" size="sm">{org.role}</Badge>
                  </div>
                ) : null
              )
            )}
          </div>
        )}

        {activeTab === "teams" && (
          <div className="space-y-3">
            {userDetails.teams.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary py-16">
                <Users02 className="h-10 w-10 text-quaternary" />
                <p className="mt-3 text-sm text-tertiary">{t("notMemberOfTeams")}</p>
              </div>
            ) : (
              userDetails.teams.map((team, idx) =>
                team ? (
                  <div
                    key={`${team.teamId}-${idx}`}
                    className="flex items-center justify-between rounded-xl border border-secondary bg-primary p-4 transition-colors hover:bg-secondary"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-utility-brand-50">
                        <Users02 className="h-5 w-5 text-utility-brand-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">{team.teamName}</p>
                        <p className="mt-0.5 text-xs text-tertiary">
                          {team.organizationName}
                          {" \u00b7 "}
                          {t("joinedDate", {
                            date: new Date(team.joinedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }),
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge color="gray" size="sm">{team.role}</Badge>
                  </div>
                ) : null
              )
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-3">
            {!userActivityLogs || userActivityLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary py-16">
                <Activity className="h-10 w-10 text-quaternary" />
                <p className="mt-3 text-sm text-tertiary">{t("noActivityLogs")}</p>
              </div>
            ) : (
              userActivityLogs.map((log) => (
                <div key={log._id} className="rounded-xl border border-secondary bg-primary p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-utility-gray-50 dark:bg-gray-800">
                        <Activity className="h-4 w-4 text-tertiary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">
                          {log.action.replace(/_/g, " ")}
                        </p>
                        <p className="mt-0.5 text-xs text-tertiary">
                          {t("performedBy")}: {log.adminEmail}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-tertiary">
                      {new Date(log.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title={t("deleteUser")} size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-utility-error-600" />
            <div>
              <p className="text-sm text-primary">{t("deleteUserConfirmation")}</p>
              <p className="mt-2 text-sm text-tertiary">{t("deleteUserWarning")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Button color="secondary" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">
              {tc("cancel")}
            </Button>
            <Button color="primary-destructive" onClick={handleDelete} className="flex-1">
              {t("deleteUser")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Impersonate Modal */}
      <Modal isOpen={isImpersonateModalOpen} onClose={() => setIsImpersonateModalOpen(false)} title={t("impersonateUser")} size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-utility-warning-600" />
            <div>
              <p className="text-sm text-primary">{t("impersonateWarning")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Button color="secondary" onClick={() => setIsImpersonateModalOpen(false)} className="flex-1">
              {tc("cancel")}
            </Button>
            <Button color="primary" onClick={handleImpersonate} className="flex-1">
              <Eye className="mr-1.5 h-4 w-4" />
              {t("impersonate")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
