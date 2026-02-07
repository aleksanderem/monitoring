"use client";

import type { HTMLAttributes } from "react";
import { cx } from "@/utils/cx";
import Image from "next/image";

interface AppLogoProps extends HTMLAttributes<HTMLDivElement> {
  /** Force a specific variant regardless of theme */
  variant?: "dark" | "white";
}

export function AppLogo({ variant, className, ...props }: AppLogoProps) {
  if (variant === "white") {
    return (
      <div {...props} className={cx("relative", className)}>
        <Image src="/logo-white.svg" alt="DSE.O" width={96} height={50} priority />
      </div>
    );
  }

  if (variant === "dark") {
    return (
      <div {...props} className={cx("relative", className)}>
        <Image src="/logo-dark.svg" alt="DSE.O" width={96} height={50} priority />
      </div>
    );
  }

  // Auto-switch based on theme
  return (
    <div {...props} className={cx("relative", className)}>
      <Image src="/logo-dark.svg" alt="DSE.O" width={96} height={50} className="dark:hidden" priority />
      <Image src="/logo-white.svg" alt="DSE.O" width={96} height={50} className="hidden dark:block" priority />
    </div>
  );
}
