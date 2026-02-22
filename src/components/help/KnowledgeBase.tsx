"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "../../../convex/_generated/api";

/**
 * Simple markdown-to-text renderer that strips markdown syntax
 * and returns plain text paragraphs for safe rendering.
 */
function MarkdownContent({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/);
  return (
    <div className="space-y-4" data-testid="kb-article-content">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Headings
        if (trimmed.startsWith("### ")) {
          return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{trimmed.slice(4)}</h3>;
        }
        if (trimmed.startsWith("## ")) {
          return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{trimmed.slice(3)}</h2>;
        }
        if (trimmed.startsWith("# ")) {
          return <h1 key={i} className="text-2xl font-bold mt-6 mb-4">{trimmed.slice(2)}</h1>;
        }

        // List items
        if (trimmed.startsWith("- ")) {
          const items = trimmed.split("\n").filter((l) => l.startsWith("- "));
          return (
            <ul key={i} className="list-disc ml-6 space-y-1">
              {items.map((item, j) => (
                <li key={j} className="text-gray-700 dark:text-gray-300">{item.slice(2)}</li>
              ))}
            </ul>
          );
        }

        return <p key={i} className="text-gray-700 dark:text-gray-300">{trimmed}</p>;
      })}
    </div>
  );
}

const CATEGORY_KEYS: Record<string, string> = {
  "getting-started": "gettingStarted",
  features: "features",
  "how-to": "howTo",
  troubleshooting: "troubleshooting",
};

export function KnowledgeBase() {
  const t = useTranslations("help");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const allArticles = useQuery(api.knowledgeBase.getArticles, selectedCategory ? { category: selectedCategory } : {});
  const categories = useQuery(api.knowledgeBase.getCategories);
  const searchResults = useQuery(
    api.knowledgeBase.searchArticles,
    searchQuery.trim().length > 0 ? { queryText: searchQuery } : "skip"
  );
  const selectedArticle = useQuery(
    api.knowledgeBase.getArticle,
    selectedSlug ? { slug: selectedSlug } : "skip"
  );

  const articles = useMemo(() => {
    if (searchQuery.trim().length > 0 && searchResults) return searchResults;
    return allArticles ?? [];
  }, [searchQuery, searchResults, allArticles]);

  // Article detail view
  if (selectedSlug && selectedArticle) {
    return (
      <div className="max-w-4xl mx-auto" data-testid="kb-article-detail">
        <button
          onClick={() => setSelectedSlug(null)}
          className="mb-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          data-testid="kb-back-btn"
        >
          ← {t("backToArticles")}
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {selectedArticle.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {t("publishedOn", {
            date: new Date(selectedArticle.createdAt).toLocaleDateString(),
          })}
        </p>
        <MarkdownContent content={selectedArticle.content} />
        {selectedArticle.tags.length > 0 && (
          <div className="mt-6 flex gap-2 flex-wrap">
            {selectedArticle.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto" data-testid="kb-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t("helpCenter")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">{t("description")}</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          data-testid="kb-search-input"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 flex-wrap" data-testid="kb-category-tabs">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            selectedCategory === null
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          data-testid="kb-category-all"
        >
          {t("allArticles")}
        </button>
        {(categories ?? []).map((cat) => (
          <button
            key={cat.category}
            onClick={() => setSelectedCategory(cat.category)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              selectedCategory === cat.category
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            data-testid={`kb-category-${cat.category}`}
          >
            {CATEGORY_KEYS[cat.category]
              ? t(CATEGORY_KEYS[cat.category] as any)
              : cat.category}{" "}
            ({cat.count})
          </button>
        ))}
      </div>

      {/* Article list */}
      {articles.length === 0 ? (
        <div className="text-center py-12" data-testid="kb-no-results">
          <p className="text-gray-500 dark:text-gray-400">{t("noResults")}</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="kb-article-list">
          {articles.map((article) => (
            <button
              key={article._id}
              onClick={() => setSelectedSlug(article.slug)}
              className="block w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
              data-testid={`kb-article-${article.slug}`}
            >
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                {article.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {article.content.slice(0, 150)}
                {article.content.length > 150 ? "..." : ""}
              </p>
              <div className="mt-2 flex gap-2">
                {article.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
