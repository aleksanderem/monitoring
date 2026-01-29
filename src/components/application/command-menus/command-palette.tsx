"use client";

import { useRouter } from "next/navigation";
import {
  Folder,
  Globe01,
  SearchSm,
  Settings01,
  Users01
} from "@untitledui/icons";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  const navigate = (path: string) => {
    router.push(path);
    onOpenChange(false);
  };

  // Placeholder - will implement full command menu later
  // For now, just a simple modal to test the provider
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-lg shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          placeholder="Search or jump to..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
          autoFocus
        />

        <div className="space-y-1">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded-lg"
          >
            <SearchSm className="h-4 w-4" />
            Dashboard
          </button>

          <button
            onClick={() => navigate("/projects")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded-lg"
          >
            <Folder className="h-4 w-4" />
            Projects
          </button>

          <button
            onClick={() => navigate("/teams")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded-lg"
          >
            <Users01 className="h-4 w-4" />
            Teams
          </button>

          <button
            onClick={() => navigate("/settings")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded-lg"
          >
            <Settings01 className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
