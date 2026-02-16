"use client";

import { useCallback, useEffect, useRef } from "react";

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

  const syncAttrs = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("name", name);
    el.setAttribute("variant", variant);
    el.setAttribute("corners", corners);
    el.setAttribute("size", String(size));

    // Resolve "currentColor" to actual computed color so the web component
    // renders correctly in dark mode (shadow DOM can't inherit CSS color)
    const resolvedColor = color === "currentColor"
      ? getComputedStyle(el).color || color
      : color;
    const resolvedStrokeColor = strokeColor === "currentColor"
      ? getComputedStyle(el).color || strokeColor
      : strokeColor;

    el.setAttribute("color", resolvedColor);
    el.setAttribute("stroke-color", resolvedStrokeColor);
    if (strokeWidth) el.setAttribute("stroke-width", String(strokeWidth));
  }, [name, variant, corners, size, color, strokeColor, strokeWidth]);

  useEffect(() => {
    syncAttrs();
  }, [syncAttrs]);

  // Re-resolve currentColor when dark mode toggles (class change on <html>)
  useEffect(() => {
    if (color !== "currentColor" && strokeColor !== "currentColor") return;
    const html = document.documentElement;
    const observer = new MutationObserver(() => syncAttrs());
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [color, strokeColor, syncAttrs]);

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
