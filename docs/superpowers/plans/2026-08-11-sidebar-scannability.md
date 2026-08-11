# Sidebar Scannability Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app sidebar (`apps/web`) scannable by adding an icon to every nav item/group, a bolder visually-separated group header, and per-group collapse/expand — without changing permission-filtering logic or persisting collapse state.

**Architecture:** Two files change. `apps/web/src/constants/nav.ts` gains an `icon: LucideIcon` field on both `NavItem` and `NavGroup`, populated with one icon per entry. `apps/web/src/layouts/AppLayout.tsx`'s `SidebarContent` component renders those icons, restyles group headers (icon + bold label + top divider between groups), and adds local (non-persisted) collapse/expand state per group with an animated chevron toggle. No other files change; permission filtering (`permissions.has(...)`, `user.isSuperScope`) is untouched.

**Tech Stack:** React 19, TypeScript, Tailwind v4, `lucide-react` (already a dependency), `react-router-dom` `NavLink`.

## Global Constraints

- Design/data model exactly as specified in `docs/superpowers/specs/2026-08-11-sidebar-scannability-design.md`: the icon mapping table, no `localStorage` persistence of collapse state, all groups expanded on every fresh page load, standalone "ภาพรวม" entry stays non-collapsible.
- No new npm dependencies — collapse animation must use a CSS grid-template-rows technique, not a new library.
- `apps/web` has no component test runner configured; verification is `npm run lint` (oxlint) inside `apps/web`, a TypeScript build check, and manual browser verification — do not introduce a test framework as part of this work.
- UI copy stays Thai; identifiers/types stay English (per project CLAUDE.md).
- Reuse existing design tokens already used in `AppLayout.tsx` (`border-border`, `text-text-primary`, `text-text-secondary`, `bg-primary-light`, `text-primary`) — don't invent new ones.

---

### Task 1: Add icons to the nav data model

**Files:**
- Modify: `apps/web/src/constants/nav.ts`

**Interfaces:**
- Produces: `NavItem.icon: LucideIcon`, `NavGroup.icon: LucideIcon` — consumed by Task 2/3 in `AppLayout.tsx` as `<item.icon />`, `<group.icon />`, `<NAV_STANDALONE.icon />`.

- [ ] **Step 1: Add the `icon` field to both interfaces and import the icons**

Replace the top of `apps/web/src/constants/nav.ts` (imports + interfaces) with:

```ts
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Boxes,
  Package,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  SlidersHorizontal,
  ClipboardCheck,
  History,
  FileText,
  ListChecks,
  FilePlus,
  Database,
  Wheat,
  Tags,
  Ruler,
  Truck,
  MapPin,
  Settings,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { PERMISSIONS, type PermissionCode } from './permissions'

export interface NavItem {
  label: string
  path: string
  permission: PermissionCode
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  icon: LucideIcon
  items: NavItem[]
}
```

- [ ] **Step 2: Assign an icon to `NAV_STANDALONE` and every group/item in `NAV_GROUPS`**

Replace the `NAV_STANDALONE` and `NAV_GROUPS` declarations with:

```ts
export const NAV_STANDALONE: NavItem = {
  label: 'ภาพรวม',
  path: '/dashboard',
  permission: PERMISSIONS.DASHBOARD_READ,
  icon: LayoutDashboard,
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'สต๊อกสินค้า',
    icon: Boxes,
    items: [
      { label: 'สต๊อกคงเหลือ', path: '/inventory/balances', permission: PERMISSIONS.INVENTORY_READ, icon: Package },
      { label: 'รับสินค้า', path: '/inventory/stock-in', permission: PERMISSIONS.INVENTORY_CREATE, icon: PackagePlus },
      { label: 'จ่ายสินค้า', path: '/inventory/stock-out', permission: PERMISSIONS.INVENTORY_CREATE, icon: PackageMinus },
      { label: 'โอนสินค้า', path: '/inventory/transfers', permission: PERMISSIONS.TRANSFER_READ, icon: ArrowLeftRight },
      { label: 'ปรับปรุงสต๊อก', path: '/inventory/adjust', permission: PERMISSIONS.INVENTORY_ADJUST, icon: SlidersHorizontal },
      { label: 'ตรวจนับสต๊อก', path: '/stock-counts', permission: PERMISSIONS.STOCK_COUNT_READ, icon: ClipboardCheck },
      { label: 'ประวัติการเคลื่อนไหว', path: '/inventory/movements', permission: PERMISSIONS.INVENTORY_READ, icon: History },
    ],
  },
  {
    label: 'ใบเบิกสินค้า',
    icon: FileText,
    items: [
      { label: 'รายการใบเบิก', path: '/requisitions', permission: PERMISSIONS.REQUISITION_READ, icon: ListChecks },
      { label: 'สร้างใบเบิก', path: '/requisitions/new', permission: PERMISSIONS.REQUISITION_CREATE, icon: FilePlus },
    ],
  },
  {
    label: 'ข้อมูลพื้นฐาน',
    icon: Database,
    items: [
      { label: 'วัตถุดิบ', path: '/master-data/ingredients', permission: PERMISSIONS.INGREDIENTS_READ, icon: Wheat },
      { label: 'หมวดหมู่', path: '/master-data/categories', permission: PERMISSIONS.CATEGORIES_READ, icon: Tags },
      { label: 'หน่วยนับ', path: '/master-data/units', permission: PERMISSIONS.UNITS_READ, icon: Ruler },
      { label: 'Supplier', path: '/master-data/suppliers', permission: PERMISSIONS.SUPPLIERS_READ, icon: Truck },
      { label: 'Zone', path: '/master-data/zones', permission: PERMISSIONS.ZONES_READ, icon: MapPin },
    ],
  },
  {
    label: 'จัดการระบบ',
    icon: Settings,
    items: [
      { label: 'ผู้ใช้งาน', path: '/management/users', permission: PERMISSIONS.USERS_READ, icon: Users },
      { label: 'บทบาท', path: '/management/roles', permission: PERMISSIONS.ROLES_READ, icon: ShieldCheck },
    ],
  },
]
```

Leave `getDefaultRouteForUser` at the bottom of the file untouched — it doesn't reference `icon`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc -b`
Expected: exits 0, no errors (this will also catch any place elsewhere in the codebase that constructs a `NavItem`/`NavGroup` object literal missing the new required `icon` field — grep confirmed `NAV_STANDALONE`/`NAV_GROUPS` in `nav.ts` are the only construction sites, but the compiler is the authority).

- [ ] **Step 4: Lint**

Run: `cd apps/web && npm run lint`
Expected: exits 0, no new warnings/errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/constants/nav.ts
git commit -m "feat(web): add icons to sidebar nav data model"
```

---

### Task 2: Render icons and bolder group headers in the sidebar

**Files:**
- Modify: `apps/web/src/layouts/AppLayout.tsx`

**Interfaces:**
- Consumes: `NavItem.icon`, `NavGroup.icon`, `NAV_STANDALONE.icon` from Task 1.
- Produces: no new exports; `SidebarContent` render output changes (icons + divider between groups). Task 3 modifies this same function further to add collapse behavior.

- [ ] **Step 1: Replace the `SidebarContent` function**

In `apps/web/src/layouts/AppLayout.tsx`, replace the existing `SidebarContent` function (currently lines 9–47) with:

```tsx
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const permissions = new Set(user?.permissions ?? [])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
      isActive ? 'bg-primary-light text-primary' : 'text-text-primary hover:bg-slate-100',
    )

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      <div className="mb-4 px-2">
        <BrandLogo variant="sidebar" />
      </div>
      {user?.isSuperScope || permissions.has(NAV_STANDALONE.permission) ? (
        <NavLink to={NAV_STANDALONE.path} className={linkClass} onClick={onNavigate}>
          <NAV_STANDALONE.icon className="size-4 shrink-0" />
          {NAV_STANDALONE.label}
        </NavLink>
      ) : null}
      {NAV_GROUPS.map((group, index) => {
        const items = group.items.filter((item) => user?.isSuperScope || permissions.has(item.permission))
        if (items.length === 0) {
          return null
        }
        return (
          <div key={group.label} className={cn('mt-3', index > 0 && 'border-t border-border pt-3')}>
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-text-primary">
              <group.icon className="size-4 shrink-0 text-text-secondary" />
              <span>{group.label}</span>
            </div>
            <div className="flex flex-col gap-1 pt-1">
              {items.map((item) => (
                <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate}>
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
```

Nothing else in the file changes for this task — `AppLayout` (the exported component) stays as-is.

- [ ] **Step 2: Typecheck and lint**

Run: `cd apps/web && npx tsc -b && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Manual browser verification**

Run: `npm run dev:web` from the repo root.
In the browser:
1. Log in (or use an already-authenticated session) as a user with broad permissions (e.g. the seeded Owner account — see `apps/api/src/database/seed.ts` / repo `.env` for seed credentials).
2. Confirm every visible sidebar item and group header shows an icon to the left of its label.
3. Confirm each group header (สต๊อกสินค้า, ใบเบิกสินค้า, ข้อมูลพื้นฐาน, จัดการระบบ) is visually bolder than item labels, and a horizontal divider separates each group from the previous one (the first group has no divider above it).
4. Resize the window below the `lg` breakpoint (or use device toolbar), open the mobile drawer via the hamburger button, and confirm the same icons/headers render correctly there.
5. Log in as (or switch to) a more restricted role and confirm only permitted items/groups still render — i.e. permission filtering still works with the new render path.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/layouts/AppLayout.tsx
git commit -m "feat(web): render icons and bolder group headers in sidebar"
```

---

### Task 3: Collapsible groups

**Files:**
- Modify: `apps/web/src/layouts/AppLayout.tsx`

**Interfaces:**
- Consumes: `SidebarContent` from Task 2 (same file, same function — this task edits it further).
- Produces: no new exports; purely adds interactive collapse/expand to the existing group rendering.

- [ ] **Step 1: Add the `ChevronDown` import**

In `apps/web/src/layouts/AppLayout.tsx`, change:

```tsx
import { LogOut, Menu, X } from 'lucide-react'
```

to:

```tsx
import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
```

- [ ] **Step 2: Add collapse state and a toggle handler inside `SidebarContent`**

Immediately after the line `const permissions = new Set(user?.permissions ?? [])` inside `SidebarContent`, add:

```tsx
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }
```

This requires `useState` to be imported — it already is, via the existing `import { useState, type ReactNode } from 'react'` at the top of the file (used today by `AppLayout`'s `isMobileNavOpen` state). No import change needed here.

- [ ] **Step 3: Turn the group header into a collapse toggle and wrap the item list for animated collapse**

Inside the `NAV_GROUPS.map(...)` callback in `SidebarContent`, replace:

```tsx
        return (
          <div key={group.label} className={cn('mt-3', index > 0 && 'border-t border-border pt-3')}>
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-text-primary">
              <group.icon className="size-4 shrink-0 text-text-secondary" />
              <span>{group.label}</span>
            </div>
            <div className="flex flex-col gap-1 pt-1">
              {items.map((item) => (
                <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate}>
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )
```

with:

```tsx
        const isExpanded = !collapsedGroups.has(group.label)
        return (
          <div key={group.label} className={cn('mt-3', index > 0 && 'border-t border-border pt-3')}>
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={isExpanded}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-text-primary hover:bg-slate-100"
            >
              <group.icon className="size-4 shrink-0 text-text-secondary" />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown
                className={cn('size-4 shrink-0 text-text-secondary transition-transform', !isExpanded && '-rotate-90')}
              />
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-in-out"
              style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-1 pt-1">
                  {items.map((item) => (
                    <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate}>
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
```

- [ ] **Step 4: Typecheck and lint**

Run: `cd apps/web && npx tsc -b && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev:web` from the repo root (if not already running).
In the browser:
1. Confirm all groups render expanded by default.
2. Click a group header — confirm its item list animates closed and the chevron rotates; click again — confirms it animates back open.
3. Click a nav item inside a group (not the header) — confirm it navigates normally and does **not** toggle that group's collapsed state.
4. Collapse a group, then refresh the page — confirm the group is expanded again (state is not persisted, per design).
5. Repeat the collapse/expand check in the mobile drawer (resize below `lg` or use device toolbar).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/layouts/AppLayout.tsx
git commit -m "feat(web): add collapsible sidebar groups"
```
