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
      if (suspended) { await activateOrg({ organizationId: orgId }); toast.success("Organization activated"); }
      else { await suspendOrg({ organizationId: orgId }); toast.success("Organization suspended"); }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
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
      toast.success("Limits updated");
      setIsEditingLimits(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update limits");
    }
  };

  const handleDelete = async () => {
    if (!selectedOrgId) return;
    try {
      await deleteOrg({ organizationId: selectedOrgId });
      toast.success("Organization deleted");
      setIsSlideoutOpen(false);
      setIsDeleteModalOpen(false);
      setSelectedOrgId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const hasSelection = selectedKeys !== "all" && selectedKeys.size > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-6">
        <Breadcrumbs.Item href="/admin">Admin</Breadcrumbs.Item>
        <Breadcrumbs.Item>Organizations</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-utility-brand-50 flex items-center justify-center">
            <Building01 className="w-7 h-7 text-utility-brand-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-primary">Organizations</h1>
            <p className="mt-0.5 text-sm text-tertiary">Manage all organizations</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-primary rounded-lg bg-primary text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-solid"
        />
      </div>

      {hasSelection && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 bg-utility-gray-50 border border-primary rounded-lg">
          <span className="text-sm font-medium text-secondary">{selectedKeys.size} organization(s) selected</span>
          <Button color="primary-destructive" size="sm" onClick={async () => {
            if (typeof selectedKeys === "string" || selectedKeys.size === 0) return;
            const ids = Array.from(selectedKeys) as Id<"organizations">[];
            for (const id of ids) { try { await suspendOrg({ organizationId: id }); } catch {} }
            toast.success("Done"); setSelectedKeys(new Set());
          }}>Suspend selected</Button>
        </div>
      )}

      <TableCard.Root>
        <TableCard.Header title="Organizations" badge={organizations?.organizations.length ?? 0} description="All organizations" />
        <Table
          aria-label="Organizations table"
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onRowAction={(key) => handleRowClick(key as Id<"organizations">)}
        >
          <Table.Header>
            <Table.Head label="Name" isRowHeader allowsSorting />
            <Table.Head label="Users" allowsSorting />
            <Table.Head label="Status" allowsSorting />
            <Table.Head label="Usage" allowsSorting />
            <Table.Head label="Created" allowsSorting />
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
                    <Badge color="error" size="sm"><AlertCircle className="w-3 h-3" />Suspended</Badge>
                  ) : (
                    <Badge color="success" size="sm"><CheckCircle className="w-3 h-3" />Active</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <div className="text-sm text-secondary">{org.projectCount} projects · {org.domainCount} domains · {org.keywordCount} keywords</div>
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
              <h2 className="text-lg font-semibold text-primary">{orgDetails?.name ?? "Organization"}</h2>
              {orgDetails?.slug && <p className="text-sm text-tertiary font-mono">{orgDetails.slug}</p>}
            </div>
          </div>
        </SlideoutMenu.Header>

        <SlideoutMenu.Content>
          {orgDetails && (
            <div className="flex flex-col h-full">
              <div className="border-b border-primary mb-6">
                <div className="flex gap-6">
                  {["overview", "users", "limits", "usage"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab ? "border-brand-solid text-brand-solid" : "border-transparent text-tertiary hover:text-secondary"
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-secondary mb-3">Details</h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Status</dt><dd>{orgDetails.suspended ? <Badge color="error" size="sm">Suspended</Badge> : <Badge color="success" size="sm">Active</Badge>}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Created</dt><dd className="text-sm text-primary">{new Date(orgDetails.createdAt).toLocaleDateString()}</dd></div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-secondary mb-3">Resources</h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Users</dt><dd className="text-sm font-medium text-primary">{orgDetails.members.length}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Teams</dt><dd className="text-sm font-medium text-primary">{orgDetails.teams.length}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Projects</dt><dd className="text-sm font-medium text-primary">{orgDetails.projectCount} / {orgDetails.limits?.maxProjects ?? "∞"}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Domains</dt><dd className="text-sm font-medium text-primary">{orgDetails.domainCount}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Keywords</dt><dd className="text-sm font-medium text-primary">{orgDetails.keywordCount}</dd></div>
                    </dl>
                  </div>
                </div>
              )}

              {activeTab === "users" && (
                <div>
                  <h3 className="text-sm font-medium text-secondary mb-4">Members ({orgDetails.members.length})</h3>
                  {orgDetails.members.length > 0 ? (
                    <div className="space-y-3">
                      {orgDetails.members.map((member) => (
                        <div key={member.userId} className="flex items-center justify-between p-3 border border-primary rounded-lg">
                          <div>
                            <div className="text-sm font-medium text-primary">{member.email}</div>
                            <div className="text-xs text-tertiary">{member.name || "No name"}</div>
                          </div>
                          <Badge color="gray" size="sm">{member.role}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (<p className="text-sm text-tertiary">No members</p>)}
                </div>
              )}

              {activeTab === "limits" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-secondary">Limits</h3>
                    {!isEditingLimits && <Button color="secondary" size="sm" onClick={handleStartEditLimits}><Settings01 className="w-4 h-4" />Edit</Button>}
                  </div>
                  {isEditingLimits && editedLimits ? (
                    <div className="space-y-4">
                      {[
                        { label: "Max projects", key: "maxProjects" as const },
                        { label: "Max domains per project", key: "maxDomainsPerProject" as const },
                        { label: "Max keywords per domain", key: "maxKeywordsPerDomain" as const },
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
                        <Button color="primary" size="sm" onClick={handleSaveLimits}>Save</Button>
                        <Button color="secondary" size="sm" onClick={() => setIsEditingLimits(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <dl className="space-y-3">
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Max projects</dt><dd className="text-sm font-medium text-primary">{orgDetails.limits?.maxProjects ?? "∞"}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Max domains/project</dt><dd className="text-sm font-medium text-primary">{orgDetails.limits?.maxDomainsPerProject ?? "∞"}</dd></div>
                      <div className="flex justify-between"><dt className="text-sm text-tertiary">Max keywords/domain</dt><dd className="text-sm font-medium text-primary">{orgDetails.limits?.maxKeywordsPerDomain ?? "∞"}</dd></div>
                    </dl>
                  )}
                </div>
              )}

              {activeTab === "usage" && (
                <div>
                  <h3 className="text-sm font-medium text-secondary mb-4">Current Usage</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-tertiary">Projects</span>
                        <span className="text-sm font-medium text-primary">{orgDetails.projectCount} / {orgDetails.limits?.maxProjects ?? "∞"}</span>
                      </div>
                      {orgDetails.limits?.maxProjects && (
                        <div className="w-full bg-utility-gray-200 rounded-full h-2">
                          <div className="bg-utility-brand-600 h-2 rounded-full" style={{ width: `${Math.min((orgDetails.projectCount / orgDetails.limits.maxProjects) * 100, 100)}%` }} />
                        </div>
                      )}
                    </div>
                    <div><div className="flex justify-between"><span className="text-sm text-tertiary">Domains</span><span className="text-sm font-medium text-primary">{orgDetails.domainCount}</span></div></div>
                    <div><div className="flex justify-between"><span className="text-sm text-tertiary">Keywords</span><span className="text-sm font-medium text-primary">{orgDetails.keywordCount}</span></div></div>
                  </div>
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button color={orgDetails.suspended ? "primary" : "secondary"} size="sm" onClick={() => selectedOrgId && handleToggleSuspend(selectedOrgId, orgDetails.suspended)}>
                      {orgDetails.suspended ? "Activate" : "Suspend"}
                    </Button>
                    <Button color="primary-destructive" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
                      <Trash01 className="w-4 h-4" />Delete
                    </Button>
                  </div>
                  <Button color="secondary" size="sm" onClick={() => setIsSlideoutOpen(false)}>Close</Button>
                </div>
              </div>
            </div>
          )}
        </SlideoutMenu.Content>
      </SlideoutMenu>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Organization" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-utility-error-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary">This action cannot be undone. All projects, domains, and keywords will be permanently deleted.</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button color="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button color="primary-destructive" onClick={handleDelete}>Delete Organization</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
