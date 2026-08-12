# Purchasing Module (P1) — Purchase Order + Receive

## Context

P1 of `plan.md` §44 includes Purchase Order, Purchase Receive, Purchase History, Waste, Audit Log, Notification, Zone/Requisition/Comparison Reports, and Advanced Dashboard — several independent subsystems. This spec covers the first sub-project: **Purchase Order lifecycle + Receiving**, scoped to PO create/approve/receive plus a list/detail view. Purchase cost analytics/reporting is deliberately deferred to a later Reports sub-project.

P0 (auth, master data, inventory, requisitions/transfers) is fully implemented on both `apps/api` and `apps/web`. The reserved permission codes `purchasing.read/create/approve/receive` already exist in `apps/api/src/common/constants/permissions.ts` with a role matrix in `apps/api/src/common/constants/roles.ts` (OWNER: all; MANAGER: read/create/approve/receive; INVENTORY_MANAGER: read/receive; KITCHEN_STAFF/FRONT_STAFF/VIEWER: none) — this spec implements against that existing reservation rather than adding new permission codes.

A recent commit (`b7bf5a9`) introduced a reserved, undeletable `WAREHOUSE` zone as the system's default receiving zone; manual Stock In is now hard-restricted to it. Purchasing follows the same rule.

## Goals

- Model a Purchase Order (PO) as a Supplier-linked, multi-line document that goes through approval before goods can be received.
- Receiving a PO increases stock in the WAREHOUSE zone and creates an auditable `StockMovement`, exactly like every other stock-affecting flow in the system (plan.md §21–23, §52).
- Support partial receiving (receive less than ordered, across multiple receive actions) without inventing new inventory rules — reuse `InventoryService.increment`.
- Do not implement Purchase Report / Cost Analytics UI in this pass — only the data needed to build them later (PO history, unit cost per line, movement linkage via `referenceType`/`referenceId`).

## Non-Goals

- Purchase Report / Cost Analytics dashboard (separate P1 sub-project).
- Auto-updating `Ingredient.defaultCost` from received unit cost (explicitly rejected — defaultCost stays a manual Owner/Manager-edited field).
- Per-line-item delivery zone selection (all POs receive into the single WAREHOUSE zone).
- New `purchasing.reject` / `purchasing.cancel` permission codes (reuse `purchasing.approve` and `purchasing.create` respectively).

## Data Model

New schema `apps/api/src/purchasing/schemas/purchase-order.schema.ts`, following the `Requisition` schema pattern:

```ts
class PurchaseOrderItem {
  ingredientId: ObjectId;      // ref Ingredient
  orderedQuantity: number;
  receivedQuantity: number;    // running total, default 0
  unit: string;                // ingredient's base unit code, snapshotted at creation
  unitCost: number;             // agreed purchase price per unit, PO-specific
}

class PurchaseOrder {
  code: string;                 // "PO-{year}-{seq}", unique, generated like Requisition.code
  supplierId: ObjectId;         // ref Supplier
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
  items: PurchaseOrderItem[];
  deliveryZoneId: ObjectId;     // always resolved server-side to the WAREHOUSE zone id
  createdBy: ObjectId;          // ref User
  approvedBy: ObjectId | null;
  rejectedBy: ObjectId | null;
  rejectionReason: string | null;
  approvedAt: Date | null;
  completedAt: Date | null;     // set when status transitions to RECEIVED
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `supplierId + createdAt`, `status + createdAt` (per plan.md §39's `purchaseOrders` index candidates), unique index on `code`.

`REFERENCE_TYPES` in `apps/api/src/stock-movements/schemas/stock-movement.schema.ts` gains `'PURCHASE_ORDER'`. `MOVEMENT_TYPES` is unchanged — receiving uses the existing `'STOCK_IN'` movement type (plan.md §23's movement type list is fixed and has no purchase-specific type); only the reference type distinguishes a PO receipt from a manual Stock In.

## Status Lifecycle

```
DRAFT ──submit──> PENDING ──approve──> APPROVED ──receive(partial)──> PARTIALLY_RECEIVED ──receive(remaining)──> RECEIVED
  │                  │                     │                                  │
  └──cancel──────────┴──reject             └──cancel                          └──receive(remaining)──> RECEIVED
                                                                                (also reachable directly from APPROVED
                                                                                 if the first receive is a full receive)
```

Rules:
- `submit`: DRAFT → PENDING. No inventory effect.
- `approve`: PENDING → APPROVED. Sets `approvedBy`/`approvedAt`. No inventory effect (mirrors Requisition Rule 2 — approval alone never moves stock).
- `reject`: PENDING → REJECTED. Requires `rejectionReason`. Terminal.
- `cancel`: DRAFT or PENDING → CANCELLED. Terminal. Not allowed once APPROVED (an approved PO represents a supplier commitment already in motion — cancelling post-approval is out of scope for this pass).
- `receive`: allowed only from APPROVED or PARTIALLY_RECEIVED. Accepts per-line received quantities (defaulting to the remaining `orderedQuantity - receivedQuantity` if omitted, same UX as `FulfillRequisitionDto`). Each call increments `receivedQuantity` per line and re-evaluates status: `RECEIVED` if every line's `receivedQuantity === orderedQuantity`, otherwise `PARTIALLY_RECEIVED`. Sets `completedAt` when it reaches `RECEIVED`.
- Received quantity can never exceed ordered quantity per line (validated server-side, `BadRequestException` with a Thai message on violation).

## API & Authorization

| Route | Permission | Notes |
|---|---|---|
| `GET /purchasing` | `purchasing.read` | list, filterable by status/supplier/date-range (reuse the shared date-range filter util from `common/utils/date-range.util.ts`) |
| `GET /purchasing/:id` | `purchasing.read` | detail |
| `POST /purchasing` | `purchasing.create` | creates in DRAFT status |
| `PATCH /purchasing/:id/submit` | `purchasing.create` | DRAFT → PENDING |
| `PATCH /purchasing/:id/approve` | `purchasing.approve` | PENDING → APPROVED |
| `PATCH /purchasing/:id/reject` | `purchasing.approve` | PENDING → REJECTED, requires reason |
| `PATCH /purchasing/:id/receive` | `purchasing.receive` | APPROVED/PARTIALLY_RECEIVED → PARTIALLY_RECEIVED/RECEIVED |
| `PATCH /purchasing/:id/cancel` | `purchasing.create` | DRAFT/PENDING → CANCELLED |

No `@ZoneScope` decorator on any route — the delivery zone is always WAREHOUSE, never client-supplied or derived from the request, so there is no per-user zone boundary to enforce here (consistent with how Owner/Manager-only Purchasing permissions already gate who can touch it). All routes still go through the global `JwtAuthGuard` → `PermissionGuard` chain.

DTOs (`apps/api/src/purchasing/dto/`): `create-purchase-order.dto.ts` (supplierId, items[], remark?), `reject-purchase-order.dto.ts` (reason), `receive-purchase-order.dto.ts` (items: [{ ingredientId, quantity? }]). All validated with `class-validator`, following existing DTO conventions (`CreateRequisitionDto`, `FulfillRequisitionDto` as reference).

## Inventory Integration

`PurchasingService.receive()`:

1. Load the PO, verify status is APPROVED or PARTIALLY_RECEIVED, throw `ConflictException` otherwise (Thai message).
2. Resolve the WAREHOUSE zone id via `ZonesService.getWarehouseZoneId()` (already exists, added in `b7bf5a9`).
3. `InventoryService.withTransaction(async (session) => { ... })`:
   - For each received line, call `inventoryService.increment({ ingredientId, zoneId: warehouseZoneId, quantity, unit, movementType: 'STOCK_IN', referenceType: 'PURCHASE_ORDER', referenceId: po._id, unitCost: line.unitCost, performedBy: userId }, session)`.
   - Update `item.receivedQuantity` on the PO document within the same session.
   - Recompute and persist PO status (`PARTIALLY_RECEIVED` / `RECEIVED`, `completedAt`).
4. Return the updated PO.

This is the same shape as `TransfersService.executeTransfer()` and `RequisitionsService.fulfill()` — one transaction, one or more `InventoryService` primitive calls, a status recompute at the end.

## Frontend

- `apps/web/src/api/endpoints/purchasing.ts`: hand-rolled endpoint file (list/get/create + action methods `submit/approve/reject/receive/cancel`, each a `PATCH .../:id/<action>`), mirroring `endpoints/requisitions.ts`.
- `apps/web/src/pages/purchasing/PurchaseOrdersListPage.tsx`: `DataTable` + status `Badge`, date-range filter, permission-gated "สร้างใบสั่งซื้อ" button (`purchasing.create`).
- `apps/web/src/pages/purchasing/CreatePurchaseOrderPage.tsx`: react-hook-form + zod, `useFieldArray` for line items, supplier dropdown, ingredient dropdown + unit cost input per line — mirrors `CreateRequisitionPage.tsx`.
- `apps/web/src/pages/purchasing/PurchaseOrderDetailPage.tsx`: shows PO header, line items with ordered/received quantities, status history (approvedBy/rejectedBy/timestamps), and permission-gated action buttons (submit/approve/reject/receive/cancel) shown conditionally based on current status + `usePermission`.
- New sidebar group "จัดซื้อ" (per `plan.md` §42/§74: ใบสั่งซื้อ / รับสินค้า / ประวัติการจัดซื้อ — this pass wires ใบสั่งซื้อ list+create+detail; รับสินค้า is the receive action inside the detail page rather than a separate page; ประวัติการจัดซื้อ is just the list page filtered to RECEIVED, no separate route needed).
- New routes in `src/app/router.tsx`, each wrapped in `<ProtectedRoute permission={PERMISSIONS.PURCHASING_*} />`.

## Testing

- Unit tests (`purchasing.service.spec.ts`): status transition guards (reject from non-PENDING throws, receive from DRAFT throws, receive quantity exceeding ordered throws), partial-receive accumulation across two calls reaching RECEIVED, code generation uniqueness/retry.
- E2E (`test/purchasing.e2e-spec.ts`): full happy path — create → submit → approve → receive (partial) → receive (remaining) → assert `ZoneStock` for WAREHOUSE and two `StockMovement` records with `referenceType: 'PURCHASE_ORDER'`; a forbidden-permission case (KITCHEN_STAFF hitting `POST /purchasing` → 403).

## Open Items Resolved During Design (for traceability)

- PO requires approval before receiving — yes.
- Receiving zone — always the reserved WAREHOUSE zone, not user-selectable, consistent with `b7bf5a9`.
- Partial receive — accumulates per-line, same pattern as Requisition fulfillment.
- Received unit cost does **not** auto-update `Ingredient.defaultCost`.
- Scope — PO + Receive + list/detail only; Purchase Report/Cost Analytics is a separate sub-project.
- Reject/Cancel reuse the already-reserved `purchasing.approve`/`purchasing.create` permission codes rather than adding new ones.
