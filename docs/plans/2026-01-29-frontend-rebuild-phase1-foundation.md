# Frontend Rebuild Phase 1: Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish foundation components and patterns (SlideoutMenu, DataTable, Dialog, Command Palette, Breadcrumbs) that will be used throughout the entire frontend rebuild.

**Architecture:** Install and configure all Untitled UI PRO components, create reusable pattern components (SlideoutDetailView, DataTableWithFilters, BulkActionBar), and establish the base infrastructure (Command provider, Toast notifications, error boundaries).

**Tech Stack:**
- Next.js 14 (App Router)
- Untitled UI PRO components
- Tailwind CSS v4
- Convex React (useQuery, useMutation, useAction)
- Sonner (toast notifications)
- Motion (animations)

**Backend:** 100% preserved - using existing Convex API (see BACKEND_API_REFERENCE.md)

---

## Prerequisites

Before starting, verify:
- [ ] Backend copied to new project (see BACKEND_MIGRATION_CHECKLIST.md)
- [ ] `npx convex dev` running without errors
- [ ] All environment variables in `.env.local`
- [ ] Untitled UI PRO account logged in: `npx untitledui@latest login`

---

## Task 1: Install Untitled UI Components

**Files:**
- None (CLI installation)

**Step 1: Install Slideout component**

```bash
npx untitledui@latest add slideout -p components
```

Expected output: "✓ Successfully added slideout to components/"

**Step 2: Install Dialog component**

```bash
npx untitledui@latest add dialog -p components
```

Expected output: "✓ Successfully added dialog to components/"

**Step 3: Install Command component**

```bash
npx untitledui@latest add command -p components
```

Expected output: "✓ Successfully added command to components/"

**Step 4: Install EmptyState component**

```bash
npx untitledui@latest add empty-state -p components
```

Expected output: "✓ Successfully added empty-state to components/"

**Step 5: Install Breadcrumb component**

```bash
npx untitledui@latest add breadcrumb -p components
```

Expected output: "✓ Successfully added breadcrumb to components/"

**Step 6: Install DataTable component**

```bash
npx untitledui@latest add data-table -p components
```

Expected output: "✓ Successfully added data-table to components/"

**Step 7: Install DatePicker component**

```bash
npx untitledui@latest add date-picker -p components
```

Expected output: "✓ Successfully added date-picker to components/"

**Step 8: Install Combobox component**

```bash
npx untitledui@latest add combobox -p components
```

Expected output: "✓ Successfully added combobox to components/"

**Step 9: Verify all components installed**

```bash
ls -la src/components/application/ | grep -E "(slideout|dialog|command|data-table)"
ls -la src/components/base/ | grep -E "(empty-state|breadcrumb|date-picker|combobox)"
```

Expected: All component directories exist

**Step 10: Commit**

```bash
git add src/components/
git commit -m "feat: install Untitled UI foundation components

- Add Slideout, Dialog, Command for core interactions
- Add DataTable for all list views
- Add EmptyState, Breadcrumb for navigation
- Add DatePicker, Combobox for advanced filtering

Installed via Untitled UI CLI with -p components flag"
```

---

## Task 2: Setup Global Providers

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/providers/CommandProvider.tsx`
- Create: `src/providers/ToastProvider.tsx`

**Step 1: Create CommandProvider**

Create file: `src/providers/CommandProvider.tsx`

```typescript
"use client";

import { CommandPalette } from "@/components/application/command/command-palette";
import { useState } from "react";

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Listen for Cmd+K / Ctrl+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
```

**Step 2: Create ToastProvider**

Create file: `src/providers/ToastProvider.tsx`

```typescript
"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      expand={false}
      richColors
      closeButton
      duration={4000}
    />
  );
}
```

**Step 3: Add providers to root layout**

Modify: `src/app/layout.tsx`

Add imports:
```typescript
import { CommandProvider } from "@/providers/CommandProvider";
import { ToastProvider } from "@/providers/ToastProvider";
```

Wrap children:
```typescript
<ConvexClientProvider>
  <CommandProvider>
    {children}
    <ToastProvider />
  </CommandProvider>
</ConvexClientProvider>
```

**Step 4: Verify providers work**

Run: `npm run dev`

Open: `localhost:3000`

Test: Press Cmd+K (or Ctrl+K on Windows/Linux)

Expected: Command palette opens

**Step 5: Commit**

```bash
git add src/providers/ src/app/layout.tsx
git commit -m "feat: add global providers for Command and Toast

- CommandProvider: Cmd+K shortcut handler
- ToastProvider: Sonner toast notifications
- Wire into root layout

These providers enable keyboard-first navigation and user feedback"
```

---

## Task 3: Create Pattern Component - SlideoutDetailView

**Files:**
- Create: `src/components/patterns/SlideoutDetailView.tsx`
- Create: `src/components/patterns/index.ts`

**Step 1: Create SlideoutDetailView component**

Create file: `src/components/patterns/SlideoutDetailView.tsx`

```typescript
"use client";

import { Slideout } from "@/components/application/slideout/slideout";
import { Tabs } from "@/components/base/tabs/tabs";
import { Button } from "@/components/base/button/button";

export interface SlideoutTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface SlideoutDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  tabs: SlideoutTab[];
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  defaultTab?: string;
}

export function SlideoutDetailView({
  isOpen,
  onClose,
  title,
  tabs,
  actions,
  footer,
  defaultTab,
}: SlideoutDetailViewProps) {
  return (
    <Slideout open={isOpen} onOpenChange={onClose}>
      <Slideout.Content>
        <Slideout.Header>
          <Slideout.Title>{title}</Slideout.Title>
          {actions && <div className="flex gap-2">{actions}</div>}
        </Slideout.Header>

        <Slideout.Body>
          <Tabs defaultValue={defaultTab || tabs[0]?.id}>
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Trigger key={tab.id} value={tab.id}>
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {tabs.map((tab) => (
              <Tabs.Content key={tab.id} value={tab.id}>
                {tab.content}
              </Tabs.Content>
            ))}
          </Tabs>
        </Slideout.Body>

        {footer && (
          <Slideout.Footer>
            {footer}
          </Slideout.Footer>
        )}
      </Slideout.Content>
    </Slideout>
  );
}
```

**Step 2: Create barrel export**

Create file: `src/components/patterns/index.ts`

```typescript
export { SlideoutDetailView } from "./SlideoutDetailView";
export type { SlideoutDetailViewProps, SlideoutTab } from "./SlideoutDetailView";
```

**Step 3: Create test page to verify SlideoutDetailView**

Create file: `src/app/test-patterns/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { SlideoutDetailView } from "@/components/patterns";
import { Button } from "@/components/base/button/button";

export default function TestPatternsPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Pattern Components Test</h1>

      <Button onClick={() => setIsOpen(true)}>
        Open SlideoutDetailView
      </Button>

      <SlideoutDetailView
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Test Project"
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: <div className="p-4">Overview content here</div>,
          },
          {
            id: "settings",
            label: "Settings",
            content: <div className="p-4">Settings content here</div>,
          },
        ]}
        actions={
          <>
            <Button variant="secondary" size="sm">Edit</Button>
            <Button variant="destructive" size="sm">Delete</Button>
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button>Save</Button>
          </>
        }
      />
    </div>
  );
}
```

**Step 4: Test SlideoutDetailView**

Run: `npm run dev`

Open: `localhost:3000/test-patterns`

Test:
- Click "Open SlideoutDetailView" → Slideout opens from right
- Switch between tabs → Content changes
- Click actions → Buttons work
- Click footer buttons → Slideout closes

Expected: All interactions work smoothly

**Step 5: Commit**

```bash
git add src/components/patterns/ src/app/test-patterns/
git commit -m "feat: add SlideoutDetailView pattern component

- Reusable slideout with tabs support
- Header with title + actions
- Footer with custom buttons
- Mobile responsive (full-screen on small screens)

This pattern will be used for all detail views (projects, domains, keywords)"
```

---

## Task 4: Create Pattern Component - DataTableWithFilters

**Files:**
- Create: `src/components/patterns/DataTableWithFilters.tsx`
- Modify: `src/components/patterns/index.ts`

**Step 1: Create DataTableWithFilters component**

Create file: `src/components/patterns/DataTableWithFilters.tsx`

```typescript
"use client";

import { useState, useMemo } from "react";
import { DataTable } from "@/components/application/data-table/data-table";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/button/button";
import { BulkActionBar } from "./BulkActionBar";

export interface Column<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (selectedIds: Set<string>) => void | Promise<void>;
  variant?: "default" | "destructive";
}

export interface DataTableWithFiltersProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  bulkActions?: BulkAction[];
  emptyState?: React.ReactNode;
}

export function DataTableWithFilters<T extends { _id: string }>({
  data,
  columns,
  onRowClick,
  searchPlaceholder = "Search...",
  searchKeys,
  bulkActions,
  emptyState,
}: DataTableWithFiltersProps<T>) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!search || !searchKeys) return data;

    const lowerSearch = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((key) => {
        const value = row[key];
        return String(value).toLowerCase().includes(lowerSearch);
      })
    );
  }, [data, search, searchKeys]);

  // Handle row selection
  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map((row) => row._id)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      {searchKeys && (
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}

      {/* Bulk action bar */}
      {bulkActions && selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          actions={bulkActions}
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {/* Data table */}
      <DataTable
        data={filteredData}
        columns={columns}
        onRowClick={onRowClick}
        selectable={!!bulkActions}
        selectedIds={selectedIds}
        onSelectRow={handleSelectRow}
        onSelectAll={handleSelectAll}
        emptyState={emptyState}
      />
    </div>
  );
}
```

**Step 2: Create BulkActionBar component**

Create file: `src/components/patterns/BulkActionBar.tsx`

```typescript
"use client";

import { Button } from "@/components/base/button/button";
import { X } from "@untitledui/icons";

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (selectedIds: Set<string>) => void | Promise<void>;
  variant?: "default" | "destructive";
}

export interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  selectedIds: Set<string>;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  actions,
  selectedIds,
  onClearSelection,
}: BulkActionBarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">
          {selectedCount} selected
        </span>

        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              size="sm"
              variant={action.variant || "secondary"}
              onClick={() => action.onClick(selectedIds)}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={onClearSelection}
        icon={<X />}
      >
        Clear
      </Button>
    </div>
  );
}
```

**Step 3: Update barrel export**

Modify: `src/components/patterns/index.ts`

```typescript
export { SlideoutDetailView } from "./SlideoutDetailView";
export type { SlideoutDetailViewProps, SlideoutTab } from "./SlideoutDetailView";

export { DataTableWithFilters } from "./DataTableWithFilters";
export type { Column, BulkAction, DataTableWithFiltersProps } from "./DataTableWithFilters";

export { BulkActionBar } from "./BulkActionBar";
export type { BulkActionBarProps } from "./BulkActionBar";
```

**Step 4: Add test to test-patterns page**

Modify: `src/app/test-patterns/page.tsx`

Add test data:
```typescript
const mockProjects = [
  { _id: "1", name: "Project Alpha", domainCount: 5, keywordCount: 120 },
  { _id: "2", name: "Project Beta", domainCount: 3, keywordCount: 85 },
  { _id: "3", name: "Project Gamma", domainCount: 8, keywordCount: 240 },
];
```

Add DataTableWithFilters test:
```typescript
<DataTableWithFilters
  data={mockProjects}
  columns={[
    { id: "name", header: "Name", accessorKey: "name", sortable: true },
    { id: "domains", header: "Domains", accessorKey: "domainCount" },
    { id: "keywords", header: "Keywords", accessorKey: "keywordCount" },
  ]}
  searchKeys={["name"]}
  searchPlaceholder="Search projects..."
  bulkActions={[
    {
      label: "Delete",
      variant: "destructive",
      onClick: (ids) => console.log("Delete", Array.from(ids)),
    },
  ]}
  onRowClick={(row) => console.log("Clicked", row)}
/>
```

**Step 5: Test DataTableWithFilters**

Run: `npm run dev`

Open: `localhost:3000/test-patterns`

Test:
- Search → Filters rows
- Select rows → Bulk action bar appears
- Click "Delete" → Console logs selected IDs
- Click row → Console logs row data
- Clear selection → Bulk bar disappears

Expected: All features work

**Step 6: Commit**

```bash
git add src/components/patterns/
git commit -m "feat: add DataTableWithFilters pattern component

- Reusable data table with search filtering
- Row selection (multi-select)
- Bulk action bar with custom actions
- Click handler for row details

This pattern will be used for all list views (projects, domains, keywords)"
```

---

## Task 5: Create BreadcrumbNav Component

**Files:**
- Create: `src/components/shared/BreadcrumbNav.tsx`
- Create: `src/components/shared/index.ts`

**Step 1: Create BreadcrumbNav component**

Create file: `src/components/shared/BreadcrumbNav.tsx`

```typescript
"use client";

import { Breadcrumb } from "@/components/base/breadcrumb/breadcrumb";
import Link from "next/link";
import { Home } from "@untitledui/icons";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbNav({ items }: BreadcrumbNavProps) {
  return (
    <Breadcrumb>
      <Breadcrumb.Item>
        <Link href="/dashboard">
          <Home className="h-4 w-4" />
        </Link>
      </Breadcrumb.Item>

      {items.map((item, index) => (
        <Breadcrumb.Item key={index}>
          {item.href && index < items.length - 1 ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span>{item.label}</span>
          )}
        </Breadcrumb.Item>
      ))}
    </Breadcrumb>
  );
}
```

**Step 2: Create barrel export**

Create file: `src/components/shared/index.ts`

```typescript
export { BreadcrumbNav } from "./BreadcrumbNav";
export type { BreadcrumbNavProps, BreadcrumbItem } from "./BreadcrumbNav";
```

**Step 3: Add test to test-patterns page**

Modify: `src/app/test-patterns/page.tsx`

Add import:
```typescript
import { BreadcrumbNav } from "@/components/shared";
```

Add at top of page:
```typescript
<BreadcrumbNav
  items={[
    { label: "Projects", href: "/projects" },
    { label: "Project Alpha", href: "/projects/123" },
    { label: "Domain Details" },
  ]}
/>
```

**Step 4: Test BreadcrumbNav**

Run: `npm run dev`

Open: `localhost:3000/test-patterns`

Test:
- See breadcrumbs: Home > Projects > Project Alpha > Domain Details
- Click "Home" → Should navigate (or show href)
- Click "Projects" → Should navigate
- "Domain Details" is not clickable (current page)

Expected: Navigation works, styling correct

**Step 5: Commit**

```bash
git add src/components/shared/
git commit -m "feat: add BreadcrumbNav component

- Dynamic breadcrumb with home icon
- Clickable ancestors, non-clickable current
- Responsive (collapses on mobile)

This will be added to all views for navigation context"
```

---

## Task 6: Create LoadingState Component

**Files:**
- Create: `src/components/shared/LoadingState.tsx`
- Modify: `src/components/shared/index.ts`

**Step 1: Create LoadingState component**

Create file: `src/components/shared/LoadingState.tsx`

```typescript
"use client";

import { Skeleton } from "@/components/base/skeleton/skeleton";

export interface LoadingStateProps {
  type?: "table" | "card" | "list";
  rows?: number;
}

export function LoadingState({ type = "table", rows = 5 }: LoadingStateProps) {
  if (type === "table") {
    return (
      <div className="space-y-3">
        {/* Table header */}
        <Skeleton className="h-10 w-full" />

        {/* Table rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (type === "card") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // List type
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
```

**Step 2: Update barrel export**

Modify: `src/components/shared/index.ts`

```typescript
export { BreadcrumbNav } from "./BreadcrumbNav";
export type { BreadcrumbNavProps, BreadcrumbItem } from "./BreadcrumbNav";

export { LoadingState } from "./LoadingState";
export type { LoadingStateProps } from "./LoadingState";
```

**Step 3: Test LoadingState**

Add to test-patterns page:

```typescript
<div className="space-y-8">
  <div>
    <h2 className="text-lg font-semibold mb-4">Table Loading State</h2>
    <LoadingState type="table" rows={5} />
  </div>

  <div>
    <h2 className="text-lg font-semibold mb-4">Card Loading State</h2>
    <LoadingState type="card" rows={6} />
  </div>

  <div>
    <h2 className="text-lg font-semibold mb-4">List Loading State</h2>
    <LoadingState type="list" rows={4} />
  </div>
</div>
```

**Step 4: Verify LoadingState**

Run: `npm run dev`

Open: `localhost:3000/test-patterns`

Expected: See animated skeleton loaders for table, cards, and list

**Step 5: Commit**

```bash
git add src/components/shared/
git commit -m "feat: add LoadingState component

- Skeleton loaders for table, card, list types
- Configurable row count
- Shimmer animation effect

This will be used while data loads from Convex queries"
```

---

## Task 7: Update Root Layout with Error Boundary

**Files:**
- Create: `src/app/error.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create error boundary**

Create file: `src/app/error.tsx`

```typescript
"use client";

import { useEffect } from "react";
import { Button } from "@/components/base/button/button";
import { AlertCircle } from "@untitledui/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (could send to logging service)
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>

        <h2 className="mb-2 text-2xl font-bold text-gray-900">
          Something went wrong
        </h2>

        <p className="mb-6 text-gray-600">
          {error.message || "An unexpected error occurred"}
        </p>

        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
```

**Step 2: Verify error boundary**

Test by adding to any page:
```typescript
// Temporarily add to test throwing error
throw new Error("Test error boundary");
```

Expected: See error UI with "Try again" button

**Step 3: Remove test error and commit**

```bash
git add src/app/error.tsx
git commit -m "feat: add global error boundary

- Catches unhandled errors in app
- Shows user-friendly error message
- Provides retry button
- Logs errors to console

This prevents white screen of death"
```

---

## Task 8: Create CommandPalette Implementation

**Files:**
- Create: `src/components/application/command/command-palette.tsx`

**Step 1: Create CommandPalette component**

Create file: `src/components/application/command/command-palette.tsx`

```typescript
"use client";

import { Command } from "@/components/application/command/command";
import { useRouter } from "next/navigation";
import {
  Folder,
  Globe,
  Search,
  Settings,
  Users
} from "@untitledui/icons";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  const navigate = (path: string) => {
    router.push(path);
    onOpenChange(false);
  };

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange}>
      <Command.Input placeholder="Search or jump to..." />

      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        <Command.Group heading="Navigation">
          <Command.Item onSelect={() => navigate("/dashboard")}>
            <Search className="mr-2 h-4 w-4" />
            Dashboard
          </Command.Item>

          <Command.Item onSelect={() => navigate("/projects")}>
            <Folder className="mr-2 h-4 w-4" />
            Projects
          </Command.Item>

          <Command.Item onSelect={() => navigate("/teams")}>
            <Users className="mr-2 h-4 w-4" />
            Teams
          </Command.Item>

          <Command.Item onSelect={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Command.Item>
        </Command.Group>

        <Command.Separator />

        <Command.Group heading="Quick Actions">
          <Command.Item>
            <Folder className="mr-2 h-4 w-4" />
            Create Project
          </Command.Item>

          <Command.Item>
            <Globe className="mr-2 h-4 w-4" />
            Add Domain
          </Command.Item>

          <Command.Item>
            <Search className="mr-2 h-4 w-4" />
            Add Keywords
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

**Step 2: Test CommandPalette**

Run: `npm run dev`

Open: `localhost:3000`

Test: Press Cmd+K (or Ctrl+K)

Expected:
- Command palette opens
- Can search/filter items
- Can navigate to pages
- Esc closes palette

**Step 3: Commit**

```bash
git add src/components/application/command/
git commit -m "feat: implement CommandPalette with navigation

- Cmd+K / Ctrl+K keyboard shortcut
- Navigation commands (Dashboard, Projects, Teams, Settings)
- Quick action commands (Create Project, Add Domain, etc.)
- Fuzzy search filtering

This enables keyboard-first navigation throughout app"
```

---

## Task 9: Remove Custom Modal Component

**Files:**
- Delete: `src/components/base/modal/` (if exists)
- Modify: Any files using custom Modal → replace with Dialog

**Step 1: Find custom Modal usages**

```bash
grep -r "from.*modal" src/app/ src/components/ || echo "No custom modal found"
```

**Step 2: If custom Modal exists, replace with Dialog**

Example replacement:
```typescript
// Before (custom Modal)
import { Modal } from "@/components/base/modal/modal";

<Modal isOpen={open} onClose={() => setOpen(false)}>
  <Modal.Header>Title</Modal.Header>
  <Modal.Body>Content</Modal.Body>
</Modal>

// After (Untitled UI Dialog)
import { Dialog } from "@/components/base/dialog/dialog";

<Dialog open={open} onOpenChange={setOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Title</Dialog.Title>
    </Dialog.Header>
    <Dialog.Body>Content</Dialog.Body>
  </Dialog.Content>
</Dialog>
```

**Step 3: Delete custom Modal if exists**

```bash
rm -rf src/components/base/modal/
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: replace custom Modal with Untitled UI Dialog

- Remove custom Modal implementation
- Replace all usages with Dialog component
- Consistent modal UX across app
- Better accessibility with Dialog

This unifies the design system"
```

---

## Task 10: Document Foundation Components

**Files:**
- Create: `docs/components/FOUNDATION.md`

**Step 1: Create foundation components documentation**

Create file: `docs/components/FOUNDATION.md`

```markdown
# Foundation Components

## Overview

Foundation components are the building blocks used throughout the frontend rebuild.

## Installed Components

### Untitled UI PRO Components

- **Slideout** - Side panel for detail views
- **Dialog** - Modal dialogs for forms and confirmations
- **Command** - Command palette (Cmd+K)
- **DataTable** - Advanced tables with sorting/filtering
- **EmptyState** - Empty state placeholders
- **Breadcrumb** - Navigation breadcrumbs
- **DatePicker** - Date selection
- **Combobox** - Searchable dropdowns

### Pattern Components

#### SlideoutDetailView
- **Path:** `src/components/patterns/SlideoutDetailView.tsx`
- **Purpose:** Reusable slideout with tabs for detail views
- **Usage:**
  ```typescript
  <SlideoutDetailView
    isOpen={isOpen}
    onClose={() => setIsOpen(false)}
    title="Project Details"
    tabs={[
      { id: "overview", label: "Overview", content: <OverviewTab /> },
      { id: "settings", label: "Settings", content: <SettingsTab /> },
    ]}
  />
  ```

#### DataTableWithFilters
- **Path:** `src/components/patterns/DataTableWithFilters.tsx`
- **Purpose:** Data table with search, bulk actions, row selection
- **Usage:**
  ```typescript
  <DataTableWithFilters
    data={projects}
    columns={projectColumns}
    searchKeys={["name"]}
    bulkActions={[
      { label: "Delete", variant: "destructive", onClick: handleDelete },
    ]}
    onRowClick={handleRowClick}
  />
  ```

#### BulkActionBar
- **Path:** `src/components/patterns/BulkActionBar.tsx`
- **Purpose:** Action bar shown when rows selected
- **Used by:** DataTableWithFilters

### Shared Components

#### BreadcrumbNav
- **Path:** `src/components/shared/BreadcrumbNav.tsx`
- **Purpose:** Dynamic breadcrumbs for navigation
- **Usage:**
  ```typescript
  <BreadcrumbNav
    items={[
      { label: "Projects", href: "/projects" },
      { label: "Project Name" },
    ]}
  />
  ```

#### LoadingState
- **Path:** `src/components/shared/LoadingState.tsx`
- **Purpose:** Skeleton loaders for loading states
- **Usage:**
  ```typescript
  {!data ? <LoadingState type="table" rows={5} /> : <DataTable data={data} />}
  ```

### Providers

#### CommandProvider
- **Path:** `src/providers/CommandProvider.tsx`
- **Purpose:** Global Cmd+K shortcut handler
- **Wired in:** Root layout

#### ToastProvider
- **Path:** `src/providers/ToastProvider.tsx`
- **Purpose:** Sonner toast notifications
- **Usage:**
  ```typescript
  import { toast } from "sonner";
  toast.success("Project created");
  toast.error("Failed to save");
  ```

## Next Steps

These foundation components will be used to build:
- Projects view (Phase 2)
- Domains view (Phase 2)
- Keywords view (Phase 2)
- Dashboard (Phase 2)
- Admin panel (Phase 4)
```

**Step 2: Commit documentation**

```bash
git add docs/components/
git commit -m "docs: add foundation components reference

Complete documentation of all foundation components:
- Untitled UI components installed
- Pattern components (SlideoutDetailView, DataTableWithFilters)
- Shared components (BreadcrumbNav, LoadingState)
- Providers (Command, Toast)

This serves as reference for Phase 2 implementation"
```

---

## Verification Checklist

After completing Phase 1, verify:

- [ ] All Untitled UI components installed (8 components)
- [ ] CommandProvider working (Cmd+K opens palette)
- [ ] ToastProvider working (can show notifications)
- [ ] SlideoutDetailView works (test page)
- [ ] DataTableWithFilters works (test page with search, bulk actions)
- [ ] BreadcrumbNav renders correctly
- [ ] LoadingState shows skeleton loaders
- [ ] Error boundary catches errors
- [ ] CommandPalette navigates to pages
- [ ] No custom Modal component (replaced with Dialog)
- [ ] Foundation documentation complete

**Test Command:**
```bash
npm run dev
# Visit localhost:3000/test-patterns
# Test all pattern components
# Press Cmd+K to test command palette
```

**Build Command:**
```bash
npm run build
# Should complete without errors
```

---

## Success Criteria

✅ **Phase 1 Complete When:**

1. All foundation components installed and verified
2. Pattern components (SlideoutDetailView, DataTableWithFilters) working
3. Global providers (Command, Toast) active
4. Test page demonstrates all patterns
5. Documentation complete
6. Build succeeds
7. No console errors in dev mode

---

## Next Phase

After Phase 1 completion, proceed to:

**Phase 2: Core Views** - Implement Projects, Domains, Keywords views using foundation components

See: `docs/plans/2026-01-29-frontend-rebuild-phase2-core-views.md`

---

**Plan Created:** 2026-01-29
**Session:** S0049
**Estimated Time:** 1-2 days
