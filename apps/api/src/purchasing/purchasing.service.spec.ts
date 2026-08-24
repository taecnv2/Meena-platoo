import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
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
  let auditLogsService: { log: jest.Mock };
  let notificationsService: { create: jest.Mock };

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
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

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
        { provide: AuditLogsService, useValue: auditLogsService },
        { provide: NotificationsService, useValue: notificationsService },
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

    it('throws ConflictException with Thai message after exhausting all retries on duplicate key errors', async () => {
      purchaseOrderModel.create.mockRejectedValue({ code: 11000 });

      await expect(
        service.create(
          {
            supplierId,
            items: [{ ingredientId, orderedQuantity: 10, unitCost: 42 }],
          },
          userId,
        ),
      ).rejects.toThrow(
        new ConflictException('ไม่สามารถสร้างเลขที่ใบสั่งซื้อได้ กรุณาลองใหม่'),
      );

      expect(purchaseOrderModel.create).toHaveBeenCalledTimes(5);
    });
  });

  describe('status transitions', () => {
    function mutableDoc(overrides: Record<string, unknown>) {
      const doc: Record<string, unknown> = {
        _id: new Types.ObjectId(),
        code: 'PO-mock',
        status: 'DRAFT',
        items: [],
        createdBy: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
      };
      doc.toObject = jest.fn(() => ({
        _id: doc._id,
        code: doc.code,
        status: doc.status,
        items: doc.items,
        createdBy: doc.createdBy,
        rejectionReason: doc.rejectionReason ?? null,
      }));
      return doc;
    }

    it('rejects submit when the PO is not DRAFT', async () => {
      purchaseOrderModel.findById.mockResolvedValue(
        mutableDoc({ status: 'PENDING' }),
      );
      await expect(service.submit('po-1')).rejects.toThrow(
        'ใบสั่งซื้อนี้ไม่อยู่ในสถานะร่าง',
      );
    });

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
        service.reject(
          'po-1',
          { rejectionReason: 'สินค้าราคาสูงเกินไป' },
          userId,
        ),
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

    it('records rejectedBy/rejectionReason and moves PENDING to REJECTED', async () => {
      const doc = mutableDoc({ status: 'PENDING' });
      purchaseOrderModel.findById.mockResolvedValue(doc);
      await service.reject(
        'po-1',
        { rejectionReason: 'สินค้าราคาสูงเกินไป' },
        userId,
      );
      expect(doc.status).toBe('REJECTED');
      expect(doc.rejectedBy).toEqual(new Types.ObjectId(userId));
      expect(doc.rejectionReason).toBe('สินค้าราคาสูงเกินไป');
    });

    it('records cancelledBy and moves PENDING to CANCELLED', async () => {
      const doc = mutableDoc({ status: 'PENDING' });
      purchaseOrderModel.findById.mockResolvedValue(doc);
      await service.cancel('po-1', userId);
      expect(doc.status).toBe('CANCELLED');
      expect(doc.cancelledBy).toEqual(new Types.ObjectId(userId));
    });
  });

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
});
