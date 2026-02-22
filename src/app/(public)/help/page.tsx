import type { Metadata } from "next";
import { KnowledgeBase } from "@/components/help/KnowledgeBase";

export const metadata: Metadata = {
  title: "Help Center - doseo",
  description: "Find answers to common questions about using doseo for SEO monitoring, keyword tracking, and competitor analysis.",
  openGraph: {
    title: "Help Center - doseo",
    description: "Find answers to common questions about using doseo for SEO monitoring.",
  },
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <KnowledgeBase />
    </div>
  );
}
