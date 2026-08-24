import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransfersService } from '../transfers/transfers.service';
import { ZonesService } from '../zones/zones.service';
import { RequisitionsService } from './requisitions.service';
import { Requisition } from './schemas/requisition.schema';

describe('RequisitionsService', () => {
  let service: RequisitionsService;
  let requisitionModel: {
    create: jest.Mock;
    findById: jest.Mock;
    countDocuments: jest.Mock;
  };
  let ingredientsService: { findByIdWithUnit: jest.Mock };
  let transfersService: { executeTransfer: jest.Mock };
  let zonesService: { getWarehouseZoneId: jest.Mock };
  let auditLogsService: { log: jest.Mock };
  let notificationsService: { create: jest.Mock };

  const warehouseZoneId = new Types.ObjectId().toString();
  const toZoneId = new Types.ObjectId().toString();
  const ingredientId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  function buildRequisitionDoc(overrides: Record<string, unknown> = {}) {
    const doc: Record<string, unknown> & {
      save: jest.Mock;
      toObject: jest.Mock;
    } = {
      _id: new Types.ObjectId(),
      code: 'REQ-2026-0001',
      fromZoneId: new Types.ObjectId(warehouseZoneId),
      toZoneId: new Types.ObjectId(toZoneId),
      status: 'PENDING',
      items: [
        {
          ingredientId: new Types.ObjectId(ingredientId),
          requestedQuantity: 10,
          approvedQuantity: 0,
          fulfilledQuantity: 0,
          unit: 'kg',
          unitCost: 30,
        },
      ],
      requestedBy: new Types.ObjectId(userId),
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn(),
      ...overrides,
    };
    doc.toObject.mockImplementation(() => ({ ...doc }));
    return doc;
  }

  beforeEach(async () => {
    requisitionModel = {
      create: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
    };
    ingredientsService = {
      findByIdWithUnit: jest.fn().mockResolvedValue({
        _id: ingredientId,
        defaultCost: 30,
        baseUnitId: { code: 'kg' },
      }),
    };
    transfersService = {
      executeTransfer: jest.fn().mockResolvedValue(undefined),
    };
    zonesService = {
      getWarehouseZoneId: jest.fn().mockResolvedValue(warehouseZoneId),
    };
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequisitionsService,
        {
          provide: getModelToken(Requisition.name),
          useValue: requisitionModel,
        },
        { provide: IngredientsService, useValue: ingredientsService },
        { provide: TransfersService, useValue: transfersService },
        { provide: ZonesService, useValue: zonesService },
        { provide: AuditLogsService, useValue: auditLogsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(RequisitionsService);
  });

  describe('create', () => {
    it('rejects when fromZoneId is not the reserved WAREHOUSE zone', async () => {
      await expect(
        service.create(
          {
            fromZoneId: toZoneId,
            toZoneId,
            items: [{ ingredientId, requestedQuantity: 5 }],
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(requisitionModel.create).not.toHaveBeenCalled();
    });

    it('snapshots ingredient unit/cost and creates with zeroed approved/fulfilled quantities', async () => {
      const created = buildRequisitionDoc();
      requisitionModel.create.mockResolvedValueOnce(created);

      await service.create(
        {
          fromZoneId: warehouseZoneId,
          toZoneId,
          items: [{ ingredientId, requestedQuantity: 5 }],
        },
        userId,
      );

      expect(requisitionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING',
          requestedBy: userId,
          items: [
            expect.objectContaining({
              ingredientId,
              requestedQuantity: 5,
              approvedQuantity: 0,
              fulfilledQuantity: 0,
              unit: 'kg',
              unitCost: 30,
            }),
          ],
        }),
      );
    });

    it('throws ConflictException after exhausting all code-generation retries on duplicate key', async () => {
      requisitionModel.create.mockRejectedValue({ code: 11000 });

      await expect(
        service.create(
          {
            fromZoneId: warehouseZoneId,
            toZoneId,
            items: [{ ingredientId, requestedQuantity: 5 }],
          },
          userId,
        ),
      ).rejects.toThrow(ConflictException);
      expect(requisitionModel.create).toHaveBeenCalledTimes(5);
    });
  });

  describe('approve', () => {
    it('rejects when the requisition is not PENDING', async () => {
      requisitionModel.findById.mockResolvedValueOnce(
        buildRequisitionDoc({ status: 'APPROVED' }),
      );

      await expect(service.approve('id', {}, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('applies per-item approvedQuantity overrides, defaulting to requestedQuantity, and notifies the requester', async () => {
      const doc = buildRequisitionDoc();
      requisitionModel.findById.mockResolvedValueOnce(doc);

      const result = await service.approve(
        'id',
        { items: [{ ingredientId, approvedQuantity: 7 }] },
        userId,
      );

      expect(result.status).toBe('APPROVED');
      expect(
        (result.items[0] as { approvedQuantity: number }).approvedQuantity,
      ).toBe(7);
      expect(doc.save).toHaveBeenCalled();
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REQUISITION_APPROVED' }),
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId, type: 'REQUISITION_APPROVED' }),
      );
    });

    it('defaults approvedQuantity to requestedQuantity when no override is given', async () => {
      const doc = buildRequisitionDoc();
      requisitionModel.findById.mockResolvedValueOnce(doc);

      const result = await service.approve('id', {}, userId);

      expect(
        (result.items[0] as { approvedQuantity: number }).approvedQuantity,
      ).toBe(10);
    });
  });

  describe('reject', () => {
    it('rejects when the requisition is not PENDING', async () => {
      requisitionModel.findById.mockResolvedValueOnce(
        buildRequisitionDoc({ status: 'APPROVED' }),
      );

      await expect(
        service.reject('id', { rejectionReason: 'ของหมด' }, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets status to REJECTED and notifies the requester', async () => {
      const doc = buildRequisitionDoc();
      requisitionModel.findById.mockResolvedValueOnce(doc);

      const result = await service.reject(
        'id',
        { rejectionReason: 'ของหมด' },
        userId,
      );

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('ของหมด');
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'REQUISITION_REJECTED' }),
      );
    });
  });

  describe('cancel', () => {
    it('rejects cancelling a requisition that has already been fulfilled', async () => {
      requisitionModel.findById.mockResolvedValueOnce(
        buildRequisitionDoc({ status: 'FULFILLED' }),
      );

      await expect(service.cancel('id', userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows cancelling a PENDING requisition', async () => {
      const doc = buildRequisitionDoc();
      requisitionModel.findById.mockResolvedValueOnce(doc);

      const result = await service.cancel('id', userId);

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('fulfill', () => {
    it('rejects when the requisition is not APPROVED or PARTIALLY_FULFILLED', async () => {
      requisitionModel.findById.mockResolvedValueOnce(
        buildRequisitionDoc({ status: 'PENDING' }),
      );

      await expect(
        service.fulfill(
          'id',
          { items: [{ ingredientId, quantity: 1 }] },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(transfersService.executeTransfer).not.toHaveBeenCalled();
    });

    it('rejects fulfilling more than the remaining approved quantity', async () => {
      const doc = buildRequisitionDoc({
        status: 'APPROVED',
        items: [
          {
            ingredientId: new Types.ObjectId(ingredientId),
            requestedQuantity: 10,
            approvedQuantity: 10,
            fulfilledQuantity: 8,
            unit: 'kg',
            unitCost: 30,
          },
        ],
      });
      requisitionModel.findById.mockResolvedValueOnce(doc);

      await expect(
        service.fulfill(
          'id',
          { items: [{ ingredientId, quantity: 5 }] },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(transfersService.executeTransfer).not.toHaveBeenCalled();
    });

    it('executes the transfer and moves to PARTIALLY_FULFILLED when quantity remains', async () => {
      const doc = buildRequisitionDoc({
        status: 'APPROVED',
        items: [
          {
            ingredientId: new Types.ObjectId(ingredientId),
            requestedQuantity: 10,
            approvedQuantity: 10,
            fulfilledQuantity: 0,
            unit: 'kg',
            unitCost: 30,
          },
        ],
      });
      requisitionModel.findById.mockResolvedValueOnce(doc);

      const result = await service.fulfill(
        'id',
        { items: [{ ingredientId, quantity: 6 }] },
        userId,
      );

      expect(transfersService.executeTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          fromZoneId: warehouseZoneId,
          toZoneId,
          requisitionId: 'id',
          performedBy: userId,
        }),
      );
      expect(result.status).toBe('PARTIALLY_FULFILLED');
      expect(
        (result.items[0] as { fulfilledQuantity: number }).fulfilledQuantity,
      ).toBe(6);
      expect(result.fulfilledAt).toBeUndefined();
    });

    it('moves to FULFILLED and stamps fulfilledAt once every item is fully issued', async () => {
      const doc = buildRequisitionDoc({
        status: 'PARTIALLY_FULFILLED',
        items: [
          {
            ingredientId: new Types.ObjectId(ingredientId),
            requestedQuantity: 10,
            approvedQuantity: 10,
            fulfilledQuantity: 6,
            unit: 'kg',
            unitCost: 30,
          },
        ],
      });
      requisitionModel.findById.mockResolvedValueOnce(doc);

      const result = await service.fulfill(
        'id',
        { items: [{ ingredientId, quantity: 4 }] },
        userId,
      );

      expect(result.status).toBe('FULFILLED');
      expect(
        (result.items[0] as { fulfilledQuantity: number }).fulfilledQuantity,
      ).toBe(10);
      expect(result.fulfilledAt).toBeInstanceOf(Date);
    });
  });
});
