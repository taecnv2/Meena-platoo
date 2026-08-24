import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Ingredient } from '../ingredients/schemas/ingredient.schema';
import { Requisition } from '../requisitions/schemas/requisition.schema';
import { ZoneStock } from '../inventory/schemas/zone-stock.schema';
import { Transfer } from '../transfers/schemas/transfer.schema';
import { StockCount } from '../stock-counts/schemas/stock-count.schema';
import { StockMovement } from '../stock-movements/schemas/stock-movement.schema';
import { Waste } from '../waste/schemas/waste.schema';
import { PurchaseOrder } from '../purchasing/schemas/purchase-order.schema';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let zoneStockModel: { aggregate: jest.Mock };
  let ingredientModel: { aggregate: jest.Mock };
  let requisitionModel: { countDocuments: jest.Mock; aggregate: jest.Mock };
  let transferModel: { countDocuments: jest.Mock };
  let stockCountModel: { aggregate: jest.Mock };
  let stockMovementModel: { aggregate: jest.Mock };
  let wasteModel: { countDocuments: jest.Mock };
  let purchaseOrderModel: { countDocuments: jest.Mock };

  beforeEach(async () => {
    zoneStockModel = {
      aggregate: jest.fn().mockResolvedValue([{ totalValue: 0 }]),
    };
    ingredientModel = { aggregate: jest.fn().mockResolvedValue([]) };
    requisitionModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    transferModel = { countDocuments: jest.fn().mockResolvedValue(0) };
    stockCountModel = { aggregate: jest.fn().mockResolvedValue([]) };
    stockMovementModel = { aggregate: jest.fn().mockResolvedValue([]) };
    wasteModel = { countDocuments: jest.fn().mockResolvedValue(0) };
    purchaseOrderModel = { countDocuments: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(ZoneStock.name), useValue: zoneStockModel },
        { provide: getModelToken(Ingredient.name), useValue: ingredientModel },
        {
          provide: getModelToken(Requisition.name),
          useValue: requisitionModel,
        },
        { provide: getModelToken(Transfer.name), useValue: transferModel },
        { provide: getModelToken(StockCount.name), useValue: stockCountModel },
        {
          provide: getModelToken(StockMovement.name),
          useValue: stockMovementModel,
        },
        { provide: getModelToken(Waste.name), useValue: wasteModel },
        {
          provide: getModelToken(PurchaseOrder.name),
          useValue: purchaseOrderModel,
        },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('counts low/out-of-stock ingredients at the <=0 and <=minimumStock boundaries', async () => {
    zoneStockModel.aggregate.mockResolvedValueOnce([{ totalValue: 1000 }]);
    ingredientModel.aggregate.mockResolvedValueOnce([
      { minimumStock: 5, totalQuantity: 0 }, // out of stock
      { minimumStock: 5, totalQuantity: 5 }, // low stock (at the boundary)
      { minimumStock: 5, totalQuantity: 10 }, // normal
    ]);

    const summary = await service.getOwnerSummary();

    expect(summary.inventory).toEqual({
      stockValue: 1000,
      lowStockCount: 1,
      outOfStockCount: 1,
    });
  });

  it('returns a null topRequestingZone when there is no requisition activity in range', async () => {
    requisitionModel.aggregate.mockResolvedValueOnce([]);

    const summary = await service.getOwnerSummary();

    expect(summary.requisition.topRequestingZone).toBeNull();
  });

  it('maps the top requesting zone from the aggregate result', async () => {
    const zoneId = new Types.ObjectId().toString();
    requisitionModel.aggregate.mockResolvedValueOnce([
      { zoneId, zoneName: 'Kitchen', count: 4 },
    ]);

    const summary = await service.getOwnerSummary();

    expect(summary.requisition.topRequestingZone).toEqual({
      zoneId,
      zoneName: 'Kitchen',
      count: 4,
    });
  });

  it('sums pendingApprovals across requisitions, purchase orders, and waste', async () => {
    requisitionModel.countDocuments.mockImplementation(
      (filter?: Record<string, unknown>) =>
        Promise.resolve(filter?.status === 'PENDING' ? 3 : 0),
    );
    purchaseOrderModel.countDocuments.mockResolvedValueOnce(2);
    wasteModel.countDocuments.mockResolvedValueOnce(1);

    const summary = await service.getOwnerSummary();

    expect(summary.operations.pendingApprovals).toBe(6);
  });

  it('reports a 100% purchasing changePercent when last month had zero spend', async () => {
    stockMovementModel.aggregate
      .mockResolvedValueOnce([{ total: 50 }]) // purchasing: today
      .mockResolvedValueOnce([{ total: 500 }]) // purchasing: thisMonth
      .mockResolvedValueOnce([]); // purchasing: lastMonthElapsed -> 0

    const summary = await service.getOwnerSummary();

    expect(summary.purchasing).toEqual({
      today: 50,
      thisMonth: 500,
      changePercent: 100,
    });
  });

  it('reports a 0% waste changePercent when both periods had zero waste cost', async () => {
    const summary = await service.getOwnerSummary();

    expect(summary.waste).toEqual({ today: 0, thisMonth: 0, changePercent: 0 });
  });

  it('maps stock count status aggregate rows into a status->count record', async () => {
    stockCountModel.aggregate.mockResolvedValueOnce([
      { _id: 'PENDING_APPROVAL', count: 2 },
      { _id: 'APPROVED', count: 5 },
    ]);

    const summary = await service.getOwnerSummary();

    expect(summary.operations.stockCountStatus).toEqual({
      PENDING_APPROVAL: 2,
      APPROVED: 5,
    });
  });
});
