"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Table, TableCard } from "@/components/application/table/table";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { Users02, UserMinus01 } from "@untitledui/icons";
import type { Selection } from "react-aria-components";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const router = useRouter();
  usePageTitle("Admin", "Users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "super_admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());

  const users = useQuery(api.admin.listAllUsers, { search: search || undefined, limit: 100 });
  const suspendUser = useMutation(api.admin.adminSuspendUser);

  const filteredUsers = users?.users.filter((user) => {
    if (roleFilter === "super_admin" && !user.isSuperAdmin) return false;
    if (roleFilter === "user" && user.isSuperAdmin) return false;
    if (statusFilter === "active" && user.suspended) return false;
    if (statusFilter === "suspended" && !user.suspended) return false;
    return true;
  });

  const handleRowClick = (userId: Id<"users">) => {
    router.push(`/admin/users/${userId}`);
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

  const hasSelection = selectedKeys !== "all" && selectedKeys.size > 0;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Breadcrumbs className="mb-6">
        <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{t("navUsers")}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-utility-brand-50">
            <Users02 className="h-7 w-7 text-utility-brand-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-primary">{t("navUsers")}</h1>
            <p className="mt-0.5 text-sm text-tertiary">{t("usersDescription")}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="max-w-md flex-1">
          <input
            type="text"
            placeholder={t("searchUsersPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-primary bg-primary px-4 py-2 text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-solid"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="rounded-lg border border-primary bg-primary px-4 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
        >
          <option value="all">{t("allRoles")}</option>
          <option value="super_admin">{t("roleSuperAdmin")}</option>
          <option value="user">{t("roleUser")}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-primary bg-primary px-4 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
        >
          <option value="all">{t("allStatus")}</option>
          <option value="active">{t("statusActive")}</option>
          <option value="suspended">{t("statusSuspended")}</option>
        </select>
      </div>

      {hasSelection && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-primary bg-utility-gray-50 px-4 py-3">
          <span className="text-sm text-secondary">{t("usersSelected", { count: selectedKeys.size })}</span>
          <div className="flex items-center gap-2">
            <Button color="tertiary-destructive" size="sm" onClick={handleBulkSuspend}>
              <UserMinus01 className="mr-1 h-4 w-4" />
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-utility-gray-100">
                      <span className="text-sm font-medium text-utility-gray-600">
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
    </div>
  );
}
