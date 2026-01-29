"use client";

import { useMemo, useState } from "react";
import { parseDate } from "@internationalized/date";
import { DownloadCloud02, FilterLines, Plus, SearchLg, Trash01, Zap } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { HeaderNavigationBase } from "@/components/application/app-navigation/header-navigation";
import { DateRangePicker } from "@/components/application/date-picker/date-range-picker";
import { PaginationCardMinimal, PaginationPageMinimalCenter } from "@/components/application/pagination/pagination";
import { SectionHeader } from "@/components/application/section-headers/section-headers";
import { Table, TableCard, TableRowActionsDropdown } from "@/components/application/table/table";
import { TabList, Tabs } from "@/components/application/tabs/tabs";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";

// Helper functions for formatting
const formatCurrency = (amount: number): string => amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

const formatDate = (timestamp: number): string =>
    new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const tabs = [
    { id: "all", label: "All trades" },
    { id: "buy", label: "Buy" },
    { id: "sell", label: "Sell" },
];

const trades = [
    {
        id: "trade-001",
        label: "TSLA BUY",
        company: "Tesla, Inc.",
        amount: 30021.23,
        deliveryDate: new Date(2025, 0, 13).getTime(),
        status: "processing",
        author: {
            name: "Olivia Rhye",
            email: "olivia@untitledui.com",
            avatarUrl: "https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80",
            initials: "OR",
        },
    },
    {
        id: "trade-002",
        label: "MTCH SELL",
        company: "Match Group, Inc,",
        amount: 10045.0,
        deliveryDate: new Date(2025, 0, 13).getTime(),
        status: "success",
        author: {
            name: "Phoenix Baker",
            email: "phoenix@untitledui.com",
            avatarUrl: "https://www.untitledui.com/images/avatars/phoenix-baker?fm=webp&q=80",
            initials: "PB",
        },
    },
    {
        id: "trade-003",
        label: "DDOG BUY",
        company: "Datadog Inc",
        amount: 40132.16,
        deliveryDate: new Date(2025, 0, 13).getTime(),
        status: "success",
        author: { name: "Lana Steiner", email: "lana@untitledui.com", avatarUrl: "", initials: "LS" },
    },
    {
        id: "trade-004",
        label: "ARKG BUY",
        company: "ARK Genomic Revolution ETF",
        amount: 22665.12,
        deliveryDate: new Date(2025, 0, 13).getTime(),
        status: "declined",
        author: { name: "Demi Wilkinson", email: "demi@untitledui.com", avatarUrl: "", initials: "DW" },
    },
    {
        id: "trade-005",
        label: "SQ BUY",
        company: "Square, Inc.",
        amount: 18221.3,
        deliveryDate: new Date(2025, 0, 12).getTime(),
        status: "success",
        author: {
            name: "Candice Wu",
            email: "candice@untitledui.com",
            avatarUrl: "https://www.untitledui.com/images/avatars/candice-wu?fm=webp&q=80",
            initials: "CW",
        },
    },
    {
        id: "trade-006",
        label: "MSTR SELL",
        company: "MicroStrategy Inc.",
        amount: 24118.18,
        deliveryDate: new Date(2025, 0, 12).getTime(),
        status: "success",
        author: { name: "Natali Craig", email: "natali@untitledui.com", avatarUrl: "", initials: "NC" },
    },
];

export const Informational01 = () => {
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "deliveryDate",
        direction: "descending",
    });

    const sortedItems = useMemo(() => {
        if (!sortDescriptor) return trades;

        return trades.toSorted((a, b) => {
            const first = a[sortDescriptor.column as keyof typeof a];
            const second = b[sortDescriptor.column as keyof typeof b];

            // Handle numbers
            if (typeof first === "number" && typeof second === "number") {
                return sortDescriptor.direction === "ascending" ? first - second : second - first;
            }

            // Handle strings
            if (typeof first === "string" && typeof second === "string") {
                const result = first.localeCompare(second);
                return sortDescriptor.direction === "ascending" ? result : -result;
            }

            return 0;
        });
    }, [sortDescriptor]);

    return (
        <div className="flex flex-col">
            <HeaderNavigationBase
                items={[
                    { label: "Home", href: "/" },
                    {
                        label: "Dashboard",
                        href: "/dashboard",
                        current: true,
                        items: [
                            { label: "Overview", href: "#" },
                            { label: "Notifications", href: "#" },
                            { label: "Trade history", href: "#", current: true },
                            { label: "Saved reports", href: "#" },
                            { label: "Withdrawals", href: "#" },
                        ],
                    },
                    { label: "Projects", href: "/projects" },
                    { label: "Tasks", href: "/tasks" },
                    { label: "Reporting", href: "/reporting" },
                    { label: "Users", href: "/users" },
                ]}
                trailingContent={
                    <Button iconLeading={Zap} color="secondary" size="sm">
                        Upgrade now
                    </Button>
                }
            />
            <main className="min-w-0 flex-1 bg-primary pt-8 pb-16 lg:pt-12 lg:pb-24">
                <div className="mx-auto mb-8 flex max-w-container flex-col gap-5 px-4 lg:px-8">
                    {/* Page header simple */}
                    <div className="relative flex flex-col gap-5 bg-primary">
                        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                            <div className="flex flex-col gap-0.5 lg:gap-1">
                                <p className="text-xl font-semibold text-primary lg:text-display-xs">Trade history</p>
                                <p className="text-md text-tertiary">View your team's trades and transactions.</p>
                            </div>
                            <div className="flex flex-col gap-4 lg:flex-row">
                                <div className="flex items-start gap-3">
                                    <Button iconLeading={DownloadCloud02} color="secondary" size="md">
                                        Export
                                    </Button>
                                    <Button iconLeading={Plus} size="md">
                                        Add trade
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Tabs orientation="horizontal" selectedKey="all">
                        <TabList size="sm" type="underline" items={tabs} />
                    </Tabs>
                </div>
                <div className="mx-auto flex max-w-container flex-col gap-6 px-4 lg:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-y-3 lg:gap-y-4">
                        <Input shortcut className="lg:w-100" size="sm" placeholder="Search for trades" icon={SearchLg} />
                        <div className="flex gap-3">
                            <DateRangePicker
                                defaultValue={{
                                    start: parseDate("2025-01-10"),
                                    end: parseDate("2025-01-16"),
                                }}
                            />
                            <Button iconLeading={FilterLines} size="md" color="secondary" className="hidden lg:inline-flex">
                                Filters
                            </Button>
                            <Button iconLeading={FilterLines} size="md" color="secondary" className="inline-flex lg:hidden" />
                        </div>
                    </div>

                    <SectionHeader.Root className="border-none pb-0 lg:hidden">
                        <SectionHeader.Group>
                            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 self-stretch">
                                <SectionHeader.Heading>All trades</SectionHeader.Heading>
                            </div>

                            <div className="absolute top-0 right-0 md:static">
                                <TableRowActionsDropdown />
                            </div>
                        </SectionHeader.Group>
                    </SectionHeader.Root>

                    <TableCard.Root className="-mx-4 rounded-none lg:mx-0 lg:rounded-xl">
                        <TableCard.Header
                            title="All trades"
                            badge={
                                <Badge color="gray" type="modern" size="sm">
                                    58 trades
                                </Badge>
                            }
                            contentTrailing={<TableRowActionsDropdown />}
                            className="hidden pb-5 lg:flex"
                        />
                        <Table
                            aria-label="Trades"
                            selectionMode="multiple"
                            defaultSelectedKeys={["trade-001", "trade-003", "trade-004", "trade-005"]}
                            sortDescriptor={sortDescriptor}
                            onSortChange={setSortDescriptor}
                        >
                            <Table.Header>
                                <Table.Head id="trade" isRowHeader label="Trade" className="w-full" />
                                <Table.Head id="amount" label="Order amount" />
                                <Table.Head id="deliveryDate" label="Delivery date" allowsSorting />
                                <Table.Head id="status" label="Status" />
                                <Table.Head id="author" label="Executed by" />
                                <Table.Head id="actions" />
                            </Table.Header>
                            <Table.Body items={sortedItems}>
                                {(trade) => (
                                    <Table.Row id={trade.id} className="selected:bg-primary">
                                        <Table.Cell>
                                            <div>
                                                <p className="text-sm font-medium whitespace-nowrap text-primary">{trade.label}</p>
                                                <p className="text-sm whitespace-nowrap text-tertiary">{trade.company}</p>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>{formatCurrency(trade.amount)}</Table.Cell>
                                        <Table.Cell>{formatDate(trade.deliveryDate)}</Table.Cell>
                                        <Table.Cell>
                                            <BadgeWithDot
                                                color={
                                                    trade.status === "success"
                                                        ? "success"
                                                        : trade.status === "processing"
                                                          ? "gray"
                                                          : trade.status === "declined"
                                                            ? "error"
                                                            : "gray"
                                                }
                                                size="sm"
                                                type="modern"
                                                className="capitalize"
                                            >
                                                {trade.status}
                                            </BadgeWithDot>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="group flex items-center gap-3 outline-hidden">
                                                <Avatar src={trade.author.avatarUrl} alt={trade.author.name} size="sm" initials={trade.author.initials} />
                                                <div>
                                                    <p className="text-sm font-medium text-primary">{trade.author.name}</p>
                                                    <p className="text-sm text-tertiary">{trade.author.email}</p>
                                                </div>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell className="px-4">
                                            <div className="flex justify-end gap-0.5">
                                                <ButtonUtility size="xs" color="tertiary" tooltip="Download" icon={DownloadCloud02} />
                                                <ButtonUtility size="xs" color="tertiary" tooltip="Edit" icon={Trash01} />
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                )}
                            </Table.Body>
                        </Table>
                        <div className="max-lg:hidden">
                            <PaginationCardMinimal align="right" page={1} total={10} />
                        </div>
                    </TableCard.Root>
                    <div className="lg:hidden">
                        <PaginationPageMinimalCenter page={1} total={10} />
                    </div>
                </div>
            </main>
        </div>
    );
};
