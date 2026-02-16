"use client";

import { useTranslations } from "next-intl";

interface HistoryItem {
  _id: string;
  version: number;
  status: string;
  createdAt: number;
  metadata?: any;
}

interface GeneratorHistoryListProps {
  items: HistoryItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function GeneratorHistoryList({ items, selectedId, onSelect }: GeneratorHistoryListProps) {
  const t = useTranslations("generators");

  if (items.length === 0) {
    return <p className="text-sm text-tertiary">{t("noHistory")}</p>;
  }

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium uppercase tracking-wider text-quaternary">{t("history")}</h4>
      {items.map((item) => (
        <button
          key={item._id}
          onClick={() => onSelect(item._id)}
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
            selectedId === item._id
              ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
              : "text-secondary hover:bg-secondary"
          }`}
        >
          <span>{t("version", { version: item.version })}</span>
          <span className="text-xs text-tertiary">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </button>
      ))}
    </div>
  );
}
