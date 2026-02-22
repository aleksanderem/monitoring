"use client";

import { CommandPalette } from "@/components/application/command-menus/command-palette";
import { useCommandPalette } from "@/hooks/useCommandPalette";

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useCommandPalette();

  return (
    <>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
