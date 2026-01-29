"use client";

import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import Link from "next/link";
import { Home05 } from "@untitledui/icons";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbNav({ items }: BreadcrumbNavProps) {
  return (
    <Breadcrumbs type="text" divider="chevron">
      <Breadcrumbs.Item href="/dashboard">
        <Home05 className="h-4 w-4" />
      </Breadcrumbs.Item>

      {items.map((item, index) => (
        <Breadcrumbs.Item
          key={index}
          href={item.href && index < items.length - 1 ? item.href : undefined}
        >
          {item.label}
        </Breadcrumbs.Item>
      ))}
    </Breadcrumbs>
  );
}
