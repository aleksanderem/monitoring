# Complete Build Guide for AI - SEO Monitoring Platform

> **CRITICAL:** You are building a FRONTEND ONLY. The backend (Convex) already exists and works perfectly.
> DO NOT create or modify ANY files in `/convex/` folder.
> ONLY build React/Next.js components that consume existing Convex API.

---

## Quick Start Checklist for AI

Before you start building:

1. ✅ **Backend is ready** - See `BACKEND_API_REFERENCE.md` for all available API functions
2. ✅ **Migration done** - Follow `BACKEND_MIGRATION_CHECKLIST.md` to copy backend
3. ✅ **Convex running** - `npx convex dev` should be running without errors
4. ✅ **Untitled UI access** - `npx untitledui@latest login` completed
5. ✅ **Dependencies installed** - All packages from Step 1.2 below

---

## Build Order (Follow Sequentially)

```
Phase 1: Foundation (Days 1-2)
  → Install Untitled UI components
  → Create pattern components (SlideoutDetailView, DataTableWithFilters)
  → Setup providers (Command, Toast, Convex)

Phase 2: Authentication (Day 3)
  → Login page
  → Register page
  → Auth flow testing

Phase 3: Dashboard Layout (Day 4)
  → Sidebar navigation
  → Dashboard layout
  → Protected routes

Phase 4: Projects Module (Days 5-6)
  → Projects list with DataTable
  → Project SlideoutMenu
  → Create/Edit/Delete projects

Phase 5: Domains Module (Days 7-9)
  → Domains table in Project slideout
  → Domain SlideoutMenu
  → Domain settings
  → Keywords integration

Phase 6: Keywords Module (Days 10-12)
  → Keywords table with positions
  → Keyword SlideoutMenu
  → Position history chart
  → Bulk add keywords
  → Check positions (DataForSEO integration)

Phase 7: Dashboard Overview (Days 13-14)
  → Overview metrics cards
  → Position distribution chart
  → Top movers table
  → Recent activity feed

Phase 8: Teams Module (Days 15-16)
  → Teams list
  → Team SlideoutMenu
  → Member management
  → Invitations

Phase 9: Reports Module (Days 17-19)
  → Report builder
  → Client reports list
  → Report preview
  → Shareable links

Phase 10: Settings (Day 20)
  → User settings tabs
  → Preferences
  → API keys

Phase 11: Admin Panel (Days 21-23)
  → Users management
  → Organizations management
  → Logs viewer
  → System config

Phase 12: Public Reports (Days 24-25)
  → Public report view (/r/[token])
  → Keyword proposals form
  → Client messaging

Phase 13: Polish (Days 26-30)
  → Loading states everywhere
  → Error boundaries
  → Empty states
  → Toast notifications
  → Animations
```

---

## Phase 1: Foundation Setup

### 1.1: Create Project

```bash
npx create-next-app@latest seo-monitoring-v2 \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir

cd seo-monitoring-v2
```

### 1.2: Install ALL Dependencies

```bash
# Convex
npm install convex @convex-dev/auth @auth/core

# UI Components
npm install @radix-ui/react-avatar @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator
npm install @radix-ui/react-slot @radix-ui/react-tabs
npm install @untitledui/icons @untitledui/file-icons
npm install react-aria react-aria-components @react-stately/utils
npm install tailwindcss-react-aria-components

# Utilities
npm install sonner motion recharts qr-code-styling
npm install tailwind-merge tailwindcss-animate
npm install cmdk

# Dev
npm install -D @tailwindcss/typography @tailwindcss/postcss
```

### 1.3: Copy Backend

```bash
# CRITICAL: Stop here and copy your backend

# 1. Copy convex folder
cp -r /path/to/old/project/convex/* ./convex/

# 2. Copy env file
cp /path/to/old/project/.env.local ./.env.local

# 3. Start Convex
npx convex dev

# Expected: "✓ Deployment complete" - no errors
```

### 1.4: Install Untitled UI Components

```bash
# Login first (opens browser)
npx untitledui@latest login

# Install all needed components (use -p flag)
npx untitledui@latest add button -p components
npx untitledui@latest add input -p components
npx untitledui@latest add select -p components
npx untitledui@latest add dialog -p components
npx untitledui@latest add slideout -p components
npx untitledui@latest add tabs -p components
npx untitledui@latest add badge -p components
npx untitledui@latest add avatar -p components
npx untitledui@latest add dropdown-menu -p components
npx untitledui@latest add skeleton -p components
npx untitledui@latest add breadcrumb -p components
npx untitledui@latest add empty-state -p components
npx untitledui@latest add command -p components
npx untitledui@latest add data-table -p components
npx untitledui@latest add date-picker -p components
```

Expected: All components installed in `components/` folder

### 1.5: Create Folder Structure

```bash
mkdir -p app/{\\(auth\\)/{login,register},\\(dashboard\\)/{dashboard,projects,teams,settings},\\(admin\\)/admin,r/[token]}
mkdir -p components/{patterns,shared,features/{projects,domains,keywords,teams,dashboard,reports}}
mkdir -p providers
mkdir -p lib
mkdir -p hooks
```

---

## Phase 2: Core Infrastructure

### 2.1: Tailwind Theme

Create `app/theme.css`:

```css
@import "tailwindcss";

@theme {
  --color-brand-solid: #7F56D9;
  --color-brand-solid-hover: #6941C6;

  --color-gray-25: #FCFCFD;
  --color-gray-50: #F9FAFB;
  --color-gray-100: #F2F4F7;
  --color-gray-200: #EAECF0;
  --color-gray-300: #D0D5DD;
  --color-gray-400: #98A2B3;
  --color-gray-500: #667085;
  --color-gray-600: #475467;
  --color-gray-700: #344054;
  --color-gray-800: #1D2939;
  --color-gray-900: #101828;

  --color-error-500: #F04438;
  --color-warning-500: #F79009;
  --color-success-500: #12B76A;
}

@plugin "@tailwindcss/typography";
@plugin "tailwindcss-animate";
@plugin "tailwindcss-react-aria-components";
```

### 2.2: Utility Functions

Create `lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Create `lib/convex.ts`:

```typescript
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useCurrentUser() {
  return useQuery(api.auth.currentUser);
}

export function useCurrentOrganization() {
  const user = useCurrentUser();
  // Assumes backend has getCurrentOrganization query
  return useQuery(
    api.organizations.getCurrentOrganization,
    user ? {} : "skip"
  );
}
```

### 2.3: Providers

Create `providers/ConvexProvider.tsx`:

```typescript
"use client";

import { ConvexProvider as BaseConvexProvider } from "convex/react";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return <BaseConvexProvider client={convex}>{children}</BaseConvexProvider>;
}
```

Create `providers/ToastProvider.tsx`:

```typescript
"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return <Toaster position="top-right" richColors closeButton />;
}
```

### 2.4: Root Layout

Update `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./theme.css";
import { ConvexProvider } from "@/providers/ConvexProvider";
import { ToastProvider } from "@/providers/ToastProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SEO Monitoring Platform",
  description: "Track keyword rankings and SEO performance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexProvider>
          {children}
          <ToastProvider />
        </ConvexProvider>
      </body>
    </html>
  );
}
```

---

## Phase 3: Pattern Components (MUST CREATE THESE FIRST)

These are reusable patterns you'll use everywhere.

### Pattern 1: SlideoutDetailView

Create `components/patterns/SlideoutDetailView.tsx`:

```typescript
"use client";

import { Slideout } from "@/components/application/slideout";
import { Tabs } from "@/components/base/tabs";

export interface SlideoutTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface SlideoutDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  tabs: SlideoutTab[];
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}

export function SlideoutDetailView({
  isOpen,
  onClose,
  title,
  subtitle,
  tabs,
  actions,
  footer,
}: SlideoutDetailViewProps) {
  return (
    <Slideout open={isOpen} onOpenChange={onClose}>
      <Slideout.Content className="w-full max-w-2xl">
        <Slideout.Header>
          <div>
            <Slideout.Title>{title}</Slideout.Title>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </Slideout.Header>

        <Slideout.Body className="p-0">
          <Tabs defaultValue={tabs[0]?.id} className="w-full">
            <Tabs.List className="border-b px-6">
              {tabs.map((tab) => (
                <Tabs.Trigger key={tab.id} value={tab.id}>
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <div className="p-6">
              {tabs.map((tab) => (
                <Tabs.Content key={tab.id} value={tab.id}>
                  {tab.content}
                </Tabs.Content>
              ))}
            </div>
          </Tabs>
        </Slideout.Body>

        {footer && <Slideout.Footer>{footer}</Slideout.Footer>}
      </Slideout.Content>
    </Slideout>
  );
}
```

### Pattern 2: DataTableWithFilters

Create `components/patterns/DataTableWithFilters.tsx`:

```typescript
"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/base/input";
import { BulkActionBar, type BulkAction } from "./BulkActionBar";

export interface Column<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface DataTableWithFiltersProps<T extends { _id: string }> {
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
  const [sortBy, setSortBy] = useState<{ key: keyof T; order: "asc" | "desc" } | null>(null);

  const filteredAndSortedData = useMemo(() => {
    let result = data;

    // Filter
    if (search && searchKeys) {
      const lower = search.toLowerCase();
      result = result.filter((row) =>
        searchKeys.some((key) => String(row[key]).toLowerCase().includes(lower))
      );
    }

    // Sort
    if (sortBy) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortBy.key];
        const bVal = b[sortBy.key];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortBy.order === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [data, search, searchKeys, sortBy]);

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(
      selectedIds.size === filteredAndSortedData.length
        ? new Set()
        : new Set(filteredAndSortedData.map((r) => r._id))
    );
  };

  return (
    <div className="space-y-4">
      {searchKeys && (
        <Input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      )}

      {bulkActions && selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          actions={bulkActions}
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      <div className="rounded-lg border">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              {bulkActions && (
                <th className="w-12 p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredAndSortedData.length && filteredAndSortedData.length > 0}
                    onChange={selectAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="p-3 text-left text-sm font-medium text-gray-700"
                  onClick={() =>
                    col.sortable &&
                    setSortBy((prev) =>
                      prev?.key === col.accessorKey
                        ? { key: col.accessorKey!, order: prev.order === "asc" ? "desc" : "asc" }
                        : { key: col.accessorKey!, order: "asc" }
                    )
                  }
                >
                  {col.header}
                  {col.sortable && sortBy?.key === col.accessorKey && (
                    <span className="ml-1">{sortBy.order === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (bulkActions ? 1 : 0)} className="p-8 text-center">
                  {emptyState || <p className="text-gray-500">No data</p>}
                </td>
              </tr>
            ) : (
              filteredAndSortedData.map((row) => (
                <tr
                  key={row._id}
                  onClick={() => onRowClick?.(row)}
                  className="cursor-pointer border-b hover:bg-gray-50"
                >
                  {bulkActions && (
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row._id)}
                        onChange={() => toggleSelectRow(row._id)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.id} className="p-3 text-sm">
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                        ? String(row[col.accessorKey])
                        : ""}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Pattern 3: BulkActionBar

Create `components/patterns/BulkActionBar.tsx`:

```typescript
"use client";

import { Button } from "@/components/base/button";
import { X } from "@untitledui/icons";

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (selectedIds: Set<string>) => void | Promise<void>;
  variant?: "default" | "destructive" | "secondary";
}

export function BulkActionBar({
  selectedCount,
  actions,
  selectedIds,
  onClearSelection,
}: {
  selectedCount: number;
  actions: BulkAction[];
  selectedIds: Set<string>;
  onClearSelection: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">{selectedCount} selected</span>
        <div className="flex gap-2">
          {actions.map((action, i) => (
            <Button
              key={i}
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
      <Button size="sm" variant="ghost" onClick={onClearSelection}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### Pattern 4: Shared Components

Create `components/shared/BreadcrumbNav.tsx`:

```typescript
"use client";

import { Breadcrumb } from "@/components/base/breadcrumb";
import Link from "next/link";
import { Home } from "@untitledui/icons";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function BreadcrumbNav({ items }: { items: BreadcrumbItem[] }) {
  return (
    <Breadcrumb>
      <Breadcrumb.Item>
        <Link href="/dashboard" className="flex items-center">
          <Home className="h-4 w-4" />
        </Link>
      </Breadcrumb.Item>
      {items.map((item, i) => (
        <Breadcrumb.Item key={i}>
          {item.href && i < items.length - 1 ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span className="text-gray-900">{item.label}</span>
          )}
        </Breadcrumb.Item>
      ))}
    </Breadcrumb>
  );
}
```

Create `components/shared/LoadingState.tsx`:

```typescript
import { Skeleton } from "@/components/base/skeleton";

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}
```

---

## Phase 4: Authentication

### 4.1: Login Page

Create `app/(auth)/login/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/base/button";
import { Input } from "@/components/base/input";
import Link from "next/link";
import { toast } from "sonner";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn("password", { email, password, flow: "signIn" });
      router.push("/dashboard");
      toast.success("Logged in successfully");
    } catch (error) {
      toast.error("Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Sign in</h1>
          <p className="mt-2 text-gray-600">Welcome back to SEO Monitor</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link href="/register" className="text-brand-solid hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### 4.2: Register Page

Create `app/(auth)/register/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/base/button";
import { Input } from "@/components/base/input";
import Link from "next/link";
import { toast } from "sonner";

export default function RegisterPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn("password", { email, password, name, flow: "signUp" });
      router.push("/dashboard");
      toast.success("Account created! Welcome aboard.");
    } catch (error) {
      toast.error("Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Create account</h1>
          <p className="mt-2 text-gray-600">Start monitoring your SEO today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be at least 8 characters
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Sign up"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-solid hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

---

## Phase 5: Dashboard Layout & Sidebar

### 5.1: Sidebar Component

Create `components/features/Sidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Folder,
  Users,
  Settings,
  Shield,
  LogOut,
} from "@untitledui/icons";
import { Button } from "@/components/base/button";
import { Avatar } from "@/components/base/avatar";
import { useAuthActions } from "@convex-dev/auth/react";
import { useCurrentUser, useCurrentOrganization } from "@/lib/convex";
import { toast } from "sonner";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: Folder },
  { name: "Teams", href: "/teams", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const user = useCurrentUser();
  const org = useCurrentOrganization();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    toast.success("Signed out");
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-white">
      {/* Logo */}
      <div className="border-b p-6">
        <h1 className="text-xl font-bold">SEO Monitor</h1>
        {org && <p className="text-sm text-gray-500">{org.name}</p>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}

        {/* Admin link (if super admin) */}
        {/* TODO: Check if user is super admin */}
        <Link
          href="/admin"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <Shield className="h-5 w-5" />
          Admin Panel
        </Link>
      </nav>

      {/* User section */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar>
            <Avatar.Image src={user?.avatarUrl} alt={user?.name} />
            <Avatar.Fallback>{user?.name?.[0] || "U"}</Avatar.Fallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
```

### 5.2: Dashboard Layout

Create `app/(dashboard)/layout.tsx`:

```typescript
"use client";

import { Sidebar } from "@/components/features/Sidebar";
import { useCurrentUser } from "@/lib/convex";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (user === null) {
      router.push("/login");
    }
  }, [user, router]);

  if (user === undefined) {
    return <div>Loading...</div>;
  }

  if (user === null) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="container mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

---

## Phase 6: Projects Module (COMPLETE IMPLEMENTATION)

### 6.1: Projects Page

Create `app/(dashboard)/projects/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BreadcrumbNav } from "@/components/shared/BreadcrumbNav";
import { LoadingState } from "@/components/shared/LoadingState";
import { DataTableWithFilters } from "@/components/patterns/DataTableWithFilters";
import { ProjectSlideout } from "@/components/features/projects/ProjectSlideout";
import { CreateProjectDialog } from "@/components/features/projects/CreateProjectDialog";
import { Button } from "@/components/base/button";
import { Plus, Trash2 } from "@untitledui/icons";
import { EmptyState } from "@/components/base/empty-state";
import { toast } from "sonner";
import { useCurrentOrganization } from "@/lib/convex";

export default function ProjectsPage() {
  const org = useCurrentOrganization();
  const teams = useQuery(
    org ? api.teams.getTeams : undefined,
    org ? { organizationId: org._id } : "skip"
  );

  const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | null>(null);
  const projects = useQuery(
    selectedTeamId ? api.projects.getProjects : undefined,
    selectedTeamId ? { teamId: selectedTeamId } : "skip"
  );

  const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects"> | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const deleteProject = useMutation(api.projects.deleteProject);

  const handleDelete = async (selectedIds: Set<string>) => {
    if (!confirm(`Delete ${selectedIds.size} project(s)? This cannot be undone.`)) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          deleteProject({ projectId: id as Id<"projects"> })
        )
      );
      toast.success(`Deleted ${selectedIds.size} project(s)`);
    } catch (error) {
      toast.error("Failed to delete projects");
    }
  };

  if (!teams) return <LoadingState />;

  // First time - select first team
  if (teams.length > 0 && !selectedTeamId) {
    setSelectedTeamId(teams[0]._id);
  }

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Projects" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-gray-600">Manage your SEO monitoring projects</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Team selector */}
      {teams.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Team:</label>
          <select
            value={selectedTeamId || ""}
            onChange={(e) => setSelectedTeamId(e.target.value as Id<"teams">)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {teams.map((team) => (
              <option key={team._id} value={team._id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Projects table */}
      {!projects ? (
        <LoadingState />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start monitoring keywords"
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          }
        />
      ) : (
        <DataTableWithFilters
          data={projects}
          columns={[
            {
              id: "name",
              header: "Project Name",
              accessorKey: "name",
              sortable: true,
            },
            {
              id: "domains",
              header: "Domains",
              accessorKey: "domainCount",
              sortable: true,
            },
            {
              id: "keywords",
              header: "Keywords",
              accessorKey: "keywordCount",
              sortable: true,
            },
            {
              id: "created",
              header: "Created",
              cell: (row) => new Date(row.createdAt).toLocaleDateString(),
            },
          ]}
          searchKeys={["name"]}
          searchPlaceholder="Search projects..."
          bulkActions={[
            {
              label: "Delete",
              icon: <Trash2 className="h-4 w-4" />,
              variant: "destructive",
              onClick: handleDelete,
            },
          ]}
          onRowClick={(project) => setSelectedProjectId(project._id)}
        />
      )}

      {/* Slideout for project details */}
      <ProjectSlideout
        projectId={selectedProjectId}
        isOpen={!!selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
      />

      {/* Dialog for creating project */}
      <CreateProjectDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        teamId={selectedTeamId}
      />
    </div>
  );
}
```

### 6.2: Create Project Dialog

Create `components/features/projects/CreateProjectDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog } from "@/components/base/dialog";
import { Input } from "@/components/base/input";
import { Button } from "@/components/base/button";
import { toast } from "sonner";

export function CreateProjectDialog({
  isOpen,
  onClose,
  teamId,
}: {
  isOpen: boolean;
  onClose: () => void;
  teamId: Id<"teams"> | null;
}) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const createProject = useMutation(api.projects.createProject);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamId) {
      toast.error("Please select a team first");
      return;
    }

    setIsLoading(true);
    try {
      await createProject({ name, teamId });
      toast.success("Project created");
      setName("");
      onClose();
    } catch (error) {
      toast.error("Failed to create project");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Create Project</Dialog.Title>
          <Dialog.Description>
            Create a new SEO monitoring project
          </Dialog.Description>
        </Dialog.Header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Project Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client Website SEO"
              required
              autoFocus
            />
          </div>

          <Dialog.Footer>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
```

### 6.3: Project Slideout

Create `components/features/projects/ProjectSlideout.tsx`:

```typescript
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SlideoutDetailView } from "@/components/patterns/SlideoutDetailView";
import { Button } from "@/components/base/button";
import { Pencil, Trash2 } from "@untitledui/icons";
import { toast } from "sonner";
import { ProjectOverviewTab } from "./ProjectOverviewTab";
import { ProjectDomainsTab } from "./ProjectDomainsTab";
import { ProjectSettingsTab } from "./ProjectSettingsTab";

export function ProjectSlideout({
  projectId,
  isOpen,
  onClose,
}: {
  projectId: Id<"projects"> | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const project = useQuery(
    projectId ? api.projects.getProject : undefined,
    projectId ? { projectId } : "skip"
  );

  const deleteProject = useMutation(api.projects.deleteProject);

  const handleDelete = async () => {
    if (!projectId) return;

    if (!confirm("Delete this project? This will delete all domains and keywords.")) {
      return;
    }

    try {
      await deleteProject({ projectId });
      toast.success("Project deleted");
      onClose();
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  if (!project) return null;

  return (
    <SlideoutDetailView
      isOpen={isOpen}
      onClose={onClose}
      title={project.name}
      subtitle={`${project.domainCount} domains · ${project.keywordCount} keywords`}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: <ProjectOverviewTab project={project} />,
        },
        {
          id: "domains",
          label: "Domains",
          content: <ProjectDomainsTab projectId={project._id} />,
        },
        {
          id: "settings",
          label: "Settings",
          content: <ProjectSettingsTab project={project} />,
        },
      ]}
      actions={
        <>
          <Button size="sm" variant="secondary">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      }
    />
  );
}
```

### 6.4: Project Tabs

Create `components/features/projects/ProjectOverviewTab.tsx`:

```typescript
export function ProjectOverviewTab({ project }: { project: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Domains</p>
          <p className="text-2xl font-bold">{project.domainCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Keywords</p>
          <p className="text-2xl font-bold">{project.keywordCount}</p>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-2">Project Information</h3>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-600">Created</dt>
            <dd>{new Date(project.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
```

Create `components/features/projects/ProjectDomainsTab.tsx`:

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/base/empty-state";
import { Button } from "@/components/base/button";
import { Plus } from "@untitledui/icons";

export function ProjectDomainsTab({ projectId }: { projectId: Id<"projects"> }) {
  const domains = useQuery(api.domains.getDomains, { projectId });

  if (!domains) return <LoadingState rows={3} />;

  if (domains.length === 0) {
    return (
      <EmptyState
        title="No domains yet"
        description="Add a domain to start tracking keywords"
        action={
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Domain
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {domains.map((domain) => (
        <div
          key={domain._id}
          className="rounded-lg border p-4 hover:border-brand-solid transition cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{domain.domain}</p>
              <p className="text-sm text-gray-600">
                {domain.keywordCount} keywords
                {domain.avgPosition && ` · Avg pos: ${domain.avgPosition}`}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              {domain.settings.searchEngine}
            </div>
          </div>
        </div>
      ))}

      <Button variant="secondary" className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Domain
      </Button>
    </div>
  );
}
```

Create `components/features/projects/ProjectSettingsTab.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/base/input";
import { Button } from "@/components/base/button";
import { toast } from "sonner";

export function ProjectSettingsTab({ project }: { project: any }) {
  const [name, setName] = useState(project.name);
  const [maxDomains, setMaxDomains] = useState(project.limits?.maxDomains || "");
  const updateProject = useMutation(api.projects.updateProject);

  const handleSave = async () => {
    try {
      await updateProject({
        projectId: project._id,
        name,
        limits: maxDomains ? { maxDomains: parseInt(maxDomains) } : undefined,
      });
      toast.success("Project updated");
    } catch (error) {
      toast.error("Failed to update project");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">Project Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Max Domains (optional)
        </label>
        <Input
          type="number"
          value={maxDomains}
          onChange={(e) => setMaxDomains(e.target.value)}
          placeholder="No limit"
        />
        <p className="mt-1 text-xs text-gray-500">
          Leave empty for organization default
        </p>
      </div>

      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  );
}
```

---

## KEY PATTERNS TO FOLLOW

### Pattern: Convex Data Fetching

```typescript
// 1. Query (reactive, auto-updates)
const data = useQuery(api.module.functionName, { arg: value });

// Returns: undefined (loading) | null (not found) | T (data)

// 2. Mutation (write data)
const mutateFn = useMutation(api.module.functionName);
await mutateFn({ arg: value });

// 3. Action (external API call)
const actionFn = useAction(api.module.functionName);
const result = await actionFn({ arg: value });
```

### Pattern: SlideoutMenu Usage

```typescript
// 1. In parent (list view)
const [selectedId, setSelectedId] = useState<Id | null>(null);

// 2. In DataTable
onRowClick={(row) => setSelectedId(row._id)}

// 3. Render Slideout
<ItemSlideout
  itemId={selectedId}
  isOpen={!!selectedId}
  onClose={() => setSelectedId(null)}
/>
```

### Pattern: Form with Mutation

```typescript
const mutateFn = useMutation(api.module.create);
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    await mutateFn({ ...formData });
    toast.success("Success!");
    onClose();
  } catch (error) {
    toast.error("Failed");
  } finally {
    setIsLoading(false);
  }
};
```

### Pattern: Bulk Actions

```typescript
const deleteFn = useMutation(api.module.delete);

const handleBulkDelete = async (selectedIds: Set<string>) => {
  if (!confirm(`Delete ${selectedIds.size} items?`)) return;

  try {
    await Promise.all(
      Array.from(selectedIds).map((id) => deleteFn({ id: id as Id }))
    );
    toast.success(`Deleted ${selectedIds.size} items`);
  } catch (error) {
    toast.error("Failed to delete");
  }
};

// Use in DataTableWithFilters:
bulkActions={[
  {
    label: "Delete",
    variant: "destructive",
    onClick: handleBulkDelete,
  },
]}
```

---

## Complete Module Templates

Use these templates for each module (Domains, Keywords, Teams, etc.):

### Module Template Structure

```
components/features/[module]/
├── [Module]Slideout.tsx          # Main slideout (uses SlideoutDetailView)
├── [Module]OverviewTab.tsx       # Overview tab content
├── [Module]SettingsTab.tsx       # Settings tab content
├── Create[Module]Dialog.tsx      # Create dialog
└── index.ts                      # Barrel exports

app/(dashboard)/[module]/
└── page.tsx                      # List view (uses DataTableWithFilters)
```

### Example: Domains Module

#### `components/features/domains/DomainSlideout.tsx`

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SlideoutDetailView } from "@/components/patterns/SlideoutDetailView";
import { DomainOverviewTab } from "./DomainOverviewTab";
import { DomainKeywordsTab } from "./DomainKeywordsTab";
import { DomainSettingsTab } from "./DomainSettingsTab";

export function DomainSlideout({
  domainId,
  isOpen,
  onClose,
}: {
  domainId: Id<"domains"> | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const domain = useQuery(
    domainId ? api.domains.getDomain : undefined,
    domainId ? { domainId } : "skip"
  );

  if (!domain) return null;

  return (
    <SlideoutDetailView
      isOpen={isOpen}
      onClose={onClose}
      title={domain.domain}
      subtitle={`${domain.settings.searchEngine} · ${domain.settings.location}`}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: <DomainOverviewTab domain={domain} />,
        },
        {
          id: "keywords",
          label: "Keywords",
          content: <DomainKeywordsTab domainId={domain._id} />,
        },
        {
          id: "settings",
          label: "Settings",
          content: <DomainSettingsTab domain={domain} />,
        },
      ]}
    />
  );
}
```

#### `components/features/domains/DomainKeywordsTab.tsx`

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DataTableWithFilters } from "@/components/patterns/DataTableWithFilters";
import { AddKeywordsDialog } from "../keywords/AddKeywordsDialog";
import { KeywordSlideout } from "../keywords/KeywordSlideout";
import { Button } from "@/components/base/button";
import { Plus, Trash2, RefreshCw } from "@untitledui/icons";
import { Badge } from "@/components/base/badge";
import { toast } from "sonner";

export function DomainKeywordsTab({ domainId }: { domainId: Id<"domains"> }) {
  const keywords = useQuery(api.keywords.getKeywords, { domainId });
  const [selectedKeywordId, setSelectedKeywordId] = useState<Id<"keywords"> | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const deleteKeyword = useMutation(api.keywords.deleteKeyword);

  const handleDelete = async (selectedIds: Set<string>) => {
    if (!confirm(`Delete ${selectedIds.size} keyword(s)?`)) return;

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          deleteKeyword({ keywordId: id as Id<"keywords"> })
        )
      );
      toast.success(`Deleted ${selectedIds.size} keyword(s)`);
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  if (!keywords) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => setIsAddOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Keywords
      </Button>

      <DataTableWithFilters
        data={keywords}
        columns={[
          {
            id: "phrase",
            header: "Keyword",
            accessorKey: "phrase",
            sortable: true,
          },
          {
            id: "position",
            header: "Position",
            cell: (row) =>
              row.currentPosition ? (
                <span className="font-mono">{row.currentPosition}</span>
              ) : (
                <span className="text-gray-400">—</span>
              ),
            sortable: true,
          },
          {
            id: "change",
            header: "Change",
            cell: (row) => {
              if (row.change === null) return <span className="text-gray-400">—</span>;
              if (row.change > 0) {
                return (
                  <span className="text-success-500">
                    ↑ {Math.abs(row.change)}
                  </span>
                );
              }
              if (row.change < 0) {
                return (
                  <span className="text-error-500">
                    ↓ {Math.abs(row.change)}
                  </span>
                );
              }
              return <span className="text-gray-400">—</span>;
            },
          },
          {
            id: "volume",
            header: "Volume",
            accessorKey: "searchVolume",
            cell: (row) =>
              row.searchVolume ? (
                <span className="font-mono">{row.searchVolume.toLocaleString()}</span>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          {
            id: "status",
            header: "Status",
            cell: (row) => (
              <Badge variant={row.status === "active" ? "success" : "secondary"}>
                {row.status}
              </Badge>
            ),
          },
        ]}
        searchKeys={["phrase"]}
        searchPlaceholder="Search keywords..."
        bulkActions={[
          {
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            variant: "destructive",
            onClick: handleDelete,
          },
        ]}
        onRowClick={(keyword) => setSelectedKeywordId(keyword._id)}
      />

      <AddKeywordsDialog
        domainId={domainId}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />

      <KeywordSlideout
        keywordId={selectedKeywordId}
        isOpen={!!selectedKeywordId}
        onClose={() => setSelectedKeywordId(null)}
      />
    </div>
  );
}
```

#### `components/features/keywords/AddKeywordsDialog.tsx`

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog } from "@/components/base/dialog";
import { Button } from "@/components/base/button";
import { toast } from "sonner";

export function AddKeywordsDialog({
  domainId,
  isOpen,
  onClose,
}: {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [keywords, setKeywords] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const addKeywords = useMutation(api.keywords.addKeywords);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const phrases = keywords
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean);

    if (phrases.length === 0) {
      toast.error("Please enter at least one keyword");
      return;
    }

    setIsLoading(true);
    try {
      await addKeywords({ domainId, phrases });
      toast.success(`Added ${phrases.length} keyword(s)`);
      setKeywords("");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to add keywords");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Add Keywords</Dialog.Title>
          <Dialog.Description>
            Enter keywords to monitor (one per line)
          </Dialog.Description>
        </Dialog.Header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={"seo monitoring tool\nkeyword rank tracker\norganic position tracking"}
              className="w-full rounded-md border p-3 text-sm font-mono"
              rows={10}
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              {keywords.split("\n").filter(Boolean).length} keyword(s)
            </p>
          </div>

          <Dialog.Footer>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Keywords"}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
```

#### `components/features/keywords/KeywordSlideout.tsx`

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SlideoutDetailView } from "@/components/patterns/SlideoutDetailView";
import { Badge } from "@/components/base/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function KeywordSlideout({
  keywordId,
  isOpen,
  onClose,
}: {
  keywordId: Id<"keywords"> | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const keyword = useQuery(
    keywordId ? api.keywords.getKeywordWithHistory : undefined,
    keywordId ? { keywordId, days: 30 } : "skip"
  );

  if (!keyword) return null;

  const chartData = keyword.history?.map((h) => ({
    date: h.date,
    position: h.position || 100,
  })) || [];

  return (
    <SlideoutDetailView
      isOpen={isOpen}
      onClose={onClose}
      title={keyword.phrase}
      subtitle={
        <div className="flex items-center gap-2 mt-1">
          {keyword.currentPosition && (
            <Badge>Position: {keyword.currentPosition}</Badge>
          )}
          {keyword.change !== null && (
            <Badge variant={keyword.change > 0 ? "success" : "error"}>
              {keyword.change > 0 ? "↑" : "↓"} {Math.abs(keyword.change)}
            </Badge>
          )}
        </div>
      }
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="space-y-6">
              {/* Position history chart */}
              <div>
                <h3 className="font-medium mb-4">Position History (30 days)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis reversed domain={[1, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="position"
                      stroke="#7F56D9"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-gray-600">Search Volume</p>
                  <p className="text-xl font-bold">
                    {keyword.searchVolume?.toLocaleString() || "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-gray-600">Difficulty</p>
                  <p className="text-xl font-bold">{keyword.difficulty || "—"}</p>
                </div>
              </div>

              {/* Ranking URL */}
              {keyword.rankingUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Ranking URL
                  </p>
                  <a
                    href={keyword.rankingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-solid hover:underline"
                  >
                    {keyword.rankingUrl}
                  </a>
                </div>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
```

---

## CRITICAL INSTRUCTIONS FOR AI

### ✅ DO:

1. **Use existing Convex API** - All functions in `BACKEND_API_REFERENCE.md` are ready
2. **Follow patterns** - Use SlideoutDetailView for all details, DataTableWithFilters for all lists
3. **Use Untitled UI 100%** - Install components via CLI, don't create custom ones
4. **Test as you build** - `npm run dev` and verify each page works
5. **Use TypeScript** - Import types from `@/convex/_generated/dataModel`
6. **Toast for feedback** - Every action (create/update/delete) gets toast notification
7. **Loading states** - Show `<LoadingState />` while useQuery returns undefined
8. **Empty states** - Use `<EmptyState />` for empty lists
9. **Error handling** - Wrap mutations in try-catch, show toast on error

### ❌ DON'T:

1. **DON'T modify backend** - NEVER create/edit files in `/convex/` folder
2. **DON'T create custom base components** - Use Untitled UI for Button, Input, Dialog, etc.
3. **DON'T hardcode data** - Always fetch from Convex API
4. **DON'T skip loading states** - Users must see feedback
5. **DON'T ignore permissions** - Backend enforces them, but hide UI controls user can't use
6. **DON'T create separate detail pages** - Use slideouts for details (not `/projects/[id]` routes)

---

## Complete Page Checklist

Build these pages in order:

### Phase 1: Foundation ✅
- [x] Pattern components (SlideoutDetailView, DataTableWithFilters, BulkActionBar)
- [x] Shared components (BreadcrumbNav, LoadingState)
- [x] Providers (Convex, Toast)

### Phase 2: Auth ✅
- [x] `app/(auth)/login/page.tsx`
- [x] `app/(auth)/register/page.tsx`

### Phase 3: Layout ✅
- [x] `components/features/Sidebar.tsx`
- [x] `app/(dashboard)/layout.tsx`

### Phase 4: Projects 📝 (EXAMPLE ABOVE)
- [ ] `app/(dashboard)/projects/page.tsx`
- [ ] `components/features/projects/ProjectSlideout.tsx`
- [ ] `components/features/projects/CreateProjectDialog.tsx`
- [ ] Tab components (Overview, Domains, Settings)

### Phase 5: Domains 📝 (EXAMPLE ABOVE)
- [ ] Domain slideout + tabs
- [ ] Add domain dialog
- [ ] Keywords integration in tab

### Phase 6: Keywords 📝 (EXAMPLE ABOVE)
- [ ] Keyword slideout with chart
- [ ] Add keywords dialog (bulk textarea)
- [ ] Position history visualization

### Phase 7: Dashboard
- [ ] `app/(dashboard)/dashboard/page.tsx` - Overview with metrics cards

### Phase 8: Teams
- [ ] `app/(dashboard)/teams/page.tsx` - Teams list
- [ ] Team slideout with members tab

### Phase 9: Settings
- [ ] `app/(dashboard)/settings/page.tsx` - User settings tabs

### Phase 10: Admin
- [ ] `app/(admin)/admin/users/page.tsx`
- [ ] `app/(admin)/admin/organizations/page.tsx`
- [ ] `app/(admin)/admin/logs/page.tsx`

### Phase 11: Public Reports
- [ ] `app/r/[token]/page.tsx` - Client-facing report view

---

## Testing Each Module

After building each module, test:

```bash
# 1. Start dev server
npm run dev

# 2. Open browser
open http://localhost:3000

# 3. Test flow:
# - Login
# - Navigate to module
# - Create item
# - View item (slideout opens)
# - Edit item (save changes)
# - Delete item (bulk action)

# 4. Check console - no errors

# 5. Build test
npm run build

# Expected: Build succeeds
```

---

## Example: Complete Projects Module

Here's the COMPLETE implementation for reference:

### File: `app/(dashboard)/projects/page.tsx`

[See Step 6.1 above for complete code]

### Files needed:
- `components/features/projects/ProjectSlideout.tsx` [See 6.3]
- `components/features/projects/ProjectOverviewTab.tsx` [See 6.4]
- `components/features/projects/ProjectDomainsTab.tsx` [See 6.4]
- `components/features/projects/ProjectSettingsTab.tsx` [See 6.4]
- `components/features/projects/CreateProjectDialog.tsx` [See 6.2]

**Repeat this pattern for:**
- Domains module (in ProjectDomainsTab, add Domain slideout)
- Keywords module (in DomainKeywordsTab, add Keyword slideout)
- Teams module
- Dashboard module
- Settings module
- Admin modules
- Public reports module

---

## Quick Reference: Convex API Calls

```typescript
// Projects
const projects = useQuery(api.projects.getProjects, { teamId });
const createProject = useMutation(api.projects.createProject);
await createProject({ name: "New Project", teamId });

// Domains
const domains = useQuery(api.domains.getDomains, { projectId });
const createDomain = useMutation(api.domains.createDomain);
await createDomain({
  projectId,
  domain: "example.com",
  settings: {
    refreshFrequency: "daily",
    searchEngine: "google.pl",
    location: "Poland",
    language: "pl",
  },
});

// Keywords
const keywords = useQuery(api.keywords.getKeywords, { domainId });
const addKeywords = useMutation(api.keywords.addKeywords);
await addKeywords({ domainId, phrases: ["keyword 1", "keyword 2"] });

// Check positions (Action - external API call)
const fetchPositions = useAction(api.dataforseo.fetchPositions);
await fetchPositions({ domainId });

// Teams
const teams = useQuery(api.teams.getTeams, { organizationId });
const createTeam = useMutation(api.teams.createTeam);
await createTeam({ organizationId, name: "Marketing Team" });

// Dashboard
const stats = useQuery(api.dashboard.getOverviewStats, { organizationId });
// Returns: { totalProjects, totalDomains, totalKeywords, avgPosition, ... }
```

---

## Final Deliverables

After completing all phases, you should have:

✅ **28 pages total:**
- 2 auth pages (login, register)
- 6 dashboard pages (dashboard, projects, teams, settings, + 2 detail pages if needed)
- 5 admin pages (users, orgs, logs, config, api)
- 1 public report page

✅ **~50 components:**
- Pattern components (3-5)
- Feature components per module (4-6 per module × 8 modules)
- Shared components (5-10)

✅ **100% Untitled UI usage**

✅ **Zero backend modifications**

✅ **All features from original spec working**

---

**Build Time Estimate:** 25-30 days for experienced developer following this guide

**Priority:** Follow the phase order - Foundation must be complete before building features

**References:**
- Backend API: `BACKEND_API_REFERENCE.md`
- Migration: `BACKEND_MIGRATION_CHECKLIST.md`
- Analysis: `PROJECT_ANALYSIS_AND_REBUILD_PLAN.md`

---

**Last Updated:** 2026-01-29
**Session:** S0049
