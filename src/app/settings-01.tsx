"use client";

import { useState } from "react";
import {
    BarChartSquare02,
    CheckDone01,
    HomeLine,
    LayoutAlt01,
    Mail01,
    MessageChatCircle,
    PieChart03,
    Rows01,
    SearchLg,
    Settings01 as Settings01Icon,
    Users01,
} from "@untitledui/icons";
import { FeaturedCardProgressCircle } from "@/components/application/app-navigation/base-components/featured-cards";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import type { FileListItemProps } from "@/components/application/file-upload/file-upload-base";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { SectionFooter } from "@/components/application/section-footers/section-footer";
import { SectionHeader } from "@/components/application/section-headers/section-headers";
import { SectionLabel } from "@/components/application/section-headers/section-label";
import { TabList, Tabs } from "@/components/application/tabs/tabs";
import { Avatar } from "@/components/base/avatar/avatar";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { Input, InputBase, TextField } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { Select } from "@/components/base/select/select";
import { NativeSelect } from "@/components/base/select/select-native";
import { TextEditor } from "@/components/base/text-editor/text-editor";
import { countriesOptions } from "@/utils/countries";
import { timezonesOptionsWithLongName } from "@/utils/timezones";

const tabs = [
    { id: "details", label: "My details" },
    { id: "profile", label: "Profile" },
    { id: "password", label: "Password" },
    { id: "team", label: "Team" },
    { id: "plan", label: "Plan" },
    { id: "billing", label: "Billing" },
    { id: "email", label: "Email" },
    { id: "notifications", label: "Notifications", badge: 2 },
    { id: "integrations", label: "Integrations" },
    { id: "api", label: "API" },
];

const placeholderFiles: FileListItemProps[] = [
    {
        name: "Tech design requirements.pdf",
        type: "pdf",
        size: 200 * 1024,
        progress: 100,
    },
    {
        name: "Dashboard recording.mp4",
        type: "mp4",
        size: 1600 * 1024,
        progress: 40,
    },
    {
        name: "Dashboard prototype FINAL.fig",
        type: "fig",
        failed: false,
        size: 4200 * 1024,
        progress: 80,
    },
];

export const Settings01 = () => {
    const [selectedTab, setSelectedTab] = useState<string>("details");
    const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);

    const handleAvatarUpload = (file: File) => {
        console.log("File uploaded:", file);
        setUploadedAvatar(URL.createObjectURL(file));
    };

    return (
        <div className="flex flex-col bg-primary lg:flex-row">
            <SidebarNavigationSimple
                activeUrl="/settings"
                items={[
                    {
                        label: "Home",
                        href: "/",
                        icon: HomeLine,
                        items: [
                            { label: "Overview", href: "/overview" },
                            { label: "Products", href: "/products" },
                            { label: "Orders", href: "/orders" },
                            { label: "Customers", href: "/customers" },
                        ],
                    },
                    {
                        label: "Dashboard",
                        href: "/dashboard",
                        icon: BarChartSquare02,
                        items: [
                            { label: "Overview", href: "/dashboard/overview" },
                            { label: "Notifications", href: "/dashboard/notifications", badge: 10 },
                            { label: "Analytics", href: "/dashboard/analytics" },
                            { label: "Saved reports", href: "/dashboard/saved-reports" },
                        ],
                    },
                    {
                        label: "Projects",
                        href: "/projects",
                        icon: Rows01,
                        items: [
                            { label: "View all", href: "/projects/all" },
                            { label: "Personal", href: "/projects/personal" },
                            { label: "Team", href: "/projects/team" },
                            { label: "Shared with me", href: "/projects/shared-with-me" },
                            { label: "Archive", href: "/projects/archive" },
                        ],
                    },
                    {
                        label: "Tasks",
                        href: "/tasks",
                        icon: CheckDone01,
                        badge: 8,
                        items: [
                            { label: "My tasks", href: "/tasks/my-tasks" },
                            { label: "Assigned to me", href: "/tasks/assigned" },
                            { label: "Completed", href: "/tasks/completed" },
                            { label: "Upcoming", href: "/tasks/upcoming" },
                        ],
                    },
                    {
                        label: "Reporting",
                        href: "/reporting",
                        icon: PieChart03,
                        items: [
                            { label: "Dashboard", href: "/reporting/dashboard" },
                            { label: "Revenue", href: "/reporting/revenue" },
                            { label: "Performance", href: "/reporting/performance" },
                            { label: "Export data", href: "/reporting/export" },
                        ],
                    },
                    {
                        label: "Users",
                        href: "/users",
                        icon: Users01,
                        items: [
                            { label: "All users", href: "/users/all" },
                            { label: "Admins", href: "/users/admins" },
                            { label: "Team members", href: "/users/team" },
                            { label: "Permissions", href: "/users/permissions" },
                        ],
                    },
                ]}
                footerItems={[
                    {
                        label: "Settings",
                        href: "/settings",
                        icon: Settings01Icon,
                    },
                    {
                        label: "Support",
                        href: "/support",
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
                featureCard={
                    <FeaturedCardProgressCircle
                        title="Used space"
                        description="Your team has used 80% of your available space. Need more?"
                        confirmLabel="Upgrade plan"
                        progress={80}
                        className="hidden md:flex"
                        onDismiss={() => {}}
                        onConfirm={() => {}}
                    />
                }
            />

            <main className="min-w-0 flex-1 bg-primary pt-8 pb-12">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-5 px-4 lg:px-8">
                        {/* Page header simple with search */}
                        <div className="relative flex flex-col gap-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                                <div className="flex flex-col gap-0.5 lg:gap-1">
                                    <h1 className="text-xl font-semibold text-primary lg:text-display-xs">Settings</h1>
                                </div>
                                <div className="flex flex-col gap-4 lg:flex-row">
                                    <Input className="lg:w-80" size="sm" shortcut aria-label="Search" placeholder="Search" icon={SearchLg} />
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
                        <div className="-mx-4 -my-1 scrollbar-hide flex overflow-auto px-4 py-1 lg:-mx-8 lg:px-8">
                            <Tabs className="hidden md:flex xl:w-full" selectedKey={selectedTab} onSelectionChange={(value) => setSelectedTab(value as string)}>
                                <TabList type="button-minimal" className="w-full" items={tabs} />
                            </Tabs>
                        </div>
                    </div>
                    <Form
                        className="flex flex-col gap-6 px-4 lg:px-8"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const data = Object.fromEntries(new FormData(e.currentTarget));
                            console.log("Form data:", data);
                        }}
                    >
                        <SectionHeader.Root>
                            <SectionHeader.Group>
                                <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
                                    <SectionHeader.Heading>Personal info</SectionHeader.Heading>
                                    <SectionHeader.Subheading>Update your photo and personal details here.</SectionHeader.Subheading>
                                </div>

                                <SectionHeader.Actions>
                                    <Button color="secondary" size="md">
                                        Cancel
                                    </Button>
                                    <Button type="submit" color="primary" size="md">
                                        Save
                                    </Button>
                                </SectionHeader.Actions>
                            </SectionHeader.Group>
                        </SectionHeader.Root>

                        {/* Form content */}
                        <div className="flex flex-col gap-5">
                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root isRequired size="sm" title="Name" className="max-lg:hidden" />

                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
                                    <TextField isRequired name="firstName" defaultValue="Olivia">
                                        <Label className="lg:hidden">First name</Label>
                                        <InputBase size="md" />
                                    </TextField>
                                    <TextField isRequired name="lastName" defaultValue="Rhye">
                                        <Label className="lg:hidden">Last name</Label>
                                        <InputBase size="md" />
                                    </TextField>
                                </div>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root isRequired size="sm" title="Email address" className="max-lg:hidden" />

                                <TextField isRequired name="email" type="email" defaultValue="olivia@untitledui.com">
                                    <Label className="lg:hidden">Email address</Label>
                                    <InputBase size="md" icon={Mail01} />
                                </TextField>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root
                                    isRequired
                                    size="sm"
                                    title="Your photo"
                                    description="This will be displayed on your profile."
                                    tooltip="This is tooltip"
                                />
                                <div className="flex flex-col gap-5 lg:flex-row">
                                    <Avatar size="2xl" src={uploadedAvatar || "https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80"} />

                                    <FileUpload.DropZone className="w-full" onDropFiles={(files) => handleAvatarUpload(files[0])} />
                                </div>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root size="sm" title="Role" className="max-lg:hidden" />

                                <TextField name="role" defaultValue="Product Designer">
                                    <Label className="lg:hidden">Role</Label>
                                    <InputBase size="md" />
                                </TextField>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root size="sm" title="Country" className="max-lg:hidden" />

                                <Select name="country" label="Country" size="md" defaultSelectedKey="AU" className="lg:label:hidden" items={countriesOptions}>
                                    {(item) => (
                                        <Select.Item id={item.id} icon={item.icon}>
                                            {item.label}
                                        </Select.Item>
                                    )}
                                </Select>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root size="sm" title="Timezone" tooltip="This is tooltip" className="max-lg:hidden" />

                                <Select
                                    name="timezone"
                                    label="Timezone"
                                    size="md"
                                    tooltip="This is a tooltip"
                                    className="lg:label:hidden"
                                    defaultSelectedKey={timezonesOptionsWithLongName.find((item) => item.label?.includes("PST"))?.id}
                                    items={timezonesOptionsWithLongName}
                                >
                                    {(item) => (
                                        <Select.Item id={item.id} avatarUrl={item.avatarUrl} supportingText={item.supportingText} icon={item.icon}>
                                            {item.label}
                                        </Select.Item>
                                    )}
                                </Select>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root isRequired size="sm" title="Bio" description="Write a short introduction." />

                                <TextEditor.Root
                                    limit={400}
                                    className="gap-2"
                                    inputClassName="min-h-70 p-4 resize-y"
                                    content="I'm a Product Designer based in Melbourne, Australia. I specialize in UX/UI design, brand strategy, and Webflow development."
                                >
                                    <TextEditor.Toolbar floating type="simple" />

                                    <div className="flex flex-col gap-1.5">
                                        <TextEditor.Content />
                                        <TextEditor.HintText />
                                    </div>
                                </TextEditor.Root>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root size="sm" title="Portfolio projects" description="Share a few snippets of your work." />

                                <FileUpload.Root>
                                    <FileUpload.DropZone />

                                    <FileUpload.List>
                                        {placeholderFiles.map((file) => (
                                            <FileUpload.ListItemProgressBar key={file.name} {...file} size={file.size} />
                                        ))}
                                    </FileUpload.List>
                                </FileUpload.Root>
                            </div>
                        </div>

                        <SectionFooter.Root>
                            <SectionFooter.Actions>
                                <Button color="secondary" size="md">
                                    Cancel
                                </Button>
                                <Button type="submit" color="primary" size="md">
                                    Save
                                </Button>
                            </SectionFooter.Actions>
                        </SectionFooter.Root>
                    </Form>
                </div>
            </main>
        </div>
    );
};
