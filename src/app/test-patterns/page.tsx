"use client";

import { useState } from "react";
import { SlideoutDetailView } from "@/components/patterns";
import { Button } from "@/components/base/buttons/button";

export default function TestPatternsPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Pattern Components Test</h1>

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
            <Button variant="tertiary-gray" size="sm">Edit</Button>
            <Button variant="tertiary-color" size="sm">Delete</Button>
          </>
        }
        footer={
          <>
            <Button variant="tertiary-gray" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary">Save</Button>
          </>
        }
      />
    </div>
  );
}
