"use client";

import type { Id } from "../../../../convex/_generated/dataModel";
import { AnchorTextDistributionChart } from "../charts/AnchorTextDistributionChart";
import { ReferringDomainQualityChart } from "../charts/ReferringDomainQualityChart";
import { AnchorTextTable } from "../tables/AnchorTextTable";
import { ToxicLinksTable } from "../tables/ToxicLinksTable";
import { ReferringDomainsTable } from "../tables/ReferringDomainsTable";
import { BacklinkGapTable } from "../tables/BacklinkGapTable";

interface BacklinkProfileSectionProps {
    domainId: Id<"domains">;
}

export function BacklinkProfileSection({ domainId }: BacklinkProfileSectionProps) {
    return (
        <div className="flex flex-col gap-6">
            {/* Charts: Anchor Text Distribution + Referring Domain Quality side by side */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <AnchorTextDistributionChart domainId={domainId} />
                <ReferringDomainQualityChart domainId={domainId} />
            </div>

            {/* Anchor Text Table — full width data table */}
            <AnchorTextTable domainId={domainId} />

            {/* Referring Domains */}
            <ReferringDomainsTable domainId={domainId} />

            {/* Toxic Links */}
            <ToxicLinksTable domainId={domainId} />

            {/* Backlink Gap */}
            <BacklinkGapTable domainId={domainId} />
        </div>
    );
}
