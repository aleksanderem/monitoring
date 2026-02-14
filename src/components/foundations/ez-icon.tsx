"use client";

import { useEffect, useRef } from "react";

interface EzIconProps {
  name: string;
  variant?: "stroke" | "solid" | "bulk" | "duotone" | "twotone";
  corners?: "rounded" | "sharp" | "standard";
  size?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  className?: string;
}

export function EzIcon({
  name,
  variant = "twotone",
  corners = "rounded",
  size = 24,
  color = "currentColor",
  strokeColor = "currentColor",
  strokeWidth,
  className,
}: EzIconProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("name", name);
    el.setAttribute("variant", variant);
    el.setAttribute("corners", corners);
    el.setAttribute("size", String(size));
    el.setAttribute("color", color);
    el.setAttribute("stroke-color", strokeColor);
    if (strokeWidth) el.setAttribute("stroke-width", String(strokeWidth));
  }, [name, variant, corners, size, color, strokeColor, strokeWidth]);

  return (
    // @ts-expect-error — web component not in JSX.IntrinsicElements
    <easier-icon
      ref={ref}
      name={name}
      variant={variant}
      corners={corners}
      size={size}
      color={color}
      stroke-color={strokeColor}
      stroke-width={strokeWidth}
      class={className}
      style={{ display: "inline-flex", verticalAlign: "middle" }}
    />
  );
}
