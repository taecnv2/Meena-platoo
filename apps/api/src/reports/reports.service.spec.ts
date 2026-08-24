import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Ingredient } from '../ingredients/schemas/ingredient.schema';
import { PurchaseOrder } from '../purchasing/schemas/purchase-order.schema';
import { Requisition } from '../requisitions/schemas/requisition.schema';
import { StockMovement } from '../stock-movements/schemas/stock-movement.schema';
import { Supplier } from '../suppliers/schemas/supplier.schema';
import { ZoneStock } from '../inventory/schemas/zone-stock.schema';
import { User } from '../users/schemas/user.schema';
import { Waste } from '../waste/schemas/waste.schema';
import { Zone } from '../zones/schemas/zone.schema';
import { ReportsService } from './reports.service';

/** Chainable query mock supporting .select()/.populate()/.sort() before a terminal .lean(). */
function queryMock<T>(result: T) {
  const q: {
    select: jest.Mock;
    populate: jest.Mock;
    sort: jest.Mock;
    lean: jest.Mock;
  } = {
    select: jest.fn(() => q),
    populate: jest.fn(() => q),
    sort: jest.fn(() => q),
    lean: jest.fn(() => Promise.resolve(result)),
  };
  return q;
}

describe('ReportsService', () => {
  let service: ReportsService;
  let zoneStockModel: { aggregate: jest.Mock };
  let ingredientModel: { find: jest.Mock };
  let zoneModel: { find: jest.Mock };
  let requisitionModel: { aggregate: jest.Mock };
  let stockMovementModel: { aggregate: jest.Mock };
  let userModel: { find: jest.Mock };
  let purchaseOrderModel: { aggregate: jest.Mock; find: jest.Mock };
  let supplierModel: { find: jest.Mock };
  let wasteModel: { aggregate: jest.Mock; countDocuments: jest.Mock };

  const ingredientId = new Types.ObjectId();
  const zoneId = new Types.ObjectId();
  const supplierId = new Types.ObjectId();

  beforeEach(async () => {
    zoneStockModel = { aggregate: jest.fn() };
    ingredientModel = { find: jest.fn(() => queryMock([])) };
    zoneModel = { find: jest.fn(() => queryMock([])) };
    requisitionModel = { aggregate: jest.fn() };
    stockMovementModel = { aggregate: jest.fn() };
    userModel = { find: jest.fn(() => queryMock([])) };
    purchaseOrderModel = {
      aggregate: jest.fn(),
      find: jest.fn(() => queryMock([])),
    };
    supplierModel = { find: jest.fn(() => queryMock([])) };
    wasteModel = {
      aggregate: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getModelToken(ZoneStock.name), useValue: zoneStockModel },
        { provide: getModelToken(Ingredient.name), useValue: ingredientModel },
        { provide: getModelToken(Zone.name), useValue: zoneModel },
        {
          provide: getModelToken(Requisition.name),
          useValue: requisitionModel,
        },
        {
          provide: getModelToken(StockMovement.name),
          useValue: stockMovementModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: getModelToken(PurchaseOrder.name),
          useValue: purchaseOrderModel,
        },
        { provide: getModelToken(Supplier.name), useValue: supplierModel },
        { provide: getModelToken(Waste.name), useValue: wasteModel },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  describe('getInventoryReport', () => {
    it('derives stockStatus at the OUT_OF_STOCK / LOW_STOCK / NORMAL boundaries', async () => {
      const outOfStockId = new Types.ObjectId();
      const lowStockId = new Types.ObjectId();
      const normalId = new Types.ObjectId();

      zoneStockModel.aggregate.mockResolvedValueOnce([
        { _id: lowStockId, quantity: 4, value: 40 },
        { _id: normalId, quantity: 10, value: 100 },
        // outOfStockId has no ZoneStock row at all -> defaults to 0
      ]);
      stockMovementModel.aggregate
        .mockResolvedValueOnce([{ _id: normalId, quantity: 5, value: 50 }]) // movement in
        .mockResolvedValueOnce([{ _id: lowStockId, quantity: 2, value: 20 }]); // movement out
      ingredientModel.find.mockReturnValueOnce(
        queryMock([
          {
            _id: outOfStockId,
            name: 'ของหมด',
            minimumStock: 5,
            maximumStock: 20,
            baseUnitId: { code: 'kg' },
          },
          {
            _id: lowStockId,
            name: 'ของใกล้หมด',
            minimumStock: 5,
            maximumStock: 20,
            baseUnitId: { code: 'kg' },
          },
          {
            _id: normalId,
            name: 'ของปกติ',
            minimumStock: 5,
            maximumStock: 20,
            baseUnitId: { code: 'kg' },
          },
        ]),
      );

      const rows = await service.getInventoryReport();

      expect(
        rows.find((r) => r.ingredientId === outOfStockId.toString())
          ?.stockStatus,
      ).toBe('OUT_OF_STOCK');
      expect(
        rows.find((r) => r.ingredientId === lowStockId.toString())?.stockStatus,
      ).toBe('LOW_STOCK');
      expect(
        rows.find((r) => r.ingredientId === normalId.toString())?.stockStatus,
      ).toBe('NORMAL');
      const normalRow = rows.find(
        (r) => r.ingredientId === normalId.toString(),
      );
      expect(normalRow?.totalQuantity).toBe(10);
      expect(normalRow?.movementInQuantity).toBe(5);
      const lowStockRow = rows.find(
        (r) => r.ingredientId === lowStockId.toString(),
      );
      expect(lowStockRow?.movementOutQuantity).toBe(2);
      expect(lowStockRow?.unit).toBe('kg');
    });
  });

  describe('getPurchaseReport', () => {
    it('sources ordered value from PurchaseOrder and received value from StockMovement', async () => {
      purchaseOrderModel.aggregate.mockResolvedValueOnce([
        {
          totals: [{ numberOfOrders: 2, totalOrderedValue: 1000 }],
          bySupplier: [{ _id: supplierId, count: 2, value: 1000 }],
          byIngredient: [{ _id: ingredientId, quantity: 20, value: 1000 }],
        },
      ]);
      stockMovementModel.aggregate
        .mockResolvedValueOnce([{ total: 600 }]) // received total (partial receive vs. ordered)
        .mockResolvedValueOnce([{ _id: '2026-08-20', value: 600 }]); // trend
      ingredientModel.find.mockReturnValueOnce(
        queryMock([{ _id: ingredientId, name: 'ปลาทู' }]),
      );
      supplierModel.find.mockReturnValueOnce(
        queryMock([{ _id: supplierId, name: 'ตลาดไท' }]),
      );

      const report = await service.getPurchaseReport();

      expect(report.totals).toEqual({
        numberOfOrders: 2,
        totalOrderedValue: 1000,
        totalReceivedValue: 600,
      });
      expect(report.bySupplier[0]).toEqual({
        supplierId: supplierId.toString(),
        supplierName: 'ตลาดไท',
        count: 2,
        value: 1000,
      });
      expect(report.byIngredient[0]).toEqual({
        ingredientId: ingredientId.toString(),
        ingredientName: 'ปลาทู',
        quantity: 20,
        value: 1000,
      });
      expect(report.trend).toEqual([{ date: '2026-08-20', value: 600 }]);
    });

    it("scopes received-value StockMovement query to the filtered supplier's own purchase orders", async () => {
      const ownOrderId = new Types.ObjectId();
      purchaseOrderModel.find.mockReturnValueOnce(
        queryMock([{ _id: ownOrderId }]),
      );
      purchaseOrderModel.aggregate.mockResolvedValueOnce([
        {
          totals: [{ numberOfOrders: 1, totalOrderedValue: 500 }],
          bySupplier: [],
          byIngredient: [],
        },
      ]);
      let capturedMovementPipeline: unknown;
      stockMovementModel.aggregate
        .mockImplementationOnce((pipeline: unknown) => {
          capturedMovementPipeline = pipeline;
          return Promise.resolve([{ total: 500 }]);
        })
        .mockResolvedValueOnce([]);
      ingredientModel.find.mockReturnValueOnce(queryMock([]));
      supplierModel.find.mockReturnValueOnce(queryMock([]));

      await service.getPurchaseReport(
        undefined,
        undefined,
        supplierId.toString(),
      );

      const [movementMatch] = capturedMovementPipeline as Array<{
        $match: { referenceId?: { $in: Types.ObjectId[] } };
      }>;
      expect(movementMatch.$match.referenceId).toEqual({ $in: [ownOrderId] });
    });
  });

  describe('getWasteReport', () => {
    it('counts only APPROVED waste toward totals, tracking PENDING_APPROVAL separately', async () => {
      let capturedWastePipeline: unknown;
      wasteModel.aggregate.mockImplementationOnce((pipeline: unknown) => {
        capturedWastePipeline = pipeline;
        return Promise.resolve([
          {
            totals: [{ numberOfRecords: 3, totalQuantity: 6, totalValue: 180 }],
            byReason: [{ _id: 'SPOILED', quantity: 6, value: 180 }],
            byZone: [{ _id: zoneId, quantity: 6, value: 180 }],
            byIngredient: [{ _id: ingredientId, quantity: 6, value: 180 }],
            trend: [{ _id: '2026-08-20', value: 180 }],
          },
        ]);
      });
      let capturedPendingMatch: unknown;
      wasteModel.countDocuments.mockImplementationOnce((match: unknown) => {
        capturedPendingMatch = match;
        return Promise.resolve(4);
      });
      ingredientModel.find.mockReturnValueOnce(
        queryMock([{ _id: ingredientId, name: 'หมู' }]),
      );
      zoneModel.find.mockReturnValueOnce(
        queryMock([{ _id: zoneId, name: 'Kitchen' }]),
      );

      const report = await service.getWasteReport();

      expect(report.totals).toEqual({
        numberOfRecords: 3,
        totalQuantity: 6,
        totalValue: 180,
        pendingCount: 4,
      });
      expect(report.byReason[0]).toEqual({
        reason: 'SPOILED',
        quantity: 6,
        value: 180,
      });
      expect(report.byZone[0]).toEqual({
        zoneId: zoneId.toString(),
        zoneName: 'Kitchen',
        quantity: 6,
        value: 180,
      });

      const [aggregateMatch] = capturedWastePipeline as Array<{
        $match: { status: string };
      }>;
      expect(aggregateMatch.$match.status).toBe('APPROVED');
      const pendingMatchArg = capturedPendingMatch as { status: string };
      expect(pendingMatchArg.status).toBe('PENDING_APPROVAL');
    });
  });

  describe('getCostReport', () => {
    it('aggregates only usage/waste/adjustment-out movement types', async () => {
      let capturedCostPipeline: unknown;
      stockMovementModel.aggregate.mockImplementationOnce(
        (pipeline: unknown) => {
          capturedCostPipeline = pipeline;
          return Promise.resolve([
            {
              total: [{ total: 500 }],
              byIngredient: [{ _id: ingredientId, cost: 300 }],
              byZone: [{ _id: zoneId, cost: 500 }],
              byMovementType: [
                { _id: 'STOCK_OUT', cost: 300 },
                { _id: 'WASTE', cost: 150 },
                { _id: 'ADJUSTMENT_OUT', cost: 50 },
              ],
              trend: [{ _id: '2026-08-20', cost: 500 }],
            },
          ]);
        },
      );
      ingredientModel.find.mockReturnValueOnce(
        queryMock([{ _id: ingredientId, name: 'ปลาทู' }]),
      );
      zoneModel.find.mockReturnValueOnce(
        queryMock([{ _id: zoneId, name: 'Kitchen' }]),
      );

      const report = await service.getCostReport();

      expect(report.totalCost).toBe(500);
      expect(report.byMovementType).toEqual([
        { movementType: 'STOCK_OUT', cost: 300 },
        { movementType: 'WASTE', cost: 150 },
        { movementType: 'ADJUSTMENT_OUT', cost: 50 },
      ]);

      const [match] = capturedCostPipeline as Array<{
        $match: { movementType: { $in: string[] } };
      }>;
      expect(match.$match.movementType.$in).toEqual([
        'STOCK_OUT',
        'WASTE',
        'ADJUSTMENT_OUT',
      ]);
    });
  });

  describe('getZoneReport (baseline)', () => {
    it('maps aggregated rows onto every zone, defaulting zones with no activity to zero', async () => {
      const emptyZoneId = new Types.ObjectId();
      zoneModel.find.mockReturnValueOnce(
        queryMock([
          { _id: zoneId, name: 'Kitchen' },
          { _id: emptyZoneId, name: 'Front of House' },
        ]),
      );
      zoneStockModel.aggregate.mockResolvedValueOnce([
        { _id: zoneId, quantity: 10, value: 100 },
      ]);
      stockMovementModel.aggregate
        .mockResolvedValueOnce([{ _id: zoneId, quantity: 2, value: 20 }]) // usage
        .mockResolvedValueOnce([{ _id: zoneId, count: 1 }]) // transfersIn
        .mockResolvedValueOnce([]); // transfersOut
      requisitionModel.aggregate.mockResolvedValueOnce([
        { _id: zoneId, count: 1, value: 50 },
      ]);

      const rows = await service.getZoneReport();

      expect(rows).toHaveLength(2);
      const kitchenRow = rows.find((r) => r.zoneId === zoneId.toString());
      expect(kitchenRow).toMatchObject({
        stockQuantity: 10,
        stockValue: 100,
        transfersIn: 1,
        requisitionCount: 1,
      });
      const emptyRow = rows.find((r) => r.zoneId === emptyZoneId.toString());
      expect(emptyRow).toMatchObject({
        stockQuantity: 0,
        transfersIn: 0,
        requisitionCount: 0,
      });
    });
  });

  describe('getRequisitionReport (baseline)', () => {
    it('returns totals and top-requested ingredients from the facet result', async () => {
      requisitionModel.aggregate.mockResolvedValueOnce([
        {
          totals: [
            {
              numberOfRequests: 5,
              requestedItems: 8,
              totalRequestedValue: 400,
            },
          ],
          byIngredient: [{ _id: ingredientId, quantity: 10, value: 400 }],
          byZone: [{ _id: zoneId, count: 5, value: 400 }],
          byUser: [],
          trend: [],
        },
      ]);
      ingredientModel.find.mockReturnValueOnce(
        queryMock([{ _id: ingredientId, name: 'ปลาทู' }]),
      );
      zoneModel.find.mockReturnValueOnce(
        queryMock([{ _id: zoneId, name: 'Kitchen' }]),
      );
      userModel.find.mockReturnValueOnce(queryMock([]));

      const report = await service.getRequisitionReport();

      expect(report.numberOfRequests).toBe(5);
      expect(report.totalRequestedValue).toBe(400);
      expect(report.topRequestedIngredients[0]).toEqual({
        ingredientId: ingredientId.toString(),
        ingredientName: 'ปลาทู',
        quantity: 10,
        value: 400,
      });
    });
  });

  describe('getComparisonReport (baseline)', () => {
    it('computes percentageChange as 0 when both periods are zero', async () => {
      stockMovementModel.aggregate
        .mockResolvedValueOnce([
          {
            purchase: [],
            stockUsage: [],
            waste: [],
            transfer: [],
            adjustment: [],
            cost: [],
            stockValueChange: [],
          },
        ])
        .mockResolvedValueOnce([
          {
            purchase: [],
            stockUsage: [],
            waste: [],
            transfer: [],
            adjustment: [],
            cost: [],
            stockValueChange: [],
          },
        ]);
      requisitionModel.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const report = await service.getComparisonReport(
        'THIS_MONTH_VS_LAST_MONTH',
      );

      expect(
        report.metrics.every(
          (m) => m.currentValue === 0 && m.previousValue === 0,
        ),
      ).toBe(true);
      expect(report.metrics.every((m) => m.percentageChange === 0)).toBe(true);
    });
  });
});
