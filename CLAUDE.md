# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Meena Inventory** — an internal Inventory & Operations Management System for the Thai restaurant **Meena Platoo (มีนาปลาทู)**. npm workspaces monorepo: `apps/api` (NestJS + MongoDB) and `apps/web` (React + Vite).

The full product/domain/authorization/UI spec lives in `plan.md` at the repo root — **read it before implementing any non-trivial feature**. It defines the business rules (inventory movement rules, requisition vs. transfer semantics, RBAC + Permission + Zone Scope model, Thai-first localization, blue/white branding) that the code below already implements. Do not treat this app as generic CRUD; every mutation is expected to be authorized, validated, and traceable through an inventory movement per `plan.md` §52–53.

## Commands

Run from the repo root (npm workspaces):

```bash
npm run dev:api        # apps/api start:dev (Nest watch mode, port 3000)
npm run dev:web        # apps/web dev (Vite, port 5173)
npm run build:api
npm run build:web
npm run seed           # apps/api seed script — creates permissions/roles/zones/owner user
npm run lint           # lints both api and web
```

Inside `apps/api`:

```bash
npm run start:dev      # watch mode
npm run test           # jest unit tests (*.spec.ts, colocated in src/)
npm run test -- inventory.service   # run a single test file by name pattern
npm run test:e2e       # jest e2e (test/*.e2e-spec.ts, separate config)
npm run test:cov
npm run lint           # eslint --fix
npm run seed           # ts-node src/database/seed.ts
```

Inside `apps/web`:

```bash
npm run dev
npm run build           # tsc -b && vite build
npm run lint             # oxlint
```

There is no root-level test runner — run tests from within `apps/api`.

## Architecture

### Backend (`apps/api`, NestJS + Mongoose/MongoDB)

One module per business domain under `src/`, mirroring `plan.md` §4 (auth, users, roles, permissions, zones, categories, units, suppliers, ingredients, inventory, stock-movements, transfers, requisitions, stock-counts, dashboard). Each module follows `*.module.ts` / `*.controller.ts` / `*.service.ts` / `dto/` / `schemas/`.

**Request authorization pipeline** (mirrors `plan.md` §6/§16, wired globally in `app.module.ts` via `APP_GUARD`, executed in this order for every request):

1. `JwtAuthGuard` — authenticates via `Authorization: Bearer` header (passport-jwt strategy in `auth/strategies/jwt.strategy.ts`); routes opt out with the `@Public()` decorator.
2. `PermissionGuard` — reads `@RequirePermission('resource.action')` metadata and checks it against `request.user.permissions`.
3. `ZoneScopeGuard` — reads `@ZoneScope({ source, field, ... })` metadata and checks the resolved zone id against `request.user.zoneIds` (bypassed if `user.isSuperScope`, i.e. Owner-style all-zone access).

`ZoneScope` can resolve the target zone id from the request `param`/`query`/`body`, or from an existing `entity` (looked up via `ModuleRef` calling `findZoneIdById(id, field)` on a service that implements `ZoneLookupService` — e.g. resolving a requisition's own `toZoneId` when approving it, not something present on the request body). When adding a new mutating endpoint that touches zone-scoped data, add both decorators — don't rely on service-layer checks alone.

Permission codes follow `resource.action` (e.g. `requisition.approve`) and must never be zone-specific (no `kitchen.inventory.read`) — zone restriction is always the separate `ZoneScope` layer. See `common/constants/permissions.ts` and `common/constants/roles.ts` for the canonical list and the default role→permission matrix (`plan.md` §9–19), applied by `database/seed.ts`.

**Inventory consistency rules** (`plan.md` §21–23, implemented in `inventory/inventory.service.ts`):

- `ZoneStock` documents (`ingredientId` + `zoneId`) are the source of truth for "how much of X is in zone Y"; total restaurant stock is always the sum across zones.
- Every stock mutation goes through `InventoryService.increment` / `.decrement`, which atomically updates `ZoneStock` and appends an immutable `StockMovement` record in the same MongoDB transaction (`withTransaction`, via `connection.startSession()`). Movements are never edited after creation.
- `decrement` uses a conditional `$gte` filter so concurrent operations can't drive stock negative (`plan.md` §40); a failed decrement throws `ConflictException` without writing a movement.
- **Requisition creation does not move stock** — only approval → fulfillment → the resulting Transfer does (`plan.md` §24, §22 Rule 2/3). Don't conflate the two flows.
- When adding a new stock-affecting feature (purchasing receive, waste, stock count adjustment, etc.), route it through `InventoryService.increment`/`decrement` inside `withTransaction` rather than writing to `ZoneStock` directly.

**Response/error conventions**: `TransformInterceptor` wraps all successful responses as `{ success: true, data }`; `HttpExceptionFilter` normalizes error responses. User-facing exception messages (validation, `ForbiddenException`, etc.) are written in Thai (see `common/guards/*.guard.ts`) — keep this convention for new endpoints per `plan.md` §63.

**Config**: environment variables are typed/validated through `config/configuration.ts` + `config/env.validation.ts` (`ConfigModule.forRoot({ validate })`), not read ad hoc via `process.env` elsewhere. `.env.example` documents required vars (Mongo URI, JWT access/refresh secrets and TTLs, refresh cookie name, bcrypt rounds, CORS origin, seed owner credentials).

### Frontend (`apps/web`, React 19 + Vite + TanStack Query + Tailwind v4)

- Path alias `@/*` → `src/*` (`vite.config.ts`).
- `src/api/axiosClient.ts` is the single Axios instance: unwraps the backend's `{ success, data }` envelope, attaches the access token from `tokenStore`, and on `401` transparently calls `/auth/refresh` (dedup'd via a shared in-flight `refreshPromise`) before retrying the original request once; refresh failure clears the token and redirects to `/login`.
- `src/api/createCrudApi.ts` is a generic factory (`list/get/create/update`) — use it for straightforward resource endpoints under `src/api/endpoints/*` instead of hand-rolling Axios calls; add resource-specific methods (e.g. approve/fulfill actions) alongside the generated CRUD object.
- Routing (`src/app/router.tsx`) gates every route with `<ProtectedRoute permission={PERMISSIONS.X} />`; add new pages by wrapping their `<Route>` in a `ProtectedRoute` with the matching backend permission constant from `src/constants/permissions.ts`, mirroring the guard chain on the API side. Frontend permission checks are UX only — the real boundary is the backend guard chain above (`plan.md` §37–38).
- `src/features/auth/AuthContext.tsx` holds the authenticated user (with resolved `permissions`/`zoneIds`); `src/hooks/usePermission.ts` and `useZoneAccess.ts` read from it for conditional rendering.
- Shared design-system primitives live in `src/components/` (Button, Input, Select, DataTable, Modal, StatCard, Badge, ConfirmDialog, etc.) — reuse these rather than one-off styled elements, per `plan.md` §79.
- UI copy is Thai-first (`src/constants/labels.ts`, `src/constants/nav.ts`); identifiers, types, and API contracts stay in English per `plan.md` §64.

### Cross-cutting

When a change affects business state, trace it through the full chain the domain expects (`plan.md` §52): **Auth → Permission → Zone Scope → Inventory → Movement → Audit → Report.** A new mutating feature typically needs: a DTO with `class-validator` rules, a permission constant + role matrix update, a `ZoneScope` decorator on the controller route, a service method that goes through `InventoryService`/`StockMovementsService` where stock is involved, and corresponding frontend route guarding — not just a UI form.
