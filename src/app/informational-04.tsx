"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Download04, FilterFunnel01, HomeLine, ReverseLeft, SearchLg, X, Zap } from "@untitledui/icons";
import { type SortDescriptor } from "react-aria-components";
import { HeaderNavigationBase } from "@/components/application/app-navigation/header-navigation";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { PaginationPageDefault } from "@/components/application/pagination/pagination";
import { Table, TableCard } from "@/components/application/table/table";
import { TabList, Tabs } from "@/components/application/tabs/tabs";
import { Avatar } from "@/components/base/avatar/avatar";
import { BadgeWithIcon } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Dot } from "@/components/foundations/dot-icon";

// Helper functions for formatting
const formatDate = (timestamp: number): string =>
    new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const tabs = [
    { id: "overview", label: "Overview" },
    { id: "notifications", label: "Notifications" },
    { id: "analytics", label: "Analytics" },
    { id: "saved_reports", label: "Saved reports" },
    { id: "orders", label: "Orders" },
    { id: "user_reports", label: "User reports" },
    { id: "manage_notifications", label: "Manage notifications" },
];

const orders = [
    {
        id: "order-01",
        invoice: "INV-3066",
        date: new Date(2025, 0, 6).getTime(),
        status: "paid",
        customer: {
            id: "olivia",
            name: "Olivia Rhye",
            email: "olivia@untitledui.com",
            avatarUrl: "https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80",
            initials: "OR",
        },
        purchase: "Monthly",
    },
    {
        id: "order-02",
        invoice: "INV-3065",
        date: new Date(2025, 0, 6).getTime(),
        status: "paid",
        customer: {
            id: "phoenix",
            name: "Phoenix Baker",
            email: "phoenix@untitledui.com",
            avatarUrl: "https://www.untitledui.com/images/avatars/phoenix-baker?fm=webp&q=80",
            initials: "PB",
        },
        purchase: "Monthly",
    },
    {
        id: "order-03",
        invoice: "INV-3064",
        date: new Date(2025, 0, 6).getTime(),
        status: "paid",
        customer: { id: "lana", name: "Lana Steiner", email: "lana@untitledui.com", avatarUrl: "", initials: "LS" },
        purchase: "Monthly",
    },
    {
        id: "order-04",
        invoice: "INV-3063",
        date: new Date(2025, 0, 5).getTime(),
        status: "paid",
        customer: { id: "demi", name: "Demi Wilkinson", email: "demi@untitledui.com", avatarUrl: "", initials: "DW" },
        purchase: "Monthly",
    },
    {
        id: "order-05",
        invoice: "INV-3062",
        date: new Date(2025, 0, 5).getTime(),
        status: "refunded",
        customer: {
            id: "candice",
            name: "Candice Wu",
            email: "candice@untitledui.com",
            avatarUrl: "https://www.untitledui.com/images/avatars/candice-wu?fm=webp&q=80",
            initials: "CW",
        },
        purchase: "Monthly",
    },
    {
        id: "order-06",
        invoice: "INV-3061",
        date: new Date(2025, 0, 5).getTime(),
        status: "paid",
        customer: { id: "natali", name: "Natali Craig", email: "natali@untitledui.com", avatarUrl: "", initials: "NC" },
        purchase: "Monthly",
    },
    {
        id: "order-07",
        invoice: "INV-3060",
        date: new Date(2025, 0, 4).getTime(),
        status: "cancelled",
        customer: {
            id: "drew",
            name: "Drew Cano",
            email: "drew@untitledui.com",
            avatarUrl: "https://www.untitledui.com/images/avatars/drew-cano?fm=webp&q=80",
            initials: "DC",
        },
        purchase: "Monthly",
    },
];

export const Informational04 = () => {
    const [status, setStatus] = useState("paid");
    const [category, setCategory] = useState("all");
    const [customer, setCustomer] = useState("all");
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "invoice",
        direction: "descending",
    });

    const sortedItems = useMemo(() => {
        if (!sortDescriptor) return orders;

        return orders.toSorted((a, b) => {
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
            <main className="flex w-full flex-col gap-3 bg-secondary_subtle pt-8 pb-12 shadow-none lg:gap-8 lg:bg-primary lg:pt-12 lg:pb-24">
                <div className="mx-auto flex w-full max-w-container flex-col gap-5 px-4 lg:px-8">
                    {/* Page header simple */}
                    <div className="relative flex flex-col gap-4 border-b border-secondary pb-4">
                        <div className="max-lg:hidden">
                            <Breadcrumbs type="button">
                                <Breadcrumbs.Item href="#" icon={HomeLine} />
                                <Breadcrumbs.Item href="#">Dashboard</Breadcrumbs.Item>
                                <Breadcrumbs.Item href="#">Untitled UI</Breadcrumbs.Item>
                                <Breadcrumbs.Item href="#">Orders</Breadcrumbs.Item>
                            </Breadcrumbs>
                        </div>
                        <div className="flex lg:hidden">
                            <Button href="#" color="link-gray" size="md" iconLeading={ArrowLeft}>
                                Back
                            </Button>
                        </div>
                        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                            <div className="flex flex-col gap-0.5 md:gap-1">
                                <p className="text-xl font-semibold text-primary lg:text-display-xs">Orders</p>
                            </div>
                            <div className="flex flex-col gap-4 lg:flex-row">
                                <div className="flex items-start gap-3">
                                    <Button iconLeading={Download04} color="secondary" size="md">
                                        Download all
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mx-auto flex w-full max-w-container gap-16 lg:px-8">
                    <Tabs orientation="vertical" selectedKey="orders" className="w-auto max-lg:hidden">
                        <TabList size="sm" type="line" items={tabs} className="items-start" />
                    </Tabs>
                    <div className="mx-auto flex w-full max-w-container min-w-0 flex-1 flex-col px-4 lg:gap-6 lg:px-0">
                        <div className="hidden gap-x-3 rounded-xl bg-secondary p-5 ring-1 ring-secondary ring-inset lg:flex">
                            <Input
                                label="Search for order"
                                className="lg:max-w-90"
                                size="sm"
                                shortcut
                                aria-label="Search"
                                placeholder="Search"
                                icon={SearchLg}
                            />
                            <div className="flex flex-1 gap-x-3">
                                <Select
                                    className="flex-1"
                                    label="Status"
                                    selectedKey={status}
                                    placeholderIcon={<Dot className="size-2.5 shrink-0 text-fg-success-secondary in-disabled:text-fg-disabled_subtle" />}
                                    onSelectionChange={(value) => setStatus(value as string)}
                                    items={[
                                        {
                                            id: "all",
                                            label: "All",
                                            icon: <Dot className="size-2.5 shrink-0 text-fg-brand-secondary in-disabled:text-fg-disabled_subtle" />,
                                        },
                                        {
                                            id: "paid",
                                            label: "Paid",
                                            icon: <Dot className="size-2.5 shrink-0 text-fg-success-secondary in-disabled:text-fg-disabled_subtle" />,
                                        },
                                        {
                                            id: "refunded",
                                            label: "Refunded",
                                            icon: <Dot className="size-2.5 shrink-0 text-fg-quaternary in-disabled:text-fg-disabled_subtle" />,
                                        },
                                        {
                                            id: "cancelled",
                                            label: "Cancelled",
                                            icon: <Dot className="size-2.5 shrink-0 text-fg-error-secondary in-disabled:text-fg-disabled_subtle" />,
                                        },
                                    ]}
                                >
                                    {(item) => (
                                        <Select.Item id={item.id} icon={item.icon}>
                                            {item.label}
                                        </Select.Item>
                                    )}
                                </Select>
                                <Select
                                    className="flex-1"
                                    label="Category"
                                    selectedKey={category}
                                    onSelectionChange={(value) => setCategory(value as string)}
                                    items={[
                                        { id: "all", label: "All" },
                                        { id: "books", label: "Books" },
                                        { id: "tech", label: "Tech" },
                                        { id: "legal", label: "Legal" },
                                    ]}
                                >
                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                </Select>
                                <Select
                                    className="flex-1"
                                    label="Customer"
                                    selectedKey={customer}
                                    onSelectionChange={(value) => setCustomer(value as string)}
                                    items={[
                                        { id: "all", label: "All" },
                                        { id: "olivia", label: "Olivia Rhye" },
                                        { id: "phoenix", label: "Phoenix Baker" },
                                        { id: "lana", label: "Lana Steiner" },
                                        { id: "demi", label: "Demi Wilkinson" },
                                        { id: "candice", label: "Candice Wu" },
                                        { id: "natali", label: "Natali Craig" },
                                        { id: "drew", label: "Drew Cano" },
                                    ]}
                                >
                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                </Select>
                            </div>
                        </div>
                        <div className="mb-6 flex flex-col gap-4 lg:hidden">
                            <Input className="lg:max-w-90" size="sm" shortcut aria-label="Search" placeholder="Search" icon={SearchLg} />
                            <Button iconLeading={FilterFunnel01} color="secondary" size="md">
                                Filters
                            </Button>
                        </div>
                        <TableCard.Root className="-mx-4 rounded-none lg:mx-0 lg:rounded-xl">
                            <Table
                                aria-label="Orders"
                                selectionMode="multiple"
                                sortDescriptor={sortDescriptor}
                                onSortChange={setSortDescriptor}
                                className="bg-primary"
                            >
                                <Table.Header>
                                    <Table.Head id="invoice" isRowHeader allowsSorting label="Invoice" className="w-full" />
                                    <Table.Head id="date" label="Date" />
                                    <Table.Head id="status" label="Status" />
                                    <Table.Head id="customer" label="Customer" />
                                    <Table.Head id="purchase" label="Purchase" />
                                    <Table.Head id="actions" />
                                </Table.Header>
                                <Table.Body items={sortedItems}>
                                    {(order) => (
                                        <Table.Row id={order.id}>
                                            <Table.Cell className="text-sm font-medium whitespace-nowrap text-primary">{order.invoice}</Table.Cell>
                                            <Table.Cell className="whitespace-nowrap">{formatDate(order.date)}</Table.Cell>
                                            <Table.Cell>
                                                <BadgeWithIcon
                                                    color={
                                                        order.status === "paid"
                                                            ? "success"
                                                            : order.status === "refunded"
                                                              ? "gray"
                                                              : order.status === "cancelled"
                                                                ? "error"
                                                                : "gray"
                                                    }
                                                    iconLeading={
                                                        order.status === "paid"
                                                            ? Check
                                                            : order.status === "refunded"
                                                              ? ReverseLeft
                                                              : order.status === "cancelled"
                                                                ? X
                                                                : Check
                                                    }
                                                    size="sm"
                                                    type="pill-color"
                                                    className="capitalize"
                                                >
                                                    {order.status}
                                                </BadgeWithIcon>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <div className="group flex items-center gap-3 outline-hidden">
                                                    <Avatar
                                                        src={order.customer.avatarUrl}
                                                        alt={order.customer.name}
                                                        size="sm"
                                                        initials={order.customer.initials}
                                                    />
                                                    <div>
                                                        <p className="text-sm font-medium text-primary">{order.customer.name}</p>
                                                        <p className="text-sm text-tertiary">{order.customer.email}</p>
                                                    </div>
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell>{order.purchase}</Table.Cell>
                                            <Table.Cell>
                                                <div className="flex gap-3">
                                                    <Button size="sm" color="link-gray">
                                                        Delete
                                                    </Button>
                                                    <Button size="sm" color="link-color">
                                                        Edit
                                                    </Button>
                                                </div>
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table>
                        </TableCard.Root>
                        <PaginationPageDefault page={1} total={10} className="border-t-0 pt-6 lg:pt-0!" />
                    </div>
                </div>
            </main>
        </div>
    );
};
