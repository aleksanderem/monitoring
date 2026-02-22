"use client";

import { useMemo, useState } from "react";
import { Check, DownloadCloud02, Mail01, Plus, Zap } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { HeaderNavigationBase } from "@/components/application/app-navigation/header-navigation";
import { SectionHeader } from "@/components/application/section-headers/section-headers";
import { SectionLabel } from "@/components/application/section-headers/section-label";
import { Table, TableCard } from "@/components/application/table/table";
import { Avatar } from "@/components/base/avatar/avatar";
import { BadgeWithIcon } from "@/components/base/badges/badges";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { InputBase, TextField } from "@/components/base/input/input";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
import * as RadioGroups from "@/components/base/radio-groups/radio-groups";
import { NativeSelect } from "@/components/base/select/select-native";
import { MastercardIcon, VisaIcon } from "@/components/foundations/payment-icons";

// Helper functions for formatting
const formatCurrency = (amount: number): string => `USD ${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}`;

const formatDate = (timestamp: number): string =>
    new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const formatInvoice = (planName: string, billingPeriod: number): string => {
    const date = new Date(billingPeriod);
    const monthYear = date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
    });
    return `${planName} – ${monthYear}`;
};

const tabs = [
    { id: "details", label: "My details" },
    { id: "profile", label: "Profile" },
    { id: "password", label: "Password" },
    { id: "team", label: "Team" },
    { id: "plan", label: "Plan" },
    { id: "billing", label: "Billing" },
    { id: "notifications", label: "Notifications" },
    { id: "integrations", label: "Integrations" },
    { id: "api", label: "API" },
];

const invoices = [
    {
        id: "invoice-01",
        invoice: 7,
        billingPeriod: new Date(2025, 11, 1).getTime(),
        plan: "Basic plan",
        amount: 10.0,
        date: new Date(2025, 11, 1).getTime(),
        status: "Paid",
    },
    {
        id: "invoice-02",
        invoice: 6,
        billingPeriod: new Date(2025, 10, 1).getTime(),
        plan: "Basic plan",
        amount: 10.0,
        date: new Date(2025, 10, 1).getTime(),
        status: "Paid",
    },
    {
        id: "invoice-03",
        invoice: 5,
        billingPeriod: new Date(2025, 9, 1).getTime(),
        plan: "Basic plan",
        amount: 10.0,
        date: new Date(2025, 9, 1).getTime(),
        status: "Paid",
    },
    {
        id: "invoice-04",
        invoice: 4,
        billingPeriod: new Date(2025, 8, 1).getTime(),
        plan: "Basic plan",
        amount: 10.0,
        date: new Date(2025, 8, 1).getTime(),
        status: "Paid",
    },
    {
        id: "invoice-05",
        invoice: 3,
        billingPeriod: new Date(2025, 7, 1).getTime(),
        plan: "Basic plan",
        amount: 10.0,
        date: new Date(2025, 7, 1).getTime(),
        status: "Paid",
    },
    {
        id: "invoice-06",
        invoice: 2,
        billingPeriod: new Date(2025, 6, 1).getTime(),
        plan: "Basic plan",
        amount: 10.0,
        date: new Date(2025, 6, 1).getTime(),
        status: "Paid",
    },
    {
        id: "invoice-07",
        invoice: 1,
        billingPeriod: new Date(2025, 5, 1).getTime(),
        plan: "Basic plan",
        amount: 10.0,
        date: new Date(2025, 5, 1).getTime(),
        status: "Paid",
    },
];

const paymentCards = [
    {
        value: "card-01",
        title: "Visa ending in 1234",
        description: "Expiry 06/2025",
        logo: <VisaIcon className="h-8 w-11.5" />,
    },
    {
        value: "card-02",
        title: "Mastercard ending in 1234",
        description: "Expiry 06/2025",
        logo: <MastercardIcon className="h-8 w-11.5" />,
    },
];

export const Settings15 = () => {
    const [selectedTab, setSelectedTab] = useState<string>("billing");

    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "billingPeriod",
        direction: "descending",
    });

    const sortedItems = useMemo(() => {
        return invoices.toSorted((a, b) => {
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
        <div className="bg-primary">
            <HeaderNavigationBase
                activeUrl="/settings-01"
                items={[
                    { label: "Home", href: "/" },
                    {
                        label: "Dashboard",
                        href: "/dashboard",
                        items: [
                            { label: "My details", href: "#" },
                            { label: "Profile", href: "#", current: true },
                            { label: "Password", href: "#" },
                            { label: "Team", href: "#" },
                            { label: "Billing", href: "#" },
                            { label: "Notifications", href: "#" },
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

            <main className="bg-primary pt-8 pb-12 lg:pt-12 lg:pb-24">
                <div className="flex flex-col gap-8">
                    <div className="mx-auto flex w-full max-w-container flex-col gap-5 px-4 lg:px-8">
                        {/* Page header simple with search */}
                        <div className="relative flex flex-col gap-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                                <div className="flex flex-col gap-0.5 lg:gap-1">
                                    <h1 className="text-xl font-semibold text-primary lg:text-display-xs">Settings</h1>
                                    <p className="text-md text-tertiary">Manage your team and preferences here.</p>
                                </div>
                            </div>
                        </div>

                        <NativeSelect
                            aria-label="Page tabs"
                            className="md:hidden"
                            value={selectedTab}
                            onChange={(event) => setSelectedTab(event.target.value)}
                            options={tabs.map((tab) => ({ label: tab.label, value: tab.id }))}
                        />
                        <ButtonGroup className="hidden md:flex">
                            {tabs.map((tab) => (
                                <ButtonGroupItem key={tab.id} isSelected={tab.id === selectedTab} onClick={() => setSelectedTab(tab.id)}>
                                    {tab.label}
                                </ButtonGroupItem>
                            ))}
                        </ButtonGroup>
                    </div>

                    <div className="mx-auto flex w-full max-w-container flex-col gap-6 px-4 lg:px-8">
                        <SectionHeader.Root>
                            <SectionHeader.Group>
                                <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
                                    <SectionHeader.Heading>Payment method</SectionHeader.Heading>
                                    <SectionHeader.Subheading>Update your billing details and address.</SectionHeader.Subheading>
                                </div>
                            </SectionHeader.Group>
                        </SectionHeader.Root>

                        <div className="flex flex-col gap-5">
                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_minmax(480px,512px)] lg:gap-8">
                                <SectionLabel.Root size="sm" title="Contact email" description="Where should invoices be sent?" />

                                <div className="flex flex-col gap-3">
                                    <RadioGroup aria-label="Contact email" defaultValue="custom" className="gap-4">
                                        <RadioButton value="default" label="Send to my account email" hint="olivia@untitledui.com" />
                                        <RadioButton value="custom" label="Send to an alternative email" />
                                    </RadioGroup>
                                    <div className="pl-6">
                                        <TextField isRequired aria-label="Email address" name="email" type="email" defaultValue="billing@untitledui.com">
                                            <InputBase icon={Mail01} size="md" />
                                        </TextField>
                                    </div>
                                </div>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_minmax(480px,512px)] lg:gap-8">
                                <SectionLabel.Root isRequired size="sm" title="Card details" description="Select default payment method." />

                                <div className="flex flex-col gap-4">
                                    <RadioGroups.PaymentIcon aria-label="Payment options" defaultValue="card-01" items={paymentCards} />

                                    <div className="flex gap-3">
                                        <Button color="link-gray" size="md" iconLeading={Plus}>
                                            Add new payment method
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto flex w-full max-w-container flex-col gap-6 px-4 lg:px-8">
                        <SectionHeader.Root className="border-none pb-0">
                            <SectionHeader.Group>
                                <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
                                    <SectionHeader.Heading>Billing history</SectionHeader.Heading>
                                </div>
                                <SectionHeader.Actions>
                                    <Button color="secondary" size="md" iconLeading={DownloadCloud02}>
                                        Download all
                                    </Button>
                                </SectionHeader.Actions>
                            </SectionHeader.Group>
                        </SectionHeader.Root>

                        <TableCard.Root className="-mx-4 rounded-none bg-transparent shadow-none ring-0 lg:mx-0 lg:rounded-xl lg:bg-primary lg:shadow-xs lg:ring-1">
                            <Table
                                aria-label="Invoices"
                                selectionMode="multiple"
                                sortDescriptor={sortDescriptor}
                                onSortChange={setSortDescriptor}
                                className="bg-primary"
                            >
                                <Table.Header>
                                    <Table.Head id="billingPeriod" isRowHeader label="Invoice" allowsSorting className="w-full" />
                                    <Table.Head id="amount" label="Amount" />
                                    <Table.Head id="date" label="Date" />
                                    <Table.Head id="status" label="Status" />
                                    <Table.Head id="users" label="Users on plan" />
                                    <Table.Head id="actions" />
                                </Table.Header>
                                <Table.Body items={sortedItems}>
                                    {(invoice) => (
                                        <Table.Row id={invoice.id}>
                                            <Table.Cell className="font-semibold! text-nowrap">{formatInvoice(invoice.plan, invoice.billingPeriod)}</Table.Cell>
                                            <Table.Cell className="text-nowrap">{formatCurrency(invoice.amount)}</Table.Cell>
                                            <Table.Cell className="text-nowrap">{formatDate(invoice.date)}</Table.Cell>
                                            <Table.Cell>
                                                <BadgeWithIcon
                                                    iconLeading={Check}
                                                    color={invoice.status === "Paid" ? "success" : invoice.status === "Failed" ? "error" : "gray"}
                                                    type="modern"
                                                    size="sm"
                                                >
                                                    {invoice.status}
                                                </BadgeWithIcon>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <div className="flex -space-x-1">
                                                    <Avatar
                                                        className="ring-[1.5px] ring-bg-primary"
                                                        size="xs"
                                                        src="https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80"
                                                        alt="Olivia Rhye"
                                                    />
                                                    <Avatar
                                                        className="ring-[1.5px] ring-bg-primary"
                                                        size="xs"
                                                        src="https://www.untitledui.com/images/avatars/phoenix-baker?fm=webp&q=80"
                                                        alt="Phoenix Baker"
                                                    />
                                                    <Avatar
                                                        className="ring-[1.5px] ring-bg-primary"
                                                        size="xs"
                                                        src="https://www.untitledui.com/images/avatars/lana-steiner?fm=webp&q=80"
                                                        alt="Lana Steiner"
                                                    />
                                                    <Avatar
                                                        className="ring-[1.5px] ring-bg-primary"
                                                        size="xs"
                                                        src="https://www.untitledui.com/images/avatars/demi-wilkinson?fm=webp&q=80"
                                                        alt="Demi Wilkinson"
                                                    />
                                                    <Avatar
                                                        className="ring-[1.5px] ring-bg-primary"
                                                        size="xs"
                                                        src="https://www.untitledui.com/images/avatars/candice-wu?fm=webp&q=80"
                                                        alt="Candice Wu"
                                                    />
                                                    <Avatar
                                                        size="xs"
                                                        className="ring-[1.5px] ring-bg-primary"
                                                        placeholder={<span className="text-xs font-semibold text-quaternary">+5</span>}
                                                    />
                                                </div>
                                            </Table.Cell>

                                            <Table.Cell className="px-4">
                                                <div className="flex justify-end gap-0.5">
                                                    <ButtonUtility size="xs" color="tertiary" tooltip="Download" icon={DownloadCloud02} />
                                                </div>
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table>
                        </TableCard.Root>
                    </div>
                </div>
            </main>
        </div>
    );
};
