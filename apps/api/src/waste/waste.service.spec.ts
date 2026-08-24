import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WasteService } from './waste.service';
import { Waste } from './schemas/waste.schema';

describe('WasteService', () => {
  let service: WasteService;
  let wasteModel: {
    create: jest.Mock;
    countDocuments: jest.Mock;
    findById: jest.Mock;
  };
  let ingredientsService: { findByIdWithUnit: jest.Mock };
  let inventoryService: { withTransaction: jest.Mock; decrement: jest.Mock };
  let auditLogsService: { log: jest.Mock };
  let notificationsService: { create: jest.Mock };

  const ingredientId = new Types.ObjectId().toString();
  const zoneId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    wasteModel = {
      create: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
      findById: jest.fn(),
    };
    ingredientsService = {
      findByIdWithUnit: jest.fn().mockResolvedValue({
        _id: ingredientId,
        baseUnitId: { code: 'kg' },
        defaultCost: 30,
      }),
    };
    inventoryService = {
      withTransaction: jest.fn((fn: (session: unknown) => Promise<unknown>) =>
        fn({}),
      ),
      decrement: jest.fn().mockResolvedValue(undefined),
    };
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WasteService,
        { provide: getModelToken(Waste.name), useValue: wasteModel },
        { provide: IngredientsService, useValue: ingredientsService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: AuditLogsService, useValue: auditLogsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(WasteService);
  });

  describe('create', () => {
    it('generates a WS-{year}-{seq} code, snapshots the ingredient unit/cost, and leaves stock untouched', async () => {
      const wasteId = new Types.ObjectId();
      const created = {
        toObject: () => ({
          _id: wasteId,
          code: 'WS-mock',
          zoneId,
          ingredientId,
          quantity: 2,
          reason: 'SPOILED',
        }),
      };
      wasteModel.create.mockResolvedValue(created);

      await service.create(
        {
          zoneId,
          ingredientId,
          quantity: 2,
          reason: 'SPOILED',
          remark: 'เน่าเสีย',
        },
        userId,
      );

      const year = new Date().getFullYear();
      expect(wasteModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: `WS-${year}-0001`,
          zoneId,
          ingredientId,
          quantity: 2,
          unit: 'kg',
          reason: 'SPOILED',
          unitCost: 30,
          status: 'PENDING_APPROVAL',
          reportedBy: userId,
          remark: 'เน่าเสีย',
        }),
      );
      expect(inventoryService.decrement).not.toHaveBeenCalled();
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          action: 'WASTE_CREATED',
          entity: 'Waste',
          entityId: wasteId.toString(),
        }),
      );
    });

    it('throws ConflictException with Thai message after exhausting all retries on duplicate key errors', async () => {
      wasteModel.create.mockRejectedValue({ code: 11000 });

      await expect(
        service.create(
          { zoneId, ingredientId, quantity: 2, reason: 'SPOILED' },
          userId,
        ),
      ).rejects.toThrow(
        new ConflictException(
          'ไม่สามารถสร้างเลขที่รายการของเสียได้ กรุณาลองใหม่',
        ),
      );
      expect(wasteModel.create).toHaveBeenCalledTimes(5);
    });
  });

  describe('status transitions', () => {
    function mutableDoc(overrides: Record<string, unknown>) {
      const doc: Record<string, unknown> = {
        _id: new Types.ObjectId(),
        code: 'WS-mock',
        status: 'PENDING_APPROVAL',
        zoneId,
        ingredientId,
        quantity: 2,
        unit: 'kg',
        unitCost: 30,
        reason: 'SPOILED',
        remark: null,
        reportedBy: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
      };
      doc.toObject = jest.fn(() => ({
        _id: doc._id,
        code: doc.code,
        status: doc.status,
        reportedBy: doc.reportedBy,
        rejectionReason: doc.rejectionReason ?? null,
      }));
      return doc;
    }

    it('rejects approve when the waste record is not PENDING_APPROVAL', async () => {
      wasteModel.findById.mockResolvedValue(mutableDoc({ status: 'APPROVED' }));
      await expect(service.approve('w-1', userId)).rejects.toThrow(
        'รายการของเสียนี้ไม่อยู่ในสถานะรออนุมัติ',
      );
    });

    it('rejects reject() when the waste record is not PENDING_APPROVAL', async () => {
      wasteModel.findById.mockResolvedValue(mutableDoc({ status: 'REJECTED' }));
      await expect(
        service.reject('w-1', { rejectionReason: 'ข้อมูลไม่ถูกต้อง' }, userId),
      ).rejects.toThrow('รายการของเสียนี้ไม่อยู่ในสถานะรออนุมัติ');
    });

    it('decrements stock and moves PENDING_APPROVAL to APPROVED on approve', async () => {
      const doc = mutableDoc({ status: 'PENDING_APPROVAL' });
      wasteModel.findById.mockResolvedValue(doc);

      await service.approve('w-1', userId);

      expect(inventoryService.decrement).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientId,
          zoneId,
          quantity: 2,
          unit: 'kg',
          movementType: 'WASTE',
          referenceType: 'WASTE',
          unitCost: 30,
          performedBy: userId,
        }),
        expect.anything(),
      );
      expect(doc.status).toBe('APPROVED');
      expect(doc.approvedBy).toEqual(new Types.ObjectId(userId));
      expect(doc.approvedAt).toBeInstanceOf(Date);
    });

    it('propagates ConflictException from insufficient stock without changing status', async () => {
      inventoryService.decrement.mockRejectedValue(
        new ConflictException('สต๊อกไม่เพียงพอ'),
      );
      const doc = mutableDoc({ status: 'PENDING_APPROVAL' });
      wasteModel.findById.mockResolvedValue(doc);

      await expect(service.approve('w-1', userId)).rejects.toThrow(
        'สต๊อกไม่เพียงพอ',
      );
      expect(doc.status).toBe('PENDING_APPROVAL');
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('records rejectedBy/rejectionReason and moves PENDING_APPROVAL to REJECTED', async () => {
      const doc = mutableDoc({ status: 'PENDING_APPROVAL' });
      wasteModel.findById.mockResolvedValue(doc);

      await service.reject(
        'w-1',
        { rejectionReason: 'ข้อมูลไม่ถูกต้อง' },
        userId,
      );

      expect(doc.status).toBe('REJECTED');
      expect(doc.rejectedBy).toEqual(new Types.ObjectId(userId));
      expect(doc.rejectionReason).toBe('ข้อมูลไม่ถูกต้อง');
    });
  });
});
