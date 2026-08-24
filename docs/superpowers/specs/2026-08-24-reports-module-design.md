# Reports Module (P1) — Inventory, Purchase, Waste, Cost Reports

## Context

`plan.md` §34 lists 7 reports: Inventory, Zone, Requisition, Purchase, Waste, Comparison, Cost. Zone, Requisition, and Comparison reports are already implemented (`apps/api/src/reports/reports.service.ts` + `reports.controller.ts`, with matching pages under `apps/web/src/pages/reports/`) and were committed as part of the P1 batch (`97965e0`/`baeea64`). This spec covers the remaining four: **Inventory Report, Purchase Report, Waste Report, Cost Report**.

All P0 domains (auth, master data, inventory, requisitions/transfers, purchasing, waste, audit log, notifications) are implemented on both `apps/api` and `apps/web`. The `reports.read` permission already exists and gates the existing 3 report routes; this spec reuses it rather than adding new permission codes.

`plan.md` §28 also lists Cost, Food Cost, Gross Profit, and Gross Margin as comparison metrics — Food Cost/Gross Profit/Gross Margin require Recipe and Sales data, which are P2 (`plan.md` §45, not built). This spec deliberately scopes Cost Report to cost-consumed only.

## Goals

- Add `GET /reports/inventory`, `GET /reports/purchase`, `GET /reports/waste`, `GET /reports/cost` to the existing `ReportsController`/`ReportsService`, following the exact aggregation-pipeline pattern already used for Zone/Requisition reports (no schema changes — everything derives from data already being written by Inventory, Purchasing, and Waste services).
- Add matching frontend pages, nav entries, and routes mirroring `ZoneReportPage.tsx`.
- Close the test-coverage gap on `reports.service.ts`, which currently has **zero** tests (including the 3 already-shipped reports).

## Non-Goals

- Food Cost, Gross Profit, Gross Margin (blocked on Recipe/Sales — P2).
- Export (CSV/PDF) — out of scope, matches existing 3 reports (screen-only).
- New permission codes — all four reuse `reports.read`.
- Any change to Inventory/Purchasing/Waste services — reports are read-only aggregations over existing collections.

## API & Data Shapes

All four accept `dateFrom`/`dateTo` (via the existing `resolveActivityRange`/`buildDateRangeQuery` helpers, defaulting to month-to-date like the existing reports) and are gated by `@RequirePermission(PERMISSION_CODES.REPORTS_READ)`. No `@ZoneScope` — same as the existing 3 reports, which are Owner/Manager-facing aggregate views, not zone-scoped operational data.

### 1. Inventory Report — `GET /reports/inventory?dateFrom&dateTo&zoneId`

Per-ingredient rows, aggregated from `ZoneStock` (optionally filtered to one zone) joined with `Ingredient` for `minimumStock`/`maximumStock`, plus `StockMovement` totals for the date range:

```ts
interface InventoryReportRow {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalQuantity: number;
  totalValue: number;
  minimumStock: number;
  maximumStock: number;
  stockStatus: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL';
  movementInQuantity: number;
  movementInValue: number;
  movementOutQuantity: number;
  movementOutValue: number;
}
```

`stockStatus`: `OUT_OF_STOCK` if `totalQuantity <= 0`; `LOW_STOCK` if `totalQuantity < minimumStock`; else `NORMAL`. `movementIn`/`movementOut` sum `StockMovement` rows in range where `movementType` is an IN type (`STOCK_IN`, `TRANSFER_IN`, `ADJUSTMENT_IN`) / OUT type (`STOCK_OUT`, `TRANSFER_OUT`, `ADJUSTMENT_OUT`, `WASTE`) respectively, grouped by `ingredientId`.

### 2. Purchase Report — `GET /reports/purchase?dateFrom&dateTo&supplierId`

```ts
interface PurchaseReport {
  totals: { numberOfOrders: number; totalOrderedValue: number; totalReceivedValue: number };
  bySupplier: Array<{ supplierId: string; supplierName: string; count: number; value: number }>;
  byIngredient: Array<{ ingredientId: string; ingredientName: string; quantity: number; value: number }>; // top 10 by value
  trend: Array<{ date: string; value: number }>;
}
```

`totalOrderedValue`/`numberOfOrders`/`bySupplier`/`byIngredient` (ordered side) come from `PurchaseOrder` documents with `createdAt` in range, excluding `CANCELLED`/`REJECTED`, summing `orderedQuantity * unitCost` per line. `totalReceivedValue`/`trend` come from `StockMovement` rows with `referenceType: 'PURCHASE_ORDER'` and `movementType: 'STOCK_IN'` in range — same convention `getFlowMetrics`'s `purchase` facet already uses, kept consistent so Purchase Report and the Comparison Report's "ซื้อของ" metric never disagree.

### 3. Waste Report — `GET /reports/waste?dateFrom&dateTo&zoneId`

```ts
interface WasteReport {
  totals: { numberOfRecords: number; totalQuantity: number; totalValue: number; pendingCount: number };
  byReason: Array<{ reason: WasteReason; quantity: number; value: number }>;
  byZone: Array<{ zoneId: string; zoneName: string; quantity: number; value: number }>;
  byIngredient: Array<{ ingredientId: string; ingredientName: string; quantity: number; value: number }>; // top 10
  trend: Array<{ date: string; value: number }>;
}
```

`totals`/`byReason`/`byZone`/`byIngredient`/`trend` are computed from `Waste` documents with `status: 'APPROVED'` and `createdAt` in range (unapproved waste never touched inventory, so it's excluded from the value totals — matches Rule: only approved waste creates a `StockMovement`). `pendingCount` is a separate count of `status: 'PENDING_APPROVAL'` docs in range, shown for operational visibility but not folded into `totalValue`.

### 4. Cost Report — `GET /reports/cost?dateFrom&dateTo&zoneId`

```ts
interface CostReport {
  totalCost: number;
  byIngredient: Array<{ ingredientId: string; ingredientName: string; cost: number }>; // top 10
  byZone: Array<{ zoneId: string; zoneName: string; cost: number }>;
  byMovementType: Array<{ movementType: 'STOCK_OUT' | 'WASTE' | 'ADJUSTMENT_OUT'; cost: number }>;
  trend: Array<{ date: string; cost: number }>;
}
```

Computed from `StockMovement` rows in range where `movementType` is `STOCK_OUT`, `WASTE`, or `ADJUSTMENT_OUT` (identical movement-type set to the existing `cost` facet in `getFlowMetrics`, so Cost Report and the Comparison Report's "Cost" metric stay consistent), summing `totalCost` grouped by `ingredientId` / `zoneId` / `movementType` / day.

## Implementation Notes

- All four methods live on the existing `ReportsService` class, following the `$facet` aggregation style already used in `getRequisitionReport`. `byIngredient` facets use the same `$sort: { value: -1 }, $limit: 10` pattern as `getRequisitionReport`'s `byIngredient`.
- Name-lookup maps (`ingredientNames`, `zoneNames`, `supplierNames`) are built the same way as the existing `ingredientNames`/`zoneNames`/`userNames` maps in `getRequisitionReport` — fetch once per request, `Map` by stringified `_id`.
- `ReportsModule` needs `Supplier` and `Waste` models injected (`ZoneStock`, `Ingredient`, `Zone`, `Requisition`, `StockMovement`, `User` are already injected); `PurchaseOrder` model also needs adding.
- All currency values pass through the existing `round2` helper.
- Controller routes follow the exact shape of the existing 3: `@RequirePermission(PERMISSION_CODES.REPORTS_READ)` + `@Get('inventory'|'purchase'|'waste'|'cost')` + `@Query()` params, delegating straight to the service.

## Frontend

- `apps/web/src/api/endpoints/reports.ts`: add `inventory`, `purchase`, `waste`, `cost` methods alongside the existing `zone`/`requisition`/`comparison`, same `axiosClient.get(...).then((r) => r.data)` shape.
- `apps/web/src/types/entities.ts`: add `InventoryReportRow`, `PurchaseReport`, `WasteReport`, `CostReport` types matching the shapes above.
- Four new pages under `apps/web/src/pages/reports/`: `InventoryReportPage.tsx`, `PurchaseReportPage.tsx`, `WasteReportPage.tsx`, `CostReportPage.tsx` — each mirrors `ZoneReportPage.tsx` (`DateRangeFilter` + `DataTable`), with a row of `StatCard`s above the table for the `totals` block where the report has one (Purchase, Waste; Inventory and Cost skip StatCards since they're already row-oriented breakdowns, matching how `RequisitionReportPage.tsx` presents `numberOfRequests`/`totalRequestedValue` — check that page's existing StatCard usage and mirror it).
- `apps/web/src/constants/nav.ts`: extend the existing "รายงาน" group with the 4 new items (labels per `plan.md` §74: รายงานสต๊อก / รายงานจัดซื้อ / รายงานของเสีย / รายงานต้นทุน).
- `apps/web/src/app/router.tsx`: 4 new routes under the existing `PERMISSIONS.REPORTS_READ`-gated `<ProtectedRoute>` block.

## Testing

`reports.service.ts` has zero existing tests. Add `apps/api/src/reports/reports.service.spec.ts` covering **all 6** report methods (existing 3 + new 4), following the mock-model convention already used in `waste.service.spec.ts`/`purchasing.service.spec.ts` (plain Jest mocks of injected Mongoose models — `.aggregate`, `.find` — no in-memory DB):

- One test per report asserting the mapping/rounding logic against a canned aggregate/facet result (e.g., `stockStatus` derivation boundaries — exactly at `minimumStock`, at 0 — for Inventory Report; `pendingCount` excluded from `totalValue` for Waste Report; ordered-vs-received value coming from different sources for Purchase Report).
- `getComparisonReport`/`getZoneReport`/`getRequisitionReport` get baseline coverage too since they currently have none.
- No e2e test added in this pass (the existing 3 reports also have none) — flagged as a pre-existing gap, not introduced by this spec.

## Open Items Resolved During Design (for traceability)

- Cost Report scope: cost-consumed breakdown only, no Food Cost/Gross Margin (blocked on P2 Recipe/Sales data).
- Inventory Report is a new dedicated report endpoint, not an extension of the existing live `StockBalancePage`.
- Waste Report's value totals count only `APPROVED` waste; `PENDING_APPROVAL` is surfaced as a count only.
- Purchase Report's "ordered" and "received" values intentionally come from different sources (`PurchaseOrder` vs `StockMovement`) to reflect that an order can be approved without being fully received.
- Reuses `reports.read` permission for all four — no new permission codes.
