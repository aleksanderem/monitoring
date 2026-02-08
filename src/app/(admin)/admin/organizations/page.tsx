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
  Building01,
  Trash01,
  AlertCircle,
  CheckCircle,
  Settings01,
} from "@untitledui/icons";
import type { Selection } from "react-aria-components";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface OrgWithStats {
  _id: Id<"organizations">;
  name: string;
  slug: string;
  createdAt: number;
  memberCount: number;
  projectCount: number;
  domainCount: number;
  keywordCount: number;
  suspended: boolean;
  limits?: {
    maxProjects?: number;
    maxDomainsPerProject?: number;
    maxKeywordsPerDomain?: number;
  };
}

interface OrgDetails {
  _id: Id<"organizations">;
  name: string;
  slug: string;
  createdAt: number;
  projectCount: number;
  domainCount: number;
  keywordCount: number;
  suspended: boolean;
  members: Array<{
    userId: Id<"users">;
    email?: string;
    name?: string | null;
    role: string;
    joinedAt: number;
  }>;
  teams: Array<{
    _id: Id<"teams">;
    name: string;
    projects: Array<{
      _id: Id<"projects">;
      name: string;
      domainCount: number;
    }>;
  }>;
  limits?: {
    maxProjects?: number;
    maxDomainsPerProject?: number;
    maxKeywordsPerDomain?: number;
  };
}

export default function AdminOrganizationsPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<Id<"organizations"> | null>(null);
  const [isSlideoutOpen, setIsSlideoutOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
  const [activeTab, setActiveTab] = useState("overview");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingLimits, setIsEditingLimits] = useState(false);
  const [editedLimits, setEditedLimits] = useState<{
    maxProjects: number;
    maxDomainsPerProject: number;
    maxKeywordsPerDomain: number;
  } | null>(null);

  const organizations = useQuery(api.admin.listAllOrganizations, { search: search || undefined, limit: 100 });
  const orgDetails = useQuery(api.admin.getOrganizationDetails, selectedOrgId ? { organizationId: selectedOrgId } : "skip");

  const updateLimits = useMutation(api.admin.adminUpdateOrganizationLimits);
  const suspendOrg = useMutation(api.admin.adminSuspendOrganization);
  const activateOrg = useMutation(api.admin.adminActivateOrganization);
  const deleteOrg = useMutation(api.admin.adminDeleteOrganization);

  const handleRowClick = (orgId: Id<"organizations">) => {
    setSelectedOrgId(orgId);
    setIsSlideoutOpen(true);
    setActiveTab("overview");
    setIsEditingLimits(false);
  };

  const handleToggleSuspend = async (orgId: Id<"organizations">, suspended: boolean) => {
    try {
      if (suspended) { await activateOrg({ organizationId: orgId }); toast.success(t("orgActivated")); }
      else { await suspendOrg({ organizationId: orgId }); toast.success(t("orgSuspended")); }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedUpdateStatus"));
    }
  };

  const handleStartEditLimits = () => {
    if (orgDetails) {
      setEditedLimits({
        maxProjects: orgDetails.limits?.maxProjects ?? 5,
        maxDomainsPerProject: orgDetails.limits?.maxDomainsPerProject ?? 10,
        maxKeywordsPerDomain: orgDetails.limits?.maxKeywordsPerDomain ?? 100,
      });
      setIsEditingLimits(true);
    }
  };

  const handleSaveLimits = async () => {
    if (!selectedOrgId || !editedLimits) return;
    try {
      await updateLimits({ organizationId: selectedOrgId, limits: editedLimits });
      toast.success(t("limitsUpdated"));
      setIsEditingLimits(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedUpdateLimits"));
    }
  };

  const handleDelete = async () => {
    if (!selectedOrgId) return;
    try {
      await deleteOrg({ organizationId: selectedOrgId });
      toast.success(t("orgDeleted"));
      setIsSlideoutOpen(false);
      setIsDeleteModalOpen(false);
      setSelectedOrgId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedDelete"));
    }
  };

  const hasSelection = selectedKeys !== "all" && selectedKeys.size > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-6">
        <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{t("navOrganizations")}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-utility-brand-50 flex items-center justify-center">
            <Building01 className="w-7 h-7 text-utility-brand-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-primary">{t("navOrganizations")}</h1>
            <p className="mt-0.5 text-sm text-tertiary">{t("orgsDescription")}</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder={t("searchOrgsPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-primary rounded-lg bg-primary text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-solid"
        />
      </div>

      {hasSelection && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 bg-utility-gray-50 border border-primary rounded-lg">
          <span className="text-sm font-medium text-secondary">{t("orgsSelected", { count: selectedKeys.size })}</span>
          <Button color="primary-destructive" size="sm" onClick={async () => {
            if (typeof selectedKeys === "string" || selectedKeys.size === 0) return;
            const ids = Array.from(selectedKeys) as Id<"organizations">[];
            for (const id of ids) { try { await suspendOrg({ organizationId: id }); } catch {} }
            toast.success(t("done")); setSelectedKeys(new Set());
          }}>{t("suspendSelected")}</Button>
        </div>
      )}

      <TableCard.Root>
        <TableCard.Header title={t("navOrganizations")} badge={organizations?.organizations.length ?? 0} description={t("allOrganizations")} />
        <Table
          aria-label={t("navOrganizations")}
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onRowAction={(key) => handleRowClick(key as Id<"organizations">)}
        >
          <Table.Header>
            <Table.Head label={t("columnName")} isRowHeader allowsSorting />
            <Table.Head label={t("statsUsers")} allowsSorting />
            <Table.Head label={t("columnStatus")} allowsSorting />
            <Table.Head label={t("columnUsage")} allowsSorting />
            <Table.Head label={t("columnCreated")} allowsSorting />
          </Table.Header>
          <Table.Body items={organizations?.organizations ?? []}>
            {(org: OrgWithStats) => (
              <Table.Row id={org._id} className="cursor-pointer">
                <Table.Cell>
                  <div>
                    <div className="font-medium text-primary">{org.name}</div>
                    <div className="text-xs text-tertiary font-mono">{org.slug}</div>
                  </div>
                </Table.Cell>
                <Table.Cell><span className="text-sm text-secondary">{org.memberCount}</span></Table.Cell>
                <Table.Cell>
                  {org.suspended ? (
                    <Badge color="error" size="sm"><AlertCircle className="w-3 h-3" />{t("statusSuspended")}</Badge>
                  ) : (
                    <Badge color="success" size="sm"><CheckCircle className="w-3 h-3" />{t("statusActive")}</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <div className="text-sm text-secondary">{t("orgUsageSummary", { projects: org.projectCount, domains: org.domainCount, keywords: org.keywordCount })}</div>
                </Table.Cell>
                <Table.Cell><span className="text-sm text-tertiary">{new Date(org.createdAt).toLocaleDateString()}</span></Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </TableCard.Root>

      <SlideoutMenu
        isOpen={isSlideoutOpen}
        onOpenChange={(open) => { setIsSlideoutOpen(open); if (!open) setSelectedOrgId(null); }}
      >
        <SlideoutMenu.Header onClose={() => setIsSlideoutOpen(false)}>
          <div className="flex items-center gap-3">
            <Building01 className="w-12 h-12 text-utility-brand-700" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-primary">{orgDetails?.name ?? t("navOrganizations")}</h2>
              {orgDetails?.slug && <p className="text-sm text-tertiary font-mono">{orgDetails.slug}</p>}
            </div>
          </div>
        </SlideoutMenu.Header>

        <SlideoutMenu.Content>
          {orgDetails && (
            <div className="flex flex-col h-full">
              <div className="border-b border-primary mb-6">
                <div className="flex gap-6">
                  {([
                    { key: "overview", label: t("tabOverview") },
                    { key: "users", label: t("tabUsers") },
                    { key: "limits", label: t("tabLimits") },
                    { key: "usage", label: t("tabUsage") },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.key ? "border-brand-solid text-brand-solid" : "border-transparent text-tertiary hover:text-secondary"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-secondary mb-3">{t("details")}</h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("columnStatus")}</dt><dd>{orgDetails.suspended ? <Badge color="error" size="sm">{t("statusSuspended")}</Badge> : <Badge color="success" size="sm">{t("statusActive")}</Badge>}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("columnCreated")}</dt><dd className="text-sm text-primary">{new Date(orgDetails.createdAt).toLocaleDateString()}</dd></div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-secondary mb-3">{t("resources")}</h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("statsUsers")}</dt><dd className="text-sm font-medium text-primary">{orgDetails.members.length}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("tabTeams")}</dt><dd className="text-sm font-medium text-primary">{orgDetails.teams.length}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("statsProjects")}</dt><dd className="text-sm font-medium text-primary">{orgDetails.projectCount} / {orgDetails.limits?.maxProjects ?? "∞"}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("statsDomains")}</dt><dd className="text-sm font-medium text-primary">{orgDetails.domainCount}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("statsKeywords")}</dt><dd className="text-sm font-medium text-primary">{orgDetails.keywordCount}</dd></div>
                    </dl>
                  </div>
                </div>
              )}

              {activeTab === "users" && (
                <div>
                  <h3 className="text-sm font-medium text-secondary mb-4">{t("members")} ({orgDetails.members.length})</h3>
                  {orgDetails.members.length > 0 ? (
                    <div className="space-y-3">
                      {orgDetails.members.map((member) => (
                        <div key={member.userId} className="flex items-center justify-between p-3 border border-primary rounded-lg">
                          <div>
                            <div className="text-sm font-medium text-primary">{member.email}</div>
                            <div className="text-xs text-tertiary">{member.name || t("noName")}</div>
                          </div>
                          <Badge color="gray" size="sm">{member.role}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (<p className="text-sm text-tertiary">{t("noMembers")}</p>)}
                </div>
              )}

              {activeTab === "limits" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-secondary">{t("limits")}</h3>
                    {!isEditingLimits && <Button color="secondary" size="sm" onClick={handleStartEditLimits}><Settings01 className="w-4 h-4" />{t("edit")}</Button>}
                  </div>
                  {isEditingLimits && editedLimits ? (
                    <div className="space-y-4">
                      {[
                        { label: t("maxProjects"), key: "maxProjects" as const },
                        { label: t("maxDomainsPerProject"), key: "maxDomainsPerProject" as const },
                        { label: t("maxKeywordsPerDomain"), key: "maxKeywordsPerDomain" as const },
                      ].map((field) => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-secondary mb-1">{field.label}</label>
                          <input
                            type="number"
                            min={1}
                            value={editedLimits[field.key]}
                            onChange={(e) => setEditedLimits({ ...editedLimits, [field.key]: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button color="primary" size="sm" onClick={handleSaveLimits}>{tc("save")}</Button>
                        <Button color="secondary" size="sm" onClick={() => setIsEditingLimits(false)}>{tc("cancel")}</Button>
                      </div>
                    </div>
                  ) : (
                    <dl className="space-y-3">
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("maxProjects")}</dt><dd className="text-sm font-medium text-primary">{orgDetails.limits?.maxProjects ?? "∞"}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("maxDomainsPerProject")}</dt><dd className="text-sm font-medium text-primary">{orgDetails.limits?.maxDomainsPerProject ?? "∞"}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("maxKeywordsPerDomain")}</dt><dd className="text-sm font-medium text-primary">{orgDetails.limits?.maxKeywordsPerDomain ?? "∞"}</dd></div>
                    </dl>
                  )}
                </div>
              )}

              {activeTab === "usage" && (
                <div>
                  <h3 className="text-sm font-medium text-secondary mb-4">{t("currentUsage")}</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-tertiary">{t("statsProjects")}</span>
                        <span className="text-sm font-medium text-primary">{orgDetails.projectCount} / {orgDetails.limits?.maxProjects ?? "∞"}</span>
                      </div>
                      {orgDetails.limits?.maxProjects && (
                        <div className="w-full bg-utility-gray-200 rounded-full h-2">
                          <div className="bg-utility-brand-600 h-2 rounded-full" style={{ width: `${Math.min((orgDetails.projectCount / orgDetails.limits.maxProjects) * 100, 100)}%` }} />
                        </div>
                      )}
                    </div>
                    <div><div className="flex justify-between"><span className="text-sm text-tertiary">{t("statsDomains")}</span><span className="text-sm font-medium text-primary">{orgDetails.domainCount}</span></div></div>
                    <div><div className="flex justify-between"><span className="text-sm text-tertiary">{t("statsKeywords")}</span><span className="text-sm font-medium text-primary">{orgDetails.keywordCount}</span></div></div>
                  </div>
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button color={orgDetails.suspended ? "primary" : "secondary"} size="sm" onClick={() => selectedOrgId && handleToggleSuspend(selectedOrgId, orgDetails.suspended)}>
                      {orgDetails.suspended ? t("activate") : t("suspend")}
                    </Button>
                    <Button color="primary-destructive" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
                      <Trash01 className="w-4 h-4" />{tc("delete")}
                    </Button>
                  </div>
                  <Button color="secondary" size="sm" onClick={() => setIsSlideoutOpen(false)}>{t("close")}</Button>
                </div>
              </div>
            </div>
          )}
        </SlideoutMenu.Content>
      </SlideoutMenu>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title={t("deleteOrg")} size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-utility-error-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary">{t("deleteOrgWarning")}</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button color="secondary" onClick={() => setIsDeleteModalOpen(false)}>{tc("cancel")}</Button>
            <Button color="primary-destructive" onClick={handleDelete}>{t("deleteOrg")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
