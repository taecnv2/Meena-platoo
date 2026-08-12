# Purchasing Module (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Purchase Order lifecycle (create → submit → approve/reject → receive, with partial receiving) so purchasing brings stock into the reserved WAREHOUSE zone with a full audit trail, on both `apps/api` and `apps/web`.

**Architecture:** A new `purchasing` NestJS module mirrors the existing `requisitions` module's shape exactly (schema with an embedded item subdocument tracking running totals, a service with one method per status transition, a thin permission-gated controller) and reuses `InventoryService.increment`/`withTransaction` for the one action that actually moves stock (`receive`). The frontend adds a `purchasing` API endpoint file and three pages (list/create/detail) that mirror the existing `requisitions` pages pixel-for-pixel in structure.

**Tech Stack:** NestJS 11 + Mongoose 9 + class-validator (backend), React 19 + TanStack Query + react-hook-form + zod + Tailwind v4 (frontend), Jest + ts-jest for backend unit tests.

## Global Constraints

- Full design spec: `docs/superpowers/specs/2026-08-12-purchasing-module-design.md` — read it if anything below is ambiguous.
- Permission codes `purchasing.read/create/approve/receive` are **already reserved** in `apps/api/src/common/constants/permissions.ts` and already wired into the role matrix in `apps/api/src/common/constants/roles.ts` (OWNER: all; MANAGER: read/create/approve/receive; INVENTORY_MANAGER: read/receive). Do not add new permission codes — reject reuses `purchasing.approve`, cancel reuses `purchasing.create`.
- Receiving always targets the reserved WAREHOUSE zone via `ZonesService.getWarehouseZoneId()` — never a client-supplied zone id.
- Every stock mutation must go through `InventoryService.increment`/`decrement` inside `InventoryService.withTransaction`. Never write to `ZoneStock` directly.
- UI copy is Thai; technical identifiers (types, fields, routes) are English (plan.md §63–64).
- This codebase currently has **zero** test files (no `*.spec.ts` anywhere, no `mongodb-memory-server` dependency, only a boilerplate `app.e2e-spec.ts` health check). This plan writes real Jest **unit tests** for `PurchasingService` using mocked Mongoose models/services — no DB required. It does **not** add e2e/integration tests, since that would require introducing new test infrastructure (e.g. `mongodb-memory-server`) that is out of scope for this feature and not established anywhere else in the codebase.
- No `@ZoneScope` decorator is used anywhere in the Purchasing controller — delivery is always the WAREHOUSE zone, so there is no per-request zone to validate.
- **Discovered during Task 1 (amended after initial review):** `apps/api/tsconfig.json` sets `isolatedModules: true`, which makes `ts-jest` transpile each file without cross-file type information. Combined with `@nestjs/mongoose`'s `@Prop()` decorator, this means any Mongoose schema property typed as a string-literal union (e.g. `status!: PurchaseOrderStatus`) with no explicit `type` throws `Cannot determine a type for the "<Class>.<field>" field (union/intersection/ambiguous type was used)` the moment the schema module is imported under Jest — confirmed by reproducing the identical crash on the pre-existing `RequisitionSchema.status` field, so this is not new breakage, just never previously exercised (this codebase had zero test files before this plan). The real `nest build` output is unaffected (`tsc`'s full-program compile resolves the union type without needing `isolatedModules`), so this is purely a test-time issue. **Every `@Prop()` for an enum/union-typed field written or touched in this plan must pass an explicit `type: String` alongside `enum:`** — e.g. `@Prop({ type: String, enum: PURCHASE_ORDER_STATUSES, default: 'DRAFT', index: true })`. Task 1 and Task 2 below already reflect this.

---

## Task 1: StockMovement gains a PURCHASE_ORDER reference type

**Files:**
- Modify: `apps/api/src/stock-movements/schemas/stock-movement.schema.ts`
- Test: `apps/api/src/stock-movements/schemas/stock-movement.schema.spec.ts` (new)

**Interfaces:**
- Produces: `REFERENCE_TYPES` array containing `'PURCHASE_ORDER'`, used by Task 5's `receive()` when calling `InventoryService.increment`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/stock-movements/schemas/stock-movement.schema.spec.ts`:

```ts
import { REFERENCE_TYPES } from './stock-movement.schema';

describe('StockMovement REFERENCE_TYPES', () => {
  it('includes PURCHASE_ORDER for purchase-order receiving', () => {
    expect(REFERENCE_TYPES).toContain('PURCHASE_ORDER');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npm run test -- stock-movement.schema`
Expected: FAIL. The failure will actually be `Cannot determine a type for the "StockMovement.movementType" field (union/intersection/ambiguous type was used)`, thrown at import time by `@nestjs/mongoose`'s `@Prop()` decorator — not a clean `toContain` assertion failure. This is a genuine, reproducible pre-existing gap: `apps/api/tsconfig.json` has `isolatedModules: true`, so `ts-jest` cannot resolve the `MovementType`/`ReferenceType` string-literal unions through cross-file type information, and `@nestjs/mongoose` refuses to guess. It reproduces identically on the pre-existing `RequisitionSchema.status` field, so it is not something this task introduces — it has simply never been exercised, because this codebase had zero test files before this plan. `nest build` (real `tsc`) is unaffected. Step 3 fixes this as part of adding the new reference type, since any import from this module (including just `REFERENCE_TYPES`) evaluates the whole file, including the class decorators.

- [ ] **Step 3: Add the reference type and fix the enum Prop decorators**

In `apps/api/src/stock-movements/schemas/stock-movement.schema.ts`, update the `REFERENCE_TYPES` array (currently lines 18–26):

```ts
export const REFERENCE_TYPES = [
  'STOCK_IN',
  'STOCK_OUT',
  'TRANSFER',
  'ADJUSTMENT',
  'STOCK_COUNT',
  'WASTE',
  'PURCHASE_ORDER',
  'MANUAL',
] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];
```

Also add an explicit `type: String` to the `movementType` and `referenceType` `@Prop()` decorators further down in the same file (this is required for Step 4 below to pass, per the Step 2 explanation above — not optional cleanup):

```ts
  @Prop({ type: String, enum: MOVEMENT_TYPES, required: true, index: true })
  movementType!: MovementType;

  @Prop({ type: String, enum: REFERENCE_TYPES, required: true })
  referenceType!: ReferenceType;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npm run test -- stock-movement.schema`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/api && git add src/stock-movements/schemas/stock-movement.schema.ts src/stock-movements/schemas/stock-movement.schema.spec.ts
git commit -m "feat(api): add PURCHASE_ORDER stock movement reference type"
```

---

## Task 2: PurchaseOrder schema

**Files:**
- Create: `apps/api/src/purchasing/schemas/purchase-order.schema.ts`
- Test: `apps/api/src/purchasing/schemas/purchase-order.schema.spec.ts`

**Interfaces:**
- Consumes: nothing beyond `@nestjs/mongoose` primitives.
- Produces: `PurchaseOrder`, `PurchaseOrderDocument`, `PurchaseOrderItem`, `PurchaseOrderSchema`, `PurchaseOrderItemSchema`, `PURCHASE_ORDER_STATUSES`, `PurchaseOrderStatus` — consumed by every later backend task.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/purchasing/schemas/purchase-order.schema.spec.ts`:

```ts
import { PurchaseOrderSchema } from './purchase-order.schema';

describe('PurchaseOrderSchema', () => {
  it('defines the expected top-level fields', () => {
    const paths = Object.keys(PurchaseOrderSchema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'code',
        'supplierId',
        'status',
        'items',
        'deliveryZoneId',
        'createdBy',
        'approvedBy',
        'rejectedBy',
        'rejectionReason',
        'cancelledBy',
        'approvedAt',
        'completedAt',
        'remark',
      ]),
    );
  });

  it('defaults status to DRAFT', () => {
    const statusPath = PurchaseOrderSchema.path('status') as unknown as {
      defaultValue: unknown;
    };
    expect(statusPath.defaultValue).toBe('DRAFT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npm run test -- purchase-order.schema`
Expected: FAIL — cannot find module `./purchase-order.schema`.

- [ ] **Step 3: Create the schema**

Create `apps/api/src/purchasing/schemas/purchase-order.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PurchaseOrderDocument = HydratedDocument<PurchaseOrder>;

@Schema({ _id: false })
export class PurchaseOrderItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
  })
  ingredientId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  orderedQuantity!: number;

  @Prop({ required: true, min: 0, default: 0 })
  receivedQuantity!: number;

  @Prop({ required: true })
  unit!: string;

  @Prop({ required: true, min: 0 })
  unitCost!: number;
}

export const PurchaseOrderItemSchema =
  SchemaFactory.createForClass(PurchaseOrderItem);

export const PURCHASE_ORDER_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

/**
 * A Supplier order for ingredients (plan.md §30). Only receive() moves inventory, and it
 * always lands in the reserved WAREHOUSE zone (plan.md §22 Rules 1/5; see ZonesService).
 */
@Schema({ timestamps: true, collection: 'purchaseOrders' })
export class PurchaseOrder {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Supplier',
    required: true,
    index: true,
  })
  supplierId!: Types.ObjectId;

  @Prop({ type: String, enum: PURCHASE_ORDER_STATUSES, default: 'DRAFT', index: true })
  status!: PurchaseOrderStatus;

  @Prop({ type: [PurchaseOrderItemSchema], required: true })
  items!: PurchaseOrderItem[];

  /** Always resolved server-side to the WAREHOUSE zone id, never client-supplied. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Zone', required: true })
  deliveryZoneId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  approvedBy!: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  rejectedBy!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  rejectionReason!: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  cancelledBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  approvedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: String, default: null })
  remark!: string | null;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);
PurchaseOrderSchema.index({ supplierId: 1, createdAt: -1 });
PurchaseOrderSchema.index({ status: 1, createdAt: -1 });
```

Note the `status` prop passes `type: String` alongside `enum: PURCHASE_ORDER_STATUSES` — see the Global Constraints entry on `isolatedModules`/`ts-jest`/`@nestjs/mongoose`: without it, importing this schema under Jest throws `Cannot determine a type for the "PurchaseOrder.status" field`, since `PurchaseOrderStatus` is a string-literal union and `ts-jest` cannot resolve it through `isolatedModules`. This is required for Step 4 below to pass, not optional polish.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npm run test -- purchase-order.schema`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/api && git add src/purchasing/schemas/purchase-order.schema.ts src/purchasing/schemas/purchase-order.schema.spec.ts
git commit -m "feat(api): add PurchaseOrder schema"
```

---

## Task 3: PurchasingService — create() and code generation

**Files:**
- Create: `apps/api/src/purchasing/dto/create-purchase-order.dto.ts`
- Create: `apps/api/src/purchasing/purchasing.service.ts`
- Test: `apps/api/src/purchasing/purchasing.service.spec.ts`

**Interfaces:**
- Consumes: `PurchaseOrder`/`PurchaseOrderDocument` (Task 2), `IngredientsService.findByIdWithUnit(id): Promise<IngredientWithUnit>` (existing, `apps/api/src/ingredients/ingredients.service.ts:44`), `ZonesService.getWarehouseZoneId(): Promise<string>` (existing, `apps/api/src/zones/zones.service.ts:72`).
- Produces: `PurchasingService.create(dto, userId): Promise<PurchaseOrder>`, `FindPurchaseOrdersFilter` interface, `PurchasingService.findAll(filter)`, `PurchasingService.findById(id)` — consumed by Task 6's controller and later service tasks (which add more methods to this same class).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/purchasing/purchasing.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { ZonesService } from '../zones/zones.service';
import { PurchasingService } from './purchasing.service';
import { PurchaseOrder } from './schemas/purchase-order.schema';

describe('PurchasingService', () => {
  let service: PurchasingService;
  let purchaseOrderModel: {
    create: jest.Mock;
    countDocuments: jest.Mock;
    findById: jest.Mock;
  };
  let ingredientsService: { findByIdWithUnit: jest.Mock };
  let inventoryService: { withTransaction: jest.Mock; increment: jest.Mock };
  let zonesService: { getWarehouseZoneId: jest.Mock };

  const ingredientId = new Types.ObjectId().toString();
  const supplierId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const warehouseZoneId = new Types.ObjectId().toString();

  beforeEach(async () => {
    purchaseOrderModel = {
      create: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
      findById: jest.fn(),
    };
    ingredientsService = {
      findByIdWithUnit: jest.fn().mockResolvedValue({
        _id: ingredientId,
        baseUnitId: { code: 'kg' },
        defaultCost: 50,
      }),
    };
    inventoryService = {
      withTransaction: jest.fn((fn: (session: unknown) => Promise<unknown>) =>
        fn({}),
      ),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    zonesService = {
      getWarehouseZoneId: jest.fn().mockResolvedValue(warehouseZoneId),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasingService,
        {
          provide: getModelToken(PurchaseOrder.name),
          useValue: purchaseOrderModel,
        },
        { provide: IngredientsService, useValue: ingredientsService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: ZonesService, useValue: zonesService },
      ],
    }).compile();

    service = module.get(PurchasingService);
  });

  describe('create', () => {
    it('generates a PO-{year}-{seq} code, snapshots the ingredient unit, and delivers to the warehouse zone', async () => {
      const created = { toObject: () => ({ code: 'PO-mock' }) };
      purchaseOrderModel.create.mockResolvedValue(created);

      await service.create(
        {
          supplierId,
          items: [{ ingredientId, orderedQuantity: 10, unitCost: 42 }],
        },
        userId,
      );

      const year = new Date().getFullYear();
      expect(purchaseOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: `PO-${year}-0001`,
          supplierId,
          status: 'DRAFT',
          deliveryZoneId: warehouseZoneId,
          createdBy: userId,
          items: [
            {
              ingredientId,
              orderedQuantity: 10,
              receivedQuantity: 0,
              unit: 'kg',
              unitCost: 42,
            },
          ],
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npm run test -- purchasing.service`
Expected: FAIL — cannot find module `./purchasing.service` (and `./dto/create-purchase-order.dto`).

- [ ] **Step 3: Create the DTO**

Create `apps/api/src/purchasing/dto/create-purchase-order.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  orderedQuantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsMongoId()
  supplierId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];

  @IsOptional()
  @IsString()
  remark?: string;
}
```

- [ ] **Step 4: Create the service**

Create `apps/api/src/purchasing/purchasing.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { ZonesService } from '../zones/zones.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import {
  PurchaseOrder,
  PurchaseOrderDocument,
  PurchaseOrderStatus,
} from './schemas/purchase-order.schema';

export interface FindPurchaseOrdersFilter {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

const MAX_CODE_RETRIES = 5;

@Injectable()
export class PurchasingService {
  constructor(
    @InjectModel(PurchaseOrder.name)
    private readonly purchaseOrderModel: Model<PurchaseOrderDocument>,
    private readonly ingredientsService: IngredientsService,
    private readonly inventoryService: InventoryService,
    private readonly zonesService: ZonesService,
  ) {}

  findAll(filter: FindPurchaseOrdersFilter): Promise<PurchaseOrder[]> {
    const query: QueryFilter<PurchaseOrderDocument> = {};
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.supplierId) {
      query.supplierId = filter.supplierId;
    }
    const createdAt = buildDateRangeQuery(filter.dateFrom, filter.dateTo);
    if (createdAt) {
      query.createdAt = createdAt;
    }
    return this.purchaseOrderModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filter.limit ?? 200)
      .lean();
  }

  async findById(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrderModel.findById(id).lean();
    if (!purchaseOrder) {
      throw new NotFoundException('ไม่พบใบสั่งซื้อนี้');
    }
    return purchaseOrder;
  }

  async create(
    dto: CreatePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrder> {
    const warehouseZoneId = await this.zonesService.getWarehouseZoneId();
    const items = await Promise.all(
      dto.items.map(async (item) => {
        const ingredient = await this.ingredientsService.findByIdWithUnit(
          item.ingredientId,
        );
        return {
          ingredientId: item.ingredientId,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: 0,
          unit: ingredient.baseUnitId.code,
          unitCost: item.unitCost,
        };
      }),
    );

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt += 1) {
      const code = await this.generateCode();
      try {
        const created = await this.purchaseOrderModel.create({
          code,
          supplierId: dto.supplierId,
          status: 'DRAFT',
          items,
          deliveryZoneId: warehouseZoneId,
          createdBy: userId,
          remark: dto.remark ?? null,
        });
        return created.toObject();
      } catch (error) {
        if (!isDuplicateKeyError(error) || attempt === MAX_CODE_RETRIES - 1) {
          throw error;
        }
      }
    }
    throw new ConflictException(
      'ไม่สามารถสร้างเลขที่ใบสั่งซื้อได้ กรุณาลองใหม่',
    );
  }

  private async getMutableOrThrow(
    id: string,
  ): Promise<PurchaseOrderDocument> {
    const purchaseOrder = await this.purchaseOrderModel.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('ไม่พบใบสั่งซื้อนี้');
    }
    return purchaseOrder;
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.purchaseOrderModel.countDocuments({
      code: new RegExp(`^PO-${year}-`),
    });
    return `PO-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
```

`getMutableOrThrow` is `private`, matching `RequisitionsService`'s identical helper — other methods added to this same class in Tasks 4 and 5 can still call it, since `private` only restricts access from outside the class. `BadRequestException` is imported but unused until Task 4; the backend `tsconfig.base.json` has no `noUnusedLocals`/`noUnusedParameters`, so this does not fail `npm run test` or `npm run build` in the interim — it is expected and resolved when Task 4 adds the first method that throws it.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npm run test -- purchasing.service`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd apps/api && git add src/purchasing/dto/create-purchase-order.dto.ts src/purchasing/purchasing.service.ts src/purchasing/purchasing.service.spec.ts
git commit -m "feat(api): add PurchasingService.create with PO code generation"
```

---

## Task 4: PurchasingService — submit/approve/reject/cancel

**Files:**
- Create: `apps/api/src/purchasing/dto/reject-purchase-order.dto.ts`
- Modify: `apps/api/src/purchasing/purchasing.service.ts`
- Modify: `apps/api/src/purchasing/purchasing.service.spec.ts`

**Interfaces:**
- Consumes: `PurchasingService.getMutableOrThrow(id)` (Task 3, now used for the first time).
- Produces: `PurchasingService.submit(id)`, `.approve(id, userId)`, `.reject(id, dto, userId)`, `.cancel(id, userId)` — consumed by Task 6's controller.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/purchasing/purchasing.service.spec.ts`, inside the existing `describe('PurchasingService', ...)` block, after the `describe('create', ...)` block:

```ts
  describe('status transitions', () => {
    function mutableDoc(overrides: Record<string, unknown>) {
      const doc: Record<string, unknown> = {
        status: 'DRAFT',
        items: [],
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
      };
      doc.toObject = jest.fn(() => ({ status: doc.status, items: doc.items }));
      return doc;
    }

    it('rejects approve when the PO is not PENDING', async () => {
      purchaseOrderModel.findById.mockResolvedValue(
        mutableDoc({ status: 'DRAFT' }),
      );
      await expect(service.approve('po-1', userId)).rejects.toThrow(
        'ใบสั่งซื้อนี้ไม่อยู่ในสถานะรออนุมัติ',
      );
    });

    it('rejects reject() when the PO is not PENDING', async () => {
      purchaseOrderModel.findById.mockResolvedValue(
        mutableDoc({ status: 'APPROVED' }),
      );
      await expect(
        service.reject('po-1', { rejectionReason: 'สินค้าราคาสูงเกินไป' }, userId),
      ).rejects.toThrow('ใบสั่งซื้อนี้ไม่อยู่ในสถานะรออนุมัติ');
    });

    it('rejects cancel once the PO has already been approved', async () => {
      purchaseOrderModel.findById.mockResolvedValue(
        mutableDoc({ status: 'APPROVED' }),
      );
      await expect(service.cancel('po-1', userId)).rejects.toThrow(
        'ไม่สามารถยกเลิกใบสั่งซื้อที่อนุมัติแล้วได้',
      );
    });

    it('moves a DRAFT PO to PENDING on submit', async () => {
      const doc = mutableDoc({ status: 'DRAFT' });
      purchaseOrderModel.findById.mockResolvedValue(doc);
      await service.submit('po-1');
      expect(doc.status).toBe('PENDING');
      expect(doc.save).toHaveBeenCalled();
    });

    it('records approvedBy/approvedAt and moves PENDING to APPROVED', async () => {
      const doc = mutableDoc({ status: 'PENDING' });
      purchaseOrderModel.findById.mockResolvedValue(doc);
      await service.approve('po-1', userId);
      expect(doc.status).toBe('APPROVED');
      expect(doc.approvedBy).toEqual(new Types.ObjectId(userId));
      expect(doc.approvedAt).toBeInstanceOf(Date);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npm run test -- purchasing.service`
Expected: FAIL — `service.submit is not a function` (and similarly for `approve`/`reject`/`cancel`), and `RejectPurchaseOrderDto` import missing once added in the next step.

- [ ] **Step 3: Create the reject DTO**

Create `apps/api/src/purchasing/dto/reject-purchase-order.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';

export class RejectPurchaseOrderDto {
  @IsString()
  @MinLength(1)
  rejectionReason!: string;
}
```

- [ ] **Step 4: Add the status-transition methods**

In `apps/api/src/purchasing/purchasing.service.ts`:

Change the existing `import { QueryFilter, Model } from 'mongoose';` line to also import `Types`:

```ts
import { QueryFilter, Model, Types } from 'mongoose';
```

And add a new import line for the DTO:

```ts
import { RejectPurchaseOrderDto } from './dto/reject-purchase-order.dto';
```

Add these methods to the `PurchasingService` class, directly after `create()` and before `getMutableOrThrow`:

```ts
  async submit(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getMutableOrThrow(id);
    if (purchaseOrder.status !== 'DRAFT') {
      throw new BadRequestException('ใบสั่งซื้อนี้ไม่อยู่ในสถานะร่าง');
    }
    purchaseOrder.status = 'PENDING';
    await purchaseOrder.save();
    return purchaseOrder.toObject();
  }

  async approve(id: string, userId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getMutableOrThrow(id);
    if (purchaseOrder.status !== 'PENDING') {
      throw new BadRequestException('ใบสั่งซื้อนี้ไม่อยู่ในสถานะรออนุมัติ');
    }
    purchaseOrder.status = 'APPROVED';
    purchaseOrder.approvedBy = new Types.ObjectId(userId);
    purchaseOrder.approvedAt = new Date();
    await purchaseOrder.save();
    return purchaseOrder.toObject();
  }

  async reject(
    id: string,
    dto: RejectPurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getMutableOrThrow(id);
    if (purchaseOrder.status !== 'PENDING') {
      throw new BadRequestException('ใบสั่งซื้อนี้ไม่อยู่ในสถานะรออนุมัติ');
    }
    purchaseOrder.status = 'REJECTED';
    purchaseOrder.rejectedBy = new Types.ObjectId(userId);
    purchaseOrder.rejectionReason = dto.rejectionReason;
    await purchaseOrder.save();
    return purchaseOrder.toObject();
  }

  async cancel(id: string, userId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getMutableOrThrow(id);
    if (!['DRAFT', 'PENDING'].includes(purchaseOrder.status)) {
      throw new BadRequestException(
        'ไม่สามารถยกเลิกใบสั่งซื้อที่อนุมัติแล้วได้',
      );
    }
    purchaseOrder.status = 'CANCELLED';
    purchaseOrder.cancelledBy = new Types.ObjectId(userId);
    await purchaseOrder.save();
    return purchaseOrder.toObject();
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npm run test -- purchasing.service`
Expected: PASS (all tests in the file, including Task 3's).

- [ ] **Step 6: Commit**

```bash
cd apps/api && git add src/purchasing/dto/reject-purchase-order.dto.ts src/purchasing/purchasing.service.ts src/purchasing/purchasing.service.spec.ts
git commit -m "feat(api): add PurchasingService submit/approve/reject/cancel"
```

---

## Task 5: PurchasingService — receive() with partial receiving

**Files:**
- Create: `apps/api/src/purchasing/dto/receive-purchase-order.dto.ts`
- Modify: `apps/api/src/purchasing/purchasing.service.ts`
- Modify: `apps/api/src/purchasing/purchasing.service.spec.ts`

**Interfaces:**
- Consumes: `InventoryService.withTransaction(fn)` and `InventoryService.increment(input, session)` (existing, `apps/api/src/inventory/inventory.service.ts:171` and `:214`), `ZonesService.getWarehouseZoneId()`.
- Produces: `PurchasingService.receive(id, dto, userId): Promise<PurchaseOrder>` — consumed by Task 6's controller.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/purchasing/purchasing.service.spec.ts`, after the `describe('status transitions', ...)` block:

```ts
  describe('receive', () => {
    it('rejects receive when the PO is not APPROVED or PARTIALLY_RECEIVED', async () => {
      const doc: Record<string, unknown> = {
        status: 'PENDING',
        items: [],
        save: jest.fn(),
      };
      doc.toObject = jest.fn(() => doc);
      purchaseOrderModel.findById.mockResolvedValue(doc);

      await expect(
        service.receive('po-1', { items: [] }, userId),
      ).rejects.toThrow('ใบสั่งซื้อนี้ไม่อยู่ในสถานะที่สามารถรับสินค้าได้');
    });

    it('accumulates receivedQuantity across two partial receives and reaches RECEIVED on the second', async () => {
      const doc: Record<string, unknown> = {
        status: 'APPROVED',
        items: [
          {
            ingredientId,
            orderedQuantity: 10,
            receivedQuantity: 0,
            unit: 'kg',
            unitCost: 42,
          },
        ],
        save: jest.fn().mockResolvedValue(undefined),
      };
      doc.toObject = jest.fn(() => ({ status: doc.status, items: doc.items }));
      purchaseOrderModel.findById.mockResolvedValue(doc);

      await service.receive(
        'po-1',
        { items: [{ ingredientId, quantity: 6 }] },
        userId,
      );
      const items = doc.items as Array<{ receivedQuantity: number }>;
      expect(items[0].receivedQuantity).toBe(6);
      expect(doc.status).toBe('PARTIALLY_RECEIVED');

      await service.receive('po-1', { items: [{ ingredientId }] }, userId);
      expect(items[0].receivedQuantity).toBe(10);
      expect(doc.status).toBe('RECEIVED');
      expect(inventoryService.increment).toHaveBeenCalledTimes(2);
      expect(inventoryService.increment).toHaveBeenLastCalledWith(
        expect.objectContaining({
          ingredientId,
          zoneId: warehouseZoneId,
          quantity: 4,
          movementType: 'STOCK_IN',
          referenceType: 'PURCHASE_ORDER',
          referenceId: 'po-1',
        }),
        expect.anything(),
      );
    });

    it('rejects a receive quantity exceeding the remaining amount', async () => {
      const doc: Record<string, unknown> = {
        status: 'APPROVED',
        items: [
          {
            ingredientId,
            orderedQuantity: 10,
            receivedQuantity: 8,
            unit: 'kg',
            unitCost: 42,
          },
        ],
        save: jest.fn(),
      };
      doc.toObject = jest.fn(() => doc);
      purchaseOrderModel.findById.mockResolvedValue(doc);

      await expect(
        service.receive(
          'po-1',
          { items: [{ ingredientId, quantity: 5 }] },
          userId,
        ),
      ).rejects.toThrow(/เหลือ 2/);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npm run test -- purchasing.service`
Expected: FAIL — `service.receive is not a function`.

- [ ] **Step 3: Create the receive DTO**

Create `apps/api/src/purchasing/dto/receive-purchase-order.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export class ReceivePurchaseOrderItemDto {
  @IsMongoId()
  ingredientId!: string;

  /** Omit to receive the full remaining (orderedQuantity - receivedQuantity) for this line. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity?: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  items!: ReceivePurchaseOrderItemDto[];
}
```

- [ ] **Step 4: Add receive() to the service**

In `apps/api/src/purchasing/purchasing.service.ts`, add the import:

```ts
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
```

Add this method after `cancel()` and before `getMutableOrThrow`:

```ts
  /**
   * Increments happen inside one InventoryService transaction; the PO's own receivedQuantity/
   * status update happens in a separate save() afterwards -- same two-step pattern as
   * RequisitionsService.fulfill(), which keeps the transaction callback free of state mutated
   * via closure (a session.withTransaction retry would otherwise double-apply that mutation).
   */
  async receive(
    id: string,
    dto: ReceivePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getMutableOrThrow(id);
    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status)) {
      throw new BadRequestException(
        'ใบสั่งซื้อนี้ไม่อยู่ในสถานะที่สามารถรับสินค้าได้',
      );
    }

    const receivedItems: Array<{
      ingredientId: string;
      quantity: number;
      unit: string;
      unitCost: number;
    }> = [];
    for (const receiveItem of dto.items) {
      const item = purchaseOrder.items.find(
        (i) => i.ingredientId.toString() === receiveItem.ingredientId,
      );
      if (!item) {
        throw new BadRequestException('พบวัตถุดิบที่ไม่อยู่ในใบสั่งซื้อนี้');
      }
      const remaining = item.orderedQuantity - item.receivedQuantity;
      const quantity = receiveItem.quantity ?? remaining;
      if (quantity <= 0 || quantity > remaining) {
        throw new BadRequestException(
          `จำนวนที่รับต้องมากกว่า 0 และไม่เกินจำนวนที่เหลือของรายการนี้ (เหลือ ${remaining})`,
        );
      }
      receivedItems.push({
        ingredientId: item.ingredientId.toString(),
        quantity,
        unit: item.unit,
        unitCost: item.unitCost,
      });
    }

    const warehouseZoneId = await this.zonesService.getWarehouseZoneId();
    await this.inventoryService.withTransaction(async (session) => {
      for (const item of receivedItems) {
        await this.inventoryService.increment(
          {
            ingredientId: item.ingredientId,
            zoneId: warehouseZoneId,
            quantity: item.quantity,
            unit: item.unit,
            movementType: 'STOCK_IN',
            referenceType: 'PURCHASE_ORDER',
            referenceId: id,
            unitCost: item.unitCost,
            performedBy: userId,
          },
          session,
        );
      }
    });

    receivedItems.forEach((receivedItem) => {
      const item = purchaseOrder.items.find(
        (i) => i.ingredientId.toString() === receivedItem.ingredientId,
      );
      if (item) {
        item.receivedQuantity += receivedItem.quantity;
      }
    });

    const allReceived = purchaseOrder.items.every(
      (item) => item.receivedQuantity >= item.orderedQuantity,
    );
    purchaseOrder.status = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    if (allReceived) {
      purchaseOrder.completedAt = new Date();
    }
    await purchaseOrder.save();
    return purchaseOrder.toObject();
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npm run test -- purchasing.service`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Commit**

```bash
cd apps/api && git add src/purchasing/dto/receive-purchase-order.dto.ts src/purchasing/purchasing.service.ts src/purchasing/purchasing.service.spec.ts
git commit -m "feat(api): add PurchasingService.receive with partial-receive support"
```

---

## Task 6: PurchasingController + PurchasingModule + app wiring

**Files:**
- Create: `apps/api/src/purchasing/purchasing.controller.ts`
- Create: `apps/api/src/purchasing/purchasing.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/common/constants/permissions.ts`

**Interfaces:**
- Consumes: every `PurchasingService` method from Tasks 3–5; `PERMISSION_CODES.PURCHASING_READ/CREATE/APPROVE/RECEIVE` (already defined in `apps/api/src/common/constants/permissions.ts:57-60`); `RequirePermission` decorator (`apps/api/src/common/decorators/require-permission.decorator.ts`); `CurrentUser` decorator; `RequestUser` type (`apps/api/src/common/types/authenticated-request.ts`).
- Produces: `GET/POST /purchasing`, `GET /purchasing/:id`, `PATCH /purchasing/:id/{submit,approve,reject,receive,cancel}` HTTP routes — consumed by the frontend endpoint file in Task 8.

There is no dedicated test file for this task (no controller in this codebase has one — see `requisitions.controller.ts`, `transfers.controller.ts`). Verification is the Nest build succeeding, which catches wiring/type errors.

- [ ] **Step 1: Create the controller**

Create `apps/api/src/purchasing/purchasing.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { RejectPurchaseOrderDto } from './dto/reject-purchase-order.dto';
import { PurchasingService } from './purchasing.service';
import {
  PURCHASE_ORDER_STATUSES,
  PurchaseOrder,
  PurchaseOrderStatus,
} from './schemas/purchase-order.schema';

@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @RequirePermission(PERMISSION_CODES.PURCHASING_READ)
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<PurchaseOrder[]> {
    const resolvedStatus = (
      PURCHASE_ORDER_STATUSES as readonly string[]
    ).includes(status ?? '')
      ? (status as PurchaseOrderStatus)
      : undefined;
    return this.purchasingService.findAll({
      status: resolvedStatus,
      supplierId,
      dateFrom,
      dateTo,
    });
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<PurchaseOrder> {
    return this.purchasingService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_CREATE)
  @Post()
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.create(dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_CREATE)
  @Patch(':id/submit')
  submit(@Param('id') id: string): Promise<PurchaseOrder> {
    return this.purchasingService.submit(id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_APPROVE)
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.approve(id, user.id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_APPROVE)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectPurchaseOrderDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.reject(id, dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_RECEIVE)
  @Patch(':id/receive')
  receive(
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.receive(id, dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_CREATE)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.cancel(id, user.id);
  }
}
```

- [ ] **Step 2: Create the module**

Create `apps/api/src/purchasing/purchasing.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ZonesModule } from '../zones/zones.module';
import {
  PurchaseOrder,
  PurchaseOrderSchema,
} from './schemas/purchase-order.schema';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
    ]),
    IngredientsModule,
    InventoryModule,
    ZonesModule,
  ],
  controllers: [PurchasingController],
  providers: [PurchasingService],
  exports: [PurchasingService],
})
export class PurchasingModule {}
```

- [ ] **Step 3: Wire into AppModule**

In `apps/api/src/app.module.ts`, add the import alongside the other feature modules:

```ts
import { PurchasingModule } from './purchasing/purchasing.module';
```

And add `PurchasingModule` to the `imports` array, after `RequisitionsModule` and before `StockCountsModule` (matching the existing declaration order):

```ts
    RequisitionsModule,
    PurchasingModule,
    StockCountsModule,
```

- [ ] **Step 4: Give the Purchasing permissions real descriptions**

In `apps/api/src/common/constants/permissions.ts`, the `PERMISSION_REGISTRY` entries for the `PURCHASING` module (around lines 319–342) currently all say `description: 'Reserved for P1 Purchasing module'`. Now that the module exists, replace each with a real description matching the convention used for `REQUISITION_*` entries:

```ts
  {
    code: PERMISSION_CODES.PURCHASING_READ,
    name: 'ดูการจัดซื้อ',
    module: 'PURCHASING',
    description: 'Allows user to view purchase orders',
  },
  {
    code: PERMISSION_CODES.PURCHASING_CREATE,
    name: 'สร้างใบสั่งซื้อ',
    module: 'PURCHASING',
    description: 'Allows user to create, submit, and cancel purchase orders',
  },
  {
    code: PERMISSION_CODES.PURCHASING_APPROVE,
    name: 'อนุมัติใบสั่งซื้อ',
    module: 'PURCHASING',
    description: 'Allows user to approve or reject purchase orders',
  },
  {
    code: PERMISSION_CODES.PURCHASING_RECEIVE,
    name: 'รับสินค้าตามใบสั่งซื้อ',
    module: 'PURCHASING',
    description: 'Allows user to receive goods against an approved purchase order',
  },
```

- [ ] **Step 5: Verify the backend builds and all tests still pass**

Run: `cd apps/api && npm run build`
Expected: builds with no TypeScript errors.

Run: `cd apps/api && npm run test`
Expected: all suites (including Tasks 1–5's) PASS.

- [ ] **Step 6: Commit**

```bash
cd apps/api && git add src/purchasing/purchasing.controller.ts src/purchasing/purchasing.module.ts src/app.module.ts src/common/constants/permissions.ts
git commit -m "feat(api): wire up the Purchasing controller, module, and permission descriptions"
```

---

## Task 7: Frontend types, permissions, and labels

**Files:**
- Modify: `apps/web/src/types/entities.ts`
- Modify: `apps/web/src/constants/permissions.ts`
- Modify: `apps/web/src/constants/labels.ts`

**Interfaces:**
- Produces: `PURCHASE_ORDER_STATUSES`, `PurchaseOrderStatus`, `PurchaseOrderItem`, `PurchaseOrder` types; `PERMISSIONS.PURCHASING_READ/CREATE/APPROVE/RECEIVE`; `PURCHASE_ORDER_STATUS_LABEL`, `PURCHASE_ORDER_STATUS_COLOR` — consumed by every remaining frontend task.

No dedicated test runner exists for `apps/web` (no vitest/jest configured — only `oxlint` and `tsc -b && vite build`). Verification is the TypeScript build succeeding.

- [ ] **Step 1: Add PurchaseOrder types**

In `apps/web/src/types/entities.ts`, add at the end of the file (after the `DashboardSummary` interface):

```ts
export const PURCHASE_ORDER_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'REJECTED',
  'CANCELLED',
] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

export interface PurchaseOrderItem {
  ingredientId: string
  orderedQuantity: number
  receivedQuantity: number
  unit: string
  unitCost: number
}

export interface PurchaseOrder {
  _id: string
  code: string
  supplierId: string
  status: PurchaseOrderStatus
  items: PurchaseOrderItem[]
  deliveryZoneId: string
  createdBy: string
  approvedBy: string | null
  rejectedBy: string | null
  rejectionReason: string | null
  cancelledBy: string | null
  approvedAt: string | null
  completedAt: string | null
  remark: string | null
  createdAt: string
}
```

- [ ] **Step 2: Add the permission codes**

In `apps/web/src/constants/permissions.ts`, insert after the `STOCK_COUNT_APPROVE` line and before the `USERS_READ` block:

```ts
  PURCHASING_READ: 'purchasing.read',
  PURCHASING_CREATE: 'purchasing.create',
  PURCHASING_APPROVE: 'purchasing.approve',
  PURCHASING_RECEIVE: 'purchasing.receive',
```

- [ ] **Step 3: Add the status labels**

In `apps/web/src/constants/labels.ts`, update the top import line to include `PurchaseOrderStatus`:

```ts
import type {
  MovementType,
  PurchaseOrderStatus,
  RequisitionStatus,
  StockCountStatus,
  TransferStatus,
  ZoneType,
  UnitType,
} from '@/types/entities'
```

Add, after the `REQUISITION_STATUS_COLOR` block:

```ts
export const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'ร่าง',
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  PARTIALLY_RECEIVED: 'รับสินค้าบางส่วน',
  RECEIVED: 'รับสินค้าครบแล้ว',
  REJECTED: 'ปฏิเสธ',
  CANCELLED: 'ยกเลิก',
}

export const PURCHASE_ORDER_STATUS_COLOR: Record<PurchaseOrderStatus, 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  DRAFT: 'gray',
  PENDING: 'warning',
  APPROVED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'gray',
}
```

- [ ] **Step 4: Verify the frontend builds**

Run: `cd apps/web && npm run build`
Expected: builds with no TypeScript errors (nothing consumes these new exports yet, so this only checks the new code itself is well-typed).

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add src/types/entities.ts src/constants/permissions.ts src/constants/labels.ts
git commit -m "feat(web): add PurchaseOrder types, permissions, and status labels"
```

---

## Task 8: Frontend purchasing API endpoint

**Files:**
- Create: `apps/web/src/api/endpoints/purchasing.ts`

**Interfaces:**
- Consumes: `axiosClient` (`apps/web/src/api/axiosClient.ts`), `PurchaseOrder`/`PurchaseOrderStatus` (Task 7).
- Produces: `purchasingApi.{list,get,create,submit,approve,reject,receive,cancel}` — consumed by Tasks 9–11.

- [ ] **Step 1: Create the endpoint file**

Create `apps/web/src/api/endpoints/purchasing.ts`:

```ts
import { axiosClient } from '../axiosClient'
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/entities'

export interface CreatePurchaseOrderPayload {
  supplierId: string
  items: Array<{ ingredientId: string; orderedQuantity: number; unitCost: number }>
  remark?: string
}

export interface ReceivePurchaseOrderPayload {
  items: Array<{ ingredientId: string; quantity?: number }>
}

export interface PurchaseOrdersFilter {
  status?: PurchaseOrderStatus
  supplierId?: string
  dateFrom?: string
  dateTo?: string
}

export const purchasingApi = {
  list: (filter?: PurchaseOrdersFilter) =>
    axiosClient.get<PurchaseOrder[]>('/purchasing', { params: filter }).then((r) => r.data),
  get: (id: string) => axiosClient.get<PurchaseOrder>(`/purchasing/${id}`).then((response) => response.data),
  create: (payload: CreatePurchaseOrderPayload) =>
    axiosClient.post<PurchaseOrder>('/purchasing', payload).then((response) => response.data),
  submit: (id: string) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/submit`, {}).then((response) => response.data),
  approve: (id: string) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/approve`, {}).then((response) => response.data),
  reject: (id: string, rejectionReason: string) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/reject`, { rejectionReason }).then((response) => response.data),
  receive: (id: string, payload: ReceivePurchaseOrderPayload) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/receive`, payload).then((response) => response.data),
  cancel: (id: string) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/cancel`, {}).then((response) => response.data),
}
```

- [ ] **Step 2: Verify the frontend builds**

Run: `cd apps/web && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd apps/web && git add src/api/endpoints/purchasing.ts
git commit -m "feat(web): add purchasing API endpoint"
```

---

## Task 9: PurchaseOrdersListPage

**Files:**
- Create: `apps/web/src/pages/purchasing/PurchaseOrdersListPage.tsx`

**Interfaces:**
- Consumes: `purchasingApi` (Task 8), `suppliersApi` (existing, `apps/web/src/api/endpoints/suppliers.ts`), `DataTable`/`Badge`/`Button`/`Select`/`DateRangeFilter` components, `usePermission` hook, `PERMISSIONS.PURCHASING_CREATE`, `PURCHASE_ORDER_STATUS_LABEL`/`_COLOR` (Task 7).
- Produces: `PurchaseOrdersListPage` component — consumed by Task 12's router.

- [ ] **Step 1: Create the page**

Create `apps/web/src/pages/purchasing/PurchaseOrdersListPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { purchasingApi } from '@/api/endpoints/purchasing'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { PURCHASE_ORDER_STATUS_COLOR, PURCHASE_ORDER_STATUS_LABEL } from '@/constants/labels'
import { formatDateTime } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import { PURCHASE_ORDER_STATUSES, type PurchaseOrder, type PurchaseOrderStatus } from '@/types/entities'

export function PurchaseOrdersListPage() {
  const canCreate = usePermission(PERMISSIONS.PURCHASING_CREATE)
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['purchasing', statusFilter, dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      purchasingApi.list({
        status: statusFilter || undefined,
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const supplierMap = useMemo(() => new Map((suppliers ?? []).map((s) => [s._id, s.name])), [suppliers])

  const columns: Array<DataTableColumn<PurchaseOrder>> = [
    {
      key: 'code',
      header: 'เลขที่',
      render: (row) => (
        <Link to={`/purchasing/${row._id}`} className="font-medium text-primary hover:underline">
          {row.code}
        </Link>
      ),
    },
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'supplier', header: 'Supplier', render: (row) => supplierMap.get(row.supplierId) ?? '-' },
    { key: 'items', header: 'จำนวนรายการ', render: (row) => row.items.length },
    {
      key: 'status',
      header: 'สถานะ',
      render: (row) => <Badge color={PURCHASE_ORDER_STATUS_COLOR[row.status]}>{PURCHASE_ORDER_STATUS_LABEL[row.status]}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">รายการใบสั่งซื้อ</h1>
          <p className="text-sm text-text-secondary">ใบสั่งซื้อวัตถุดิบทั้งหมดจาก Supplier</p>
        </div>
        {canCreate ? (
          <Link to="/purchasing/new">
            <Button>
              <Plus className="size-4" /> สร้างใบสั่งซื้อ
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="max-w-xs">
        <Select
          label="สถานะ"
          placeholder="ทุกสถานะ"
          options={PURCHASE_ORDER_STATUSES.map((status) => ({ value: status, label: PURCHASE_ORDER_STATUS_LABEL[status] }))}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as PurchaseOrderStatus | '')}
        />
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <DataTable
        columns={columns}
        rows={purchaseOrders ?? []}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        emptyMessage="ยังไม่มีใบสั่งซื้อ"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify the frontend builds**

Run: `cd apps/web && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd apps/web && git add src/pages/purchasing/PurchaseOrdersListPage.tsx
git commit -m "feat(web): add PurchaseOrdersListPage"
```

---

## Task 10: CreatePurchaseOrderPage

**Files:**
- Create: `apps/web/src/pages/purchasing/CreatePurchaseOrderPage.tsx`

**Interfaces:**
- Consumes: `purchasingApi.create` (Task 8), `suppliersApi.list`, `ingredientsApi.list` (existing), `Button`/`Input`/`Select`/`Card`/`CardBody` components, `useToast` hook, `getErrorMessage`.
- Produces: `CreatePurchaseOrderPage` component — consumed by Task 12's router.

- [ ] **Step 1: Create the page**

Create `apps/web/src/pages/purchasing/CreatePurchaseOrderPage.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { purchasingApi } from '@/api/endpoints/purchasing'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Card, CardBody } from '@/components/Card'
import { useToast } from '@/components/Toast'

const formSchema = z.object({
  supplierId: z.string().min(1, 'กรุณาเลือก Supplier'),
  remark: z.string().optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
        orderedQuantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
        unitCost: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
      }),
    )
    .min(1, 'กรุณาเพิ่มอย่างน้อย 1 รายการ'),
})
type FormValues = z.infer<typeof formSchema>

export function CreatePurchaseOrderPage() {
  const toast = useToast()
  const navigate = useNavigate()

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { supplierId: '', remark: '', items: [{ ingredientId: '', orderedQuantity: 0, unitCost: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const onSubmit = async (values: FormValues) => {
    try {
      const purchaseOrder = await purchasingApi.create(values)
      toast.show('success', `สร้างใบสั่งซื้อ ${purchaseOrder.code} สำเร็จ`)
      navigate(`/purchasing/${purchaseOrder._id}`)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">สร้างใบสั่งซื้อ</h1>
        <p className="text-sm text-text-secondary">สั่งซื้อวัตถุดิบจาก Supplier เพื่อรับเข้าคลังสินค้า</p>
      </div>

      <Card className="max-w-2xl">
        <CardBody>
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
            <Select
              label="Supplier"
              placeholder="เลือก Supplier"
              options={(suppliers ?? []).map((s) => ({ value: s._id, label: s.name }))}
              error={errors.supplierId?.message}
              {...register('supplierId')}
            />

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-text-primary">รายการวัตถุดิบ</p>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2 rounded-lg border border-border p-3">
                  <div className="flex-1">
                    <Select
                      label="วัตถุดิบ"
                      placeholder="เลือกวัตถุดิบ"
                      options={(ingredients ?? []).map((i) => ({ value: i._id, label: i.name }))}
                      error={errors.items?.[index]?.ingredientId?.message}
                      {...register(`items.${index}.ingredientId`)}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      label="จำนวนที่สั่งซื้อ"
                      type="number"
                      step="0.01"
                      error={errors.items?.[index]?.orderedQuantity?.message}
                      {...register(`items.${index}.orderedQuantity`)}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      label="ราคาต่อหน่วย"
                      type="number"
                      step="0.01"
                      error={errors.items?.[index]?.unitCost?.message}
                      {...register(`items.${index}.unitCost`)}
                    />
                  </div>
                  <button type="button" onClick={() => remove(index)} className="mb-2.5 p-2 text-danger" aria-label="ลบรายการ">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => append({ ingredientId: '', orderedQuantity: 0, unitCost: 0 })}>
                <Plus className="size-4" /> เพิ่มรายการ
              </Button>
            </div>

            <Input label="หมายเหตุ (ถ้ามี)" {...register('remark')} />

            <Button type="submit" isLoading={isSubmitting}>
              สร้างใบสั่งซื้อ
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify the frontend builds**

Run: `cd apps/web && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd apps/web && git add src/pages/purchasing/CreatePurchaseOrderPage.tsx
git commit -m "feat(web): add CreatePurchaseOrderPage"
```

---

## Task 11: PurchaseOrderDetailPage

**Files:**
- Create: `apps/web/src/pages/purchasing/PurchaseOrderDetailPage.tsx`

**Interfaces:**
- Consumes: `purchasingApi` (Task 8), `ingredientsApi.list`, `suppliersApi.list`, `Button`/`Input`/`Badge`/`Card`/`CardBody`/`CardHeader`/`Modal`/`ConfirmDialog`/`LoadingState` components, `usePermission`, `PERMISSIONS.PURCHASING_CREATE/APPROVE/RECEIVE`, `PURCHASE_ORDER_STATUS_LABEL`/`_COLOR`, `formatDateTime`/`formatQuantity`/`formatCurrency`.
- Produces: `PurchaseOrderDetailPage` component — consumed by Task 12's router.

- [ ] **Step 1: Create the page**

Create `apps/web/src/pages/purchasing/PurchaseOrderDetailPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { purchasingApi } from '@/api/endpoints/purchasing'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Badge } from '@/components/Badge'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LoadingState } from '@/components/LoadingState'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { PURCHASE_ORDER_STATUS_COLOR, PURCHASE_ORDER_STATUS_LABEL } from '@/constants/labels'
import { formatCurrency, formatDateTime, formatQuantity } from '@/utils/format'

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const canCreate = usePermission(PERMISSIONS.PURCHASING_CREATE)
  const canApprove = usePermission(PERMISSIONS.PURCHASING_APPROVE)
  const canReceive = usePermission(PERMISSIONS.PURCHASING_RECEIVE)

  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false)
  const [isConfirmingApprove, setIsConfirmingApprove] = useState(false)
  const [isConfirmingReceive, setIsConfirmingReceive] = useState(false)
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)
  const [isMutating, setIsMutating] = useState(false)

  const { data: purchaseOrder, isLoading } = useQuery({
    queryKey: ['purchasing', id],
    queryFn: () => purchasingApi.get(id as string),
    enabled: Boolean(id),
  })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })

  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i.name])), [ingredients])
  const supplierMap = useMemo(() => new Map((suppliers ?? []).map((s) => [s._id, s.name])), [suppliers])

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['purchasing'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
    ])

  const handleSubmitOrder = async () => {
    if (!purchaseOrder) return
    setIsMutating(true)
    try {
      await purchasingApi.submit(purchaseOrder._id)
      toast.show('success', 'ส่งใบสั่งซื้อเพื่อขออนุมัติสำเร็จ')
      await invalidate()
      setIsConfirmingSubmit(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleApprove = async () => {
    if (!purchaseOrder) return
    setIsMutating(true)
    try {
      await purchasingApi.approve(purchaseOrder._id)
      toast.show('success', 'อนุมัติใบสั่งซื้อสำเร็จ')
      await invalidate()
      setIsConfirmingApprove(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleReject = async () => {
    if (!purchaseOrder || !rejectionReason.trim()) return
    setIsMutating(true)
    try {
      await purchasingApi.reject(purchaseOrder._id, rejectionReason.trim())
      toast.show('success', 'ปฏิเสธใบสั่งซื้อสำเร็จ')
      await invalidate()
      setIsRejecting(false)
      setRejectionReason('')
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleReceive = async () => {
    if (!purchaseOrder) return
    const items = purchaseOrder.items
      .filter((item) => item.receivedQuantity < item.orderedQuantity)
      .map((item) => ({ ingredientId: item.ingredientId }))
    if (items.length === 0) {
      toast.show('info', 'ไม่มีรายการที่ต้องรับเพิ่ม')
      return
    }
    setIsMutating(true)
    try {
      await purchasingApi.receive(purchaseOrder._id, { items })
      toast.show('success', 'รับสินค้าตามใบสั่งซื้อสำเร็จ')
      await invalidate()
      setIsConfirmingReceive(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleCancel = async () => {
    if (!purchaseOrder) return
    setIsMutating(true)
    try {
      await purchasingApi.cancel(purchaseOrder._id)
      toast.show('success', 'ยกเลิกใบสั่งซื้อสำเร็จ')
      await invalidate()
      setIsConfirmingCancel(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  if (isLoading || !purchaseOrder) {
    return <LoadingState />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-text-primary">{purchaseOrder.code}</h1>
            <Badge color={PURCHASE_ORDER_STATUS_COLOR[purchaseOrder.status]}>{PURCHASE_ORDER_STATUS_LABEL[purchaseOrder.status]}</Badge>
          </div>
          <p className="text-sm text-text-secondary">
            {supplierMap.get(purchaseOrder.supplierId) ?? '-'} · {formatDateTime(purchaseOrder.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && purchaseOrder.status === 'DRAFT' ? (
            <Button onClick={() => setIsConfirmingSubmit(true)}>ส่งขออนุมัติ</Button>
          ) : null}
          {canApprove && purchaseOrder.status === 'PENDING' ? (
            <Button onClick={() => setIsConfirmingApprove(true)}>อนุมัติ</Button>
          ) : null}
          {canApprove && purchaseOrder.status === 'PENDING' ? (
            <Button variant="danger" onClick={() => setIsRejecting(true)}>
              ปฏิเสธ
            </Button>
          ) : null}
          {canReceive && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status) ? (
            <Button onClick={() => setIsConfirmingReceive(true)}>รับสินค้า</Button>
          ) : null}
          {canCreate && ['DRAFT', 'PENDING'].includes(purchaseOrder.status) ? (
            <Button variant="secondary" onClick={() => setIsConfirmingCancel(true)}>
              ยกเลิก
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => navigate('/purchasing')}>
            กลับ
          </Button>
        </div>
      </div>

      {purchaseOrder.status === 'REJECTED' && purchaseOrder.rejectionReason ? (
        <Card>
          <CardBody className="text-sm text-danger">เหตุผลที่ปฏิเสธ: {purchaseOrder.rejectionReason}</CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <span className="font-medium text-text-primary">รายการวัตถุดิบ</span>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="py-2 font-medium">วัตถุดิบ</th>
                <th className="py-2 font-medium">สั่งซื้อ</th>
                <th className="py-2 font-medium">รับแล้ว</th>
                <th className="py-2 font-medium">ราคาต่อหน่วย</th>
                <th className="py-2 font-medium">มูลค่ารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchaseOrder.items.map((item) => (
                <tr key={item.ingredientId}>
                  <td className="py-2">{ingredientMap.get(item.ingredientId) ?? '-'}</td>
                  <td className="py-2">{formatQuantity(item.orderedQuantity, item.unit)}</td>
                  <td className="py-2">{formatQuantity(item.receivedQuantity, item.unit)}</td>
                  <td className="py-2">{formatCurrency(item.unitCost)}</td>
                  <td className="py-2">{formatCurrency(item.unitCost * item.orderedQuantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <ConfirmDialog
        isOpen={isConfirmingSubmit}
        title="ส่งใบสั่งซื้อเพื่อขออนุมัติ"
        message={`ส่งใบสั่งซื้อ ${purchaseOrder.code} เพื่อขออนุมัติ?`}
        confirmLabel="ส่งขออนุมัติ"
        isLoading={isMutating}
        onConfirm={() => void handleSubmitOrder()}
        onCancel={() => setIsConfirmingSubmit(false)}
      />

      <ConfirmDialog
        isOpen={isConfirmingApprove}
        title="อนุมัติใบสั่งซื้อ"
        message={`อนุมัติใบสั่งซื้อ ${purchaseOrder.code}?`}
        confirmLabel="อนุมัติ"
        isLoading={isMutating}
        onConfirm={() => void handleApprove()}
        onCancel={() => setIsConfirmingApprove(false)}
      />

      <ConfirmDialog
        isOpen={isConfirmingReceive}
        title="รับสินค้าตามใบสั่งซื้อ"
        message={`รับสินค้าเข้าคลังสินค้าให้ครบตามจำนวนที่สั่งซื้อซึ่งยังไม่ได้รับสำหรับใบสั่งซื้อ ${purchaseOrder.code}?`}
        confirmLabel="ยืนยันการรับสินค้า"
        isLoading={isMutating}
        onConfirm={() => void handleReceive()}
        onCancel={() => setIsConfirmingReceive(false)}
      />

      <ConfirmDialog
        isOpen={isConfirmingCancel}
        title="ยกเลิกใบสั่งซื้อ"
        message={`ยืนยันการยกเลิกใบสั่งซื้อ ${purchaseOrder.code}?`}
        confirmLabel="ยกเลิกใบสั่งซื้อ"
        danger
        isLoading={isMutating}
        onConfirm={() => void handleCancel()}
        onCancel={() => setIsConfirmingCancel(false)}
      />

      <Modal isOpen={isRejecting} onClose={() => setIsRejecting(false)} title="ปฏิเสธใบสั่งซื้อ">
        <div className="flex flex-col gap-4">
          <Input label="เหตุผลที่ปฏิเสธ" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
          <Button variant="danger" isLoading={isMutating} disabled={!rejectionReason.trim()} onClick={() => void handleReject()}>
            ยืนยันการปฏิเสธ
          </Button>
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 2: Verify the frontend builds**

Run: `cd apps/web && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd apps/web && git add src/pages/purchasing/PurchaseOrderDetailPage.tsx
git commit -m "feat(web): add PurchaseOrderDetailPage"
```

---

## Task 12: Router and navigation wiring

**Files:**
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/constants/nav.ts`

**Interfaces:**
- Consumes: `PurchaseOrdersListPage`, `CreatePurchaseOrderPage`, `PurchaseOrderDetailPage` (Tasks 9–11); `PERMISSIONS.PURCHASING_READ/CREATE` (Task 7).
- Produces: `/purchasing`, `/purchasing/new`, `/purchasing/:id` routes reachable from the sidebar.

- [ ] **Step 1: Add routes**

In `apps/web/src/app/router.tsx`, add the imports after the requisitions page imports:

```ts
import { PurchaseOrdersListPage } from '@/pages/purchasing/PurchaseOrdersListPage'
import { CreatePurchaseOrderPage } from '@/pages/purchasing/CreatePurchaseOrderPage'
import { PurchaseOrderDetailPage } from '@/pages/purchasing/PurchaseOrderDetailPage'
```

Add the routes after the requisitions `<Route>` blocks and before the master-data routes:

```tsx
      <Route element={<ProtectedRoute permission={PERMISSIONS.PURCHASING_READ} />}>
        <Route path="/purchasing" element={<PurchaseOrdersListPage />} />
        <Route path="/purchasing/:id" element={<PurchaseOrderDetailPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.PURCHASING_CREATE} />}>
        <Route path="/purchasing/new" element={<CreatePurchaseOrderPage />} />
      </Route>
```

- [ ] **Step 2: Add the sidebar nav group**

In `apps/web/src/constants/nav.ts`, add `ShoppingCart` to the `lucide-react` import list:

```ts
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
  ShoppingCart,
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
```

Add a new group to `NAV_GROUPS`, after the `'ใบเบิกสินค้า'` group and before `'ข้อมูลพื้นฐาน'` (matching plan.md §74's nav order):

```ts
  {
    label: 'จัดซื้อ',
    icon: ShoppingCart,
    items: [
      { label: 'ใบสั่งซื้อ', path: '/purchasing', permission: PERMISSIONS.PURCHASING_READ, icon: ListChecks },
      { label: 'สร้างใบสั่งซื้อ', path: '/purchasing/new', permission: PERMISSIONS.PURCHASING_CREATE, icon: FilePlus },
    ],
  },
```

- [ ] **Step 3: Verify the frontend builds**

Run: `cd apps/web && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd apps/web && git add src/app/router.tsx src/constants/nav.ts
git commit -m "feat(web): wire Purchasing routes and sidebar navigation"
```

---

## Task 13: Manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full backend test suite**

Run: `cd apps/api && npm run test`
Expected: all suites PASS, including every Purchasing spec from Tasks 1–5.

- [ ] **Step 2: Run lint on both workspaces**

Run: `npm run lint` (from repo root)
Expected: no errors.

- [ ] **Step 3: Start both dev servers**

Run: `npm run dev:api` (background) and `npm run dev:web` (background) from the repo root.

- [ ] **Step 4: Smoke-test the full lifecycle in the browser**

Log in as the seeded `manager` demo user (or `owner`, see `apps/api/.env.example` / `SEED_DEMO_DATA=true`), then in the browser:
1. Open "จัดซื้อ" → "สร้างใบสั่งซื้อ", pick a Supplier and an ingredient, submit — confirm redirect to the new PO's detail page in `DRAFT` status.
2. Click "ส่งขออนุมัติ" — confirm status becomes `PENDING`.
3. Click "อนุมัติ" — confirm status becomes `APPROVED`.
4. Click "รับสินค้า" and confirm — confirm status becomes `RECEIVED`, and check "สต๊อกคงเหลือ" (`/inventory/balances`) shows the increased quantity in the WAREHOUSE zone, and "ประวัติการเคลื่อนไหว" (`/inventory/movements`) shows a new `STOCK_IN` row.
5. Create a second PO, submit, approve, then receive only part of one line's quantity via the API (or verify the "receive full remaining" UX is acceptable as designed) — confirm status becomes `PARTIALLY_RECEIVED`, then receive again to confirm it reaches `RECEIVED`.
6. Log in as `kitchen` (no `purchasing.*` permissions) — confirm "จัดซื้อ" does not appear in the sidebar and `/purchasing` redirects away.

If any step fails, fix the underlying task before proceeding — do not report this plan complete until the full lifecycle works end-to-end in the browser.

- [ ] **Step 5: Stop the dev servers**

Stop both background `npm run dev:api` / `npm run dev:web` processes once verification is complete.
