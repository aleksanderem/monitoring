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
  LogIn01,
} from "@untitledui/icons";
import type { Selection } from "react-aria-components";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/hooks/usePageTitle";

// Plans API is newly created — cast to bypass generated types until next `npx convex dev`
const plansApi = (api as any).plans;

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
      domains: Array<{
        _id: Id<"domains">;
        domain: string;
      }>;
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
  const router = useRouter();
  usePageTitle("Admin", "Organizations");
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
    refreshCooldownMinutes: number;
    maxDailyRefreshes: number;
    maxDailyRefreshesPerUser: number;
    maxKeywordsPerBulkRefresh: number;
  } | null>(null);
  const [isEditingAI, setIsEditingAI] = useState(false);
  const [editedAIProvider, setEditedAIProvider] = useState<"anthropic" | "google" | "zai">("anthropic");
  const [editedAIModel, setEditedAIModel] = useState("");

  const organizations = useQuery(api.admin.listAllOrganizations, { search: search || undefined, limit: 100 });
  const orgDetails = useQuery(api.admin.getOrganizationDetails, selectedOrgId ? { organizationId: selectedOrgId } : "skip");

  const updateLimits = useMutation(api.admin.adminUpdateOrganizationLimits);
  const updateAISettings = useMutation(api.admin.adminUpdateOrganizationAISettings);
  const suspendOrg = useMutation(api.admin.adminSuspendOrganization);
  const activateOrg = useMutation(api.admin.adminActivateOrganization);
  const deleteOrg = useMutation(api.admin.adminDeleteOrganization);
  const repairDenorm = useMutation(api.admin.triggerRepairDenormalization);

  const allPlans = useQuery(plansApi.getPlans) as any[] | undefined;
  const assignPlan = useMutation(plansApi.assignPlanToOrganization);

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
        refreshCooldownMinutes: (orgDetails.limits as any)?.refreshCooldownMinutes ?? 0,
        maxDailyRefreshes: (orgDetails.limits as any)?.maxDailyRefreshes ?? 0,
        maxDailyRefreshesPerUser: (orgDetails.limits as any)?.maxDailyRefreshesPerUser ?? 0,
        maxKeywordsPerBulkRefresh: (orgDetails.limits as any)?.maxKeywordsPerBulkRefresh ?? 0,
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

  const handleStartEditAI = () => {
    if (orgDetails) {
      const settings = (orgDetails as any).aiSettings;
      setEditedAIProvider(settings?.provider ?? "anthropic");
      setEditedAIModel(settings?.model ?? "");
      setIsEditingAI(true);
    }
  };

  const handleSaveAI = async () => {
    if (!selectedOrgId) return;
    try {
      await updateAISettings({
        organizationId: selectedOrgId,
        aiSettings: {
          provider: editedAIProvider,
          model: editedAIModel || undefined,
        },
      });
      toast.success(t("aiSettingsUpdated"));
      setIsEditingAI(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("aiSettingsUpdateFailed"));
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
                    { key: "ai", label: t("tabAI") },
                    { key: "maintenance", label: t("tabMaintenance") },
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
                    <h3 className="text-sm font-medium text-secondary mb-3">Plan</h3>
                    <div className="flex items-center gap-3">
                      <select
                        value={(orgDetails as any).planId ?? ""}
                        onChange={async (e) => {
                          if (!selectedOrgId || !e.target.value) return;
                          try {
                            await assignPlan({
                              organizationId: selectedOrgId,
                              planId: e.target.value as Id<"plans">,
                            });
                            toast.success("Plan zostal przypisany");
                          } catch (err: any) {
                            toast.error(err?.message || "Nie udalo sie przypisac planu");
                          }
                        }}
                        className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid dark:bg-utility-gray-800 dark:text-white"
                      >
                        <option value="">-- Brak planu --</option>
                        {allPlans?.map((plan: any) => (
                          <option key={plan._id} value={plan._id}>
                            {plan.name} ({plan.key}){plan.isDefault ? " [domyslny]" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(orgDetails as any).planId && allPlans && (() => {
                      const currentPlan = allPlans.find((p: any) => p._id === (orgDetails as any).planId);
                      if (!currentPlan) return null;
                      return (
                        <div className="mt-2 text-xs text-tertiary">
                          Moduly: {currentPlan.modules?.join(", ") || "brak"}
                        </div>
                      );
                    })()}
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
                      <p className="text-xs font-medium text-tertiary uppercase tracking-wider">{t("entityLimits")}</p>
                      {[
                        { label: t("maxProjects"), key: "maxProjects" as const, min: 1 },
                        { label: t("maxDomainsPerProject"), key: "maxDomainsPerProject" as const, min: 1 },
                        { label: t("maxKeywordsPerDomain"), key: "maxKeywordsPerDomain" as const, min: 1 },
                      ].map((field) => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-secondary mb-1">{field.label}</label>
                          <input
                            type="number"
                            min={field.min}
                            value={editedLimits[field.key]}
                            onChange={(e) => setEditedLimits({ ...editedLimits, [field.key]: parseInt(e.target.value) || field.min })}
                            className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
                          />
                        </div>
                      ))}
                      <p className="text-xs font-medium text-tertiary uppercase tracking-wider pt-2">{t("refreshLimits")}</p>
                      {[
                        { label: t("refreshCooldownMinutes"), key: "refreshCooldownMinutes" as const, min: 0, hint: t("refreshCooldownHint") },
                        { label: t("maxDailyRefreshes"), key: "maxDailyRefreshes" as const, min: 0, hint: t("maxDailyRefreshesHint") },
                        { label: t("maxDailyRefreshesPerUser"), key: "maxDailyRefreshesPerUser" as const, min: 0, hint: t("maxDailyRefreshesPerUserHint") },
                        { label: t("maxKeywordsPerBulkRefresh"), key: "maxKeywordsPerBulkRefresh" as const, min: 0, hint: t("maxKeywordsPerBulkRefreshHint") },
                      ].map((field) => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-secondary mb-1">{field.label}</label>
                          <input
                            type="number"
                            min={field.min}
                            value={editedLimits[field.key]}
                            onChange={(e) => setEditedLimits({ ...editedLimits, [field.key]: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
                          />
                          <p className="text-xs text-tertiary mt-1">{field.hint}</p>
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
                      <div className="border-t border-primary mt-3 pt-3">
                        <p className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">{t("refreshLimits")}</p>
                        <div className="flex justify-between"><dt className="text-sm text-tertiary">{t("refreshCooldownMinutes")}</dt><dd className="text-sm font-medium text-primary">{(orgDetails.limits as any)?.refreshCooldownMinutes || t("disabled")}</dd></div>
                        <div className="flex justify-between mt-3"><dt className="text-sm text-tertiary">{t("maxDailyRefreshes")}</dt><dd className="text-sm font-medium text-primary">{(orgDetails.limits as any)?.maxDailyRefreshes || t("unlimited")}</dd></div>
                        <div className="flex justify-between mt-3"><dt className="text-sm text-tertiary">{t("maxDailyRefreshesPerUser")}</dt><dd className="text-sm font-medium text-primary">{(orgDetails.limits as any)?.maxDailyRefreshesPerUser || t("unlimited")}</dd></div>
                        <div className="flex justify-between mt-3"><dt className="text-sm text-tertiary">{t("maxKeywordsPerBulkRefresh")}</dt><dd className="text-sm font-medium text-primary">{(orgDetails.limits as any)?.maxKeywordsPerBulkRefresh || t("unlimited")}</dd></div>
                      </div>
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

              {activeTab === "ai" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-secondary">{t("aiProvider")}</h3>
                    {!isEditingAI && <Button color="secondary" size="sm" onClick={handleStartEditAI}><Settings01 className="w-4 h-4" />{t("edit")}</Button>}
                  </div>
                  <p className="text-sm text-tertiary mb-4">{t("aiSettingsDescription")}</p>
                  {isEditingAI ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary mb-1">{t("aiProvider")}</label>
                        <select
                          value={editedAIProvider}
                          onChange={(e) => {
                            setEditedAIProvider(e.target.value as "anthropic" | "google" | "zai");
                            setEditedAIModel("");
                          }}
                          className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid dark:bg-utility-gray-800 dark:text-white"
                        >
                          <option value="anthropic">{t("aiProviderClaude")}</option>
                          <option value="google">{t("aiProviderGoogle")}</option>
                          <option value="zai">{t("aiProviderZAI")}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-secondary mb-1">{t("aiModel")}</label>
                        <input
                          type="text"
                          value={editedAIModel}
                          onChange={(e) => setEditedAIModel(e.target.value)}
                          placeholder={
                            editedAIProvider === "anthropic" ? "claude-sonnet-4-5-20250929" :
                            editedAIProvider === "google" ? "gemini-2.0-flash" :
                            "glm-5"
                          }
                          className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-solid dark:bg-utility-gray-800 dark:text-white dark:placeholder:text-gray-500"
                        />
                        <p className="text-xs text-tertiary mt-1">{t("aiModelPlaceholder")}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button color="primary" size="sm" onClick={handleSaveAI}>{tc("save")}</Button>
                        <Button color="secondary" size="sm" onClick={() => setIsEditingAI(false)}>{tc("cancel")}</Button>
                      </div>
                    </div>
                  ) : (
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm text-tertiary">{t("aiProvider")}</dt>
                        <dd className="text-sm font-medium text-primary">
                          {(() => {
                            const settings = (orgDetails as any).aiSettings;
                            if (!settings?.provider || settings.provider === "anthropic") return t("aiProviderClaude");
                            if (settings.provider === "google") return t("aiProviderGoogle");
                            if (settings.provider === "zai") return t("aiProviderZAI");
                            return settings.provider;
                          })()}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-tertiary">{t("aiModel")}</dt>
                        <dd className="text-sm font-medium text-primary">
                          {(() => {
                            const settings = (orgDetails as any).aiSettings;
                            if (settings?.model) return settings.model;
                            const provider = settings?.provider ?? "anthropic";
                            if (provider === "anthropic") return "claude-sonnet-4-5-20250929";
                            if (provider === "google") return "gemini-2.0-flash";
                            if (provider === "zai") return "glm-5";
                            return "—";
                          })()}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              )}

              {activeTab === "maintenance" && (
                <div>
                  <h3 className="text-sm font-medium text-secondary mb-2">{t("tabMaintenance")}</h3>
                  <p className="text-xs text-tertiary mb-4">{t("maintenanceDescription")}</p>
                  {(() => {
                    const allDomains = orgDetails.teams.flatMap((team) =>
                      team.projects.flatMap((project) =>
                        project.domains.map((d) => ({ ...d, projectName: project.name }))
                      )
                    );
                    if (allDomains.length === 0) {
                      return <p className="text-sm text-tertiary">{t("noDomains")}</p>;
                    }
                    return (
                      <div className="space-y-3">
                        {allDomains.map((d) => (
                          <div key={d._id} className="flex items-center justify-between p-3 border border-primary rounded-lg">
                            <div>
                              <div className="text-sm font-medium text-primary">{d.domain}</div>
                              <div className="text-xs text-tertiary">{d.projectName}</div>
                            </div>
                            <Button
                              color="secondary"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await repairDenorm({ domainId: d._id });
                                  toast.success(t("repairScheduled", { domain: d.domain }));
                                } catch (error) {
                                  toast.error(error instanceof Error ? error.message : t("repairFailed"));
                                }
                              }}
                            >
                              {t("repairDenormalization")}
                            </Button>
                          </div>
                        ))}
                        <p className="text-xs text-tertiary mt-2">{t("repairDenormalizationHint")}</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      color="primary"
                      size="sm"
                      onClick={() => {
                        if (!selectedOrgId || !orgDetails) return;
                        localStorage.setItem("impersonatingOrgId", selectedOrgId);
                        localStorage.setItem("impersonatingOrgName", orgDetails.name);
                        router.push("/projects");
                      }}
                    >
                      <LogIn01 className="w-4 h-4" />
                      Wejdz jako tenant
                    </Button>
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
