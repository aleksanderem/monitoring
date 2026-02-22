"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home06, Globe01, SearchMd, Settings01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

const NAV_ITEMS = [
  { href: "/", icon: Home06, labelKey: "mobileNavDashboard" as const },
  { href: "/domains", icon: Globe01, labelKey: "mobileNavDomains" as const },
  { href: "/keywords", icon: SearchMd, labelKey: "mobileNavKeywords" as const },
  { href: "/settings", icon: Settings01, labelKey: "mobileNavSettings" as const },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("common");

  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-utility-gray-200 bg-primary md:hidden"
    >
      <ul className="flex items-center justify-around py-2">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                className={cx(
                  "flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors",
                  isActive
                    ? "text-brand-600 font-semibold"
                    : "text-utility-gray-500"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{t(labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
