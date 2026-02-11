"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Globe02 } from "@untitledui/icons";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { cx } from "@/utils/cx";

export function LanguageSwitcher() {
    const locale = useLocale() as Locale;
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    function changeLocale(newLocale: Locale) {
        document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
        setIsOpen(false);
        router.refresh();
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center rounded-lg p-2 text-quaternary transition-colors hover:bg-secondary hover:text-tertiary"
                title={localeNames[locale]}
            >
                <Globe02 className="h-5 w-5" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-secondary bg-primary shadow-lg z-50">
                    {locales.map((l) => (
                        <button
                            key={l}
                            onClick={() => changeLocale(l)}
                            className={cx(
                                "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-secondary first:rounded-t-lg last:rounded-b-lg",
                                l === locale
                                    ? "font-medium text-brand-600"
                                    : "text-primary",
                            )}
                        >
                            <span className="text-base leading-none">
                                {l === "en" ? "🇬🇧" : "🇵🇱"}
                            </span>
                            <span>{localeNames[l]}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
