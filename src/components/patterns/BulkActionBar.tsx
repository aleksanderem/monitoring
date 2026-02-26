"use client";

import { FC } from "react";
import { Button } from "@/components/base/buttons/button";
import { X } from "@untitledui/icons";

export interface BulkAction {
  label: string;
  icon?: FC<{ className?: string }> | React.ReactNode;
  onClick: (selectedIds: Set<string>) => void | Promise<void>;
  variant?: "default" | "destructive";
  disabled?: boolean;
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
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-lg border border-secondary bg-secondary/50 px-4 py-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-primary">
          {selectedCount} selected
        </span>

        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              size="sm"
              color={action.variant === "destructive" ? "secondary-destructive" : "tertiary"}
              iconLeading={action.icon}
              onClick={() => action.onClick(selectedIds)}
              disabled={action.disabled}
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
