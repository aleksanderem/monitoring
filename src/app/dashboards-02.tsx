"use client";

import { useMemo, useState } from "react";
import {
    BarChartSquare02,
    Edit01,
    FilterLines,
    Folder,
    HomeLine,
    LayoutAlt01,
    MessageChatCircle,
    PieChart03,
    Rows01,
    SearchLg,
    Settings01,
    SwitchHorizontal01,
    Trash01,
} from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { SidebarNavigationSectionDividers } from "@/components/application/app-navigation/sidebar-navigation/sidebar-section-dividers";
import { MetricsChart04 } from "@/components/application/metrics/metrics";
import { PaginationCardMinimal } from "@/components/application/pagination/pagination";
import { Table, TableCard } from "@/components/application/table/table";
import { TabList, Tabs } from "@/components/application/tabs/tabs";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { InputBase } from "@/components/base/input/input";
import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";

const pageData = [
    {
        page: "untitledui.com",
        sessions: 4288,
        avgTime: 84,
        percentageOfTotal: 62.4,
        folder: "General",
    },
    {
        page: "untitledui.com/free-icons",
        sessions: 582,
        avgTime: 68,
        percentageOfTotal: 8.2,
        folder: "General",
    },
    {
        page: "untitledui.com/icons",
        sessions: 464,
        avgTime: 72,
        percentageOfTotal: 7.6,
        folder: "General",
    },
    {
        page: "untitledui.com/components",
        sessions: 446,
        avgTime: 142,
        percentageOfTotal: 7.2,
        folder: "General",
    },
    {
        page: "untitledui.com/pricing",
        sessions: 382,
        avgTime: 48,
        percentageOfTotal: 7.0,
        folder: "General",
    },
    {
        page: "untitledui.com/faqs",
        sessions: 326,
        avgTime: 56,
        percentageOfTotal: 6.4,
        folder: "General",
    },
    {
        page: "untitledui.com/blog",
        sessions: 262,
        avgTime: 74,
        percentageOfTotal: 5.4,
        folder: "General",
    },
];

const tabs = [
    { id: "all", label: "All sessions" },
    { id: "direct", label: "Direct traffic" },
    { id: "organix", label: "Organic traffic" },
    { id: "paid", label: "Paid traffic" },
    { id: "mobile", label: "Mobile users" },
    { id: "returning", label: "Returning users" },
];

// Helper function for formatting seconds to "1m 24s" format
const formatSecondsToTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    const minutesStr = minutes.toLocaleString("en-US");
    const secondsStr = remainingSeconds.toLocaleString("en-US");

    if (minutes > 0) {
        return remainingSeconds > 0 ? `${minutesStr}m ${secondsStr}s` : `${minutesStr}m`;
    }
    return `${secondsStr}s`;
};

export const Dashboard02 = () => {
    const [selectedTab, setSelectedTab] = useState<string>("all");
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "status",
        direction: "ascending",
    });

    const sortedItems = useMemo(() => {
        return pageData.toSorted((a, b) => {
            const first = a[sortDescriptor.column as keyof typeof a];
            const second = b[sortDescriptor.column as keyof typeof b];

            // Handle numbers (including avgTime which is now numeric)
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
        <div className="flex flex-col bg-primary lg:flex-row">
            <SidebarNavigationSectionDividers
                activeUrl="/dashboard"
                items={[
                    {
                        label: "Home",
                        href: "#",
                        icon: HomeLine,
                    },
                    {
                        label: "Dashboard",
                        href: "/dashboard",
                        icon: BarChartSquare02,
                    },
                    {
                        label: "Projects",
                        href: "#",
                        icon: Rows01,
                    },
                    { divider: true },
                    {
                        label: "Folders",
                        icon: Folder,
                        items: [
                            { label: "View all", badge: 18, href: "#" },
                            { label: "Recent", badge: 8, href: "#" },
                            { label: "Favorites", badge: 6, href: "#" },
                            { label: "Shared", badge: 4, href: "#" },
                        ],
                    },
                    { divider: true },
                    {
                        label: "Reporting",
                        href: "#",
                        icon: PieChart03,
                    },
                    {
                        label: "Settings",
                        href: "#",
                        icon: Settings01,
                    },
                    {
                        label: "Support",
                        href: "#",
                        icon: MessageChatCircle,
                        badge: (
                            <BadgeWithDot color="success" type="modern" size="sm">
                                Online
                            </BadgeWithDot>
                        ),
                    },
                    {
                        label: "Open in browser",
                        href: "https://www.untitledui.com/",
                        icon: LayoutAlt01,
                    },
                ]}
            />

            <main className="min-w-0 flex-1 bg-primary pt-8 pb-12">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-5 px-4 lg:px-8">
                        {/* Page header simple with search */}
                        <div className="relative flex flex-col gap-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                                <div className="flex flex-col gap-0.5 lg:gap-1">
                                    <h1 className="text-xl font-semibold text-primary lg:text-display-xs">Site traffic</h1>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Button color="secondary" size="md" iconLeading={SwitchHorizontal01}>
                                        Switch dashboard
                                    </Button>
                                    <Button color="secondary" size="md">
                                        Export report
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="-mx-4 -my-1 scrollbar-hide flex overflow-auto px-4 py-1 lg:-mx-8 lg:px-8">
                            <Tabs selectedKey={selectedTab} onSelectionChange={(value) => setSelectedTab(value as string)}>
                                <TabList type="button-minimal" items={tabs} />
                            </Tabs>
                        </div>
                    </div>

                    <div className="flex flex-col gap-5 px-4 md:flex-row md:flex-wrap lg:gap-6 lg:px-8">
                        <MetricsChart04
                            className="flex-1 md:min-w-[320px]"
                            title="526"
                            subtitle="Total sessions"
                            type="trend"
                            change="2.4%"
                            changeTrend="positive"
                            changeDescription="vs last month"
                            chartColor="text-fg-brand-secondary"
                            chartData={[{ value: 10 }, { value: 8 }, { value: 9 }, { value: 6 }, { value: 5 }, { value: 6 }, { value: 7 }, { value: 9 }]}
                        />
                        <MetricsChart04
                            className="flex-1 md:min-w-[320px]"
                            title="2:24"
                            subtitle="Session duration"
                            type="trend"
                            change="8.6%"
                            changeTrend="positive"
                            changeDescription="vs last month"
                            chartColor="text-fg-brand-secondary"
                            chartData={[
                                { value: 4 },
                                { value: 5 },
                                { value: 7 },
                                { value: 8 },
                                { value: 7 },
                                { value: 5 },
                                { value: 4 },
                                { value: 6 },
                                { value: 5 },
                                { value: 7 },
                            ]}
                        />
                        <MetricsChart04
                            className="flex-1 md:min-w-[320px]"
                            title="316"
                            subtitle="Pages per session"
                            type="trend"
                            change="6.0%"
                            changeDescription="vs last month"
                            changeTrend="positive"
                            chartColor="text-fg-brand-secondary"
                            chartData={[{ value: 4 }, { value: 3 }, { value: 6 }, { value: 5 }, { value: 6 }, { value: 7 }]}
                        />
                    </div>

                    <div className="flex flex-col gap-6 px-4 lg:px-8">
                        <TableCard.Root className="-mx-4 rounded-none bg-secondary_subtle lg:mx-0 lg:rounded-xl">
                            <TableCard.Header title="Pages and screens" />

                            <div className="flex justify-between gap-4 border-b border-secondary px-4 py-3 lg:px-6">
                                <ButtonGroup defaultSelectedKeys={["all"]} className="hidden shrink-0 lg:flex">
                                    <ButtonGroupItem id="all">View all</ButtonGroupItem>
                                    <ButtonGroupItem id="public">Public</ButtonGroupItem>
                                    <ButtonGroupItem id="private">Private</ButtonGroupItem>
                                </ButtonGroup>

                                <div className="grid w-full grid-cols-1 gap-3 lg:w-auto lg:grid-cols-[minmax(0,296px)_max-content]">
                                    <InputBase size="sm" type="search" shortcut aria-label="Search" placeholder="Search" icon={SearchLg} />

                                    <Button iconLeading={FilterLines} color="secondary" size="md">
                                        Filters
                                    </Button>
                                </div>
                            </div>

                            <Table
                                aria-label="Pages and screens"
                                selectionMode="multiple"
                                sortDescriptor={sortDescriptor}
                                onSortChange={setSortDescriptor}
                                className="bg-primary"
                            >
                                <Table.Header className="bg-primary">
                                    <Table.Head id="page" label="Page" allowsSorting isRowHeader className="w-full" />
                                    <Table.Head id="sessions" label="Sessions" allowsSorting />
                                    <Table.Head id="avgTime" label="Avg time" allowsSorting />
                                    <Table.Head id="percentageOfTotal" label="% of total" allowsSorting className="min-w-79" />
                                    <Table.Head id="folder" label="Folder" allowsSorting />
                                    <Table.Head id="actions" />
                                </Table.Header>

                                <Table.Body items={sortedItems}>
                                    {(stats) => (
                                        <Table.Row id={stats.page}>
                                            <Table.Cell className="font-medium!">{stats.page}</Table.Cell>
                                            <Table.Cell>{stats.sessions.toLocaleString()}</Table.Cell>
                                            <Table.Cell>{formatSecondsToTime(stats.avgTime)}</Table.Cell>
                                            <Table.Cell>
                                                <ProgressBar
                                                    labelPosition="right"
                                                    value={stats.percentageOfTotal}
                                                    valueFormatter={(value) => value.toFixed(1) + "%"}
                                                />
                                            </Table.Cell>
                                            <Table.Cell>
                                                <BadgeWithDot color="brand" size="sm" type="modern">
                                                    {stats.folder}
                                                </BadgeWithDot>
                                            </Table.Cell>
                                            <Table.Cell className="px-4">
                                                <div className="flex justify-end gap-0.5">
                                                    <ButtonUtility size="xs" color="tertiary" tooltip="Delete" icon={Trash01} />
                                                    <ButtonUtility size="xs" color="tertiary" tooltip="Edit" icon={Edit01} />
                                                </div>
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table>
                            <PaginationCardMinimal align="right" page={1} total={10} className="bg-secondary_subtle" />
                        </TableCard.Root>
                    </div>
                </div>
            </main>
        </div>
    );
};
