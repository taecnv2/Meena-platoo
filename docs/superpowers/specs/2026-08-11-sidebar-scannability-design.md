# Sidebar Scannability Redesign

**Date:** 2026-08-11
**Status:** Approved for planning

## Problem

The sidebar (`apps/web/src/layouts/AppLayout.tsx` + `apps/web/src/constants/nav.ts`) renders 4 groups totaling ~16 items as flat text, all styled identically. Group headers (`text-xs uppercase text-secondary`) don't stand out enough from item labels, and there are no icons, so users with broad permissions can't tell at a glance which section they're looking at — they have to read line by line. Confirmed with the user: the specific pain is "แยกกลุ่ม/หมวดไม่ออกชัดเจน" (groups aren't visually distinguishable), not list length or active-state visibility.

## Goals

1. Make each group visually distinct at a glance (icon + stronger header treatment).
2. Make each item scannable by icon shape, not just text.
3. Let users collapse groups they don't need open, to reduce visual noise, without losing the "everything visible on load" behavior they're used to.

## Design

### 1. Icons

- Add an `icon` field (a `LucideIcon` component reference) to both `NavItem` and `NavGroup` in `apps/web/src/constants/nav.ts`.
- Every item and every group header renders its icon to the left of its label, sized consistently with existing icon usage in `AppLayout.tsx` (`size-4` for items, matching the `size-5` used for `Menu`/`X` at group-header scale).
- Icon mapping (all from the already-installed `lucide-react`):

  | Group | Icon | Item | Icon |
  |---|---|---|---|
  | ภาพรวม (standalone) | `LayoutDashboard` | — | — |
  | สต๊อกสินค้า | `Boxes` | สต๊อกคงเหลือ | `Package` |
  | | | รับสินค้า | `PackagePlus` |
  | | | จ่ายสินค้า | `PackageMinus` |
  | | | โอนสินค้า | `ArrowLeftRight` |
  | | | ปรับปรุงสต๊อก | `SlidersHorizontal` |
  | | | ตรวจนับสต๊อก | `ClipboardCheck` |
  | | | ประวัติการเคลื่อนไหว | `History` |
  | ใบเบิกสินค้า | `FileText` | รายการใบเบิก | `ListChecks` |
  | | | สร้างใบเบิก | `FilePlus` |
  | ข้อมูลพื้นฐาน | `Database` | วัตถุดิบ | `Wheat` |
  | | | หมวดหมู่ | `Tags` |
  | | | หน่วยนับ | `Ruler` |
  | | | Supplier | `Truck` |
  | | | Zone | `MapPin` |
  | จัดการระบบ | `Settings` | ผู้ใช้งาน | `Users` |
  | | | บทบาท | `ShieldCheck` |

### 2. Group header treatment

- Replace the current plain uppercase label with a row containing: group icon, group label (heavier weight than today, e.g. `text-sm font-semibold text-text-primary` instead of `text-xs uppercase text-text-secondary`), and a trailing chevron (see collapse behavior below).
- Add a `border-t border-border` (or equivalent spacing) above each group block (except the first) so groups read as visually separated sections, not a continuous list.

### 3. Collapse/expand per group

- Each group header is a clickable button that toggles that group's expanded state.
- Expanded state is local `useState` inside `SidebarContent`, keyed by group label — **not persisted** (no `localStorage`). Every page load/refresh starts with all groups expanded, matching current behavior and the user's explicit choice.
- Chevron rotates (`ChevronDown` when expanded → visually rotated to point right when collapsed, or swap `ChevronDown`/`ChevronRight`) to indicate state.
- Collapsing hides that group's items; clicking an item never affects any group's collapsed state (only the header click toggles).
- Animate the collapse with a CSS grid-template-rows transition (`grid-template-rows: 1fr` ↔ `0fr` on a wrapping `div`, content in a `overflow-hidden` inner div) — no new dependency needed, works in the existing Tailwind setup.
- The standalone "ภาพรวม" entry stays outside the group list, non-collapsible, as it is today.

### 4. Out of scope

- No change to permission filtering logic (which items/groups render at all) — purely visual/interaction layer on top of the existing filtered list.
- No change to mobile drawer behavior beyond inheriting the same `SidebarContent` (it already renders inside both the desktop `<aside>` and the mobile drawer).
- No persistence of collapse state across sessions or devices.

## Files touched

- `apps/web/src/constants/nav.ts` — add `icon` to `NavItem`/`NavGroup` types and data.
- `apps/web/src/layouts/AppLayout.tsx` — `SidebarContent`: render icons, restyle group headers, add collapse/expand state + chevron + animated collapse wrapper.

## Testing

- Manual verification in browser (dev server): confirm icons render for every item/group across at least two roles with different permission sets (to confirm filtering still works with the new render path), confirm collapse/expand toggles correctly and doesn't interfere with navigation clicks, confirm mobile drawer still works.
- No new unit tests needed — this is a presentational change to an already-untested layout component; `npm run lint` in `apps/web` must still pass.
