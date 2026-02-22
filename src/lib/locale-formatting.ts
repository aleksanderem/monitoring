/**
 * Locale-aware formatting utilities for dates, numbers, currencies, and relative time.
 * Uses the Intl API for proper localization across EN and PL locales.
 */

export function formatDate(
  date: Date | number,
  locale: string,
  style: "short" | "medium" | "long" = "medium"
): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "numeric", month: "numeric", year: "numeric" }
      : style === "medium"
        ? { day: "numeric", month: "long", year: "numeric" }
        : { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatNumber(
  num: number,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(num);
}

export function formatCurrency(
  amount: number,
  currency: string,
  locale: string
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amount
  );
}

export function formatPercent(
  value: number,
  locale: string,
  decimals: number = 1
): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

export function formatRelativeTime(
  date: Date | number,
  locale: string
): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
        -diffMinutes,
        "minute"
      );
    }
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -diffHours,
      "hour"
    );
  }
  if (diffDays < 30) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -diffDays,
      "day"
    );
  }
  const diffMonths = Math.floor(diffDays / 30);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    -diffMonths,
    "month"
  );
}

export function formatCompactNumber(num: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact" }).format(num);
}
