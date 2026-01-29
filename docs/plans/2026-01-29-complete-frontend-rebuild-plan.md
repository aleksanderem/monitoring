# Complete Frontend Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete frontend rebuild using Untitled UI PRO components while preserving 100% of Convex backend, with clear architectural patterns for modals, slideouts, and full pages.

**Architecture:**
- **Modals (Dialog)**: Simple forms, confirmations, quick actions (Create Project, Add Domain, Delete confirmation)
- **Slideouts**: Complex detail views with multiple tabs (Project details with domains/keywords/settings)
- **Full Pages**: Main list views, Dashboard, Settings pages, Admin panel
- **Data Tables**: All lists with row action dropdowns (Edit, Delete, Archive, etc.)
- **Data Fetching**: Progressive loading - fetch current data first, then enrich with history/metrics asynchronously

**Tech Stack:**
- Next.js 14 (App Router)
- Untitled UI PRO components
- Tailwind CSS v4
- Convex React (useQuery, useMutation, useAction)
- Sonner (toasts)
- DataForSEO & SE Ranking APIs (via Convex actions)

**Backend:** 100% preserved - using existing Convex API (see BACKEND_API_REFERENCE.md)

---

## Architectural Decisions & Patterns

### When to Use What

**Dialog (Modal) - Use for:**
- Create forms (Create Project, Add Domain, Add Keywords)
- Delete confirmations
- Quick edit forms (Edit Project Name, Change Settings)
- Single-action operations
- **Rule**: If it's <5 fields or single purpose → Modal

**Slideout - Use for:**
- Multi-tab detail views (Project with Overview/Domains/Keywords/Settings tabs)
- Complex forms with sections (Keyword research with filters/preview/selection)
- View with multiple related actions
- **Rule**: If it has tabs or >5 fields → Slideout

**Full Page - Use for:**
- Main list views (Projects list, Domains list, Keywords list)
- Dashboard with widgets
- Settings pages with sections
- Admin panel
- Public reports
- **Rule**: If it's a primary navigation destination → Full Page

### Data Table Pattern

**Every data table MUST have:**
```typescript
// Row action dropdown
<DataTable.Row>
  <DataTable.Cell>...</DataTable.Cell>
  <DataTable.Cell>
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button variant="ghost" size="sm" icon={<MoreVertical />} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onClick={() => handleEdit(row)}>Edit</DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => handleView(row)}>View Details</DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => handleDelete(row)} destructive>Delete</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  </DataTable.Cell>
</DataTable.Row>
```

**Bulk actions** - Use checkbox selection for multi-row operations:
- Delete selected
- Archive selected
- Export selected
- Move to project

### Keyword Position Fetching Strategy

**Initial Fetch (when no positions exist):**
1. User adds keywords to domain
2. Show "No positions yet" state with "Fetch Positions" button
3. On click → Trigger `fetchKeywordPositions` action (calls DataForSEO)
4. Show loading state
5. Poll for results (positions saved to `keywordPositions` table)
6. Display current positions

**Data to Fetch & Display:**
- **Current Position** (keywordPositions table) - daily tracking
- **Position History** (keywordPositions table filtered by keyword + date range)
- **Search Volume** (keywords table - from DataForSEO keyword data)
- **Keyword Difficulty** (keywords table - separate endpoint `getKeywordDifficulty`)
- **CPC** (keywords table - from DataForSEO)
- **Competition** (keywords table - from DataForSEO)

**Progressive Loading Pattern:**
```typescript
// 1. Fetch keywords with current position
const keywords = useQuery(api.keywords.listByDomain, { domainId });

// 2. Enrich with difficulty (if missing) - background
useEffect(() => {
  keywords?.forEach(kw => {
    if (!kw.difficulty) {
      fetchDifficulty(kw._id); // Async action
    }
  });
}, [keywords]);

// 3. Load history on demand (when user clicks "View History")
const [selectedKeyword, setSelectedKeyword] = useState(null);
const history = useQuery(
  api.keywords.getPositionHistory,
  selectedKeyword ? { keywordId: selectedKeyword } : "skip"
);
```

### File Structure Convention

```
src/
├── app/
│   ├── (auth)/          # Auth pages (login, register)
│   ├── (dashboard)/     # Main app pages
│   │   ├── layout.tsx   # Sidebar + header
│   │   ├── page.tsx     # Dashboard
│   │   ├── projects/
│   │   │   └── page.tsx # Projects list (full page)
│   │   ├── domains/
│   │   │   └── page.tsx # Domains list (full page)
│   │   └── keywords/
│   │       └── page.tsx # Keywords list (full page)
│   └── (public)/        # Public reports
├── components/
│   ├── features/        # Feature-specific components
│   │   ├── projects/
│   │   │   ├── CreateProjectDialog.tsx      # Modal
│   │   │   ├── ProjectSlideout.tsx          # Slideout with tabs
│   │   │   └── ProjectsTable.tsx            # Table component
│   │   ├── domains/
│   │   └── keywords/
│   ├── patterns/        # Reusable patterns
│   │   ├── SlideoutDetailView.tsx
│   │   ├── DataTableWithFilters.tsx
│   │   └── RowActionDropdown.tsx
│   └── shared/          # Shared UI components
└── lib/
    └── hooks/           # Custom hooks
        ├── useKeywordPositions.ts
        └── useProgressiveData.ts
```

---

## Phase 1: Foundation (1-2 days) ✓

**Status:** Plan exists at `docs/plans/2026-01-29-frontend-rebuild-phase1-foundation.md`

**Deliverables:**
- All Untitled UI components installed
- Pattern components (SlideoutDetailView, DataTableWithFilters, RowActionDropdown)
- Global providers (Command, Toast)
- Error boundary
- Test page

---

## Phase 2: Authentication & Layout (1 day)

**Goal:** Implement authentication pages and dashboard layout with sidebar navigation.

### Task 1: Create Login Page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

**Step 1: Create auth layout**

Create file: `src/app/(auth)/layout.tsx`

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Create login page**

Create file: `src/app/(auth)/login/page.tsx`

```typescript
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/base/button/button";
import { Input } from "@/components/base/input/input";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn("password", { email, password, flow: "signIn" });
      router.push("/dashboard");
      toast.success("Logged in successfully");
    } catch (error) {
      toast.error("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold">Sign In</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" loading={loading}>
          Sign In
        </Button>
      </form>
    </div>
  );
}
```

**Step 3: Test login page**

Run: `npm run dev`
Open: `localhost:3000/login`
Test: Enter credentials and sign in

Expected: Login works, redirects to dashboard

**Step 4: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat: add login page with Convex Auth

- Auth layout with centered form
- Login page with email/password
- Toast notifications for feedback
- Redirect to dashboard on success"
```

### Task 2: Create Dashboard Layout with Sidebar

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Header.tsx`

**Step 1: Create Sidebar component**

Create file: `src/components/layout/Sidebar.tsx`

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Folder,
  Globe,
  Search,
  Users,
  Settings,
  BarChart3
} from "@untitledui/icons";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: Folder },
  { name: "Domains", href: "/domains", icon: Globe },
  { name: "Keywords", href: "/keywords", icon: Search },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Teams", href: "/teams", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="p-6">
        <h1 className="text-xl font-bold">SEO Monitor</h1>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

**Step 2: Create Header component**

Create file: `src/components/layout/Header.tsx`

```typescript
"use client";

import { Button } from "@/components/base/button/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "@untitledui/icons";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function Header() {
  const { signOut } = useAuthActions();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    toast.success("Signed out successfully");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-4">
        {/* Breadcrumbs will go here */}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </header>
  );
}
```

**Step 3: Create dashboard layout**

Create file: `src/app/(dashboard)/layout.tsx`

```typescript
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Step 4: Create placeholder dashboard page**

Create file: `src/app/(dashboard)/page.tsx`

```typescript
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome to SEO Monitor</p>
    </div>
  );
}
```

**Step 5: Test dashboard layout**

Run: `npm run dev`
Open: `localhost:3000/dashboard`

Expected: See sidebar, header, and main content area

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/ src/components/layout/
git commit -m "feat: add dashboard layout with sidebar navigation

- Sidebar with navigation links
- Header with sign out button
- Dashboard layout structure
- Active link highlighting
- Responsive layout ready"
```

---

## Phase 3: Projects Module (2-3 days)

**Goal:** Implement complete Projects module with list view, create dialog, detail slideout, and all CRUD operations.

### Task 1: Create Projects Page (Full Page)

**Files:**
- Create: `src/app/(dashboard)/projects/page.tsx`
- Create: `src/components/features/projects/ProjectsTable.tsx`

**Step 1: Create ProjectsTable component**

Create file: `src/components/features/projects/ProjectsTable.tsx`

```typescript
"use client";

import { DataTableWithFilters } from "@/components/patterns/DataTableWithFilters";
import { DropdownMenu } from "@/components/base/dropdown-menu/dropdown-menu";
import { Button } from "@/components/base/button/button";
import { MoreVertical, Edit, Trash, FolderOpen } from "@untitledui/icons";
import type { Doc } from "@/convex/_generated/dataModel";

interface ProjectsTableProps {
  projects: Doc<"projects">[];
  onView: (project: Doc<"projects">) => void;
  onEdit: (project: Doc<"projects">) => void;
  onDelete: (project: Doc<"projects">) => void;
}

export function ProjectsTable({ projects, onView, onEdit, onDelete }: ProjectsTableProps) {
  return (
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
          id: "domainCount",
          header: "Domains",
          cell: (row) => row.domainCount || 0,
        },
        {
          id: "keywordCount",
          header: "Keywords",
          cell: (row) => row.keywordCount || 0,
        },
        {
          id: "createdAt",
          header: "Created",
          cell: (row) => new Date(row._creationTime).toLocaleDateString(),
        },
        {
          id: "actions",
          header: "",
          cell: (row) => (
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" size="sm" icon={<MoreVertical />} />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={() => onView(row)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => onEdit(row)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => onDelete(row)} destructive>
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          ),
        },
      ]}
      searchKeys={["name"]}
      searchPlaceholder="Search projects..."
      onRowClick={onView}
    />
  );
}
```

**Step 2: Create Projects page**

Create file: `src/app/(dashboard)/projects/page.tsx`

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ProjectsTable } from "@/components/features/projects/ProjectsTable";
import { Button } from "@/components/base/button/button";
import { Plus } from "@untitledui/icons";
import { BreadcrumbNav } from "@/components/shared/BreadcrumbNav";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { useState } from "react";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  if (!projects) {
    return <LoadingState type="table" rows={5} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <BreadcrumbNav items={[{ label: "Projects" }]} />
          <h1 className="mt-2 text-2xl font-bold">Projects</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title="No projects yet"
          description="Create your first project to start tracking keywords"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              Create Project
            </Button>
          }
        />
      ) : (
        <ProjectsTable
          projects={projects}
          onView={(project) => setSelectedProject(project)}
          onEdit={(project) => console.log("Edit", project)}
          onDelete={(project) => console.log("Delete", project)}
        />
      )}

      {/* CreateProjectDialog will go here */}
      {/* ProjectSlideout will go here */}
    </div>
  );
}
```

**Step 3: Test projects page**

Run: `npm run dev`
Open: `localhost:3000/projects`

Expected: See empty state or projects table

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/projects/ src/components/features/projects/
git commit -m "feat: add Projects page with table and row actions

- Projects list page (full page)
- ProjectsTable with row action dropdown
- Empty state for no projects
- Breadcrumb navigation
- Loading state
- Search filtering ready"
```

### Task 2: Create Project Dialog (Modal)

**Files:**
- Create: `src/components/features/projects/CreateProjectDialog.tsx`

**Step 1: Create CreateProjectDialog**

Create file: `src/components/features/projects/CreateProjectDialog.tsx`

```typescript
"use client";

import { Dialog } from "@/components/base/dialog/dialog";
import { Button } from "@/components/base/button/button";
import { Input } from "@/components/base/input/input";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const createProject = useMutation(api.projects.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createProject({ name, description });
      toast.success("Project created");
      onOpenChange(false);
      setName("");
      setDescription("");
    } catch (error) {
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Create Project</Dialog.Title>
          <Dialog.Description>
            Create a new project to organize your domains and keywords
          </Dialog.Description>
        </Dialog.Header>

        <form onSubmit={handleSubmit}>
          <Dialog.Body className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Project Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My SEO Project"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Description (optional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Project description"
              />
            </div>
          </Dialog.Body>

          <Dialog.Footer>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Project
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
```

**Step 2: Wire CreateProjectDialog into Projects page**

Modify: `src/app/(dashboard)/projects/page.tsx`

Add import:
```typescript
import { CreateProjectDialog } from "@/components/features/projects/CreateProjectDialog";
```

Add before closing div:
```typescript
<CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
```

**Step 3: Test create project**

Run: `npm run dev`
Open: `localhost:3000/projects`
Click: "Create Project"

Expected: Dialog opens, can create project, dialog closes, table updates

**Step 4: Commit**

```bash
git add src/components/features/projects/ src/app/\(dashboard\)/projects/
git commit -m "feat: add Create Project dialog

- Modal dialog for creating projects
- Form with name and description
- Convex mutation integration
- Toast notifications
- Loading states"
```

### Task 3: Create Project Slideout (Complex Detail View)

**Files:**
- Create: `src/components/features/projects/ProjectSlideout.tsx`
- Create: `src/components/features/projects/tabs/OverviewTab.tsx`
- Create: `src/components/features/projects/tabs/DomainsTab.tsx`
- Create: `src/components/features/projects/tabs/SettingsTab.tsx`

**Step 1: Create OverviewTab**

Create file: `src/components/features/projects/tabs/OverviewTab.tsx`

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface OverviewTabProps {
  projectId: Id<"projects">;
}

export function OverviewTab({ projectId }: OverviewTabProps) {
  const project = useQuery(api.projects.get, { id: projectId });
  const stats = useQuery(api.projects.getStats, { projectId });

  if (!project || !stats) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-500">Description</h3>
        <p className="mt-1">{project.description || "No description"}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold">{stats.domainCount}</div>
          <div className="text-sm text-gray-600">Domains</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold">{stats.keywordCount}</div>
          <div className="text-sm text-gray-600">Keywords</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold">{stats.avgPosition || "-"}</div>
          <div className="text-sm text-gray-600">Avg Position</div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-500">Created</h3>
        <p className="mt-1">
          {new Date(project._creationTime).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Create DomainsTab**

Create file: `src/components/features/projects/tabs/DomainsTab.tsx`

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/base/button/button";
import { Plus } from "@untitledui/icons";

interface DomainsTabProps {
  projectId: Id<"projects">;
}

export function DomainsTab({ projectId }: DomainsTabProps) {
  const domains = useQuery(api.domains.listByProject, { projectId });

  if (!domains) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Domains ({domains.length})</h3>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Domain
        </Button>
      </div>

      {domains.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-600">No domains yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {domains.map((domain) => (
            <div
              key={domain._id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="font-medium">{domain.url}</div>
              <div className="text-sm text-gray-600">
                {domain.keywordCount || 0} keywords
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create SettingsTab**

Create file: `src/components/features/projects/tabs/SettingsTab.tsx`

```typescript
"use client";

import { Button } from "@/components/base/button/button";
import { Input } from "@/components/base/input/input";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

interface SettingsTabProps {
  projectId: Id<"projects">;
}

export function SettingsTab({ projectId }: SettingsTabProps) {
  const project = useQuery(api.projects.get, { id: projectId });
  const updateProject = useMutation(api.projects.update);
  const deleteProject = useMutation(api.projects.remove);

  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProject({ id: projectId, name, description });
      toast.success("Project updated");
    } catch (error) {
      toast.error("Failed to update project");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure? This will delete all domains and keywords.")) {
      return;
    }

    try {
      await deleteProject({ id: projectId });
      toast.success("Project deleted");
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  if (!project) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 font-medium">Project Settings</h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button onClick={handleSave} loading={loading}>
            Save Changes
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="mb-2 font-medium text-red-600">Danger Zone</h3>
        <p className="mb-4 text-sm text-gray-600">
          Deleting this project will permanently delete all domains and keywords.
        </p>
        <Button variant="destructive" onClick={handleDelete}>
          Delete Project
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Create ProjectSlideout**

Create file: `src/components/features/projects/ProjectSlideout.tsx`

```typescript
"use client";

import { SlideoutDetailView } from "@/components/patterns/SlideoutDetailView";
import { OverviewTab } from "./tabs/OverviewTab";
import { DomainsTab } from "./tabs/DomainsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import type { Doc } from "@/convex/_generated/dataModel";

interface ProjectSlideoutProps {
  project: Doc<"projects"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectSlideout({ project, isOpen, onClose }: ProjectSlideoutProps) {
  if (!project) return null;

  return (
    <SlideoutDetailView
      isOpen={isOpen}
      onClose={onClose}
      title={project.name}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: <OverviewTab projectId={project._id} />,
        },
        {
          id: "domains",
          label: "Domains",
          content: <DomainsTab projectId={project._id} />,
        },
        {
          id: "settings",
          label: "Settings",
          content: <SettingsTab projectId={project._id} />,
        },
      ]}
    />
  );
}
```

**Step 5: Wire ProjectSlideout into Projects page**

Modify: `src/app/(dashboard)/projects/page.tsx`

Add import:
```typescript
import { ProjectSlideout } from "@/components/features/projects/ProjectSlideout";
```

Add before closing div:
```typescript
<ProjectSlideout
  project={selectedProject}
  isOpen={!!selectedProject}
  onClose={() => setSelectedProject(null)}
/>
```

**Step 6: Test project slideout**

Run: `npm run dev`
Open: `localhost:3000/projects`
Click: Any project row or "View Details"

Expected: Slideout opens with 3 tabs, can switch tabs, can edit settings, can view domains

**Step 7: Commit**

```bash
git add src/components/features/projects/
git commit -m "feat: add Project slideout with tabs

- ProjectSlideout with 3 tabs (Overview, Domains, Settings)
- OverviewTab with stats cards
- DomainsTab with domain list
- SettingsTab with edit form and delete
- Slideout pattern for complex details"
```

---

## Phase 4: Domains Module (2-3 days)

**Goal:** Implement Domains module with list, create, detail slideout, and keyword position fetching.

### Task 1: Create Domains Page

Similar structure to Projects page.

**Files:**
- Create: `src/app/(dashboard)/domains/page.tsx`
- Create: `src/components/features/domains/DomainsTable.tsx`
- Create: `src/components/features/domains/CreateDomainDialog.tsx`
- Create: `src/components/features/domains/DomainSlideout.tsx`

[Follow same pattern as Projects module]

### Task 2: Add Domain Verification

When domain is added, verify ownership via DNS or file upload.

### Task 3: Implement "Fetch Positions" Action

**Files:**
- Create: `src/components/features/domains/FetchPositionsButton.tsx`

```typescript
"use client";

import { Button } from "@/components/base/button/button";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "@untitledui/icons";
import type { Id } from "@/convex/_generated/dataModel";

interface FetchPositionsButtonProps {
  domainId: Id<"domains">;
}

export function FetchPositionsButton({ domainId }: FetchPositionsButtonProps) {
  const fetchPositions = useAction(api.keywords.fetchPositionsForDomain);
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    toast.info("Fetching positions...", { id: "fetch-positions" });

    try {
      const result = await fetchPositions({ domainId });
      toast.success(`Fetched positions for ${result.count} keywords`, {
        id: "fetch-positions",
      });
    } catch (error) {
      toast.error("Failed to fetch positions", { id: "fetch-positions" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleFetch} loading={loading} size="sm">
      <RefreshCw className="mr-2 h-4 w-4" />
      Fetch Positions
    </Button>
  );
}
```

---

## Phase 5: Keywords Module (3-4 days)

**Goal:** Complete Keywords module with progressive data loading (current position → history → difficulty → volume).

### Task 1: Create Keywords Page

**Files:**
- Create: `src/app/(dashboard)/keywords/page.tsx`
- Create: `src/components/features/keywords/KeywordsTable.tsx`

### Task 2: Implement Progressive Data Loading Hook

**Files:**
- Create: `src/lib/hooks/useKeywordEnrichment.ts`

```typescript
"use client";

import { useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Progressive data loading for keywords:
 * 1. Load keywords with current positions (from query)
 * 2. Enrich with difficulty (if missing) - background
 * 3. Enrich with volume (if missing) - background
 */
export function useKeywordEnrichment(keywords: Doc<"keywords">[] | undefined) {
  const enrichKeyword = useAction(api.keywords.enrichKeywordMetrics);

  useEffect(() => {
    if (!keywords) return;

    // Find keywords missing metrics
    const needsEnrichment = keywords.filter(
      (kw) => !kw.difficulty || !kw.searchVolume || !kw.cpc
    );

    // Enrich in background (batched)
    if (needsEnrichment.length > 0) {
      enrichKeyword({
        keywordIds: needsEnrichment.map((kw) => kw._id),
      }).catch((err) => {
        console.error("Failed to enrich keywords:", err);
      });
    }
  }, [keywords, enrichKeyword]);
}
```

### Task 3: Create Keyword History Chart

**Files:**
- Create: `src/components/features/keywords/KeywordHistoryChart.tsx`

Use position history data to show line chart of rankings over time.

### Task 4: Add "No Positions Yet" State

Show when keyword has no positions, with "Fetch Positions" button.

---

## Phase 6: Dashboard (2 days)

**Goal:** Overview dashboard with key metrics, recent activity, and quick actions.

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`
- Create: `src/components/features/dashboard/StatsCards.tsx`
- Create: `src/components/features/dashboard/RecentActivity.tsx`
- Create: `src/components/features/dashboard/TopKeywords.tsx`

---

## Phase 7: Teams Module (1-2 days)

**Goal:** Multi-user team management with role-based permissions.

---

## Phase 8: Reports Module (2-3 days)

**Goal:** Custom reports with charts, export to PDF/CSV.

---

## Phase 9: Settings Pages (1 day)

**Goal:** User settings, notification preferences, API integrations.

---

## Phase 10: Admin Panel (2 days)

**Goal:** Super admin functionality (user management, organization management, system logs).

---

## Phase 11: Public Reports (2 days)

**Goal:** Public shareable reports with custom branding.

---

## Phase 12: Polish & Testing (2-3 days)

**Goal:** Fix bugs, improve UX, add animations, optimize performance.

---

## Phase 13: Deployment (1 day)

**Goal:** Deploy to production, set up monitoring, configure CI/CD.

---

## Success Criteria

✅ **Complete Rebuild When:**

1. All 13 phases implemented
2. 100% backend preserved and working
3. All Convex queries/mutations/actions integrated
4. Modals used for simple forms
5. Slideouts used for complex details
6. Full pages for main views
7. Row action dropdowns on all tables
8. Progressive keyword data loading works
9. Position fetching works (current + history)
10. Keyword metrics enrichment works (difficulty, volume, CPC)
11. Build succeeds with no errors
12. All pages responsive
13. No console errors

---

## Next Steps

After plan approval:

**Execution Options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?

---

**Plan Created:** 2026-01-29
**Session:** S0050
**Estimated Time:** 6-8 weeks (full-time)
**Backend:** 100% preserved, zero changes
