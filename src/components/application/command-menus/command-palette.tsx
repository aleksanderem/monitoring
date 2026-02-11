"use client";

import { useRouter } from "next/navigation";
import {
  Folder,
  SearchSm,
  Settings01,
  Users01
} from "@untitledui/icons";
import { useTranslations } from "next-intl";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslations("nav");
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
      className="fixed inset-0 z-50 bg-overlay/70 backdrop-blur"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-lg rounded-xl bg-primary shadow-xl ring-1 ring-border-secondary p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          placeholder={t("searchOrJumpTo")}
          className="w-full px-4 py-2 border border-primary rounded-lg bg-primary text-primary placeholder:text-placeholder mb-4 outline-none focus:ring-2 focus:ring-brand-500"
          autoFocus
        />

        <div className="space-y-1">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-secondary hover:bg-primary_hover rounded-lg transition-colors"
          >
            <SearchSm className="h-4 w-4 text-quaternary" />
            {t("dashboard")}
          </button>

          <button
            onClick={() => navigate("/projects")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-secondary hover:bg-primary_hover rounded-lg transition-colors"
          >
            <Folder className="h-4 w-4 text-quaternary" />
            {t("projects")}
          </button>

          <button
            onClick={() => navigate("/teams")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-secondary hover:bg-primary_hover rounded-lg transition-colors"
          >
            <Users01 className="h-4 w-4 text-quaternary" />
            {t("teams")}
          </button>

          <button
            onClick={() => navigate("/settings")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-secondary hover:bg-primary_hover rounded-lg transition-colors"
          >
            <Settings01 className="h-4 w-4 text-quaternary" />
            {t("settings")}
          </button>
        </div>
      </div>
    </div>
  );
}
