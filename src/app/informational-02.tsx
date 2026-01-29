"use client";

import { useMemo, useState } from "react";
import { parseDate } from "@internationalized/date";
import {
    BarChartSquare02,
    CheckDone01,
    ClockFastForward,
    DownloadCloud02,
    FilterLines,
    Grid03,
    HomeLine,
    LineChartUp03,
    NotificationBox,
    PieChart03,
    Plus,
    Rows01,
    SearchLg,
    Settings03,
    Star01,
    UserSquare,
    Users01,
} from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { SidebarNavigationSlim } from "@/components/application/app-navigation/sidebar-navigation/sidebar-slim";
import { DateRangePicker } from "@/components/application/date-picker/date-range-picker";
import { PaginationCardDefault, PaginationPageMinimalCenter } from "@/components/application/pagination/pagination";
import { Table, TableCard } from "@/components/application/table/table";
import { Avatar } from "@/components/base/avatar/avatar";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";

// Helper functions for formatting
const formatCurrency = (amount: number): string => amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

const formatDate = (timestamp: number): string =>
    new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const trades = [
    {
        id: "trade-01",
        label: "TSLA BUY",
        company: "Tesla, Inc.",
        amount: 30021.23,
        deliveryDate: new Date(2025, 0, 12).getTime(),
        status: "processing",
        author: {
            name: "Olivia Rhye",
            email: "olivia@untitledui.com",
            avatarUrl: "https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80",
            initials: "OR",
        },
    },
    {
        id: "trade-02",
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
        id: "trade-03",
        label: "DDOG BUY",
        company: "Datadog Inc",
        amount: 40132.16,
        deliveryDate: new Date(2025, 0, 13).getTime(),
        status: "success",
        author: { name: "Lana Steiner", email: "lana@untitledui.com", avatarUrl: "", initials: "LS" },
    },
    {
        id: "trade-04",
        label: "ARKG BUY",
        company: "ARK Genomic Revolution ETF",
        amount: 22665.12,
        deliveryDate: new Date(2025, 0, 13).getTime(),
        status: "declined",
        author: { name: "Demi Wilkinson", email: "demi@untitledui.com", avatarUrl: "", initials: "DW" },
    },
    {
        id: "trade-05",
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
        id: "trade-06",
        label: "MSTR SELL",
        company: "MicroStrategy Inc.",
        amount: 24118.18,
        deliveryDate: new Date(2025, 0, 12).getTime(),
        status: "success",
        author: { name: "Natali Craig", email: "natali@untitledui.com", avatarUrl: "", initials: "NC" },
    },
    {
        id: "trade-07",
        label: "TSLA BUY",
        company: "Tesla, Inc.",
        amount: 22468.2,
        deliveryDate: new Date(2025, 0, 12).getTime(),
        status: "success",
        author: {
            name: "Candice Wu",
            email: "candice@untitledui.com",
            avatarUrl: "https://www.untitledui.com/images/avatars/candice-wu?fm=webp&q=80",
            initials: "NC",
        },
    },
];

export const Informational02 = () => {
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
        <div className="flex flex-col lg:flex-row">
            <SidebarNavigationSlim
                activeUrl="/dashboard/trade-history"
                items={[
                    {
                        label: "Home",
                        href: "/",
                        icon: HomeLine,
                    },
                    {
                        label: "Dashboard",
                        href: "/dashboard",
                        icon: BarChartSquare02,
                        items: [
                            { label: "Overview", href: "/dashboard/overview", icon: Grid03 },
                            { label: "Notifications", href: "/dashboard/notifications", icon: NotificationBox, badge: 10 },
                            { label: "Analytics", href: "/dashboard/analytics", icon: LineChartUp03 },
                            { label: "Saved reports", href: "/dashboard/saved-reports", icon: Star01 },
                            { label: "Trade history", href: "/dashboard/trade-history", icon: ClockFastForward },
                            { label: "User reports", href: "/dashboard/user-reports", icon: UserSquare },
                            { label: "Manage notifications", href: "/dashboard/manage-notifications", icon: Settings03 },
                        ],
                    },
                    {
                        label: "Projects",
                        href: "/projects",
                        icon: Rows01,
                    },
                    {
                        label: "Tasks",
                        href: "/tasks",
                        icon: CheckDone01,
                    },
                    {
                        label: "Reporting",
                        href: "/reporting",
                        icon: PieChart03,
                    },
                    {
                        label: "Users",
                        href: "/users",
                        icon: Users01,
                    },
                ]}
            />
            <main className="min-w-0 flex-1 bg-secondary_subtle pt-8 pb-12 shadow-none lg:bg-primary">
                <div className="mx-auto mb-8 flex max-w-container flex-col gap-5 px-4 lg:px-8">
                    {/* Page header simple */}
                    <div className="relative flex flex-col gap-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                            <div className="flex flex-col gap-0.5 md:gap-1">
                                <p className="text-xl font-semibold text-primary md:text-display-xs">Trade history</p>
                                <p className="text-md text-tertiary">View your team's trades and transactions.</p>
                            </div>
                            <div className="flex flex-col gap-4 lg:flex-row">
                                <div className="flex items-start gap-3">
                                    <Button iconLeading={DownloadCloud02} color="secondary" size="md">
                                        Download CSV
                                    </Button>
                                    <Button iconLeading={Plus} size="md">
                                        Add
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <ButtonGroup size="md">
                        <ButtonGroupItem isSelected>All trades</ButtonGroupItem>
                        <ButtonGroupItem>Buy side</ButtonGroupItem>
                        <ButtonGroupItem>Sell side</ButtonGroupItem>
                    </ButtonGroup>
                </div>
                <div className="mx-auto flex max-w-container flex-col px-4 lg:gap-6 lg:px-8">
                    <div className="lg:rounded-xl lg:bg-secondary lg:px-4 lg:py-3">
                        <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-4 pb-6 after:pointer-events-none after:absolute after:inset-0 after:border-b after:border-secondary lg:flex-nowrap lg:px-0 lg:pb-0 lg:after:border-b-0">
                            <Input shortcut className="lg:max-w-100" size="sm" placeholder="Search for trades" icon={SearchLg} />
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
                    </div>
                    <TableCard.Root className="-mx-4 rounded-none shadow-xs lg:mx-0 lg:rounded-xl">
                        <Table
                            aria-label="Trades"
                            selectionMode="multiple"
                            sortDescriptor={sortDescriptor}
                            onSortChange={setSortDescriptor}
                            className="bg-primary"
                        >
                            <Table.Header className="bg-transparent">
                                <Table.Head id="trade" isRowHeader label="Trade" className="w-full" />
                                <Table.Head id="amount" label="Order amount" />
                                <Table.Head id="deliveryDate" label="Delivery date" allowsSorting />
                                <Table.Head id="status" label="Status" />
                                <Table.Head id="author" label="Executed by" />
                                <Table.Head id="actions" />
                            </Table.Header>
                            <Table.Body items={sortedItems}>
                                {(trade) => (
                                    <Table.Row id={trade.id}>
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
                                        <Table.Cell>
                                            <Button size="sm" color="link-color">
                                                Edit
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                )}
                            </Table.Body>
                        </Table>
                        <div className="max-lg:hidden">
                            <PaginationCardDefault />
                        </div>
                    </TableCard.Root>
                    <div className="lg:hidden">
                        <PaginationPageMinimalCenter page={1} total={10} className="mt-6" />
                    </div>
                </div>
            </main>
        </div>
    );
};
