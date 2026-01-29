"use client";

import { FC } from "react";
import { Button } from "@/components/base/buttons/button";
import { X } from "@untitledui/icons";

export interface BulkAction {
  label: string;
  icon?: FC<{ className?: string }> | React.ReactNode;
  onClick: (selectedIds: Set<string>) => void | Promise<void>;
  variant?: "default" | "destructive";
}

export interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  selectedIds: Set<string>;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  actions,
  selectedIds,
  onClearSelection,
}: BulkActionBarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">
          {selectedCount} selected
        </span>

        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              size="sm"
              color="tertiary"
              iconLeading={action.icon}
              onClick={() => action.onClick(selectedIds)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      <Button
        size="sm"
        color="tertiary"
        iconLeading={X}
        onClick={onClearSelection}
      >
        Clear
      </Button>
    </div>
  );
}
