# Foundation Components

## Overview

Foundation components are the building blocks used throughout the frontend rebuild. Phase 1 established these components for use in all subsequent phases.

## Installed Components

### Untitled UI PRO Components

All components are pre-installed in the project:

- **Slideout** (`application/slideout-menus/`) - Side panel for detail views
- **Modal/Dialog** (`application/modals/`) - Modal dialogs for forms and confirmations
- **Command** (`application/command-menus/`) - Command palette (Cmd+K)
- **Table** (`application/table/`) - Advanced tables with sorting/filtering
- **Empty State** (`application/empty-state/`) - Empty state placeholders
- **Breadcrumbs** (`application/breadcrumbs/`) - Navigation breadcrumbs
- **DatePicker** (`application/date-picker/`) - Date selection
- **Tabs** (`application/tabs/`) - Tab navigation

### Pattern Components

Located in `src/components/patterns/`

#### SlideoutDetailView
- **Path:** `src/components/patterns/SlideoutDetailView.tsx`
- **Purpose:** Reusable slideout with tabs for detail views
- **Usage:**
  ```typescript
  import { SlideoutDetailView } from "@/components/patterns";

  <SlideoutDetailView
    isOpen={isOpen}
    onClose={() => setIsOpen(false)}
    title="Project Details"
    tabs={[
      { id: "overview", label: "Overview", content: <OverviewTab /> },
      { id: "settings", label: "Settings", content: <SettingsTab /> },
    ]}
    actions={<Button>Edit</Button>}
    footer={<Button>Save</Button>}
  />
  ```

#### DataTableWithFilters
- **Path:** `src/components/patterns/DataTableWithFilters.tsx`
- **Purpose:** Data table with search, bulk actions, row selection
- **Usage:**
  ```typescript
  import { DataTableWithFilters } from "@/components/patterns";

  <DataTableWithFilters
    data={projects}
    columns={[
      { id: "name", header: "Name", accessorKey: "name" },
      { id: "count", header: "Count", accessorKey: "count" },
    ]}
    searchKeys={["name"]}
    searchPlaceholder="Search..."
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
- **Auto-displays:** When items are selected in DataTableWithFilters

### Shared Components

Located in `src/components/shared/`

#### BreadcrumbNav
- **Path:** `src/components/shared/BreadcrumbNav.tsx`
- **Purpose:** Dynamic breadcrumbs for navigation
- **Usage:**
  ```typescript
  import { BreadcrumbNav } from "@/components/shared";

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
- **Types:** `table`, `card`, `list`
- **Usage:**
  ```typescript
  import { LoadingState } from "@/components/shared";

  {!data ? (
    <LoadingState type="table" rows={5} />
  ) : (
    <DataTable data={data} />
  )}
  ```

### Base Components

#### Skeleton
- **Path:** `src/components/base/skeleton/skeleton.tsx`
- **Purpose:** Base skeleton component with pulse animation
- **Used by:** LoadingState
- **Usage:**
  ```typescript
  import { Skeleton } from "@/components/base/skeleton/skeleton";

  <Skeleton className="h-10 w-full" />
  ```

### Providers

#### CommandProvider
- **Path:** `src/providers/CommandProvider.tsx`
- **Purpose:** Global Cmd+K shortcut handler
- **Wired in:** Root layout
- **Keyboard Shortcut:** `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)

#### ToastProvider
- **Path:** `src/providers/ToastProvider.tsx`
- **Purpose:** Sonner toast notifications
- **Wired in:** Root layout
- **Usage:**
  ```typescript
  import { toast } from "sonner";

  toast.success("Project created");
  toast.error("Failed to save");
  toast.info("Processing...");
  ```

### Error Handling

#### Error Boundary
- **Path:** `src/app/error.tsx`
- **Purpose:** Catches unhandled errors in the app
- **Features:**
  - Shows user-friendly error message
  - Provides retry button
  - Logs errors to console
  - Prevents white screen of death

## Testing

A comprehensive test page is available at `/test-patterns` demonstrating all pattern components:

- SlideoutDetailView with tabs
- DataTableWithFilters with search and bulk actions
- BreadcrumbNav
- LoadingState (table, card, list types)

## Next Steps

These foundation components will be used to build:

- **Phase 2:** Authentication & Layout (login, dashboard, sidebar)
- **Phase 3:** Projects Module (list, create, detail, CRUD)
- **Phase 4:** Domains Module
- **Phase 5:** Keywords Module
- **Phase 6+:** Dashboard, Teams, Reports, Settings, Admin

## File Organization

```
src/
├── app/
│   ├── layout.tsx           # Root layout with providers
│   ├── error.tsx            # Global error boundary
│   └── test-patterns/       # Component test page
├── components/
│   ├── application/         # Untitled UI application components
│   │   ├── slideout-menus/
│   │   ├── modals/
│   │   ├── command-menus/
│   │   ├── breadcrumbs/
│   │   ├── tabs/
│   │   └── ...
│   ├── base/                # Untitled UI base components
│   │   ├── buttons/
│   │   ├── input/
│   │   ├── skeleton/
│   │   └── ...
│   ├── patterns/            # Reusable pattern components
│   │   ├── SlideoutDetailView.tsx
│   │   ├── DataTableWithFilters.tsx
│   │   ├── BulkActionBar.tsx
│   │   └── index.ts
│   └── shared/              # Shared utility components
│       ├── BreadcrumbNav.tsx
│       ├── LoadingState.tsx
│       └── index.ts
└── providers/               # Global providers
    ├── CommandProvider.tsx
    ├── ToastProvider.tsx
    ├── router-provider.tsx
    └── theme.tsx
```

## Architectural Patterns

### When to Use What

- **SlideoutDetailView:** Complex detail views with multiple tabs (Project details, Domain settings, etc.)
- **DataTableWithFilters:** All list views with filtering and actions (Projects list, Domains list, Keywords list)
- **BreadcrumbNav:** Page headers for navigation context
- **LoadingState:** While data is loading from Convex queries
- **Toast:** User feedback for actions (success, error, info messages)

---

**Documentation Created:** 2026-01-29
**Phase:** 1 - Foundation
**Session:** S0003
