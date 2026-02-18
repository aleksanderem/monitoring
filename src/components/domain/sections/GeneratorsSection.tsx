"use client";

import type { Id } from "../../../../convex/_generated/dataModel";
import { SchemaGeneratorPanel } from "./generators/SchemaGeneratorPanel";
import { LlmsTxtGeneratorPanel } from "./generators/LlmsTxtGeneratorPanel";

interface GeneratorsSectionProps {
  domainId: Id<"domains">;
}

export function GeneratorsSection({ domainId }: GeneratorsSectionProps) {
  return (
    <div className="grid gap-6">
      <SchemaGeneratorPanel domainId={domainId} />
      <LlmsTxtGeneratorPanel domainId={domainId} />
    </div>
  );
}
