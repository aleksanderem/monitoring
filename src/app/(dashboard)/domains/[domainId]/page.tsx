"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ArrowLeft, Globe01, Hash01, Edit01, Trash01, RefreshCcw01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { toast } from "sonner";

// Helper to format date
function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Helper to format relative time
function formatRelativeTime(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export default function DomainDetailPage() {
  const params = useParams();
  const router = useRouter();
  const domainId = params.domainId as Id<"domains">;

  const domain = useQuery(api.domains.getDomain, { domainId });
  const deleteDomain = useMutation(api.domains.remove);

  // TODO: Add keywords query
  const keywords: any[] = [];

  const handleDelete = async () => {
    try {
      await deleteDomain({ id: domainId });
      toast.success("Domain deleted successfully");
      router.push("/domains");
    } catch (error) {
      toast.error("Failed to delete domain");
      console.error(error);
    }
  };

  if (domain === undefined) {
    return (
      <div className="p-8">
        <LoadingState type="card" />
      </div>
    );
  }

  if (domain === null) {
    return (
      <div className="mx-auto flex max-w-container flex-col gap-8 px-4 py-8 lg:px-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">Domain not found</p>
          <Button size="md" color="secondary" onClick={() => router.push("/domains")} className="mt-4">
            Back to Domains
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-container flex-col gap-8 px-4 py-8 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-5">
        <Button
          size="sm"
          color="tertiary"
          iconLeading={ArrowLeft}
          onClick={() => router.push("/domains")}
        >
          Back to Domains
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Globe01 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-primary lg:text-display-xs">
                {domain.domain}
              </h1>
              <p className="text-md text-tertiary">
                {domain.settings.searchEngine} · {domain.settings.refreshFrequency}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <ButtonUtility
              size="sm"
              color="tertiary"
              tooltip="Refresh rankings"
              icon={RefreshCcw01}
              onClick={() => toast.info("Refresh coming soon")}
            />
            <ButtonUtility
              size="sm"
              color="tertiary"
              tooltip="Edit"
              icon={Edit01}
              onClick={() => toast.info("Edit dialog coming soon")}
            />
            <DeleteConfirmationDialog
              title={`Delete "${domain.domain}"?`}
              description="This will permanently delete the domain and all associated keywords and ranking data. This action cannot be undone."
              confirmLabel="Delete domain"
              onConfirm={handleDelete}
            >
              <ButtonUtility
                size="sm"
                color="tertiary"
                tooltip="Delete"
                icon={Trash01}
              />
            </DeleteConfirmationDialog>
          </div>
        </div>
      </div>

      {/* Overview Section */}
      <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Overview</h2>
          <BadgeWithDot size="md" type="modern" color="success">
            Active
          </BadgeWithDot>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-tertiary">Keywords</p>
            <div className="flex items-center gap-2">
              <Hash01 className="h-5 w-5 text-fg-quaternary" />
              <p className="text-2xl font-semibold text-primary">{keywords.length}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-tertiary">Created</p>
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-primary">{formatRelativeTime(domain.createdAt)}</p>
              <p className="text-sm text-tertiary">{formatDate(domain.createdAt)}</p>
            </div>
          </div>

          {domain.lastRefreshedAt && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-tertiary">Last Refreshed</p>
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-primary">{formatRelativeTime(domain.lastRefreshedAt)}</p>
                <p className="text-sm text-tertiary">{formatDate(domain.lastRefreshedAt)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Section */}
      <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
        <h2 className="text-lg font-semibold text-primary">Settings</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-secondary">Search Engine</p>
            <p className="text-sm text-primary">{domain.settings.searchEngine}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-secondary">Refresh Frequency</p>
            <BadgeWithDot size="sm" color="gray" type="modern">
              {domain.settings.refreshFrequency}
            </BadgeWithDot>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-secondary">Location</p>
            <p className="text-sm text-primary">{domain.settings.location}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-secondary">Language</p>
            <p className="text-sm text-primary">{domain.settings.language}</p>
          </div>
        </div>
      </div>

      {/* Keywords Section */}
      <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Keywords</h2>
          <Button size="md">Add Keywords</Button>
        </div>

        {keywords.length > 0 ? (
          <div className="flex flex-col gap-4">
            {keywords.map((keyword: any, index: number) => (
              <div key={keyword._id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Hash01 className="h-5 w-5 text-fg-quaternary" />
                    <p className="text-sm font-medium text-primary">{keyword.phrase}</p>
                  </div>
                  <p className="text-sm font-medium text-secondary">#{keyword.position || "—"}</p>
                </div>
                {index < keywords.length - 1 && <span className="mt-4 block h-px w-full bg-border-secondary" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Hash01 className="h-10 w-10 text-fg-quaternary" />
            <p className="text-sm font-medium text-primary">No keywords yet</p>
            <p className="text-sm text-tertiary">Add keywords to start tracking rankings</p>
          </div>
        )}
      </div>
    </div>
  );
}
