"use client";

import { useState } from "react";
import { SlideoutDetailView, DataTableWithFilters } from "@/components/patterns";
import { BreadcrumbNav, LoadingState } from "@/components/shared";
import { Button } from "@/components/base/buttons/button";
import { Trash01, Edit05 } from "@untitledui/icons";

const mockProjects = [
  { _id: "1", name: "Project Alpha", domainCount: 5, keywordCount: 120 },
  { _id: "2", name: "Project Beta", domainCount: 3, keywordCount: 85 },
  { _id: "3", name: "Project Gamma", domainCount: 8, keywordCount: 240 },
];

export default function TestPatternsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  return (
    <div className="p-8 space-y-12">
      <div>
        <h1 className="text-2xl font-bold mb-2">Pattern Components Test</h1>
        <BreadcrumbNav
          items={[
            { label: "Components", href: "/components" },
            { label: "Pattern Tests" },
          ]}
        />
      </div>

      {/* SlideoutDetailView Test */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">SlideoutDetailView</h2>
        <Button onClick={() => setIsOpen(true)}>
          Open SlideoutDetailView
        </Button>

        <SlideoutDetailView
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Test Project"
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: <div className="p-4">Overview content here</div>,
            },
            {
              id: "settings",
              label: "Settings",
              content: <div className="p-4">Settings content here</div>,
            },
          ]}
          actions={
            <>
              <Button color="tertiary" size="sm">Edit</Button>
              <Button color="tertiary" size="sm">Delete</Button>
            </>
          }
          footer={
            <>
              <Button color="secondary" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button color="primary">Save</Button>
            </>
          }
        />
      </section>

      {/* DataTableWithFilters Test */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">DataTableWithFilters</h2>
        <DataTableWithFilters
          data={mockProjects}
          columns={[
            { id: "name", header: "Name", accessorKey: "name", sortable: true },
            { id: "domains", header: "Domains", accessorKey: "domainCount" },
            { id: "keywords", header: "Keywords", accessorKey: "keywordCount" },
          ]}
          searchKeys={["name"]}
          searchPlaceholder="Search projects..."
          bulkActions={[
            {
              label: "Delete",
              icon: Trash01,
              variant: "destructive",
              onClick: (ids) => console.log("Delete", Array.from(ids)),
            },
          ]}
          rowActions={[
            {
              label: "Edit",
              icon: Edit05,
              onClick: (row) => console.log("Edit", row),
            },
            {
              label: "Delete",
              icon: Trash01,
              variant: "destructive",
              onClick: (row) => console.log("Delete", row),
            },
          ]}
          onRowClick={(row) => console.log("Clicked", row)}
        />
      </section>

      {/* LoadingState Test */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">LoadingState</h2>
        <Button onClick={() => setShowLoading(!showLoading)}>
          Toggle Loading States
        </Button>

        {showLoading && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-4">Table Loading</h3>
              <LoadingState type="table" rows={5} />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">Card Loading</h3>
              <LoadingState type="card" rows={6} />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">List Loading</h3>
              <LoadingState type="list" rows={4} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
