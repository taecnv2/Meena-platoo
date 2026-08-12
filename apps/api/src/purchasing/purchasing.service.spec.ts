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
