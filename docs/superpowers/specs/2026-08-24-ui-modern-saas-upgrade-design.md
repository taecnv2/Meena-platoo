# Modern SaaS Dashboard UI Upgrade

**Date:** 2026-08-24
**Status:** Approved for planning

## Problem

The current UI (`apps/web`) is intentionally flat per `plan.md` §67/§77 — thin borders, `shadow-sm` at most, no gradients, no depth cues. It satisfies "Clean / Modern / Minimal" but reads as bare rather than premium. The user asked to level it up to feel like a modern SaaS product (e.g. Linear/Vercel/Stripe dashboards) — more visual depth, gradient accents on key elements, livelier stat/trend presentation — while staying inside the existing **Blue + White** brand theme from `plan.md` §66–80 (no new brand colors, no dark mode, no restructuring of the information architecture).

## Goals

1. Give the design system (tokens + core components) more depth and polish without abandoning the Blue+White, restaurant-friendly minimalism `plan.md` requires.
2. Make `DashboardPage` the flagship example of the new style, using data the API already returns (no backend changes).
3. Do it with zero new runtime dependencies — CSS/Tailwind only, no `framer-motion` (confirmed with user).
4. Every other page inherits the upgrade for free by virtue of reusing the same shared components (`Button`, `Card`, `Badge`, `StatCard`, `DataTable`) and `AppLayout` — no per-page layout rewrites in this pass.

## Non-goals

- No dark mode.
- No new color palette / no departure from Blue+White brand theme.
- No animation library dependency.
- No backend/API changes — the dashboard chart added below must be built from fields `DashboardSummary` already exposes (`data.operations.stockCountStatus`).
- No rewrite of individual feature pages (inventory, purchasing, requisitions, etc.) beyond what they get automatically from shared components.

## Design

### 1. Design tokens (`apps/web/src/index.css`)

Add tokens; keep every existing token unchanged (nothing currently consuming them should break):

```css
@theme {
  /* existing tokens unchanged */

  --gradient-primary: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);

  --color-success-border: #86efac;
  --color-warning-border: #fcd34d;
  --color-danger-border: #fca5a5;
  --color-info-border: #7dd3fc;
}
```

- `--gradient-primary` is used only for small accent surfaces (icon chips, active-nav accent, hero strip wash) — never as a full-page or full-card background. This keeps the "White-based interface with blue as the main accent" rule from `plan.md` §67 intact.
- The new `*-border` tokens let `Badge` add a subtle matching border instead of a flat single-color fill, without touching the existing `*-light` fill tokens other components already depend on.
- Elevation (hover shadows) uses Tailwind's built-in `shadow-md`/`shadow-lg` utilities with an existing-blue tint via arbitrary value (e.g. `shadow-[0_8px_24px_-8px_rgba(37,99,235,0.25)]`) rather than new tokens — scoped inline per component, since only a couple of components need it.

### 2. Core components (`apps/web/src/components/`)

**StatCard.tsx**
- Icon container changes from flat tone background (`bg-primary-light text-primary`) to a gradient-filled chip: `bg-gradient-to-br from-{tone}-400 to-{tone}-600 text-white shadow-sm`, tone-mapped the same way `TONE_ICON_CLASSES` already works (default tone uses `--gradient-primary` via an arbitrary-value class, other tones use Tailwind's existing green/amber/red 400→600 gradients so no new tokens are needed for them).
- `trend` renders as a small pill (`inline-flex items-center gap-1 rounded-full px-2 py-0.5`) with `TrendingUp`/`TrendingDown` (lucide) instead of a plain colored text line.
- `Card` wrapper gets a hover state: `transition-shadow duration-200 hover:shadow-md`.

**Card.tsx**
- Add an optional `interactive?: boolean` prop. When true, appends hover-lift classes (`transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`) on top of the existing base classes. Default `Card` usage (no prop) is visually unchanged apart from any hover styling added directly by consumers like `StatCard`.

**Badge.tsx**
- Each `COLOR_CLASSES` entry gets a matching `border` class using the new `*-border` tokens, e.g. `success: 'bg-success-light text-green-800 border border-success-border'`. Purely additive — no prop/signature change, so every existing call site is unaffected.

**Button.tsx**
- `primary` variant gains a tinted shadow: `shadow-[0_1px_2px_rgba(37,99,235,0.05),0_4px_12px_-2px_rgba(37,99,235,0.25)]` plus `hover:shadow-[0_4px_16px_-2px_rgba(37,99,235,0.35)]`.
- All variants get `active:scale-[0.98]` on the shared base classes for press feedback.
- No prop/signature changes.

**DataTable.tsx**
- Header row: sticky (`sticky top-0 z-10`) with `bg-slate-50` background (currently likely transparent/plain).
- Body rows: `transition-colors hover:bg-slate-50/70` (only if not already present — verify current classes before editing).
- Outer wrapper keeps existing `Card`-equivalent border/shadow treatment (no structural change, just confirm it visually matches the refreshed `Card`).

### 3. Sidebar / Topbar (`apps/web/src/layouts/AppLayout.tsx`)

- **Active nav item** (`linkClass` in `SidebarContent`): replace flat `bg-primary-light text-primary` with a left accent bar + soft gradient wash, e.g. `border-l-2 border-primary bg-gradient-to-r from-primary-light to-transparent text-primary`. Inactive/hover states unchanged.
- **Topbar** (`<header>`): replace `border-b border-border` with a subtle shadow (`shadow-sm`) so it reads as elevated above `<main>` rather than merely divided from it — keep `bg-white`.
- **User indicator**: replace the plain username/role text block with a small circular avatar (`bg-gradient-to-br from-primary to-indigo-600 text-white text-xs font-semibold`) placed before the existing name/role text (which stays as-is). Avatar content is the first character of `user?.username`, uppercased (e.g. `"chana"` → `"C"`); fall back to `"?"` if `username` is empty/undefined. Purely additive, no new dependency.

### 4. DashboardPage (`apps/web/src/pages/DashboardPage.tsx`)

- **Hero header**: wrap the existing title block (`<h1>ภาพรวม</h1>` + subtitle) in a `Card`-like strip with a faint gradient wash background (`bg-gradient-to-r from-primary-light/40 to-transparent`), rounded, with the existing `DateRangeFilter` inline on larger screens (still stacked on mobile — no new responsive breakpoints beyond what `DateRangeFilter` already handles).
- **KPI grids**: unchanged structure/data-binding, just automatically pick up the new `StatCard` visuals.
- **"สถานะการตรวจนับสต๊อก" card**: replace the plain `Object.entries(...).map(...)` text-row list with a horizontal bar chart built with `recharts` (already a dependency, currently unused on this page), driven by the exact same `data.operations.stockCountStatus` map — no new API field. Each bar labeled with the existing `STOCK_COUNT_STATUS_LABEL` Thai labels. If the map is empty, keep the current empty-state message unchanged.
  - Chart colors: at implementation time, follow the `dataviz` skill for palette/contrast/accessibility guidance rather than picking arbitrary hex values ad hoc.
- **"Zone ที่เบิกมากที่สุด" card**: unchanged content, just benefits from the refreshed `Card`/icon styling already applied via `CardHeader`'s icon usage (no code change needed beyond what Card.tsx already provides).

### Out of scope confirmation

- No changes to `plan.md`'s color values, Thai copy, permission/zone logic, or API contracts.
- No changes to pages other than `DashboardPage.tsx` and the shared layout/component files listed above.
- No new npm dependency (recharts is already installed; used here for the first time on this page).

## Files touched

- `apps/web/src/index.css`
- `apps/web/src/components/StatCard.tsx`
- `apps/web/src/components/Card.tsx`
- `apps/web/src/components/Badge.tsx`
- `apps/web/src/components/Button.tsx`
- `apps/web/src/components/DataTable.tsx`
- `apps/web/src/layouts/AppLayout.tsx`
- `apps/web/src/pages/DashboardPage.tsx`

## Testing

- `npm run lint` in `apps/web` must pass.
- Manual verification in browser (dev server): confirm Dashboard renders correctly with real data across at least one role, confirm the new stock-count chart renders for both empty and populated `stockCountStatus`, confirm sidebar active-state/collapse and mobile drawer still work, confirm hover/press states on `Button`/`Card`/`StatCard`/`DataTable` rows look correct, spot-check 2-3 other pages (e.g. inventory list, a form page) to confirm the shared-component changes don't visually break anything there.
- No new unit tests needed — this is a presentational change to already-untested UI components; existing component/page tests (if any) must continue to pass.
